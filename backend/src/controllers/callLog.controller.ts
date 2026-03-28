import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { addHours } from 'date-fns';
import axios from 'axios';

// ─────────────────────────────────────────────
// VALIDATION SCHEMA
// ─────────────────────────────────────────────
const createCallLogSchema = z.object({
  leadId: z.string(),
  callStatus: z.enum(['connected_positive', 'connected_callback', 'not_connected', 'not_interested']),
  duration: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  callbackScheduledAt: z.string().optional().nullable(),
  rejectionReason: z.string().optional().nullable()
});


// ─────────────────────────────────────────────
// FUNCTION 1: INITIATE OUTBOUND CALL VIA MCUBE
// POST /api/call-logs/initiate-mcube
// Body: { leadPhone: "9879985607" }
// ─────────────────────────────────────────────
export const initiateMcubeCall = async (req: AuthRequest, res: Response) => {
  try {
    const { leadPhone } = req.body;

    if (!leadPhone) {
      return res.status(400).json({ error: 'leadPhone is required.' });
    }

    const mcubeApiKey = process.env.MCUBE_TOKEN;
    if (!mcubeApiKey) {
      return res.status(503).json({ error: 'MCUBE_TOKEN not set in environment.' });
    }

    // The logged-in user's phone is used as exenumber (agent making the call)
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.userId }
    });

    if (!currentUser?.phone) {
      return res.status(400).json({
        error: 'Your account has no phone number set. Ask admin to add your phone number in the Team settings.'
      });
    }

    // MCUBE Classic Outbound API
    // GET https://mcube.vmc.in/api/outboundcall?apikey=X&exenumber=AGENT&custnumber=LEAD
    const response = await axios.get('https://mcube.vmc.in/api/outboundcall', {
      params: {
        apikey: mcubeApiKey,
        exenumber: currentUser.phone,   // Agent's number (rings first)
        custnumber: leadPhone,           // Lead's number (rings after agent picks up)
      }
    });


    // ── FIX: Immediately save a pending CallLog so call appears in CRM right away ──
    // The webhook will enrich this later with duration/recording once MCUBE posts back.
    const cleanLeadPhone = String(leadPhone).replace(/\D/g, '').slice(-10);
    const lead = await prisma.lead.findFirst({
      where: { phone: { contains: cleanLeadPhone } }
    });

    if (!lead) {
      // If the lead doesn't exist in our CRM database, we shouldn't fail silently.
      // We must tell the frontend that it cannot log a call for a non-existent lead.
      return res.status(404).json({ 
        error: `Could not log call. No lead found in the CRM with phone number ${cleanLeadPhone}. Make sure the lead is saved first.` 
      });
    }

    // Stamp last contacted so lead list stays fresh
    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastContactedAt: new Date() }
    });

    return res.status(200).json({
      success: true,
      message: 'Call initiated via MCUBE',
      mcubeResponse: response.data
    });

  } catch (error) {
    console.error('MCUBE Initiate Call Error:', error);
    return res.status(500).json({ error: 'Failed to initiate call via MCUBE' });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION 2: MCUBE WEBHOOK (INBOUND + OUTBOUND)
// POST /api/call-logs/mcube-webhook   ← configure this URL in MCUBE dashboard
//
// LOGIC:
//  - MCUBE sends call data after every call (inbound or outbound)
//  - We look up the lead by caller phone number
//  - CASE A: Lead IS assigned to a Sales Agent
//            → Log the call under that Sales Agent
//            → Create a follow-up task so Sales Agent is notified
//  - CASE B: Lead is NOT assigned (new or unassigned)
//            → Create the lead if it doesn't exist
//            → Log the call under the Admin
//            → Create a task for Admin to assign this lead
// ─────────────────────────────────────────────────────────────────────────────
export const mcubeWebhook = async (req: Request, res: Response) => {
  try {
    const callData = req.body;

    // ── DIAGNOSTIC LOGGING — remove after MCUBE is confirmed working ──
    console.log('\n📞 MCUBE WEBHOOK HIT:', new Date().toISOString());
    console.log('📦 Raw payload:', JSON.stringify(callData, null, 2));

    // ── Parse payload ──
    // INBOUND  fields: callfrom (customer), callto (agent), dialstatus, duration, callid, filename, calltype
    // OUTBOUND fields: customer (lead),     executive (agent), status,    duration, callid, filename, callType
    const {
      callfrom,    // inbound: customer phone
      callto,      // inbound: agent phone
      dialstatus,  // inbound: ANSWER / CANCEL / Busy / NoAnswer
      executive,   // outbound: agent phone
      customer,    // outbound: lead phone
      status,      // outbound: "Call complete" / "Customer Busy" / "Executive Busy"
      callType,    // "Outbound" or undefined (inbound)
      filename,    // recording URL
      duration,    // "00:00:31" or seconds as string
      callid,      // unique call ID from MCUBE
      agentname,   // agent name from MCUBE (informational)
    } = callData;

    // Determine which field is the lead's phone
    const rawLeadPhone = (customer || callfrom || '') as string;
    const rawAgentPhone = (executive || callto || '') as string;

    console.log(`📱 Lead phone raw: "${rawLeadPhone}" | Agent phone raw: "${rawAgentPhone}"`);
    console.log(`📋 callType: ${callType} | dialstatus: ${dialstatus} | status: ${status} | duration: ${duration}`);

    if (!rawLeadPhone || rawLeadPhone.length < 6) {
      console.warn('⚠️  Webhook rejected: no lead phone in payload');
      return res.status(200).send('Webhook received (no lead phone in payload)');
    }

    const cleanLeadPhone = rawLeadPhone.replace(/\D/g, '').slice(-10);
    const cleanAgentPhone = rawAgentPhone.replace(/\D/g, '').slice(-10);

    // ── Was the call answered? ──
    const isConnected =
      dialstatus === 'ANSWER' ||
      status === 'Call complete';

    const callStatus: 'connected_positive' | 'not_connected' = isConnected
      ? 'connected_positive'
      : 'not_connected';

    // ── Parse duration to seconds ──
    let durationInSeconds: number | null = null;
    if (duration) {
      const d = String(duration);
      if (d.includes(':')) {
        const parts = d.split(':').map(Number);
        if (parts.length === 3) durationInSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        else if (parts.length === 2) durationInSeconds = parts[0] * 60 + parts[1];
      } else {
        durationInSeconds = parseInt(d, 10) || null;
      }
    }

    // ── Build notes string ──
    const callTypeLabel = callType || 'Inbound';
    const baseNotes = `Auto-logged via MCUBE ${callTypeLabel} | Call ID: ${callid || 'N/A'} | Agent: ${agentname || cleanAgentPhone || 'Unknown'} | Recording: ${filename || 'None'}`;

    // ── Look up the lead by phone ──
    const lead = await prisma.lead.findFirst({
      where: { phone: { contains: cleanLeadPhone } },
      include: { assignedTo: true }
    });

    // ── Look up ALL CRM users who share the agent phone number ──
    // Sorted so sales_agent comes before sales_manager before admin.
    // When 2 agents share a number (e.g. kavy + Vishwa), BOTH get a log.
    const agentsByPhone: any[] = cleanAgentPhone.length >= 8
      ? await prisma.user.findMany({
          where: { phone: { contains: cleanAgentPhone }, isActive: true },
          orderBy: { createdAt: 'desc' }  // most recently added first
        })
      : [];

    if (agentsByPhone.length > 1) {
      console.warn(`⚠️  ${agentsByPhone.length} users share phone ${cleanAgentPhone}: ${agentsByPhone.map(u => `${u.fullName}(${u.role})`).join(', ')} — logging for ALL of them.`);
    }

    // ── OUTBOUND DEDUP: If this is an outbound call, update the pending log instead of creating a new one ──
    if (callType === 'Outbound' && callid && callid !== 'N/A') {
      const existingLog = await prisma.callLog.findFirst({
        where: {
          notes: { contains: `Call ID: ${callid}` },
          callStatus: 'not_connected',
        }
      });

      if (existingLog) {
        await prisma.callLog.update({
          where: { id: existingLog.id },
          data: {
            callStatus,
            callDuration: durationInSeconds,
            notes: baseNotes,
          }
        });
        console.log(`✅ Updated existing outbound log for Call ID: ${callid}`);
        return res.status(200).send('OK: Outbound log updated');
      }
    }
    

    // ════════════════════════════════════════════════════════════
    // CASE A: Lead IS assigned to a known sales agent
    //         → Log for the ASSIGNED agent AND for all agents sharing that phone.
    //           This way if 2 agents share a number, both get credit.
    // ════════════════════════════════════════════════════════════
    if (lead && lead.assignedTo && lead.assignedTo.role === 'sales_agent') {
      const salesAgent = lead.assignedTo;

      // Collect all agent IDs that should receive this call log.
      // Always include the currently-assigned agent.
      // Also include every other active user who shares the calling phone number.
      const recipientIds = new Set<string>([salesAgent.id]);
      agentsByPhone.forEach(u => recipientIds.add(u.id));

      // Create a call log for each recipient
      await Promise.all([...recipientIds].map(agentId =>
        prisma.callLog.create({
          data: {
            leadId: lead.id,
            agentId,
            callStatus,
            callDate: new Date(),
            callDuration: durationInSeconds,
            notes: baseNotes + (recipientIds.size > 1 ? ' | 👥 Shared number — logged for multiple agents' : ''),
          }
        })
      ));

      // Notify the ASSIGNED agent via a follow-up task
      const taskNote = isConnected
        ? `📞 Your lead ${lead.name} (${cleanLeadPhone}) just called. Please follow up when free.`
        : `📵 Missed call from your lead ${lead.name} (${cleanLeadPhone}). Please call them back.`;

      await prisma.followUpTask.create({
        data: {
          leadId: lead.id,
          agentId: salesAgent.id,
          taskType: 'callback',
          scheduledAt: new Date(),   // show immediately in their task list
          notes: taskNote,
        }
      });

      // If connected → advance lead stage
      if (isConnected) {
        const stageProgression: Record<string, string> = {
          'new': 'contacted',
          'contacted': 'site_visit',
          'site_visit': 'negotiation',
          'negotiation': 'token'
        };
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            stage: (stageProgression[lead.stage] || lead.stage) as any,
            temperature: 'hot',
            nextFollowupAt: new Date(),
          }
        });
      }

      return res.status(200).send(`OK: Logged for ${recipientIds.size} agent(s)`);
    }

    // ════════════════════════════════════════════════════════════
    // CASE B: Lead NOT assigned (or doesn't exist yet)
    //         → Log under every agent sharing that phone, or fall back to admin
    // ════════════════════════════════════════════════════════════

    // Re-use agentsByPhone already resolved above; fall back to first active admin
    let responsibleAgents: any[] = agentsByPhone;
    if (responsibleAgents.length === 0) {
      const admin = await prisma.user.findFirst({
        where: { role: 'admin', isActive: true },
        orderBy: { createdAt: 'asc' }
      });
      if (admin) responsibleAgents = [admin];
    }

    if (responsibleAgents.length === 0) {
      console.warn('⚠️  Webhook: no active user found in CRM to log this call under');
      return res.status(200).send('Webhook received (no active user found in CRM)');
    }

    // Create the lead if it doesn't exist at all
    let targetLead = lead;
    if (!targetLead) {
      // ── Always capture every inbound caller, even if missed ──
      console.log(`📥 New unknown caller ${cleanLeadPhone} — creating lead in CRM.`);
      targetLead = await prisma.lead.create({
        data: {
          name: `New Inquiry: ${cleanLeadPhone}`,
          phone: cleanLeadPhone,
          stage: 'new',
          temperature: 'warm',
          source: 'inbound_call',
        },
        include: { assignedTo: true }
      });
    }

    // Log the call under EVERY matched agent (handles shared phone numbers)
    await Promise.all(responsibleAgents.map(agent =>
      prisma.callLog.create({
        data: {
          leadId: targetLead!.id,
          agentId: agent.id,
          callStatus,
          callDate: new Date(),
          callDuration: durationInSeconds,
          notes: baseNotes + ' | ⚠️ Unassigned lead — please assign to a Sales Agent.' +
            (responsibleAgents.length > 1 ? ' | 👥 Shared number — logged for multiple agents.' : ''),
        }
      })
    ));

    // Create a task for the first responsible agent
    const notifyAgent = responsibleAgents[0];
    const adminTaskNote = isConnected
      ? `📋 New/unassigned lead ${targetLead.name} (${cleanLeadPhone}) just called. Please assign to a Sales Agent.`
      : `📋 Missed call from new/unassigned lead ${targetLead.name} (${cleanLeadPhone}). Please assign to a Sales Agent.`;

    await prisma.followUpTask.create({
      data: {
        leadId: targetLead.id,
        agentId: notifyAgent.id,
        taskType: 'callback',
        scheduledAt: new Date(),
        notes: adminTaskNote,
      }
    });

    return res.status(200).send(`OK: Logged under ${responsibleAgents.length} agent(s) for assignment`);


  } catch (error) {
    console.error('MCUBE Webhook Error:', error);
    // Always return 200 to MCUBE so they don't retry endlessly
    return res.status(200).send('Webhook received (internal error)');
  }
};



// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION: GET MISSED CALLS DETAIL (for agent notification panel)
// GET /api/call-logs/missed-calls
// Returns recent missed inbound calls with full lead info for the agent
// ─────────────────────────────────────────────────────────────────────────────
export const getMissedCallsDetail = async (req: AuthRequest, res: Response) => {
  try {
    const agentId = req.user!.userId;

    // ── STEP 1: All not_connected call logs for this agent (the TRUE source of missed calls) ──
    // This is the same data source that getCallLogs?view=missed uses, so the count will always match.
    const missedCallLogs = await prisma.callLog.findMany({
      where: {
        agentId,
        callStatus: 'not_connected',
        deletedAt: null,
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            temperature: true,
            stage: true,
            nextFollowupAt: true,
          }
        }
      },
      orderBy: { callDate: 'desc' },
      // ── NO hard cap here — we return ALL missed calls so badge count matches Telecalling page ──
    });

    // ── STEP 2: Pending callback follow-up tasks to know which calls have a taskId ──
    // (used so the frontend can mark a task as "done" after the agent calls back)
    const pendingTasks = await prisma.followUpTask.findMany({
      where: {
        agentId,
        taskType: 'callback',
        status: 'pending',
      },
      select: { id: true, leadId: true, status: true },
    });

    // Build a fast leadId → taskId lookup
    const leadTaskMap = new Map<string, string>();
    for (const t of pendingTasks) {
      if (t.leadId) leadTaskMap.set(t.leadId, t.id);
    }

    // ── STEP 3: Build the final result list ──
    // One entry per call log — no deduplication — so count matches 1:1 with Telecalling's missed view.
    const results = missedCallLogs
      .filter(log => log.lead != null)
      .map(log => {
        const callType: 'inbound_missed' | 'outbound_missed' =
          log.notes?.includes('MCUBE Inbound') ? 'inbound_missed' : 'outbound_missed';

        const taskId = leadTaskMap.get(log.lead!.id);

        return {
          id: log.id,
          leadId: log.lead!.id,
          leadName: log.lead!.name,
          leadPhone: log.lead!.phone,
          temperature: log.lead!.temperature,
          stage: log.lead!.stage,
          calledAt: log.callDate.toISOString(),
          notes: log.notes,
          type: callType,
          // followUpStatus: whether there is still a pending task for this lead
          followUpStatus: taskId ? 'pending' : 'done',
          nextFollowupAt: (log.lead as any).nextFollowupAt?.toISOString?.() ?? null,
          taskId: taskId ?? null,
        };
      });

    // Sort by calledAt descending — newest first
    results.sort((a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime());

    // ── NO .slice() cap — return all so sidebar badge and this page always show the same number ──
    return res.json(results);
  } catch (error) {
    console.error('Missed Calls Detail Error:', error);
    return res.status(500).json({ error: 'Failed to fetch missed calls detail' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING FUNCTIONS BELOW — NO CHANGES NEEDED
// ─────────────────────────────────────────────────────────────────────────────

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
      const nextStage = stageProgression[callLog.lead.stage] || callLog.lead.stage;
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
    const { leadId, view, search, date, dateFrom, dateTo, callStatus, agentId, minDuration } = req.query;

    const where: any = { deletedAt: null };
    if (leadId) where.leadId = leadId;

    // ── Search ──
    if (search) {
      where.OR = [
        { lead: { name: { contains: search as string, mode: 'insensitive' } } },
        { lead: { phone: { contains: search as string } } }
      ];
    }

    // ── Date filter — supports legacy single `date` param AND new dateFrom/dateTo range ──
    if (dateFrom || dateTo) {
      where.callDate = {};
      if (dateFrom) {
        const start = new Date(dateFrom as string);
        start.setHours(0, 0, 0, 0);
        where.callDate.gte = start;
      }
      if (dateTo) {
        const end = new Date(dateTo as string);
        end.setHours(23, 59, 59, 999);
        where.callDate.lte = end;
      }
    } else if (date) {
      const start = new Date(date as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      where.callDate = { gte: start, lte: end };
    }

    // ── Call status filter (from multi-filter panel) ──
    if (callStatus && callStatus !== 'all') {
      where.callStatus = callStatus as string;
    }

    // ── Agent filter (admin only — sales agents always scoped to self) ──
    if (req.user!.role === 'sales_agent') {
      where.agentId = req.user!.userId;
    } else if (agentId && agentId !== 'all') {
      where.agentId = agentId as string;
    }

    // ── Minimum call duration filter (in seconds) ──
    if (minDuration && minDuration !== 'all') {
      where.callDuration = { gte: parseInt(minDuration as string, 10) };
    }

    // ── View presets ──
    switch (view) {
      case 'missed': where.callStatus = 'not_connected'; break;
      case 'attended': where.callStatus = { in: ['connected_positive', 'connected_callback', 'not_interested'] }; break;
      case 'qualified': where.callStatus = 'connected_positive'; break;
      case 'unqualified': where.callStatus = 'not_interested'; break;
      case 'archive': where.isArchived = true; break;
      case 'active': {
        if (!date && !dateFrom) {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          where.callDate = { gte: startOfDay };
        }
        break;
      }
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
      take: 500
    });

    return res.json(callLogs);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch call logs' });
  }
};

export const completeFollowUpTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = await prisma.followUpTask.update({
      where: { id: taskId },
      data: { status: 'completed', completedAt: new Date() }
    });
    return res.json(task);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to complete task' });
  }
};

