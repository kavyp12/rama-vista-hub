import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { addHours } from 'date-fns';
import axios from 'axios';
import * as mm from 'music-metadata';

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
// Add this helper if you don't have it at the top of the file
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchAndUpdateDuration(callLogId: string, audioUrl: string) {
  // Try only 2 times instead of 3, and wait 30 seconds to let MCUBE upload it
  const waitTimes = [30000, 45000];

  for (let i = 0; i < waitTimes.length; i++) {
    try {
      console.log(`⏳ Background (Attempt ${i + 1}/2): Waiting ${waitTimes[i] / 1000}s for MCUBE...`);
      await delay(waitTimes[i]);

      // 1. CRITICAL: Use 'stream' to prevent downloading megabytes into RAM
      const response = await axios({
        method: 'get',
        url: audioUrl,
        responseType: 'stream',
        timeout: 10000
      });

      // 2. CRITICAL: Use `skipPostHeaders: true` so it stops reading the file the exact millisecond it finds the duration
      const metadata = await mm.parseStream(
        response.data,
        { mimeType: 'audio/wav' },
        { duration: true, skipCovers: true, skipPostHeaders: true }
      );

      // 3. CRITICAL: Destroy the stream instantly so it stops downloading the audio
      response.data.destroy();

      if (metadata.format.duration !== undefined) {
        const durationSecs = Math.round(metadata.format.duration);

        const updateData: any = { callDuration: durationSecs };
        if (durationSecs > 0) updateData.callStatus = 'connected_positive';

        await prisma.callLog.update({
          where: { id: callLogId },
          data: updateData
        });

        console.log(`✅ Success! Duration set to ${durationSecs}s for call ${callLogId}`);
        return; // Success! Exit the loop immediately.
      }

    } catch (error: any) {
      console.error(`❌ Attempt ${i + 1} failed for ${callLogId} (File not ready yet)`);
    }
  }
  console.log(`🛑 Gave up on ${callLogId} after 2 tries.`);
}

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
    let lead = await prisma.lead.findFirst({
      where: { phone: { contains: cleanLeadPhone } }
    });

    if (!lead) {
      // Auto-create an unverified lead so the call gets logged in CRM
      lead = await prisma.lead.create({
        data: {
          name: `Unverified - ${cleanLeadPhone}`,
          phone: cleanLeadPhone,
          stage: 'unverified' as any,
          source: 'outbound_call',
          assignedToId: currentUser.id,   // assign to whoever is calling
        },
        include: { assignedTo: true }
      });
      console.log(`🆕 Auto-created lead for outbound call: ${cleanLeadPhone}`);
    }

    // Stamp last contacted
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
      callid,
      agentname,
    } = callData;
    // Note: duration/billsec accessed via callData.duration and callData.billsec below

    const rawLeadPhone = (customer || callfrom || '') as string;
    const rawAgentPhone = (executive || callto || '') as string;

    if (!rawLeadPhone || rawLeadPhone.length < 6) {
      console.warn('⚠️ Webhook rejected: no lead phone in payload');
      return res.status(200).send('Webhook received (no lead phone in payload)');
    }

    const cleanLeadPhone = rawLeadPhone.replace(/\D/g, '').slice(-10);
    const cleanAgentPhone = rawAgentPhone.replace(/\D/g, '').slice(-10);

    // ─────────────────────────────────────────────────────────────────────
    // 1. EXACT DURATION PARSING (No Dummy Data)
    // ─────────────────────────────────────────────────────────────────────
    let durationInSeconds: number | null = null;
    // MCUBE may send duration as seconds, mm:ss, or hh:mm:ss
    // Also check 'billsec' (some MCUBE versions use this for actual talk time)
    const rawDuration = callData.billsec || callData.duration;
    if (rawDuration) {
      const d = String(rawDuration).trim();
      if (d.includes(':')) {
        const parts = d.split(':').map(Number);
        if (parts.length === 3) durationInSeconds = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
        else if (parts.length === 2) durationInSeconds = (parts[0] || 0) * 60 + (parts[1] || 0);
      } else {
        const parsed = parseInt(d, 10);
        durationInSeconds = isNaN(parsed) ? null : parsed;
      }
    }
    // If duration parsed to 0 but a recording exists, treat as null (recording is the source of truth)
    // The frontend will show duration from the audio file itself
    if (durationInSeconds !== null && durationInSeconds <= 0) {
      durationInSeconds = null;
    }
    console.log(`⏱ Duration parsed: ${durationInSeconds}s (raw: ${rawDuration}, billsec: ${callData.billsec}, duration: ${callData.duration})`);

    // ─────────────────────────────────────────────────────────────────────
    // 2. BULLETPROOF CONNECTION STATUS
    // If there is a recording file, OR duration > 0, the call was connected.
    // ─────────────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────
    // 2. BULLETPROOF CONNECTION STATUS
    // If duration > 0, the call was connected.
    // ─────────────────────────────────────────────────────────────────────
    const rawDialstatus = String(dialstatus || '').toUpperCase().trim();
    const rawStatus = String(status || '').toLowerCase().trim();
    const hasRecording = filename && filename !== '' && filename.toLowerCase() !== 'none';

    const isConnected =
      rawDialstatus === 'ANSWER' ||
      rawDialstatus === 'ANSWERED' ||
      rawDialstatus === 'CONNECTED' ||
      rawStatus.includes('complete') ||
      rawStatus.includes('connected') ||
      rawStatus.includes('answered') ||
      // ❌ Removed 'hasRecording' check from here!
      (durationInSeconds !== null && durationInSeconds > 0);

    const callStatus: 'connected_positive' | 'not_connected' = isConnected ? 'connected_positive' : 'not_connected';

    const callTypeLabel = callType || 'Inbound';
    const recordingValue = hasRecording ? filename : 'None';
    // Always include Duration in notes so the frontend can parse it as a fallback
    const durationLabel = durationInSeconds !== null && durationInSeconds > 0 ? `${durationInSeconds}` : '0';
    const baseNotes = `Auto-logged via MCUBE ${callTypeLabel} | Call ID: ${callid || 'N/A'} | Agent: ${agentname || cleanAgentPhone || 'Unknown'} | Duration: ${durationLabel} | Recording: ${recordingValue}`;

    // ─────────────────────────────────────────────────────────────────────
    // 3. FIND THE EXACT 1 AGENT & 1 LEAD
    // ─────────────────────────────────────────────────────────────────────
    let targetAgentId: string | null = null;

    // First try to find the specific agent/admin who took this call based on their phone number
    if (cleanAgentPhone.length >= 8) {
      const agent = await prisma.user.findFirst({
        where: { phone: { contains: cleanAgentPhone }, isActive: true },
      });
      if (agent) targetAgentId = agent.id;
    }

    // Find the lead
    let lead = await prisma.lead.findFirst({
      where: { phone: { contains: cleanLeadPhone } },
      include: { assignedTo: true }
    });

    // If we still don't have an agent, fallback to the lead's assigned owner, or finally, a default admin
    if (!targetAgentId) {
      if (lead?.assignedToId) {
        targetAgentId = lead.assignedToId;
      } else {
        const defaultAdmin = await prisma.user.findFirst({ where: { role: 'admin', isActive: true } });
        targetAgentId = defaultAdmin?.id || null;
      }
    }

    // If lead doesn't exist, create it Unassigned
    if (!lead) {
      const callerName = agentname ? `New Lead - ${agentname}` : `Unverified MCUBE Caller - ${cleanLeadPhone}`;

      lead = await prisma.lead.create({
        data: {
          name: callerName,
          phone: cleanLeadPhone,
          stage: 'unverified' as any,
          source: 'inbound_call',
          assignedToId: null, // As requested: inbound leads stay unassigned until admin assigns
          assignedById: null,
        },
        include: { assignedTo: true }
      });
      console.log(`🆕 New lead created: ${lead.name}`);
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. UPSERT CALL LOG (Create strictly ONE record per Call ID)
    // ─────────────────────────────────────────────────────────────────────
    const MCUBE_RECORDING_BASE_URL = 'https://recordings.mcube.com';
    let fullAudioUrl: string | null = null;

    if (hasRecording) {
      let cleanPath = filename.trim();
      // ✨ BULLETPROOF CHECK: If MCUBE already includes 'http', use it exactly as-is!
      if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
        fullAudioUrl = cleanPath;
      } else {
        // Otherwise, add the base URL
        if (cleanPath.startsWith('/')) cleanPath = cleanPath.slice(1);
        fullAudioUrl = `${MCUBE_RECORDING_BASE_URL}/${cleanPath}`;
      }
    }

    if (callid && callid !== 'N/A' && callid !== '') {
      const existingLog = await prisma.callLog.findFirst({
        where: { notes: { contains: `Call ID: ${callid}` } }
      });

      if (existingLog) {
        const updatedDuration = durationInSeconds ?? existingLog.callDuration;
        await prisma.callLog.update({
          where: { id: existingLog.id },
          data: {
            callStatus,
            callDuration: updatedDuration,
            notes: baseNotes,
          }
        });

        // 👇 NEW: Trigger background fetch if duration is still 0/null but audio exists
        if ((!updatedDuration || updatedDuration <= 0) && fullAudioUrl) {
          fetchAndUpdateDuration(existingLog.id, fullAudioUrl);
        }

        console.log(`✅ Upserted existing log for Call ID: ${callid}`);
        return res.status(200).send('OK: Call log updated (upsert by callid)');
      }
    }

    // If no existing log exists, create EXACTLY ONE new log
    if (targetAgentId) {
      const newLog = await prisma.callLog.create({
        data: {
          leadId: lead.id,
          agentId: targetAgentId,
          callStatus,
          callDate: new Date(),
          callDuration: durationInSeconds,
          notes: baseNotes,
        }
      });

      // 👇 NEW: If this new call is connected, auto-resolve all previous missed calls
      if (callStatus === 'connected_positive') {
        await prisma.callLog.updateMany({
          where: { leadId: lead.id, callStatus: 'not_connected', id: { not: newLog.id } },
          data: { callStatus: 'connected_positive' }
        });
      }

      // 👇 NEW: Trigger background fetch if duration is 0/null but audio exists
      if ((!durationInSeconds || durationInSeconds <= 0) && fullAudioUrl) {
        fetchAndUpdateDuration(newLog.id, fullAudioUrl);
      }

      await prisma.lead.update({
        where: { id: lead.id },
        data: { lastContactedAt: new Date() }
      });

      const taskNote = isConnected
        ? `📞 Call logged for ${lead.name} (${cleanLeadPhone}). Please follow up when free.`
        : `📵 Missed call from ${lead.name} (${cleanLeadPhone}). Please call them back.`;

      await prisma.followUpTask.create({
        data: {
          leadId: lead.id,
          agentId: targetAgentId,
          taskType: 'callback',
          scheduledAt: new Date(),
          notes: taskNote,
        }
      });

      console.log(`✅ Call logged strictly under ONE user ID: ${targetAgentId}`);
    }



    return res.status(200).send('OK: Call processed successfully');


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
    const role = req.user!.role;

    const whereClause: any = {
      callStatus: 'not_connected', 
      deletedAt: null,
    };

    // Agent visibility: See own calls OR calls from leads assigned to them
    if (role === 'sales_agent') {
      whereClause.OR = [
        { agentId: agentId },
        { lead: { assignedToId: agentId } }
      ];
    }

    const missedCallLogs = await prisma.callLog.findMany({
      where: whereClause,
      include: {
        lead: true // Includes entire lead to prevent missing field crashes
      },
      orderBy: { callDate: 'desc' },
    });

    // Extract lead IDs to find tasks regardless of WHO created the task (Admin or Agent)
    const leadIds = missedCallLogs.map(l => l.leadId).filter(Boolean) as string[];

    const pendingTasks = await prisma.followUpTask.findMany({
      where: {
        leadId: { in: leadIds },
        taskType: 'callback',
        status: 'pending',
        // Removed `agentId: agentId` here so Admin-created tasks don't hide the call!
      },
      select: { id: true, leadId: true, status: true },
    });

    const leadTaskMap = new Map<string, string>();
    for (const t of pendingTasks) {
      if (t.leadId) leadTaskMap.set(t.leadId, t.id);
    }

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
          temperature: log.lead!.temperature || 'cold',
          stage: log.lead!.stage || 'new',
          calledAt: log.callDate.toISOString(),
          notes: log.notes,
          type: callType,
          followUpStatus: taskId ? 'pending' : 'done',
          nextFollowupAt: (log.lead as any).nextFollowupAt?.toISOString?.() ?? null,
          taskId: taskId ?? null,
          leadNotes: (log.lead as any).notes ?? null, 
        };
      });

    return res.json(results);
  } catch (error) {
    console.error('Missed Calls Detail Error:', error);
    return res.status(500).json({ error: 'Failed to fetch missed calls detail' });
  }
};

