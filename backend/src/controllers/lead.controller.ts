import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getIO } from '../utils/socket';

// --- VALIDATION SCHEMAS ---

const createLeadSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().nullable(),
  // Replace the old phone line with this:
  phone: z.string().min(7, "Phone number is too short").max(20, "Phone number is too long").regex(/^\+?[0-9\s\-]+$/, "Invalid phone format"),
  source: z.string(),
  temperature: z.enum(['hot', 'warm', 'cold']).default('warm'),
  budgetMin: z.number().optional().nullable(),
  budgetMax: z.number().optional().nullable(),
  preferredLocation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable()
});

const updateLeadSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(7, "Phone number is too short").max(20, "Phone number is too long").regex(/^\+?[0-9\s\-]+$/, "Invalid phone format").optional(),
  source: z.string().optional(),
  stage: z.string().optional(),
  temperature: z.enum(['hot', 'warm', 'cold']).optional(),
  budgetMin: z.number().optional().nullable(),
  budgetMax: z.number().optional().nullable(),
  preferredLocation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  agentNotes: z.string().optional().nullable(),
  adminNotes: z.string().optional().nullable(), // 👈 ADD THIS NEW LINE
  assignedToId: z.string().optional().nullable(),
  nextFollowupAt: z.string().optional().nullable(),
  agentNextFollowupAt: z.string().optional().nullable(),
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
  console.log(`\n[Backend] 📥 Incoming request to /leads from User: ${req.user!.userId}`);
  const startTime = Date.now();

  try {
    const { stage, temperature, source, assignedTo, assignedBy, needsFollowup, phone } = req.query;
    const where: any = {};

    if (stage) where.stage = stage;
    if (temperature) where.temperature = temperature;
    if (source) where.source = source;
    if (assignedTo) where.assignedToId = assignedTo;
    if (assignedBy) where.assignedById = assignedBy; // 👈 Server-side Admin assignment filtering
    if (phone) where.phone = { contains: String(phone) };

    if (needsFollowup === 'true') {
      const now = new Date();
      where.nextFollowupAt = { lte: now };
      where.stage = { notIn: ['closed', 'completed', 'lost'] };
    }

    if (req.user!.role === 'sales_agent') {
      where.assignedToId = req.user!.userId;
    }

    // ⚠️ User requested NO LIMIT. Fetching all matching leads.
    const leads = await prisma.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        assignedBy: { select: { id: true, fullName: true, role: true } },
        deals: { select: { id: true, dealValue: true, stage: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
        project: { select: { id: true, name: true, location: true } },
        siteVisits: {
          select: {
            id: true, scheduledAt: true, status: true, rating: true, feedback: true, conductedBy: true,
            property: { select: { title: true, location: true } },
            project: { select: { name: true, location: true } }
          },
          orderBy: { scheduledAt: 'desc' }
        },
        callLogs: { select: { id: true, callStatus: true, callDate: true, notes: true, type: true }, orderBy: { callDate: 'desc' }, take: 1 },
        propertyRecommendations: { select: { propertyId: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const duration = Date.now() - startTime;
    console.log(`[Backend] ✅ Success! Sent ${leads.length} leads in ${duration}ms`);

    return res.json(leads);
  } catch (error) {
    console.error('[Backend] 🚨 ERROR in getLeads:', error);
    return res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

// Replace your entire updateLead function with this:
export const updateLead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateLeadSchema.parse(req.body);

    const existingLead = await prisma.lead.findUnique({ where: { id } });
    if (!existingLead) return res.status(404).json({ error: 'Lead not found' });

    const isAgent = req.user!.role === 'sales_agent';
    const isOwner = existingLead.assignedToId === req.user!.userId;

    if (isAgent) {
      if (!isOwner) return res.status(403).json({ error: 'You can only update your own leads.' });
      const agentAllowed = ['notes', 'stage', 'temperature', 'budgetMin', 'budgetMax',
        'preferredLocation', 'nextFollowupAt', 'agentNextFollowupAt', 'lostReason', 'agentNotes', 'interestLevel', 'preferredPropertyType'] as const;
      const updates = Object.keys(data) as string[];
      if (updates.some(k => !agentAllowed.includes(k as any))) {
        return res.status(403).json({ error: 'Agents can only update basic lead properties.' });
      }
    }

    const updateData: any = { ...data };

    if (data.assignedToId && !isAgent) {
      if (!existingLead.assignedById) updateData.assignedById = req.user!.userId;
      if (data.assignedToId !== existingLead.assignedToId) {
        await prisma.activityLog.create({
          data: {
            userId: req.user!.userId, action: 'lead_reassigned', entityType: 'lead',
            entityId: existingLead.id, details: { from: existingLead.assignedToId, to: data.assignedToId }
          }
        });
      }
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: { assignedTo: true, assignedBy: { select: { id: true, fullName: true, role: true } } }
    });

    // 🔔 Notify agent when admin assigns/reassigns a lead
    if (data.assignedToId && data.assignedToId !== existingLead.assignedToId && !isAgent) {
      try {
        getIO().to(`user:${data.assignedToId}`).emit('lead_assigned', {
          leadId: lead.id,
          leadName: lead.name,
          assignedByName: lead.assignedBy?.fullName || 'Admin',
          message: `You have been assigned a new lead: ${lead.name}`
        });
      } catch (e) {
        console.error('[Socket] updateLead emit failed:', e);
      }
    }

    // ── 1. ADMIN HISTORY SAVING (Visible to Admin Only) ──
    const newAdminDate = data.nextFollowupAt ? new Date(data.nextFollowupAt).getTime() : null;
    const oldAdminDate = existingLead.nextFollowupAt ? existingLead.nextFollowupAt.getTime() : null;
    const adminDateChanged = newAdminDate !== oldAdminDate && newAdminDate !== null;

    // 👇 FIX: Admin now uses `data.notes` independently, never touching the Agent's note
    const adminNotesChanged = data.notes && data.notes !== existingLead.notes;

    if (!isAgent && (adminDateChanged || adminNotesChanged)) {
      const agentIdToAssign = existingLead.assignedToId || req.user!.userId;
      let callStatusToLog = 'connected_positive';

      // 👇 FIX: Uses the Admin's box for the history message
      let msg = data.notes || 'Admin updated lead details';

      if (adminDateChanged) {
        callStatusToLog = 'connected_callback';

        const formattedDate = new Date(data.nextFollowupAt!).toLocaleString('en-IN', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });

        const baseLabel = `Admin Follow-up set for ${formattedDate}`;
        msg = data.notes ? `${baseLabel}: ${data.notes}` : baseLabel;

        await prisma.callLog.updateMany({
          where: { leadId: id, callStatus: 'connected_callback' },
          data: { callStatus: 'connected_positive' }
        });
        await prisma.followUpTask.updateMany({
          where: { leadId: id, status: 'pending' },
          data: { status: 'completed', completedAt: new Date() }
        });

        await prisma.followUpTask.create({
          data: {
            leadId: id, agentId: agentIdToAssign, taskType: 'callback',
            scheduledAt: new Date(data.nextFollowupAt!), notes: msg
          }
        });
      }

      await prisma.callLog.create({
        data: {
          leadId: id,
          agentId: req.user!.userId,
          callStatus: callStatusToLog as any,
          callDate: new Date(),
          ...(adminDateChanged ? { callbackScheduledAt: new Date(data.nextFollowupAt!) } : {}),
          notes: msg // 👈 Uses the private note
        }
      });
    }

    // ── 2. AGENT HISTORY SAVING (Visible to Agent and Admin) ──
    const newAgentDate = data.agentNextFollowupAt ? new Date(data.agentNextFollowupAt).getTime() : null;
    const oldAgentDate = existingLead.agentNextFollowupAt ? existingLead.agentNextFollowupAt.getTime() : null;
    const agentDateChanged = newAgentDate !== oldAgentDate && newAgentDate !== null;
    const agentNotesChanged = data.agentNotes && data.agentNotes !== existingLead.agentNotes;

    if (isAgent && (agentDateChanged || agentNotesChanged)) {
      let callStatusToLog = 'connected_positive';
      let msg = data.agentNotes || 'Agent updated lead details';

      if (agentDateChanged) {
        callStatusToLog = 'connected_callback';

        // 👈 NEW: Format the date to show in the history log
        const formattedDate = new Date(data.agentNextFollowupAt!).toLocaleString('en-IN', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });

        const baseLabel = `Agent Follow-up set for ${formattedDate}`;
        msg = data.agentNotes ? `${baseLabel}: ${data.agentNotes}` : baseLabel;

        await prisma.callLog.updateMany({
          where: { leadId: id, agentId: req.user!.userId, callStatus: 'connected_callback' },
          data: { callStatus: 'connected_positive' }
        });
        await prisma.followUpTask.updateMany({
          where: { leadId: id, agentId: req.user!.userId, status: 'pending' },
          data: { status: 'completed', completedAt: new Date() }
        });

        await prisma.followUpTask.create({
          data: {
            leadId: id, agentId: req.user!.userId, taskType: 'callback',
            scheduledAt: new Date(data.agentNextFollowupAt!), notes: msg
          }
        });
      }

      await prisma.callLog.create({
        data: {
          leadId: id, agentId: req.user!.userId, callStatus: callStatusToLog as any, callDate: new Date(),
          ...(agentDateChanged ? { callbackScheduledAt: new Date(data.agentNextFollowupAt!) } : {}),
          notes: msg
        }
      });
    }

    return res.json(lead);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update lead' });
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
    const currentUserId = req.user!.userId;
    const assignedToId = data.assignedToId || null;

    // --- SMARTER STRICT DUPLICATE CHECK ---
    // 1. Remove all spaces, plus signs, and hyphens from the incoming number
    const cleanPhone = data.phone.replace(/\D/g, '');

    // 2. Grab only the last 10 digits (ignores whether +91 was included or not)
    const basePhone = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

    // 3. Search the database for any phone number that CONTAINS those 10 digits
    const existingLead = await prisma.lead.findFirst({
      where: {
        phone: { contains: basePhone }
      }
    });

    if (existingLead) {
      return res.status(400).json({
        error: `A lead with this phone number already exists (${existingLead.name}).`
      });
    }
    // ----------------------------------

    // Track who assigned this lead
    const assignedById = data.assignedToId ? currentUserId : null;

    const lead = await prisma.lead.create({
      data: { ...data, assignedToId, assignedById },
      include: {
        assignedTo: true,
        assignedBy: { select: { id: true, fullName: true, role: true } }
      }
    });

    // 🔔 Notify agent if lead was directly assigned on creation
if (lead.assignedToId) {
  try {
    getIO().to(`user:${lead.assignedToId}`).emit('lead_assigned', {
      leadId: lead.id,
      leadName: lead.name,
      assignedByName: lead.assignedBy?.fullName || 'Admin',
      message: `A new lead has been assigned to you: ${lead.name}`
    });
  } catch (e) {
    console.error('[Socket] createLead emit failed:', e);
  }
}

    await prisma.activityLog.create({
      data: {
        userId: currentUserId,
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
      data: { assignedToId: agentId, assignedById: req.user!.userId }
    });

    // 🔔 Notify the agent of bulk assignment
    try {
      getIO().to(`user:${agentId}`).emit('lead_assigned', {
        leadId: null,
        leadName: `${leadIds.length} leads`,
        assignedByName: 'Admin',
        message: `${leadIds.length} leads have been assigned to you`
      });
    } catch (e) {
      console.error('[Socket] bulkAssign emit failed:', e);
    }

    return res.json({ success: true, count: leadIds.length });
  } catch (error) {
    return res.status(500).json({ error: 'Bulk assign failed' });
  }
};

export const importLeads = async (req: AuthRequest, res: Response) => {
  try {
    const { leads } = bulkImportSchema.parse(req.body);

    const created = await prisma.lead.createMany({
      data: leads.map(l => ({
        ...l,
        assignedToId: null,
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