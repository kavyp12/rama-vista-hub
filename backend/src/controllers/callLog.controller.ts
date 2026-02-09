import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { addHours } from 'date-fns';

const createCallLogSchema = z.object({
  leadId: z.string(),
  callStatus: z.enum(['connected_positive', 'connected_callback', 'not_connected', 'not_interested']),
  duration: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  callbackScheduledAt: z.string().optional().nullable(),
  rejectionReason: z.string().optional().nullable()
});

export const createCallLog = async (req: AuthRequest, res: Response) => {
  try {
    const data = createCallLogSchema.parse(req.body);

    // Create the call log
    const callLog = await prisma.callLog.create({
      data: {
        leadId: data.leadId,
        agentId: req.user!.userId,
        callStatus: data.callStatus,
        callDate: new Date(),
        callDuration: data.duration,
        notes: data.notes,
        callbackScheduledAt: data.callbackScheduledAt ? new Date(data.callbackScheduledAt) : null,
        rejectionReason: data.rejectionReason
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            stage: true,
            assignedToId: true
          }
        }
      }
    });

    // Handle different call outcomes
    if (data.callStatus === 'connected_positive') {
      const stageProgression: Record<string, string> = {
        'new': 'contacted',
        'contacted': 'site_visit',
        'site_visit': 'negotiation',
        'negotiation': 'token'
      };
      const currentStage = callLog.lead.stage;
      const nextStage = stageProgression[currentStage] || currentStage;

      await prisma.lead.update({
        where: { id: data.leadId },
        data: {
          stage: nextStage as any,
          temperature: 'hot'
        }
      });

    } else if (data.callStatus === 'connected_callback' && data.callbackScheduledAt) {
      await prisma.followUpTask.create({
        data: {
          leadId: data.leadId,
          agentId: req.user!.userId,
          taskType: 'callback',
          scheduledAt: new Date(data.callbackScheduledAt),
          notes: data.notes || 'Callback requested'
        }
      });

      await prisma.lead.update({
        where: { id: data.leadId },
        data: { nextFollowupAt: new Date(data.callbackScheduledAt) }
      });

    } else if (data.callStatus === 'not_connected') {
      const retryTime = addHours(new Date(), 2);

      await prisma.followUpTask.create({
        data: {
          leadId: data.leadId,
          agentId: req.user!.userId,
          taskType: 'retry_call',
          scheduledAt: retryTime,
          notes: 'Auto-scheduled retry call'
        }
      });

      await prisma.lead.update({
        where: { id: data.leadId },
        data: { nextFollowupAt: retryTime }
      });

    } else if (data.callStatus === 'not_interested') {
      await prisma.lead.update({
        where: { id: data.leadId },
        data: {
          stage: 'closed',
          notes: `Closed - Reason: ${data.rejectionReason || 'Not interested'}`
        }
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'call_logged',
        entityType: 'call_log',
        entityId: callLog.id,
        details: {
          leadName: callLog.lead.name,
          callStatus: data.callStatus
        }
      }
    });

    return res.status(201).json(callLog);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create Call Log Error:', error);
    return res.status(500).json({ error: 'Failed to create call log' });
  }
};

export const getCallLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { leadId, view, search } = req.query; 

    const where: any = {
      deletedAt: null // Default: show only active logs
    };
    
    if (leadId) where.leadId = leadId;

    if (search) {
      where.OR = [
        { lead: { name: { contains: search as string, mode: 'insensitive' } } },
        { lead: { phone: { contains: search as string } } }
      ];
    }

    if (req.user!.role === 'sales_agent') {
      where.agentId = req.user!.userId;
    }

    // --- VIEW FILTERS ---
    switch (view) {
      case 'missed':
        where.callStatus = 'not_connected';
        break;
      case 'attended':
        where.callStatus = { in: ['connected_positive', 'connected_callback', 'not_interested'] };
        break;
      case 'qualified':
        where.callStatus = 'connected_positive';
        break;
      case 'unqualified':
        where.callStatus = 'not_interested';
        break;
      case 'archive':
        where.isArchived = true; // Show only archived
        break;
      case 'deleted':
        delete where.deletedAt; // Remove the default "null" check
        where.deletedAt = { not: null }; // Show ONLY deleted items
        break;
      default:
        // 'all' view: Show everything active (not deleted), including archived?
        // Usually 'All Calls' shouldn't show archived if you have a specific Archive view.
        // If you want to hide archived from 'All', uncomment below:
        // where.isArchived = false; 
        break;
    }

    const callLogs = await prisma.callLog.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            temperature: true,
            stage: true
          }
        },
        agent: {
          select: {
            id: true,
            fullName: true
          }
        }
      },
      orderBy: { callDate: 'desc' },
      take: 100
    });

    return res.json(callLogs);
  } catch (error) {
    console.error('Get Call Logs Error:', error);
    return res.status(500).json({ error: 'Failed to fetch call logs' });
  }
};

export const getCallStats = async (req: AuthRequest, res: Response) => {
  try {
    const agentId = req.user!.role === 'sales_agent' 
      ? req.user!.userId 
      : (req.query.agentId as string);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const callsByStatus = await prisma.callLog.groupBy({
      by: ['callStatus'],
      where: {
        agentId,
        callDate: { gte: today },
        deletedAt: null // Exclude deleted calls from stats
      },
      _count: true
    });

    const totalCalls = callsByStatus.reduce((sum, item) => sum + item._count, 0);
    const connectedCalls = callsByStatus
      .filter(item => item.callStatus.startsWith('connected'))
      .reduce((sum, item) => sum + item._count, 0);

    const stats = {
      totalCalls,
      connectedCalls,
      notAnswered: callsByStatus.find(i => i.callStatus === 'not_connected')?._count || 0,
      positive: callsByStatus.find(i => i.callStatus === 'connected_positive')?._count || 0,
      negative: callsByStatus.find(i => i.callStatus === 'not_interested')?._count || 0,
      connectRate: totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0
    };

    return res.json(stats);
  } catch (error) {
    console.error('Get Call Stats Error:', error);
    return res.status(500).json({ error: 'Failed to fetch call stats' });
  }
};

// ✅ NEW FUNCTION: Update Call Log (Used for Archiving)
export const updateCallLog = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const data = req.body; // Expect { isArchived: true } etc.

        const updatedLog = await prisma.callLog.update({
            where: { id },
            data
        });

        return res.json(updatedLog);
    } catch (error) {
        console.error('Update Log Error:', error);
        return res.status(500).json({ error: 'Failed to update call log' });
    }
};

// ✅ NEW FUNCTION: Delete Call Log (Soft Delete)
export const deleteCallLog = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        // Soft delete: We just set the deletedAt timestamp
        await prisma.callLog.update({
            where: { id },
            data: { deletedAt: new Date() }
        });

        return res.json({ success: true, message: 'Call log moved to trash' });
    } catch (error) {
        console.error('Delete Log Error:', error);
        return res.status(500).json({ error: 'Failed to delete call log' });
    }
};