export const getCallLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { leadId, view, search, date, dateFrom, dateTo, callStatus, agentId, minDuration, direction, take } = req.query;

    // Use an array of AND conditions to prevent Prisma object overrides
    const andConditions: any[] = [{ deletedAt: null }];

    if (leadId) andConditions.push({ leadId });

    if (search) {
      andConditions.push({
        OR: [
          { lead: { name: { contains: search as string, mode: 'insensitive' } } },
          { lead: { phone: { contains: search as string } } },
          { id: { endsWith: search as string, mode: 'insensitive' } }, 
          { leadId: { endsWith: search as string, mode: 'insensitive' } } 
        ]
      });
    }

    const targetDateField = view === 'follow_ups' ? 'callbackScheduledAt' : 'callDate';

    if (dateFrom || dateTo) {
      const dateFilter: any = {};
      if (dateFrom) {
        const start = new Date(dateFrom as string);
        start.setHours(0, 0, 0, 0);
        dateFilter.gte = start;
      }
      if (dateTo) {
        const end = new Date(dateTo as string);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      andConditions.push({ [targetDateField]: dateFilter });
    } else if (date) {
      const start = new Date(date as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      andConditions.push({ [targetDateField]: { gte: start, lte: end } });
    }

    if (callStatus && callStatus !== 'all') {
      andConditions.push({ callStatus: callStatus as string });
    }
    
    // 👇 Bulletproof Agent Visibility for Telecalling List 👇
    if (req.user!.role === 'sales_agent') {
      andConditions.push({
        OR: [
          { agentId: req.user!.userId },
          { lead: { assignedToId: req.user!.userId } }
        ]
      });
    } else if (agentId && agentId !== 'all') {
      andConditions.push({ agentId: agentId as string });
    }

    if (minDuration && minDuration !== 'all') {
      andConditions.push({ callDuration: { gte: parseInt(minDuration as string, 10) } });
    }

    switch (view) {
      case 'follow_ups':
        andConditions.push({ callStatus: 'connected_callback' }); 
        break;
      case 'missed':
        andConditions.push({ callStatus: 'not_connected' });
        break;
      case 'attended': 
        andConditions.push({ callStatus: { in: ['connected_positive', 'connected_callback', 'not_interested'] } }); 
        break;
      case 'qualified': 
        andConditions.push({ callStatus: 'connected_positive' }); 
        break;
      case 'unqualified': 
        andConditions.push({ callStatus: 'not_interested' }); 
        break;
      case 'archive': 
        andConditions.push({ isArchived: true }); 
        break;
      case 'inbound': 
        andConditions.push({ notes: { contains: 'Inbound', mode: 'insensitive' } }); 
        break;
      case 'outbound': 
        andConditions.push({ notes: { contains: 'Outbound', mode: 'insensitive' } }); 
        break;
      case 'active': {
        if (!date && !dateFrom) {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          andConditions.push({ callDate: { gte: startOfDay } });
        }
        break;
      }
      default: break;
    }

    if (direction && direction !== 'all' && !['inbound', 'outbound', 'missed', 'follow_ups'].includes(view as string)) {
      andConditions.push({ notes: { contains: direction === 'inbound' ? 'Inbound' : 'Outbound', mode: 'insensitive' } });
    }

    const where = { AND: andConditions };

    const callLogs = await prisma.callLog.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, phone: true, temperature: true, stage: true } },
        agent: { select: { id: true, fullName: true, role: true } }
      },
      orderBy: view === 'follow_ups' ? { callbackScheduledAt: 'asc' } : { callDate: 'desc' },
      take: take ? Math.min(parseInt(take as string, 10), 2000) : 500
    });

    return res.json(callLogs);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch call logs' });
  }
};


