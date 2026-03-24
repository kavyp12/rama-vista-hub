import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

/**
 * GET /api/incentives/report
 * Returns per-agent performance metrics for the incentive pipeline.
 *
 * Query params:
 *   dateFrom?: ISO date string (e.g. 2024-01-01) — no dateFrom = all-time
 *   dateTo?:   ISO date string (e.g. 2024-12-31)
 *   agentId?:  filter to one agent
 *
 * Attribution rules:
 *   - Site visits → credited to the agent whose ID matches `conductedBy`. 
 *     If conductedBy is null (older data), falls back to the lead's assignedToId at query time.
 *   - Calls → credited to agentId on the CallLog record.
 *   - Leads → counted for the agent currently assigned (assignedToId) and created in the range.
 */
export const getIncentiveReport = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user!.role;

    // Only admin and manager can see all agents
    if (role === 'sales_agent') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { dateFrom, dateTo, agentId } = req.query;

    // ── Build date range filter ──────────────────────────────────────────────
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
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // ── Fetch all sales agents (or just the requested one) ───────────────────
    const agentWhere: any = { role: { in: ['sales_agent', 'sales_manager'] }, isActive: true };
    if (agentId && agentId !== 'all') agentWhere.id = agentId as string;

    const agents = await prisma.user.findMany({
      where: agentWhere,
      select: { id: true, fullName: true, email: true, role: true, avatarUrl: true },
      orderBy: { fullName: 'asc' }
    });

    // ── Fetch all data in parallel ───────────────────────────────────────────
    const svWhere: any = {};
    if (hasDateFilter) svWhere.scheduledAt = dateFilter;

    const callWhere: any = { deletedAt: null };
    if (hasDateFilter) callWhere.callDate = dateFilter;

    const leadWhere: any = {};
    if (hasDateFilter) leadWhere.createdAt = dateFilter;

    const [allSiteVisits, allCalls, allLeads] = await Promise.all([
      prisma.siteVisit.findMany({
        where: svWhere,
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          conductedBy: true,   // ← primary attribution field
          lead: { select: { id: true, assignedToId: true } }
        }
      }),
      prisma.callLog.findMany({
        where: callWhere,
        select: { id: true, callDate: true, callStatus: true, agentId: true }
      }),
      prisma.lead.findMany({
        where: leadWhere,
        select: { id: true, stage: true, assignedToId: true, createdAt: true }
      })
    ]);

    // ── Compute per-agent metrics ────────────────────────────────────────────
    const report = agents.map(agent => {
      // LEADS — created in range, currently assigned to this agent
      const agentLeads = allLeads.filter(l => l.assignedToId === agent.id);
      const totalLeads = agentLeads.length;
      const closedDeals = agentLeads.filter(l => l.stage === 'closed').length;
      const tokenPaid = agentLeads.filter(l => l.stage === 'token').length;
      const negotiation = agentLeads.filter(l => l.stage === 'negotiation').length;
      const lostLeads = agentLeads.filter(l => l.stage === 'lost').length;

      // SITE VISITS — attributed by conductedBy first, fallback to lead.assignedToId
      // This handles both old data (conductedBy null) and new data correctly.
      const agentVisits = allSiteVisits.filter(v => {
        if (v.conductedBy) {
          return v.conductedBy === agent.id;
        }
        // Fallback for legacy records where conductedBy wasn't set
        return v.lead?.assignedToId === agent.id;
      });
      const totalVisits = agentVisits.length;
      const completedVisits = agentVisits.filter(v => v.status === 'completed').length;
      const scheduledVisits = agentVisits.filter(v => v.status === 'scheduled').length;
      const cancelledVisits = agentVisits.filter(v => v.status === 'cancelled').length;

      // CALLS — attributed by agentId on CallLog
      const agentCalls = allCalls.filter(c => c.agentId === agent.id);
      const totalCalls = agentCalls.length;
      const connectedCalls = agentCalls.filter(c =>
        c.callStatus === 'connected_positive' || c.callStatus === 'connected_callback'
      ).length;
      const notConnected = agentCalls.filter(c => c.callStatus === 'not_connected').length;
      const notInterested = agentCalls.filter(c => c.callStatus === 'not_interested').length;

      // SCORE — weighted composite
      const score =
        totalCalls * 1 +
        totalVisits * 5 +
        completedVisits * 10 +
        tokenPaid * 30 +
        closedDeals * 50;

      const callConnectRate = totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0;
      const visitCompletionRate = totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0;
      const leadConvRate = totalLeads > 0 ? Math.round(((closedDeals + tokenPaid) / totalLeads) * 100) : 0;
      const isActive = score > 0;

      return {
        agent: {
          id: agent.id,
          fullName: agent.fullName,
          email: agent.email,
          role: agent.role,
          avatarUrl: agent.avatarUrl
        },
        leads: {
          total: totalLeads,
          closed: closedDeals,
          token: tokenPaid,
          negotiation,
          lost: lostLeads,
          convRate: leadConvRate
        },
        visits: {
          total: totalVisits,
          completed: completedVisits,
          scheduled: scheduledVisits,
          cancelled: cancelledVisits,
          completionRate: visitCompletionRate
        },
        calls: {
          total: totalCalls,
          connected: connectedCalls,
          notConnected,
          notInterested,
          connectRate: callConnectRate
        },
        score,
        isActive,
        rank: 0  // filled in after sorting
      };
    });

    // Sort by score descending and assign ranks
    report.sort((a, b) => b.score - a.score);
    report.forEach((r, i) => { r.rank = i + 1; });

    return res.json({
      agents: report,
      summary: {
        totalAgents: report.length,
        activeAgents: report.filter(r => r.isActive).length,
        totalLeads: report.reduce((s, r) => s + r.leads.total, 0),
        totalVisits: report.reduce((s, r) => s + r.visits.total, 0),
        totalCalls: report.reduce((s, r) => s + r.calls.total, 0),
        totalClosed: report.reduce((s, r) => s + r.leads.closed, 0),
        totalScore: report.reduce((s, r) => s + r.score, 0),
      },
      dateRange: {
        from: dateFrom || null,
        to: dateTo || null
      }
    });

  } catch (error) {
    console.error('Incentive Report Error:', error);
    return res.status(500).json({ error: 'Failed to generate incentive report' });
  }
};
