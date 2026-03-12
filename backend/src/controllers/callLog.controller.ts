import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { addHours } from 'date-fns';
import axios from 'axios';

const createCallLogSchema = z.object({
  leadId: z.string(),
  callStatus: z.enum(['connected_positive', 'connected_callback', 'not_connected', 'not_interested']),
  duration: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  callbackScheduledAt: z.string().optional().nullable(),
  rejectionReason: z.string().optional().nullable()
});

// --- NEW FUNCTION 3: MCUBE DYNAMIC ROUTING ---
export const mcubeRouting = async (req: Request, res: Response) => {
  try {
    const callerNumber = (req.query.callfrom || req.body.callfrom || req.query.caller_id || req.body.caller_id || '') as string;

    if (!callerNumber) {
      return res.status(200).json({ status: "success", exenumber: "7874755553" });
    }

    const cleanCaller = callerNumber.slice(-10);

    const lead = await prisma.lead.findFirst({
      where: { phone: { contains: cleanCaller } },
      include: { assignedTo: true }
    });

    // 1. If assigned to a sales agent, route directly to them
    if (lead?.assignedTo && lead.assignedTo.role === 'sales_agent' && lead.assignedTo.phone) {
      return res.status(200).json({ status: "success", exenumber: lead.assignedTo.phone });
    }

    // 2. Otherwise (unassigned or assigned to someone else), round-robin across admins for sequential hunting
    const admins = await prisma.user.findMany({
      where: { role: 'admin', isActive: true, phone: { not: null } },
      orderBy: { lastContactedAt: 'asc' }
    });

    if (admins.length > 0) {
      const selectedAdmin = admins[0];
      await prisma.user.update({
        where: { id: selectedAdmin.id },
        data: { lastContactedAt: new Date() }
      });

      // Sequential comma-separated hunting list for admins: 1st, 2nd, 3rd, etc.
      const exeNumbers = admins.map(a => a.phone).join(',');
      return res.status(200).json({ status: "success", exenumber: exeNumbers });
    }

    return res.status(200).json({ status: "success", exenumber: "7874755553" });
  } catch (error) {
    console.error('MCUBE Routing Error:', error);
    return res.status(200).json({ status: "success", exenumber: "7874755553" });
  }
};

