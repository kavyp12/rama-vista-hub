import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

const createSiteVisitSchema = z.object({
  leadId: z.string(),
  propertyId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  scheduledAt: z.string(),
  status: z.enum(['scheduled', 'rescheduled', 'completed', 'cancelled']).default('scheduled'),
  feedback: z.string().optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  conductedBy: z.string().optional().nullable()
});

// Update schema to include 'nextStage' for pipeline movement
const updateSiteVisitSchema = createSiteVisitSchema.partial().extend({
  nextStage: z.enum(['contacted', 'site_visit', 'negotiation', 'token', 'completed', 'closed', 'lost']).optional()
});

export const getSiteVisits = async (req: AuthRequest, res: Response) => {
  try {
    const { status, leadId, propertyId, projectId, conductedBy } = req.query;
    
    const where: any = {};
    
    if (status) where.status = status;
    if (leadId) where.leadId = leadId;
    if (propertyId) where.propertyId = propertyId;
    if (projectId) where.projectId = projectId;
    
    // ✅ AGENT FILTER: Agents only see their own visits (or visits for their leads)
    if (req.user!.role === 'sales_agent') {
      where.OR = [
        { conductedBy: req.user!.userId },
        { lead: { assignedToId: req.user!.userId } }
      ];
    } else if (conductedBy) {
      where.conductedBy = conductedBy;
    }

    const siteVisits = await prisma.siteVisit.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            temperature: true,
            stage: true,
            assignedToId: true
          }
        },
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            city: true
          }
        },
        project: {
          select: {
            id: true,
            name: true,
            location: true,
            city: true
          }
        },
        conductor: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      },
      orderBy: { scheduledAt: 'asc' }
    });

    return res.json(siteVisits);
  } catch (error) {
    console.error('Get Site Visits Error:', error);
    return res.status(500).json({ error: 'Failed to fetch site visits' });
  }
};

export const getSiteVisit = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const siteVisit = await prisma.siteVisit.findUnique({
      where: { id },
      include: {
        lead: true,
        property: true,
        project: true,
        conductor: true
      }
    });

    if (!siteVisit) {
      return res.status(404).json({ error: 'Site visit not found' });
    }

    // ✅ SECURITY: Agents access check
    if (req.user!.role === 'sales_agent' && 
        siteVisit.conductedBy !== req.user!.userId && 
        siteVisit.lead.assignedToId !== req.user!.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json(siteVisit);
  } catch (error) {
    throw error;
  }
};

export const createSiteVisit = async (req: AuthRequest, res: Response) => {
  try {
    const data = createSiteVisitSchema.parse(req.body);

    const conductedBy = data.conductedBy || req.user!.userId;

    // Transaction to create visit and update lead stage if needed
    const result = await prisma.$transaction(async (prisma) => {
      const siteVisit = await prisma.siteVisit.create({
        data: {
          ...data,
          conductedBy,
          scheduledAt: new Date(data.scheduledAt)
        },
        include: { lead: true }
      });

      // Automatically move lead to 'site_visit' stage if they are in an earlier stage
      if (['new', 'contacted'].includes(siteVisit.lead.stage)) {
        await prisma.lead.update({
          where: { id: data.leadId },
          data: { stage: 'site_visit', temperature: 'warm' }
        });
      }

      await prisma.activityLog.create({
        data: {
          userId: req.user!.userId,
          action: 'site_visit_scheduled',
          entityType: 'site_visit',
          entityId: siteVisit.id,
          details: { 
            leadName: siteVisit.lead.name,
            scheduledAt: siteVisit.scheduledAt
          }
        }
      });

      return siteVisit;
    });

    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    throw error;
  }
};

