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

    console.log('\n📞 MCUBE WEBHOOK HIT:', new Date().toISOString());
    console.log('📦 Raw payload:', JSON.stringify(callData, null, 2));

    const {
      callfrom,
      callto,
      dialstatus,
      executive,
      customer,
      status,
      callType,
      filename,
      duration,
      callid,
      agentname,
    } = callData;

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

    // ✅ FIX 1: Case-insensitive connected check — MCUBE sends different casing
    const rawDialstatus = String(dialstatus || '').toUpperCase().trim();
    const rawStatus = String(status || '').toLowerCase().trim();

    const isConnected =
      rawDialstatus === 'ANSWER' ||
      rawDialstatus === 'ANSWERED' ||
      rawDialstatus === 'CONNECTED' ||
      rawStatus.includes('complete') ||
      rawStatus.includes('connected') ||
      rawStatus.includes('answered');

    console.log(`✅ isConnected: ${isConnected} | rawDialstatus: "${rawDialstatus}" | rawStatus: "${rawStatus}"`);

    const callStatus: 'connected_positive' | 'not_connected' = isConnected
      ? 'connected_positive'
      : 'not_connected';

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

    const callTypeLabel = callType || 'Inbound';
    // ✅ FIX 2: Store recording URL/filename clearly so frontend can parse it
    const recordingValue = filename && filename !== '' && filename !== 'None' ? filename : 'None';
    const baseNotes = `Auto-logged via MCUBE ${callTypeLabel} | Call ID: ${callid || 'N/A'} | Agent: ${agentname || cleanAgentPhone || 'Unknown'} | Recording: ${recordingValue}`;

    const lead = await prisma.lead.findFirst({
      where: { phone: { contains: cleanLeadPhone } },
      include: { assignedTo: true }
    });

    // ✅ FIX 3: Find agent by phone — includes admin role too, not just sales_agent
    const agentsByPhone: any[] = cleanAgentPhone.length >= 8
      ? await prisma.user.findMany({
          where: { phone: { contains: cleanAgentPhone }, isActive: true },
          orderBy: { createdAt: 'desc' }
        })
      : [];

    if (agentsByPhone.length > 1) {
      console.warn(`⚠️  ${agentsByPhone.length} users share phone ${cleanAgentPhone}: ${agentsByPhone.map(u => `${u.fullName}(${u.role})`).join(', ')} — logging for ALL of them.`);
    }

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

    if (lead && lead.assignedTo && lead.assignedTo.role === 'sales_agent') {
      const salesAgent = lead.assignedTo;

      const recipientIds = new Set<string>([salesAgent.id]);
      agentsByPhone.forEach(u => recipientIds.add(u.id));

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

      const taskNote = isConnected
        ? `📞 Your lead ${lead.name} (${cleanLeadPhone}) just called. Please follow up when free.`
        : `📵 Missed call from your lead ${lead.name} (${cleanLeadPhone}). Please call them back.`;

      await prisma.followUpTask.create({
        data: {
          leadId: lead.id,
          agentId: salesAgent.id,
          taskType: 'callback',
          scheduledAt: new Date(),
          notes: taskNote,
        }
      });

      await prisma.lead.update({
        where: { id: lead.id },
        data: { lastContactedAt: new Date() }
      });

      console.log(`✅ Call logged for assigned agent: ${salesAgent.fullName}`);
      return res.status(200).send('OK: Logged for assigned sales agent');
    }

    // ✅ FIX 4: If lead assigned to ADMIN — log under that admin (not just sales_agent)
    if (lead && lead.assignedTo) {
      const assignedUser = lead.assignedTo;

      const recipientIds = new Set<string>([assignedUser.id]);
      agentsByPhone.forEach(u => recipientIds.add(u.id));

      await Promise.all([...recipientIds].map(agentId =>
        prisma.callLog.create({
          data: {
            leadId: lead.id,
            agentId,
            callStatus,
            callDate: new Date(),
            callDuration: durationInSeconds,
            notes: baseNotes,
          }
        })
      ));

      await prisma.lead.update({
        where: { id: lead.id },
        data: { lastContactedAt: new Date() }
      });

      console.log(`✅ Call logged for assigned user (${assignedUser.role}): ${assignedUser.fullName}`);
      return res.status(200).send('OK: Logged for assigned user');
    }

    // Unassigned lead — find or create, log under admin
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin', isActive: true },
      orderBy: { createdAt: 'asc' }
    });

    let targetLead = lead;

    if (!targetLead) {
      const callerName = agentname
        ? `New Lead - ${agentname}`
        : `Unverified MCUBE Caller - ${cleanLeadPhone}`;

      targetLead = await prisma.lead.create({
        data: {
          name: callerName,
          phone: cleanLeadPhone,
          stage: 'unverified' as any,
          source: 'inbound_call',
          assignedToId: adminUser?.id || null,
        },
        include: { assignedTo: true }
      });
      console.log(`🆕 New lead created: ${targetLead.name}`);
    }

    const logAgentId = agentsByPhone.length > 0 ? agentsByPhone[0].id : adminUser?.id;

    if (logAgentId) {
      await prisma.callLog.create({
        data: {
          leadId: targetLead.id,
          agentId: logAgentId,
          callStatus,
          callDate: new Date(),
          callDuration: durationInSeconds,
          notes: baseNotes,
        }
      });
    }

    if (adminUser) {
      await prisma.followUpTask.create({
        data: {
          leadId: targetLead.id,
          agentId: adminUser.id,
          taskType: 'callback',
          scheduledAt: new Date(),
          notes: `📋 Unassigned lead called: ${cleanLeadPhone}. Please assign to an agent.`,
        }
      });
    }

    await prisma.lead.update({
      where: { id: targetLead.id },
      data: { lastContactedAt: new Date() }
    });

    console.log(`✅ Unassigned call logged under admin`);
    return res.status(200).send('OK: Unassigned call logged');

  } catch (error) {
    console.error('❌ MCUBE Webhook Error:', error);
    return res.status(200).send('Webhook received with error — check server logs');
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
    const { leadId, view, search, date, dateFrom, dateTo, callStatus, agentId, minDuration, direction } = req.query;

    const where: any = { deletedAt: null };
    if (leadId) where.leadId = leadId;

    // ── Search ──
    if (search) {
      where.OR = [
        { lead: { name: { contains: search as string, mode: 'insensitive' } } },
        { lead: { phone: { contains: search as string } } }
      ];
    }

    // ── Date filter ──
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

    // ── Call status filter ──
    if (callStatus && callStatus !== 'all') {
      where.callStatus = callStatus as string;
    }

    // ── Agent filter ──
    if (req.user!.role === 'sales_agent') {
      where.agentId = req.user!.userId;
    } else if (agentId && agentId !== 'all') {
      where.agentId = agentId as string;
    }

    // ── Minimum call duration filter ──
    if (minDuration && minDuration !== 'all') {
      where.callDuration = { gte: parseInt(minDuration as string, 10) };
    }

    // ── Direction Filter (from Dropdown) ──
    if (direction && direction !== 'all') {
      where.notes = { contains: direction === 'inbound' ? 'Inbound' : 'Outbound', mode: 'insensitive' };
    }

    // ── View presets ──
    switch (view) {
      case 'missed': where.callStatus = 'not_connected'; break;
      case 'attended': where.callStatus = { in: ['connected_positive', 'connected_callback', 'not_interested'] }; break;
      case 'qualified': where.callStatus = 'connected_positive'; break;
      case 'unqualified': where.callStatus = 'not_interested'; break;
      case 'archive': where.isArchived = true; break;
      case 'inbound': where.notes = { contains: 'Inbound', mode: 'insensitive' }; break; // New
      case 'outbound': where.notes = { contains: 'Outbound', mode: 'insensitive' }; break; // New
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
    const agentId =
      req.user!.role === 'sales_agent'
        ? req.user!.userId
        : (req.query.agentId as string);

    const dateQuery = req.query.date as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const direction = req.query.direction as string;

    const whereClause: any = { deletedAt: null };

    if (agentId && agentId !== 'all') {
      whereClause.agentId = agentId;
    }

    // ── Direction filter (for main stats) ──
    if (direction && direction !== 'all') {
      whereClause.notes = {
        contains: direction === 'inbound' ? 'Inbound' : 'Outbound',
        mode: 'insensitive'
      };
    }

    // ── Date filter ──
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

    // ── Main grouped stats ──
    const callsByStatus = await prisma.callLog.groupBy({
      by: ['callStatus'],
      where: whereClause,
      _count: true
    });

    const totalCalls = callsByStatus.reduce(
      (sum, item) => sum + item._count,
      0
    );

    const connectedCalls = callsByStatus
      .filter(item => item.callStatus.startsWith('connected'))
      .reduce((sum, item) => sum + item._count, 0);

    // ── Inbound / Outbound stats ──
    const inboundWhere = {
      ...whereClause,
      notes: { contains: 'Inbound', mode: 'insensitive' as const }
    };

    const outboundWhere = {
      ...whereClause,
      notes: { contains: 'Outbound', mode: 'insensitive' as const }
    };

    const [inboundStats, outboundStats] = await Promise.all([
      prisma.callLog.groupBy({
        by: ['callStatus'],
        where: inboundWhere,
        _count: true
      }),
      prisma.callLog.groupBy({
        by: ['callStatus'],
        where: outboundWhere,
        _count: true
      })
    ]);

    const inboundTotal = inboundStats.reduce(
      (s, i) => s + i._count,
      0
    );

    const outboundTotal = outboundStats.reduce(
      (s, i) => s + i._count,
      0
    );

    const inboundConnected = inboundStats
      .filter(i => i.callStatus.startsWith('connected'))
      .reduce((s, i) => s + i._count, 0);

    const outboundConnected = outboundStats
      .filter(i => i.callStatus.startsWith('connected'))
      .reduce((s, i) => s + i._count, 0);

    const inboundMissed =
      inboundStats.find(i => i.callStatus === 'not_connected')?._count || 0;

    const outboundMissed =
      outboundStats.find(i => i.callStatus === 'not_connected')?._count || 0;

    const newLeadsCount = await prisma.lead.count({
      where: { stage: 'new' }
    });

    return res.json({
      totalCalls,
      connectedCalls,
      notAnswered:
        callsByStatus.find(i => i.callStatus === 'not_connected')?._count || 0,
      positive:
        callsByStatus.find(i => i.callStatus === 'connected_positive')?._count || 0,
      negative:
        callsByStatus.find(i => i.callStatus === 'not_interested')?._count || 0,
      callback:
        callsByStatus.find(i => i.callStatus === 'connected_callback')?._count || 0,
      connectRate:
        totalCalls > 0
          ? Math.round((connectedCalls / totalCalls) * 100)
          : 0,

      // ── NEW FIELDS ──
      inboundTotal,
      outboundTotal,
      inboundConnected,
      outboundConnected,
      inboundMissed,
      outboundMissed,

      newLeads: newLeadsCount
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to fetch call stats'
    });
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