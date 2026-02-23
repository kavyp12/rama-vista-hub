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

// --- NEW FUNCTION 1: INITIATE CALL VIA MCUBE ---
export const initiateMcubeCall = async (req: AuthRequest, res: Response) => {
  try {
    const { leadPhone } = req.body;
    
    // Find the current agent's phone number
    const agent = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!agent || !agent.phone) {
      return res.status(400).json({ error: 'Agent phone number not found in database' });
    }

    // Your MCUBE token (Store this in your .env file)
    const mcubeToken = process.env.MCUBE_TOKEN || 'YOUR_MCUBE_TOKEN'; 

    // Make the request to MCUBE Outbound API
    const response = await axios.post('https://api.mcube.com/Restmcube-api/outbound-calls', {
      HTTP_AUTHORIZATION: mcubeToken,
      exenumber: agent.phone,     
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
    const { callto, emp_phone, dialstatus, filename, answeredtime, callid } = callData;

    // 1. Find Lead and Agent by phone number (using contains to handle +91 formatting differences)
    const lead = await prisma.lead.findFirst({ where: { phone: { contains: callto.slice(-10) } } });
    const agent = await prisma.user.findFirst({ where: { phone: { contains: emp_phone.slice(-10) } } });

    if (!lead || !agent) {
      return res.status(404).json({ error: 'Lead or Agent not found' });
    }

    // 2. Map MCUBE dialstatus to CRM status
    // 2. Map MCUBE dialstatus to CRM status
    // Explicitly typing it satisfies Prisma's enum requirement
    let mappedStatus: "not_connected" | "connected_positive" = "not_connected";
    
    if (dialstatus === 'ANSWER') {
        mappedStatus = "connected_positive"; 
    } else if (dialstatus === 'Busy' || dialstatus === 'NoAnswer' || dialstatus === 'CANCEL') {
        mappedStatus = "not_connected";
    }

    // Convert answeredtime (e.g., "00:00:04") to seconds
    let durationInSeconds = null;
    if (answeredtime) {
        const parts = answeredtime.split(':');
        if(parts.length === 3) {
            durationInSeconds = (+parts[0]) * 60 * 60 + (+parts[1]) * 60 + (+parts[2]); 
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

    // MUST return 200 OK so MCUBE knows it was received
    return res.status(200).send('Webhook processed successfully');
  } catch (error) {
    console.error('MCUBE Webhook Error:', error);
    return res.status(500).send('Webhook processing failed');
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
        const data = req.body;
        const updatedLog = await prisma.callLog.update({ where: { id }, data });
        return res.json(updatedLog);
    } catch (error) {
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