export const updateSiteVisit = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateSiteVisitSchema.parse(req.body);

    const existingVisit = await prisma.siteVisit.findUnique({ 
      where: { id },
      include: { lead: true }
    });
    
    if (!existingVisit) {
      return res.status(404).json({ error: 'Site visit not found' });
    }

    // ✅ SECURITY
    if (req.user!.role === 'sales_agent' && 
        existingVisit.conductedBy !== req.user!.userId &&
        existingVisit.lead.assignedToId !== req.user!.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // ✅ LOGIC: Append History (only if new feedback is being added AND status is being changed)
    let newFeedback = existingVisit.feedback;
    
    // Only append if there's new feedback AND status is changing to completed
    if (data.feedback && data.status === 'completed' && existingVisit.status !== 'completed') {
      const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const prefix = existingVisit.feedback ? `${existingVisit.feedback}\n\n` : '';
      const updateNote = `--- COMPLETED [${timestamp}] ---\nOutcome: ${data.feedback}`;
      newFeedback = prefix + updateNote;
    } 
    // If just updating rating/feedback on already completed visit, replace feedback
    else if (data.feedback !== undefined) {
      newFeedback = data.feedback;
    }

    // ✅ TRANSACTION: Update Visit + Update Lead Stage
    const result = await prisma.$transaction(async (prisma) => {
      // 1. Update the Visit
      const siteVisit = await prisma.siteVisit.update({
        where: { id },
        data: {
          status: data.status,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
          rating: data.rating !== undefined ? data.rating : undefined,
          feedback: newFeedback,
          conductedBy: data.conductedBy
        },
        include: {
          lead: true,
          property: true,
          project: true
        }
      });

      // 2. Update Lead Stage & Temperature based on Outcome
      if (data.status === 'completed' && existingVisit.status !== 'completed') {
        const leadUpdates: any = {};

        // ✅ If nextStage is provided, use it
        if (data.nextStage) {
          leadUpdates.stage = data.nextStage;
          
          // Auto-set temperature based on stage movement
          if (data.nextStage === 'negotiation' || data.nextStage === 'token') {
            leadUpdates.temperature = 'hot';
          } else if (data.nextStage === 'lost') {
            leadUpdates.temperature = 'cold';
          } else if (data.nextStage === 'completed' || data.nextStage === 'closed') {
            // Set temperature based on rating
            if (data.rating !== null && data.rating !== undefined) {
              leadUpdates.temperature = data.rating >= 4 ? 'hot' : data.rating >= 3 ? 'warm' : 'cold';
            }
          } else {
            leadUpdates.temperature = 'warm';
          }
        } 
        // ✅ Default behavior - if NO nextStage specified but rating given, move to COMPLETED
        else if (data.rating !== null && data.rating !== undefined) {
          leadUpdates.stage = 'completed';
          leadUpdates.temperature = data.rating >= 4 ? 'hot' : data.rating >= 3 ? 'warm' : 'cold';
        }
        // ✅ If no rating and no nextStage, just mark as completed
        else {
          leadUpdates.stage = 'completed';
        }

        if (Object.keys(leadUpdates).length > 0) {
          await prisma.lead.update({
            where: { id: siteVisit.leadId },
            data: leadUpdates
          });
        }

        // Log Activity
        await prisma.activityLog.create({
          data: {
            userId: req.user!.userId,
            action: 'site_visit_completed',
            entityType: 'site_visit',
            entityId: siteVisit.id,
            details: { 
              leadName: siteVisit.lead.name,
              rating: data.rating,
              newStage: leadUpdates.stage || siteVisit.lead.stage
            }
          }
        });
      } 
      // ✅ Allow updating rating on already completed visits
      else if (existingVisit.status === 'completed' && data.rating !== undefined && data.rating !== null && data.rating !== existingVisit.rating) {
        const leadUpdates: any = {};
        
        // Update temperature based on new rating
        leadUpdates.temperature = data.rating >= 4 ? 'hot' : data.rating >= 3 ? 'warm' : 'cold';
        
        // If lead is in completed stage, keep it there unless agent specified nextStage
        if (data.nextStage) {
          leadUpdates.stage = data.nextStage;
        } else if (siteVisit.lead.stage === 'completed') {
          leadUpdates.stage = 'completed';
        }

        if (Object.keys(leadUpdates).length > 0) {
          await prisma.lead.update({
            where: { id: siteVisit.leadId },
            data: leadUpdates
          });
        }
      }
      else if (data.status === 'rescheduled') {
        // Log Reschedule
        await prisma.activityLog.create({
          data: {
            userId: req.user!.userId,
            action: 'site_visit_rescheduled',
            entityType: 'site_visit',
            entityId: siteVisit.id,
            details: { 
              leadName: siteVisit.lead.name,
              newDate: data.scheduledAt
            }
          }
        });
      }

      return siteVisit;
    });

    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    throw error;
  }
};

export const deleteSiteVisit = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingVisit = await prisma.siteVisit.findUnique({ where: { id } });
    
    if (!existingVisit) {
      return res.status(404).json({ error: 'Site visit not found' });
    }

    if (req.user!.role === 'sales_agent' && existingVisit.conductedBy !== req.user!.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.siteVisit.delete({ where: { id } });

    return res.json({ message: 'Site visit deleted successfully' });
  } catch (error) {
    throw error;
  }
};