export const getCallStats = async (req: AuthRequest, res: Response) => {
  try {
    const isSalesAgent = req.user!.role === 'sales_agent';
    const currentUserId = req.user!.userId;
    const agentId = req.query.agentId as string;
    
    const dateQuery = req.query.date as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const direction = req.query.direction as string;

    const whereClause: any = { deletedAt: null };

    // 👇 Fixed logic for Agent Visibility in Stats 👇
    if (isSalesAgent) {
      whereClause.OR = [
        { agentId: currentUserId },
        { lead: { assignedToId: currentUserId } }
      ];
    } else if (agentId && agentId !== 'all') {
      whereClause.agentId = agentId;
    }

    if (direction && direction !== 'all') {
      whereClause.notes = {
        contains: direction === 'inbound' ? 'Inbound' : 'Outbound',
        mode: 'insensitive'
      };
    }

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
    const connectedCalls = callsByStatus.filter(item => item.callStatus.startsWith('connected')).reduce((sum, item) => sum + item._count, 0);

    const inboundWhere = { ...whereClause, notes: { contains: 'Inbound', mode: 'insensitive' as const } };
    const outboundWhere = { ...whereClause, notes: { contains: 'Outbound', mode: 'insensitive' as const } };

    const [inboundStats, outboundStats] = await Promise.all([
      prisma.callLog.groupBy({ by: ['callStatus'], where: inboundWhere, _count: true }),
      prisma.callLog.groupBy({ by: ['callStatus'], where: outboundWhere, _count: true })
    ]);

    const inboundTotal = inboundStats.reduce((s, i) => s + i._count, 0);
    const outboundTotal = outboundStats.reduce((s, i) => s + i._count, 0);
    const inboundConnected = inboundStats.filter(i => i.callStatus.startsWith('connected')).reduce((s, i) => s + i._count, 0);
    const outboundConnected = outboundStats.filter(i => i.callStatus.startsWith('connected')).reduce((s, i) => s + i._count, 0);
    const inboundMissed = inboundStats.find(i => i.callStatus === 'not_connected')?._count || 0;
    const outboundMissed = outboundStats.find(i => i.callStatus === 'not_connected')?._count || 0;

    const newLeadsCount = await prisma.lead.count({ where: { stage: 'new' } });

    let adminAssignedLeads = 0;
    if (agentId && agentId !== 'all') {
      adminAssignedLeads = await prisma.lead.count({
        where: { assignedById: agentId } 
      });
    } else {
      adminAssignedLeads = await prisma.lead.count({
        where: { assignedById: { not: null } } 
      });
    }

    return res.json({
      totalCalls,
      connectedCalls,
      notAnswered: callsByStatus.find(i => i.callStatus === 'not_connected')?._count || 0,
      positive: callsByStatus.find(i => i.callStatus === 'connected_positive')?._count || 0,
      negative: callsByStatus.find(i => i.callStatus === 'not_interested')?._count || 0,
      callback: callsByStatus.find(i => i.callStatus === 'connected_callback')?._count || 0,
      connectRate: totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0,
      inboundTotal,
      outboundTotal,
      inboundConnected,
      outboundConnected,
      inboundMissed,
      outboundMissed,
      newLeads: newLeadsCount,
      adminAssignedLeads 
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch call stats' });
  }
};
// ─────────────────────────────────────────────────────────────────────────────
// EXISTING FUNCTIONS BELOW — NO CHANGES NEEDED
// ─────────────────────────────────────────────────────────────────────────────

export const createCallLog = async (req: AuthRequest, res: Response) => {
  try {
    const data = createCallLogSchema.parse(req.body);

    const leadInfo = await prisma.lead.findUnique({ where: { id: data.leadId } });
    if (!leadInfo) return res.status(404).json({ error: 'Lead not found' });
    if (req.user!.role === 'sales_agent' && leadInfo.assignedToId !== req.user!.userId) {
      return res.status(403).json({ error: 'You can only log calls for your own leads.' });
    }

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
        lead: { select: { id: true, name: true, phone: true, stage: true, assignedToId: true, notes: true } }
      }
    });

    // 👇 FIX: Automatically append these notes to the Lead's global history
    // 👇 FIX: Automatically append these notes to the Lead's global history
    if (data.notes) {
      const timestamp = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      let statusLabel = 'Called';

      if (data.callStatus === 'connected_positive') {
        statusLabel = 'Connected';
      } else if (data.callStatus === 'connected_callback') {
        // 👈 NEW: Add the scheduled date into the label
        if (data.callbackScheduledAt) {
          const scheduledDate = new Date(data.callbackScheduledAt).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
          });
          statusLabel = `Callback Scheduled for ${scheduledDate}`;
        } else {
          statusLabel = 'Callback Scheduled';
        }
      } else if (data.callStatus === 'not_connected') {
        statusLabel = 'No Answer';
      } else if (data.callStatus === 'not_interested') {
        statusLabel = 'Not Interested';
      }

      const newHistoryLine = `[${timestamp} | ${statusLabel}]: ${data.notes}`;
      const existingNotes = callLog.lead.notes || '';
      const updatedNotes = existingNotes ? `${existingNotes}\n${newHistoryLine}` : newHistoryLine;

      await prisma.lead.update({
        where: { id: data.leadId },
        data: { notes: updatedNotes }
      });
    }
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
        data: { stage: 'closed' } // Note history handled securely above
      });
    }

    // Include the actual notes inside the activity log too
    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId, action: 'call_logged', entityType: 'call_log', entityId: callLog.id,
        details: { leadName: callLog.lead.name, callStatus: data.callStatus, notes: data.notes }
      }
    });

    return res.status(201).json(callLog);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    return res.status(500).json({ error: 'Failed to create call log' });
  }
};

