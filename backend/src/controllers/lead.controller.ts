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

// ✅ FIX H3: Define explicit update schema — no raw body passthrough to Prisma
const updateLeadSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional(),
  source: z.string().optional(),
  stage: z.string().optional(),
  temperature: z.enum(['hot', 'warm', 'cold']).optional(),
  budgetMin: z.number().optional().nullable(),
  budgetMax: z.number().optional().nullable(),
  preferredLocation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  agentNotes: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  nextFollowupAt: z.string().optional().nullable(),
  lostReason: z.string().optional().nullable(),
  interestLevel: z.number().optional().nullable(),
  preferredPropertyType: z.string().optional().nullable()
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
  // 1. Log the incoming request and start a timer
  console.log(`\n[Backend] 📥 Incoming request to /leads from User: ${req.user!.userId}`);
  console.log(`[Backend] 🔍 Query Params:`, req.query);
  const startTime = Date.now();

  try {
    const { stage, temperature, source, assignedTo, needsFollowup, phone } = req.query;
    const where: any = {};

    if (stage) where.stage = stage;
    if (temperature) where.temperature = temperature;
    if (source) where.source = source;
    if (assignedTo) where.assignedToId = assignedTo;
    if (phone) where.phone = { contains: String(phone) };

    if (needsFollowup === 'true') {
      const now = new Date();
      where.nextFollowupAt = { lte: now };
      where.stage = { notIn: ['closed', 'completed', 'lost'] };
    }

    if (req.user!.role === 'sales_agent') {
      where.assignedToId = req.user!.userId;
    }

    console.log(`[Backend] ⚙️  Executing Prisma query...`);

    const leads = await prisma.lead.findMany({
      where,
      // NO take limit here - we want all leads for frontend caching
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
            conductedBy: true,
            property: { select: { title: true, location: true } },
            project: { select: { name: true, location: true } }
          },
          orderBy: { scheduledAt: 'desc' }
        },
        callLogs: {
          select: { id: true, callStatus: true, callDate: true, notes: true, type: true },
          orderBy: { callDate: 'desc' },
          take: 1 // CRITICAL: Keeps payload small by only sending the last call
        },
        propertyRecommendations: {
          select: { propertyId: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Calculate how long it took and log the success
    const duration = Date.now() - startTime;
    console.log(`[Backend] ✅ Success! Sent ${leads.length} leads in ${duration}ms`);

    return res.json(leads);
  } catch (error) {
    // 3. Log any errors that occur
    console.error('[Backend] 🚨 ERROR in getLeads:', error);
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
    const data = updateLeadSchema.parse(req.body);

    const existingLead = await prisma.lead.findUnique({ where: { id } });
    if (!existingLead) return res.status(404).json({ error: 'Lead not found' });

    const isAgent = req.user!.role === 'sales_agent';
    const isOwner = existingLead.assignedToId === req.user!.userId;

    if (isAgent) {
      if (!isOwner) {
        return res.status(403).json({ error: 'You can only update your own leads.' });
      }
      // Agents are additionally restricted to only safe fields
      const agentAllowed = ['notes', 'stage', 'temperature', 'budgetMin', 'budgetMax',
        'preferredLocation', 'nextFollowupAt', 'lostReason', 'agentNotes', 'interestLevel', 'preferredPropertyType'] as const;
      const updates = Object.keys(data) as string[];
      if (updates.some(k => !agentAllowed.includes(k as any))) {
        return res.status(403).json({ error: 'Agents can only update basic lead properties.' });
      }
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: data as any,
      include: { assignedTo: true }
    });

    // 👇 NEW: Sync "Follow-up Scheduler" with Telecalling tab!
    const nextDateStr = data.nextFollowupAt ? new Date(data.nextFollowupAt).toISOString() : null;
    const oldDateStr = existingLead.nextFollowupAt ? new Date(existingLead.nextFollowupAt).toISOString() : null;

    // Only trigger if the user actually changed/added a Follow-up date
    if (data.nextFollowupAt && nextDateStr !== oldDateStr && req.user!.role !== 'sales_agent') {
      const agentIdToAssign = existingLead.assignedToId || req.user!.userId;

      // 1. Clear old pending callbacks to prevent duplicates
      await prisma.callLog.updateMany({
        where: { leadId: id, callStatus: 'connected_callback' },
        data: { callStatus: 'connected_positive' }
      });
      await prisma.followUpTask.updateMany({
        where: { leadId: id, status: 'pending' },
        data: { status: 'completed', completedAt: new Date() }
      });

      // 2. Create new active callback so it appears in Telecalling Follow Ups
      await prisma.callLog.create({
        data: {
          leadId: id,
          agentId: agentIdToAssign,
          callStatus: 'connected_callback',
          callDate: new Date(),
          callbackScheduledAt: new Date(data.nextFollowupAt),
          notes: data.agentNotes || 'Follow-up scheduled from Lead Workspace'
        }
      });

      // 3. Keep a follow-up task active too
      await prisma.followUpTask.create({
        data: {
          leadId: id,
          agentId: agentIdToAssign,
          taskType: 'callback',
          scheduledAt: new Date(data.nextFollowupAt),
          notes: data.agentNotes || 'Follow-up scheduled from Lead Workspace'
        }
      });
    }

    return res.json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
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

    const leadInfo = await prisma.lead.findUnique({ where: { id } });
    if (!leadInfo) return res.status(404).json({ error: 'Lead not found' });
    if (req.user!.role === 'sales_agent' && leadInfo.assignedToId !== req.user!.userId) {
      return res.status(403).json({ error: 'You can only log calls for your own leads.' });
    }

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

    // Find lead owner
    const leadOwner = await prisma.lead.findUnique({
      where: { id },
      include: { assignedTo: true }
    });
    const isManagedBySalesAgent = leadOwner?.assignedTo?.role === 'sales_agent';
    const canUpdateFollowup = !isManagedBySalesAgent || req.user!.userId === leadOwner?.assignedToId;

    // Auto Advance logic
    if (data.callStatus === 'connected_positive') {
      leadUpdates.temperature = 'hot';
      leadUpdates.stage = 'contacted';
    } else if (data.callStatus === 'connected_callback') {
      leadUpdates.stage = 'contacted';
      if (data.callbackScheduledAt && canUpdateFollowup) {
        leadUpdates.nextFollowupAt = new Date(data.callbackScheduledAt);
      }
    } else if (data.callStatus === 'not_interested') {
      leadUpdates.stage = 'closed';
      leadUpdates.lostReason = data.rejectionReason || 'Not Interested';
    } else if (data.callbackScheduledAt && canUpdateFollowup) {
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

    // Get number of missed calls (callback follow-up tasks)
    const missedCalls = await prisma.followUpTask.count({
      where: {
        agentId: agentId,
        taskType: 'callback',
        status: 'pending' // Only count tasks that haven't been completed yet
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

    return res.json({ missedFollowups, missedVisits, stagnantLeads, missedCalls });
  } catch (error) {
    console.error('Agent Stats Error:', error);
    return res.status(500).json({ error: 'Failed to fetch agent stats' });
  }
};