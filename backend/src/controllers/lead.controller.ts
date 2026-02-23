import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

// --- VALIDATION SCHEMAS ---

const createLeadSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().nullable(),
  phone: z.string(),
  source: z.string(),
  temperature: z.enum(['hot', 'warm', 'cold']).default('warm'),
  budgetMin: z.number().optional().nullable(),
  budgetMax: z.number().optional().nullable(),
  preferredLocation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable()
});

const logCallSchema = z.object({
  callStatus: z.enum(['connected_positive', 'connected_callback', 'not_connected', 'not_interested']),
  type: z.enum(['call', 'whatsapp']).default('call'),
  callDuration: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  callbackScheduledAt: z.string().optional().nullable(),
  rejectionReason: z.string().optional().nullable()
});

const recommendationSchema = z.object({
  propertyIds: z.array(z.string()).min(1)
});

const bulkAssignSchema = z.object({
  leadIds: z.array(z.string()),
  agentId: z.string()
});

const bulkImportSchema = z.object({
  leads: z.array(z.object({
    name: z.string(),
    phone: z.string(),
    email: z.string().optional(),
    source: z.string().optional(),
    budgetMin: z.number().optional(),
    budgetMax: z.number().optional()
  }))
});

// --- CONTROLLERS ---

export const getLeads = async (req: AuthRequest, res: Response) => {
  try {
    const { stage, temperature, source, assignedTo, needsFollowup, phone } = req.query;

    const where: any = {};

    if (stage) where.stage = stage;
    if (temperature) where.temperature = temperature;
    if (source) where.source = source;
    if (assignedTo) where.assignedToId = assignedTo;

    if (phone) {
        where.phone = { contains: String(phone) };
    }

    if (needsFollowup === 'true') {
      const now = new Date();
      where.nextFollowupAt = { lte: now };
      where.stage = { notIn: ['closed', 'completed', 'lost'] };
    }

    if (req.user!.role === 'sales_agent') {
      where.assignedToId = req.user!.userId;
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        assignedTo: {
          select: { id: true, fullName: true, email: true, avatarUrl: true }
        },
        deals: {
          select: { id: true, dealValue: true, stage: true, createdAt: true },
          orderBy: { createdAt: 'desc' }
        },
        project: {
          select: { id: true, name: true, location: true }
        },
        siteVisits: {
          select: {
            id: true, scheduledAt: true, status: true, rating: true, feedback: true,
            property: { select: { title: true, location: true } },
            project: { select: { name: true, location: true } }
          },
          orderBy: { scheduledAt: 'desc' },
          take: 5 
        },
        callLogs: {
           select: { id: true, callStatus: true, callDate: true, notes: true, type: true },
           orderBy: { callDate: 'desc' },
        },
        propertyRecommendations: {
            select: { propertyId: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(leads);
  } catch (error) {
    console.error('Get Leads Error:', error);
    return res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

export const getLead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { id: true, fullName: true, email: true, avatarUrl: true }
        },
        project: { select: { id: true, name: true, location: true } },
        deals: {
          include: { property: { select: { title: true, price: true } } },
          orderBy: { createdAt: 'desc' }
        },
        callLogs: {
          include: { agent: { select: { fullName: true } } },
          orderBy: { callDate: 'desc' },
          take: 20
        },
        siteVisits: {
          include: {
            property: { select: { title: true, location: true } },
            project: { select: { name: true, location: true } }
          },
          orderBy: { scheduledAt: 'desc' }
        },
        propertyRecommendations: {
            include: { property: true },
            orderBy: { sentAt: 'desc' }
        }
      }
    });

    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    if (req.user!.role === 'sales_agent' && lead.assignedToId !== req.user!.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json(lead);
  } catch (error) {
    console.error('Get Lead Error:', error);
    return res.status(500).json({ error: 'Failed to fetch lead' });
  }
};

export const createLead = async (req: AuthRequest, res: Response) => {
  try {
    const data = createLeadSchema.parse(req.body);
    const assignedToId = data.assignedToId || req.user!.userId;

    const lead = await prisma.lead.create({
      data: { ...data, assignedToId },
      include: { assignedTo: true }
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'lead_created',
        entityType: 'lead',
        entityId: lead.id,
        details: { leadName: lead.name }
      }
    });

    return res.status(201).json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    return res.status(500).json({ error: 'Failed to create lead' });
  }
};

export const updateLead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body; 

    const existingLead = await prisma.lead.findUnique({ where: { id } });
    if (!existingLead) return res.status(404).json({ error: 'Lead not found' });

    const isAgent = req.user!.role === 'sales_agent';
    const isOwner = existingLead.assignedToId === req.user!.userId;

    if (isAgent) {
        if (!isOwner) {
            return res.status(403).json({ error: 'You can only update your own leads.' });
        }
        // ADDED AGENT SPECIFIC FIELDS
        const allowedUpdates = ['notes', 'stage', 'temperature', 'budgetMin', 'budgetMax', 'preferredLocation', 'nextFollowupAt', 'lostReason', 'agentNotes', 'interestLevel', 'preferredPropertyType'];
        const updates = Object.keys(data);
        const hasIllegalUpdates = updates.some(key => !allowedUpdates.includes(key));

        if (hasIllegalUpdates) {
            return res.status(403).json({ error: 'Agents can only update basic properties.' });
        }
    }

    const lead = await prisma.lead.update({
      where: { id },
      data,
      include: { assignedTo: true }
    });

    return res.json(lead);
  } catch (error) {
    console.error('Update Lead Error:', error);
    return res.status(500).json({ error: 'Failed to update lead' });
  }
};

