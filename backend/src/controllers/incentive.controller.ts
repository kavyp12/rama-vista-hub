import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

/**
 * GET /api/incentives/report
 * Returns per-agent performance metrics for the incentive pipeline,
 * AND per-admin metrics (leads assigned + IVR calls picked).
 *
 * Query params:
 *   dateFrom?: ISO date string (e.g. 2024-01-01) — no dateFrom = all-time
 *   dateTo?:   ISO date string (e.g. 2024-12-31)
 *   agentId?:  filter to one agent
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

    // ── Fetch admins for admin incentive section ─────────────────────────────
    const admins = await prisma.user.findMany({
      where: { role: 'admin', isActive: true },
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

    // Admin lead assignments — leads where assignedById is set
    const assignedLeadWhere: any = { assignedById: { not: null } };
    if (hasDateFilter) assignedLeadWhere.createdAt = dateFilter;

    const [allSiteVisits, allCalls, allLeads, allAdminAssignedLeads] = await Promise.all([
      prisma.siteVisit.findMany({
        where: svWhere,
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          conductedBy: true,
          lead: { select: { id: true, assignedToId: true } }
        }
      }),
      prisma.callLog.findMany({
        where: callWhere,
        select: { id: true, callDate: true, callStatus: true, agentId: true, notes: true }
      }),
      prisma.lead.findMany({
        where: leadWhere,
        select: { id: true, stage: true, assignedToId: true, assignedById: true, createdAt: true }
      }),
      prisma.lead.findMany({
        where: assignedLeadWhere,
        select: { id: true, assignedById: true, assignedToId: true, stage: true, createdAt: true }
      })
    ]);

    // ── Compute per-agent metrics ────────────────────────────────────────────
    const report = agents.map(agent => {
      // LEADS — assigned to this agent in range
      const agentLeads = allLeads.filter(l => l.assignedToId === agent.id);
      const totalLeads = agentLeads.length;
      const closedDeals = agentLeads.filter(l => l.stage === 'closed').length;
      const tokenPaid = agentLeads.filter(l => l.stage === 'token').length;
      const negotiation = agentLeads.filter(l => l.stage === 'negotiation').length;
      const lostLeads = agentLeads.filter(l => l.stage === 'lost').length;

      // SITE VISITS — attributed by conductedBy first, fallback to lead.assignedToId
      const agentVisits = allSiteVisits.filter(v => {
        if (v.conductedBy) return v.conductedBy === agent.id;
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

    // ── Compute per-admin metrics ────────────────────────────────────────────
    const adminReport = admins.map(admin => {
      // LEADS ASSIGNED BY THIS ADMIN
      const adminAssignedLeads = allAdminAssignedLeads.filter(l => l.assignedById === admin.id);
      const leadsAssigned = adminAssignedLeads.length;
      const leadsAssignedClosed = adminAssignedLeads.filter(l => l.stage === 'closed').length;
      const leadsAssignedToken = adminAssignedLeads.filter(l => l.stage === 'token').length;

      // IVR / PHONE CALLS — calls attributed to this admin
      const adminCalls = allCalls.filter(c => c.agentId === admin.id);
      const totalCalls = adminCalls.length;
      // IVR calls = inbound calls that admin answered
      const ivrCallsPicked = adminCalls.filter(c => {
        const notes = (c.notes || '').toLowerCase();
        return notes.includes('inbound');
      }).length;
      const connectedCalls = adminCalls.filter(c =>
        c.callStatus === 'connected_positive' || c.callStatus === 'connected_callback'
      ).length;
      const missedCalls = adminCalls.filter(c => c.callStatus === 'not_connected').length;
      const callConnectRate = totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0;

      // ADMIN SCORE — weighted for admin activities
      const score = leadsAssigned * 2 + ivrCallsPicked * 3 + leadsAssignedClosed * 20 + leadsAssignedToken * 10;
      const isActive = score > 0;

      return {
        agent: {
          id: admin.id,
          fullName: admin.fullName,
          email: admin.email,
          role: admin.role,
          avatarUrl: admin.avatarUrl
        },
        leadsAssigned,
        leadsConversion: {
          closed: leadsAssignedClosed,
          token: leadsAssignedToken,
          convRate: leadsAssigned > 0 ? Math.round(((leadsAssignedClosed + leadsAssignedToken) / leadsAssigned) * 100) : 0
        },
        calls: {
          total: totalCalls,
          ivrPicked: ivrCallsPicked,
          connected: connectedCalls,
          missed: missedCalls,
          connectRate: callConnectRate
        },
        score,
        isActive,
        rank: 0
      };
    });

    // Sort by score descending and assign ranks
    report.sort((a, b) => b.score - a.score);
    report.forEach((r, i) => { r.rank = i + 1; });

    adminReport.sort((a, b) => b.score - a.score);
    adminReport.forEach((r, i) => { r.rank = i + 1; });

    return res.json({
      agents: report,
      adminReport,
      summary: {
        totalAgents: report.length,
        activeAgents: report.filter(r => r.isActive).length,
        totalLeads: report.reduce((s, r) => s + r.leads.total, 0),
        totalVisits: report.reduce((s, r) => s + r.visits.total, 0),
        totalCalls: report.reduce((s, r) => s + r.calls.total, 0),
        totalClosed: report.reduce((s, r) => s + r.leads.closed, 0),
        totalScore: report.reduce((s, r) => s + r.score, 0),
        totalLeadsAssignedByAdmin: adminReport.reduce((s, r) => s + r.leadsAssigned, 0),
        totalIvrPickedByAdmin: adminReport.reduce((s, r) => s + r.calls.ivrPicked, 0),
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