export const getCallStats = async (req: AuthRequest, res: Response) => {
  try {
    const agentId = req.user!.role === 'sales_agent' ? req.user!.userId : (req.query.agentId as string);
    const dateQuery = req.query.date as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;

    const whereClause: any = { deletedAt: null };
    if (agentId && agentId !== 'all') whereClause.agentId = agentId;

    // Support both legacy single `date` and new dateFrom/dateTo range
    if (dateFrom || dateTo) {
      whereClause.callDate = {};
      if (dateFrom) {
        const start = new Date(dateFrom);
        start.setHours(0, 0, 0, 0);
        whereClause.callDate.gte = start;
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        whereClause.callDate.lte = end;
      }
    } else if (dateQuery) {
      const start = new Date(dateQuery);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      whereClause.callDate = { gte: start, lte: end };
    }

    const callsByStatus = await prisma.callLog.groupBy({
      by: ['callStatus'],
      where: whereClause,
      _count: true
    });

    const totalCalls = callsByStatus.reduce((sum, item) => sum + item._count, 0);
    const connectedCalls = callsByStatus
      .filter(item => item.callStatus.startsWith('connected'))
      .reduce((sum, item) => sum + item._count, 0);
      
    const newLeadsCount = await prisma.lead.count({ where: { stage: 'new' } });

    return res.json({
      totalCalls,
      connectedCalls,
      notAnswered: callsByStatus.find(i => i.callStatus === 'not_connected')?._count || 0,
      positive: callsByStatus.find(i => i.callStatus === 'connected_positive')?._count || 0,
      negative: callsByStatus.find(i => i.callStatus === 'not_interested')?._count || 0,
      callback: callsByStatus.find(i => i.callStatus === 'connected_callback')?._count || 0,
      connectRate: totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0,
      newLeads: newLeadsCount
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch call stats' });
  }
};

export const updateCallLog = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const updateSchema = z.object({
      notes: z.string().optional().nullable(),
      isArchived: z.boolean().optional(),
      callStatus: z.enum(['connected_positive', 'connected_callback', 'not_connected', 'not_interested']).optional()
    });
    const data = updateSchema.parse(req.body);

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