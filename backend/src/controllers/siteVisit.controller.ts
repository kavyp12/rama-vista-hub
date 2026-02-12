import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

// --- VALIDATION SCHEMAS ---

const createVisitSchema = z.object({
  leadId: z.string().min(1, "Lead ID is required"),
  propertyId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  scheduledAt: z.string().datetime({ message: "Invalid date format" }),
  conductedBy: z.string().optional(),
  feedback: z.string().optional().nullable(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'rescheduled']).default('scheduled')
});

const updateVisitSchema = z.object({
  status: z.enum(['scheduled', 'completed', 'cancelled', 'rescheduled']).optional(),
  scheduledAt: z.string().datetime().optional(),
  feedback: z.string().optional().nullable(),
  rating: z.number().min(1).max(5).optional().nullable(),
  conductedBy: z.string().optional()
});

// --- CONTROLLERS ---

/**
 * 1. GET ALL Site Visits (List)
 */
export const getSiteVisits = async (req: AuthRequest, res: Response) => {
  try {
    const { status, date, leadId } = req.query;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const where: any = {};

    // AGENT PERMISSION: See only own visits or visits for own leads
    if (role === 'sales_agent') {
      where.OR = [
        { conductedBy: userId },
        { lead: { assignedToId: userId } }
      ];
    }

    if (status) where.status = status;
    if (leadId) where.leadId = leadId;

    if (date) {
      const start = new Date(date as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date as string);
      end.setHours(23, 59, 59, 999);
      where.scheduledAt = { gte: start, lte: end };
    }

    const visits = await prisma.siteVisit.findMany({
      where,
      include: {
        lead: {
          select: { 
            id: true, name: true, phone: true, stage: true, 
            temperature: true, assignedToId: true, 
            budgetMin: true, budgetMax: true, preferredLocation: true 
          }
        },
        property: {
          select: { id: true, title: true, location: true, city: true, bedrooms: true, propertyType: true }
        },
        project: {
          select: { id: true, name: true, location: true, city: true }
        },
        conductor: {
          select: { id: true, fullName: true, email: true, avatarUrl: true }
        }
      },
      orderBy: { scheduledAt: 'asc' }
    });

    return res.json(visits);
  } catch (error) {
    console.error('Get Site Visits Error:', error);
    return res.status(500).json({ error: 'Failed to fetch site visits' });
  }
};

/**
 * 2. GET SINGLE Site Visit (The missing function)
 */
export const getSiteVisit = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const visit = await prisma.siteVisit.findUnique({
      where: { id },
      include: {
        lead: true,
        property: true,
        project: true,
        conductor: {
          select: { id: true, fullName: true, email: true }
        }
      }
    });

    if (!visit) return res.status(404).json({ error: 'Site visit not found' });

    // SECURITY CHECK for Agents
    if (role === 'sales_agent') {
       const isConductor = visit.conductedBy === userId;
       const isLeadOwner = visit.lead.assignedToId === userId;
       
       if (!isConductor && !isLeadOwner) {
         return res.status(403).json({ error: 'Access denied: You cannot view this site visit.' });
       }
    }

    return res.json(visit);
  } catch (error) {
    console.error('Get Single Visit Error:', error);
    return res.status(500).json({ error: 'Failed to fetch site visit details' });
  }
};

/**
 * 3. CREATE Site Visit
 */
export const createSiteVisit = async (req: AuthRequest, res: Response) => {
  try {
    const data = createVisitSchema.parse(req.body);
    const userId = req.user!.userId;
    const role = req.user!.role;

    const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    if (role === 'sales_agent' && lead.assignedToId !== userId) {
      return res.status(403).json({ error: 'Permission denied: You can only schedule visits for leads assigned to you.' });
    }

    let conductorId = data.conductedBy || userId;

    const visit = await prisma.siteVisit.create({
      data: {
        leadId: data.leadId,
        propertyId: data.propertyId,
        projectId: data.projectId,
        scheduledAt: data.scheduledAt,
        status: 'scheduled',
        conductedBy: conductorId,
        feedback: data.feedback
      },
      include: { lead: true, property: true, project: true }
    });

    if (['new', 'contacted'].includes(lead.stage)) {
        await prisma.lead.update({
            where: { id: lead.id },
            data: { 
                stage: 'site_visit',
                temperature: lead.temperature === 'cold' ? 'warm' : lead.temperature 
            }
        });
    }

    await prisma.activityLog.create({
        data: {
            userId: userId,
            action: 'site_visit_scheduled',
            entityType: 'site_visit',
            entityId: visit.id,
            details: { leadName: lead.name, scheduledAt: data.scheduledAt }
        }
    });

    return res.status(201).json(visit);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    return res.status(500).json({ error: 'Failed to schedule site visit' });
  }
};

/**
 * 4. UPDATE Site Visit
 */
export const updateSiteVisit = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateVisitSchema.parse(req.body);
    const userId = req.user!.userId;
    const role = req.user!.role;

    const existingVisit = await prisma.siteVisit.findUnique({ where: { id } });
    if (!existingVisit) return res.status(404).json({ error: 'Visit not found' });

    if (role === 'sales_agent' && existingVisit.conductedBy !== userId) {
      return res.status(403).json({ error: 'You can only update site visits assigned to you.' });
    }

    const updatedVisit = await prisma.siteVisit.update({
      where: { id },
      data,
      include: { lead: true }
    });

    return res.json(updatedVisit);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    return res.status(500).json({ error: 'Failed to update site visit' });
  }
};

/**
 * 5. DELETE Site Visit
 */
export const deleteSiteVisit = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (req.user!.role === 'sales_agent') {
        return res.status(403).json({ error: 'Agents cannot delete records. Please mark as Cancelled instead.' });
    }
    
    await prisma.siteVisit.delete({ where: { id } });
    return res.json({ message: 'Site visit deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete site visit' });
  }
};