// --- NEW FUNCTION 1: INITIATE CALL VIA MCUBE ---
export const initiateMcubeCall = async (req: AuthRequest, res: Response) => {
  try {
    const { leadPhone } = req.body;

    // Find the logged-in user's phone number
    const currentUser = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    let exeNumberToRing = currentUser?.phone;

    // If Admin/Manager has no phone number, fallback to the Lead's Assigned Agent's phone
    if (!exeNumberToRing && (currentUser?.role === 'admin' || currentUser?.role === 'sales_manager')) {
      const lead = await prisma.lead.findFirst({
        where: { phone: { contains: leadPhone.slice(-10) } },
        include: { assignedTo: true }
      });
      if (lead?.assignedTo?.phone) {
        exeNumberToRing = lead.assignedTo.phone;
      }
    }

    if (!exeNumberToRing) {
      return res.status(400).json({ error: 'No phone number available to route the call. Please add a phone number to your profile or assign an agent.' });
    }

    // ✅ FIX G9: Throw if MCUBE_TOKEN is not configured — never silently use placeholder
    const mcubeToken = process.env.MCUBE_TOKEN;
    if (!mcubeToken) {
      return res.status(503).json({ error: 'MCUBE dialer not configured. Please set MCUBE_TOKEN in environment variables.' });
    }

    // Make the request to MCUBE Outbound API
    const response = await axios.post('https://api.mcube.com/Restmcube-api/outbound-calls', {
      HTTP_AUTHORIZATION: mcubeToken,
      exenumber: exeNumberToRing,
      custnumber: leadPhone,
      refurl: "1"
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    return res.status(200).json({ success: true, message: 'Call initiated via MCUBE', data: response.data });
  } catch (error) {
    console.error('MCUBE Call Initiate Error:', error);
    return res.status(500).json({ error: 'Failed to initiate call via MCUBE' });
  }
};

// --- NEW FUNCTION 2: RECEIVE CALL DATA FROM MCUBE (WEBHOOK) ---
export const mcubeWebhook = async (req: Request, res: Response) => {
  try {
    const callData = req.body;

    // Extract MCUBE payload data based on their docs
    const { callfrom, callto, dialstatus, filename, duration, callid } = callData;

    // ✅ FIX C3: Guard against missing / too-short phone fields
    // Always respond 200 first so MCUBE doesn't retry on validation failures
    if (!callfrom || typeof callfrom !== 'string' || callfrom.length < 10) {
      console.warn('MCUBE Webhook: invalid or missing callfrom field', callData);
      return res.status(200).send('Webhook received (invalid callfrom)');
    }
    if (!callto || typeof callto !== 'string' || callto.length < 10) {
      console.warn('MCUBE Webhook: invalid or missing callto field', callData);
      return res.status(200).send('Webhook received (invalid callto)');
    }

    // 1. Find Lead and Agent by phone number (using contains to handle +91 formatting differences)
    // callfrom = Customer (Lead), callto = Agent
    const lead = await prisma.lead.findFirst({ where: { phone: { contains: callfrom.slice(-10) } } });
    const agent = await prisma.user.findFirst({ where: { phone: { contains: callto.slice(-10) } } });

    // ✅ FIX C3: Return 200 (not 404) so MCUBE doesn't retry when lead/agent isn't in CRM
    if (!lead || !agent) {
      console.warn('MCUBE Webhook: Lead or Agent not found for phones', { callfrom, callto });
      return res.status(200).send('Webhook received (lead or agent not found in CRM)');
    }

    // 2. Map MCUBE dialstatus to CRM status
    let mappedStatus: "not_connected" | "connected_positive" = "not_connected";

    if (dialstatus === 'ANSWER') {
      mappedStatus = "connected_positive";
    } else if (dialstatus === 'Busy' || dialstatus === 'NoAnswer' || dialstatus === 'CANCEL') {
      mappedStatus = "not_connected";
    }

    // Convert duration to seconds (can be "00:00:04" or just "7")
    let durationInSeconds = null;
    if (duration) {
      const durationStr = String(duration);
      if (durationStr.includes(':')) {
        const parts = durationStr.split(':');
        if (parts.length === 3) {
          durationInSeconds = (+parts[0]) * 60 * 60 + (+parts[1]) * 60 + (+parts[2]);
        } else if (parts.length === 2) {
          durationInSeconds = (+parts[0]) * 60 + (+parts[1]);
        }
      } else {
        durationInSeconds = parseInt(durationStr, 10);
      }
    }

    // 3. Auto-create the call log
    await prisma.callLog.create({
      data: {
        leadId: lead.id,
        agentId: agent.id,
        callStatus: mappedStatus,
        callDate: new Date(),
        callDuration: durationInSeconds,
        notes: `System Auto-Logged via MCUBE. \nCall ID: ${callid || 'N/A'}\nRecording: ${filename || 'No recording provided'}`,
      }
    });

    // 4. Update lead stage automatically if connected
    if (mappedStatus === 'connected_positive') {
      const stageProgression: Record<string, string> = {
        'new': 'contacted',
        'contacted': 'site_visit'
      };
      const nextStage = stageProgression[lead.stage] || lead.stage;

      await prisma.lead.update({
        where: { id: lead.id },
        data: { stage: nextStage as any, temperature: 'hot' }
      });
    }

    // 5. Auto-schedule a FollowUpTask (Notification) for missed calls
    if (mappedStatus === 'not_connected') {
      await prisma.followUpTask.create({
        data: {
          leadId: lead.id,
          agentId: agent.id,
          taskType: 'callback',
          scheduledAt: addHours(new Date(), 2),
          notes: 'Missed incoming call from Lead. Please call back when free.',
        }
      });
    }

    // ✅ MUST return 200 OK so MCUBE knows it was received
    return res.status(200).send('Webhook processed successfully');
  } catch (error) {
    console.error('MCUBE Webhook Error:', error);
    // ✅ FIX C3: Always return 200 even on internal errors to prevent MCUBE retries
    return res.status(200).send('Webhook received (internal error during processing)');
  }
};

// --- EXISTING FUNCTIONS ---
export const createCallLog = async (req: AuthRequest, res: Response) => {
  try {
    const data = createCallLogSchema.parse(req.body);

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
        lead: { select: { id: true, name: true, phone: true, stage: true, assignedToId: true } }
      }
    });

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
        data: { stage: nextStage as any, temperature: 'hot' }
      });

    } else if (data.callStatus === 'connected_callback' && data.callbackScheduledAt) {
      await prisma.followUpTask.create({
        data: {
          leadId: data.leadId, agentId: req.user!.userId, taskType: 'callback',
          scheduledAt: new Date(data.callbackScheduledAt), notes: data.notes || 'Callback requested'
        }
      });
      await prisma.lead.update({
        where: { id: data.leadId }, data: { nextFollowupAt: new Date(data.callbackScheduledAt) }
      });

    } else if (data.callStatus === 'not_connected') {
      const retryTime = addHours(new Date(), 2);
      await prisma.followUpTask.create({
        data: {
          leadId: data.leadId, agentId: req.user!.userId, taskType: 'retry_call',
          scheduledAt: retryTime, notes: 'Auto-scheduled retry call'
        }
      });
      await prisma.lead.update({
        where: { id: data.leadId }, data: { nextFollowupAt: retryTime }
      });

    } else if (data.callStatus === 'not_interested') {
      await prisma.lead.update({
        where: { id: data.leadId },
        data: { stage: 'closed', notes: `Closed - Reason: ${data.rejectionReason || 'Not interested'}` }
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId, action: 'call_logged', entityType: 'call_log', entityId: callLog.id,
        details: { leadName: callLog.lead.name, callStatus: data.callStatus }
      }
    });

    return res.status(201).json(callLog);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    return res.status(500).json({ error: 'Failed to create call log' });
  }
};