export const deleteLead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user!.role === 'sales_agent') {
      return res.status(403).json({ error: 'Access denied: Agents cannot delete leads' });
    }

    await prisma.lead.delete({ where: { id } });
    return res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete lead' });
  }
};

export const logCall = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; 
    const data = logCallSchema.parse(req.body);

    const callLog = await prisma.callLog.create({
      data: {
        leadId: id,
        agentId: req.user!.userId,
        callStatus: data.callStatus as any,
        type: data.type,
        callDuration: data.callDuration,
        notes: data.notes,
        callbackScheduledAt: data.callbackScheduledAt ? new Date(data.callbackScheduledAt) : null,
        rejectionReason: data.rejectionReason
      }
    });

    let leadUpdates: any = { lastContactedAt: new Date() };
    
    // Auto Advance logic
    if (data.callStatus === 'connected_positive') {
        leadUpdates.temperature = 'hot';
        leadUpdates.stage = 'contacted'; 
    } else if (data.callStatus === 'connected_callback') {
        leadUpdates.stage = 'contacted';
        if (data.callbackScheduledAt) {
            leadUpdates.nextFollowupAt = new Date(data.callbackScheduledAt);
        }
    } else if (data.callStatus === 'not_interested') {
        leadUpdates.stage = 'closed';
        leadUpdates.lostReason = data.rejectionReason || 'Not Interested';
    } else if (data.callbackScheduledAt) {
        leadUpdates.nextFollowupAt = new Date(data.callbackScheduledAt);
    }

    await prisma.lead.update({
        where: { id },
        data: leadUpdates
    });

    return res.status(201).json(callLog);
  } catch (error) {
    console.error('Log Call Error:', error);
    return res.status(500).json({ error: 'Failed to log call' });
  }
};

export const recommendProperties = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; 
    const { propertyIds } = recommendationSchema.parse(req.body);

    await prisma.$transaction(
      propertyIds.map((propId) => 
        prisma.propertyRecommendation.create({
          data: {
            leadId: id,
            propertyId: propId,
            recommendedBy: req.user!.userId
          }
        })
      )
    );

    return res.status(201).json({ 
      success: true, 
      message: `${propertyIds.length} properties recommended` 
    });
  } catch (error) {
    console.error('Recommendation Error:', error);
    return res.status(500).json({ error: 'Failed to recommend properties' });
  }
};

export const togglePriority = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const updated = await prisma.lead.update({
      where: { id },
      data: { isPriority: !lead.isPriority }
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update priority' });
  }
};

export const bulkAssign = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role === 'sales_agent') return res.status(403).json({ error: 'Forbidden' });

    const { leadIds, agentId } = bulkAssignSchema.parse(req.body);

    await prisma.lead.updateMany({
      where: { id: { in: leadIds } },
      data: { assignedToId: agentId }
    });

    return res.json({ success: true, count: leadIds.length });
  } catch (error) {
    return res.status(500).json({ error: 'Bulk assign failed' });
  }
};

export const importLeads = async (req: AuthRequest, res: Response) => {
  try {
    const { leads } = bulkImportSchema.parse(req.body);
    const userId = req.user!.userId;

    const created = await prisma.lead.createMany({
      data: leads.map(l => ({
        ...l,
        assignedToId: userId,
        source: l.source || 'Imported',
        stage: 'new',
        temperature: 'warm'
      }))
    });

    return res.json({ success: true, count: created.count });
  } catch (error) {
    return res.status(500).json({ error: 'Import failed' });
  }
};

export const getAgentDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const agentId = req.user!.userId;
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const missedFollowups = await prisma.lead.count({
      where: {
        assignedToId: agentId,
        nextFollowupAt: { lt: now },
        stage: { notIn: ['closed', 'completed', 'lost'] }
      }
    });

    const missedVisits = await prisma.siteVisit.count({
      where: {
        OR: [
          { conductedBy: agentId },
          { lead: { assignedToId: agentId } }
        ],
        status: 'scheduled',
        scheduledAt: { lt: now }
      }
    });

    const stagnantLeads = await prisma.lead.count({
      where: {
        assignedToId: agentId,
        updatedAt: { lt: sevenDaysAgo },
        stage: { notIn: ['closed', 'lost', 'completed', 'token'] }
      }
    });

    return res.json({ missedFollowups, missedVisits, stagnantLeads });
  } catch (error) {
    console.error('Agent Stats Error:', error);
    return res.status(500).json({ error: 'Failed to fetch agent stats' });
  }
};