export const getCallLogsOld = async (req: AuthRequest, res: Response) => {
  try {
    const { leadId, view, search, date, dateFrom, dateTo, callStatus, agentId, minDuration, direction, take } = req.query;

    const where: any = { deletedAt: null };
    if (leadId) where.leadId = leadId;

    // ── Search (NOW INCLUDES UNIQUE ID SEARCH) ──
    if (search) {
      where.OR = [
        { lead: { name: { contains: search as string, mode: 'insensitive' } } },
        { lead: { phone: { contains: search as string } } },
        { id: { endsWith: search as string, mode: 'insensitive' } }, // Search by Call ID
        { leadId: { endsWith: search as string, mode: 'insensitive' } } // Search by Lead ID
      ];
    }

    // ── Date filter ──
    const targetDateField = view === 'follow_ups' ? 'callbackScheduledAt' : 'callDate';

    if (dateFrom || dateTo) {
      where[targetDateField] = {};
      if (dateFrom) {
        const start = new Date(dateFrom as string);
        start.setHours(0, 0, 0, 0);
        where[targetDateField].gte = start;
      }
      if (dateTo) {
        const end = new Date(dateTo as string);
        end.setHours(23, 59, 59, 999);
        where[targetDateField].lte = end;
      }
    } else if (date) {
      const start = new Date(date as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      where[targetDateField] = { gte: start, lte: end };
    }

    // ── Call status & Agent filter ──
    if (callStatus && callStatus !== 'all') where.callStatus = callStatus as string;
    if (req.user!.role === 'sales_agent') {
      where.agentId = req.user!.userId;
    } else if (agentId && agentId !== 'all') {
      where.agentId = agentId as string;
    }

    if (minDuration && minDuration !== 'all') {
      where.callDuration = { gte: parseInt(minDuration as string, 10) };
    }

    // ── View presets (ADDED FOLLOW_UPS) ──
    switch (view) {
      case 'follow_ups':
        where.callStatus = 'connected_callback'; // 👈 Changed: Only show active callbacks
        break;
      case 'missed':
        where.callStatus = 'not_connected';
        break;
      case 'attended': where.callStatus = { in: ['connected_positive', 'connected_callback', 'not_interested'] }; break;
      case 'qualified': where.callStatus = 'connected_positive'; break;
      case 'unqualified': where.callStatus = 'not_interested'; break;
      case 'archive': where.isArchived = true; break;
      case 'inbound': where.notes = { contains: 'Inbound', mode: 'insensitive' }; break;
      case 'outbound': where.notes = { contains: 'Outbound', mode: 'insensitive' }; break;
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

    // ── Direction Filter ──
    if (direction && direction !== 'all' && !['inbound', 'outbound', 'missed', 'follow_ups'].includes(view as string)) {
      where.notes = { contains: direction === 'inbound' ? 'Inbound' : 'Outbound', mode: 'insensitive' };
    }

    const callLogs = await prisma.callLog.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, phone: true, temperature: true, stage: true } },
        agent: { select: { id: true, fullName: true, role: true } }
      },
      // 👇 CHANGED: Sort by Follow-up date if in Follow Ups view
      orderBy: view === 'follow_ups' ? { callbackScheduledAt: 'asc' } : { callDate: 'desc' },
      take: take ? Math.min(parseInt(take as string, 10), 2000) : 500
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

export const getCallStatsOld = async (req: AuthRequest, res: Response) => {
  try {
    const agentId = req.user!.role === 'sales_agent' ? req.user!.userId : (req.query.agentId as string);
    const dateQuery = req.query.date as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const direction = req.query.direction as string;

    const whereClause: any = { deletedAt: null };

    if (agentId && agentId !== 'all') {
      whereClause.agentId = agentId;
    }

    if (direction && direction !== 'all') {
      whereClause.notes = {
        contains: direction === 'inbound' ? 'Inbound' : 'Outbound',
        mode: 'insensitive'
      };
    }

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
    const connectedCalls = callsByStatus.filter(item => item.callStatus.startsWith('connected')).reduce((sum, item) => sum + item._count, 0);

    const inboundWhere = { ...whereClause, notes: { contains: 'Inbound', mode: 'insensitive' as const } };
    const outboundWhere = { ...whereClause, notes: { contains: 'Outbound', mode: 'insensitive' as const } };

    const [inboundStats, outboundStats] = await Promise.all([
      prisma.callLog.groupBy({ by: ['callStatus'], where: inboundWhere, _count: true }),
      prisma.callLog.groupBy({ by: ['callStatus'], where: outboundWhere, _count: true })
    ]);

    const inboundTotal = inboundStats.reduce((s, i) => s + i._count, 0);
    const outboundTotal = outboundStats.reduce((s, i) => s + i._count, 0);
    const inboundConnected = inboundStats.filter(i => i.callStatus.startsWith('connected')).reduce((s, i) => s + i._count, 0);
    const outboundConnected = outboundStats.filter(i => i.callStatus.startsWith('connected')).reduce((s, i) => s + i._count, 0);
    const inboundMissed = inboundStats.find(i => i.callStatus === 'not_connected')?._count || 0;
    const outboundMissed = outboundStats.find(i => i.callStatus === 'not_connected')?._count || 0;

    const newLeadsCount = await prisma.lead.count({ where: { stage: 'new' } });

    // 👈 Expose Admin Assignment stats for the Telecalling UI
    let adminAssignedLeads = 0;
    if (agentId && agentId !== 'all') {
      adminAssignedLeads = await prisma.lead.count({
        where: { assignedById: agentId } // How many leads did this specific admin assign?
      });
    } else {
      adminAssignedLeads = await prisma.lead.count({
        where: { assignedById: { not: null } } // Total assigned across all admins
      });
    }

    return res.json({
      totalCalls,
      connectedCalls,
      notAnswered: callsByStatus.find(i => i.callStatus === 'not_connected')?._count || 0,
      positive: callsByStatus.find(i => i.callStatus === 'connected_positive')?._count || 0,
      negative: callsByStatus.find(i => i.callStatus === 'not_interested')?._count || 0,
      callback: callsByStatus.find(i => i.callStatus === 'connected_callback')?._count || 0,
      connectRate: totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0,
      inboundTotal,
      outboundTotal,
      inboundConnected,
      outboundConnected,
      inboundMissed,
      outboundMissed,
      newLeads: newLeadsCount,
      adminAssignedLeads // Passed down to the UI
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
      callStatus: z.enum(['connected_positive', 'connected_callback', 'not_connected', 'not_interested']).optional(),
      callbackScheduledAt: z.string().optional().nullable() // Added for follow-ups
    });
    const data = updateSchema.parse(req.body);

    const existing = await prisma.callLog.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Call log not found' });

    if (role === 'sales_agent' && existing.agentId !== userId) {
      return res.status(403).json({ error: 'You can only update your own call logs.' });
    }

    const updatePayload: any = { ...data };
    if (data.callbackScheduledAt) {
      updatePayload.callbackScheduledAt = new Date(data.callbackScheduledAt);
    }

    const updatedLog = await prisma.callLog.update({ where: { id }, data: updatePayload });

    // Handle Follow-up Task Creation
    if (data.callbackScheduledAt) {
      await prisma.followUpTask.create({
        data: {
          leadId: existing.leadId,
          agentId: existing.agentId,
          taskType: 'callback',
          scheduledAt: new Date(data.callbackScheduledAt),
          notes: 'Manual Follow-up scheduled from Telecalling'
        }
      });

      const leadOwner = await prisma.lead.findUnique({
        where: { id: existing.leadId },
        include: { assignedTo: true }
      });
      const isManagedBySalesAgent = leadOwner?.assignedTo?.role === 'sales_agent';

      // Do not overwrite the sales agent's follow-up schedule if an admin/telecaller does this
      if (!isManagedBySalesAgent || userId === leadOwner?.assignedToId) {
        await prisma.lead.update({
          where: { id: existing.leadId },
          data: { nextFollowupAt: new Date(data.callbackScheduledAt) }
        });
      }
    }

    // Handle Missed to Connected Conversion
    // Handle Missed to Connected Conversion
    if (data.callStatus === 'connected_positive' && (existing.callStatus === 'not_connected' || existing.callStatus === 'connected_callback')) {
      await prisma.lead.update({
        where: { id: existing.leadId },
        data: { stage: 'contacted', temperature: 'hot' }
      });

      // Automatically close any pending follow-up tasks for this lead!
      await prisma.followUpTask.updateMany({
        where: { leadId: existing.leadId, status: 'pending' },
        data: { status: 'completed', completedAt: new Date() }
      });

      // 👈 NEW: Auto-resolve ALL previous missed calls for this number
      await prisma.callLog.updateMany({
        where: {
          leadId: existing.leadId,
          callStatus: 'not_connected'
        },
        data: { callStatus: 'connected_positive' }
      });
    }

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