export const getCallLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { leadId, view, search } = req.query;

    const where: any = { deletedAt: null };
    if (leadId) where.leadId = leadId;

    if (search) {
      where.OR = [
        { lead: { name: { contains: search as string, mode: 'insensitive' } } },
        { lead: { phone: { contains: search as string } } }
      ];
    }

    if (req.user!.role === 'sales_agent') where.agentId = req.user!.userId;

    switch (view) {
      case 'missed': where.callStatus = 'not_connected'; break;
      case 'attended': where.callStatus = { in: ['connected_positive', 'connected_callback', 'not_interested'] }; break;
      case 'qualified': where.callStatus = 'connected_positive'; break;
      case 'unqualified': where.callStatus = 'not_interested'; break;
      case 'archive': where.isArchived = true; break;
      case 'deleted':
        delete where.deletedAt;
        where.deletedAt = { not: null };
        break;
      default: break;
    }

    const callLogs = await prisma.callLog.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, phone: true, temperature: true, stage: true } },
        agent: { select: { id: true, fullName: true } }
      },
      orderBy: { callDate: 'desc' },
      take: 100
    });

    return res.json(callLogs);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch call logs' });
  }
};

export const getCallStats = async (req: AuthRequest, res: Response) => {
  try {
    const agentId = req.user!.role === 'sales_agent' ? req.user!.userId : (req.query.agentId as string);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const callsByStatus = await prisma.callLog.groupBy({
      by: ['callStatus'],
      where: { agentId, callDate: { gte: today }, deletedAt: null },
      _count: true
    });

    const totalCalls = callsByStatus.reduce((sum, item) => sum + item._count, 0);
    const connectedCalls = callsByStatus.filter(item => item.callStatus.startsWith('connected')).reduce((sum, item) => sum + item._count, 0);

    const stats = {
      totalCalls, connectedCalls,
      notAnswered: callsByStatus.find(i => i.callStatus === 'not_connected')?._count || 0,
      positive: callsByStatus.find(i => i.callStatus === 'connected_positive')?._count || 0,
      negative: callsByStatus.find(i => i.callStatus === 'not_interested')?._count || 0,
      connectRate: totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0
    };

    return res.json(stats);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch call stats' });
  }
};

export const updateCallLog = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    // ✅ FIX H8: Only allow updating safe fields — never allow leadId/agentId/callDate overwrites
    const updateSchema = z.object({
      notes: z.string().optional().nullable(),
      isArchived: z.boolean().optional(),
      callStatus: z.enum(['connected_positive', 'connected_callback', 'not_connected', 'not_interested']).optional()
    });
    const data = updateSchema.parse(req.body);

    // ✅ FIX H8: Authorization — agents can only edit their own call logs
    const existing = await prisma.callLog.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Call log not found' });

    if (role === 'sales_agent' && existing.agentId !== userId) {
      return res.status(403).json({ error: 'You can only update your own call logs.' });
    }

    const updatedLog = await prisma.callLog.update({ where: { id }, data });
    return res.json(updatedLog);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    return res.status(500).json({ error: 'Failed to update call log' });
  }
};

export const deleteCallLog = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.callLog.update({ where: { id }, data: { deletedAt: new Date() } });
    return res.json({ success: true, message: 'Call log moved to trash' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete call log' });
  }
};