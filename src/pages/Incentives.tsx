import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Trophy, Phone, Calendar, Users, Target, Award, Medal, Crown,
  Flame, CheckCircle2, Eye, Gift, Filter, RefreshCw, BarChart3, MapPin,
  TrendingDown, AlertTriangle
} from 'lucide-react';
import { format, startOfDay, startOfWeek, startOfMonth, endOfDay, endOfWeek, endOfMonth, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ── Types (matching backend response) ─────────────────────────────────────
interface AgentReport {
  agent: { id: string; fullName: string; email: string; role: string; avatarUrl?: string | null };
  leads: { total: number; closed: number; token: number; negotiation: number; lost: number; convRate: number };
  visits: { total: number; completed: number; scheduled: number; cancelled: number; completionRate: number };
  calls: { total: number; connected: number; notConnected: number; notInterested: number; connectRate: number };
  score: number;
  isActive: boolean;
  rank: number;
}

interface ReportSummary {
  totalAgents: number;
  activeAgents: number;
  totalLeads: number;
  totalVisits: number;
  totalCalls: number;
  totalClosed: number;
  totalScore: number;
}

interface Report {
  agents: AgentReport[];
  summary: ReportSummary;
  dateRange: { from: string | null; to: string | null };
}

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom';

function getPresetRange(preset: DatePreset) {
  if (preset === 'all') return { from: '', to: '' };
  const now = new Date();
  if (preset === 'today') {
    return { from: format(startOfDay(now), 'yyyy-MM-dd'), to: format(endOfDay(now), 'yyyy-MM-dd') };
  }
  if (preset === 'week') {
    return {
      from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      to: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    };
  }
  if (preset === 'month') {
    return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') };
  }
  return { from: '', to: '' };
}

function getInitials(name: string) {
  return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
}

const RANK_STYLES = [
  { grad: 'from-yellow-400 to-amber-500', icon: Crown },
  { grad: 'from-slate-300 to-slate-400', icon: Medal },
  { grad: 'from-orange-400 to-orange-500', icon: Award },
];

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

const SCORE_WEIGHTS = [
  { label: 'Per Call Made', pts: 1 },
  { label: 'Per Site Visit', pts: 5 },
  { label: 'Completed Visit', pts: 10 },
  { label: 'Token Paid Lead', pts: 30 },
  { label: 'Closed Deal', pts: 50 },
];

// ── Main Component ─────────────────────────────────────────────────────────
export default function Incentives() {
  const { token } = useAuth();

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters (all client-side on top of BE data)
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'score' | 'calls' | 'visits' | 'deals'>('score');

  // Current effective date range sent to backend
  const [activeDateFrom, setActiveDateFrom] = useState('');
  const [activeDateTo, setActiveDateTo] = useState('');

  useEffect(() => {
    if (token) fetchReport('', '');
  }, [token]);

  async function fetchReport(from: string, to: string) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (from) params.set('dateFrom', from);
      if (to) params.set('dateTo', to);

      const res = await fetch(`${API_URL}/incentives/report?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const data: Report = await res.json();
      setReport(data);
      setActiveDateFrom(from);
      setActiveDateTo(to);
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(preset: DatePreset) {
    setDatePreset(preset);
    if (preset === 'custom') return; // wait for user to fill dates
    const { from, to } = getPresetRange(preset);
    fetchReport(from, to);
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    fetchReport(customFrom, customTo);
  }

  // ── Client-side filtering + sorting ───────────────────────────────────────
  const displayAgents = useMemo(() => {
    if (!report) return [];
    let list = report.agents;
    if (agentFilter !== 'all') list = list.filter(a => a.agent.id === agentFilter);

    return [...list].sort((a, b) => {
      if (sortBy === 'calls') return b.calls.total - a.calls.total;
      if (sortBy === 'visits') return b.visits.total - a.visits.total;
      if (sortBy === 'deals') return b.leads.closed - a.leads.closed;
      return b.score - a.score;
    });
  }, [report, agentFilter, sortBy]);

  const summary = report?.summary;

  const chartData = displayAgents.slice(0, 8).map(r => ({
    name: r.agent.fullName.split(' ')[0],
    Score: r.score,
    Calls: r.calls.total,
    Visits: r.visits.total,
    Closed: r.leads.closed,
  }));

  const activeDateLabel = useMemo(() => {
    if (!activeDateFrom && !activeDateTo) return 'All Time';
    if (activeDateFrom && activeDateTo) {
      try {
        const from = format(parseISO(activeDateFrom), 'dd MMM yyyy');
        const to = format(parseISO(activeDateTo), 'dd MMM yyyy');
        return `${from} – ${to}`;
      } catch { return 'Custom Range'; }
    }
    return activeDateFrom || activeDateTo;
  }, [activeDateFrom, activeDateTo]);

  return (
    <DashboardLayout title="Incentives & Performance" description="Track agent performance by site visits, calls and deals">
      <div className="space-y-6">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-5">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="h-6 w-6 text-yellow-300" />
              Agent Incentive Pipeline
            </h2>
            <p className="text-indigo-200 text-sm mt-0.5">{activeDateLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'today', 'week', 'month'] as DatePreset[]).map(p => (
              <Button
                key={p}
                size="sm"
                variant={datePreset === p && datePreset !== 'custom' ? 'secondary' : 'ghost'}
                className={datePreset === p ? 'bg-white text-indigo-700 font-bold' : 'text-white hover:bg-white/20'}
                onClick={() => applyPreset(p)}
              >
                {p === 'all' ? 'All Time' : p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
              </Button>
            ))}
            <Button
              size="sm"
              variant={datePreset === 'custom' ? 'secondary' : 'ghost'}
              className={datePreset === 'custom' ? 'bg-white text-indigo-700 font-bold' : 'text-white hover:bg-white/20'}
              onClick={() => setDatePreset('custom')}
            >
              <Filter className="h-3.5 w-3.5 mr-1" /> Custom
            </Button>
            <Button
              size="sm" variant="ghost"
              className="text-white hover:bg-white/20"
              onClick={() => fetchReport(activeDateFrom, activeDateTo)}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Custom date picker */}
        {datePreset === 'custom' && (
          <div className="flex flex-wrap gap-3 items-center p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            <Calendar className="h-4 w-4 text-indigo-600" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">From:</span>
              <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-40 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">To:</span>
              <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-40 h-8 text-sm" />
            </div>
            <Button size="sm" onClick={applyCustom} disabled={!customFrom || !customTo || loading}>
              Apply
            </Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* ── Filters row ──────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-48">
              <Users className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {report?.agents.map(r => (
                <SelectItem key={r.agent.id} value={r.agent.id}>{r.agent.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-44">
              <BarChart3 className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">By Score</SelectItem>
              <SelectItem value="calls">By Calls</SelectItem>
              <SelectItem value="visits">By Site Visits</SelectItem>
              <SelectItem value="deals">By Closed Deals</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Summary Cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Agents', value: summary?.totalAgents ?? '—', icon: Users, c: 'text-blue-600 bg-blue-50' },
            { label: 'Active Agents', value: summary?.activeAgents ?? '—', icon: Flame, c: 'text-green-600 bg-green-50' },
            { label: 'Total Leads', value: summary?.totalLeads ?? '—', icon: Target, c: 'text-indigo-600 bg-indigo-50' },
            { label: 'Site Visits', value: summary?.totalVisits ?? '—', icon: MapPin, c: 'text-purple-600 bg-purple-50' },
            { label: 'Total Calls', value: summary?.totalCalls ?? '—', icon: Phone, c: 'text-orange-600 bg-orange-50' },
            { label: 'Closed Deals', value: summary?.totalClosed ?? '—', icon: CheckCircle2, c: 'text-green-600 bg-green-50' },
          ].map(item => (
            <Card key={item.label} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-2 ${item.c.split(' ')[1]}`}>
                  <item.icon className={`h-4 w-4 ${item.c.split(' ')[0]}`} />
                </div>
                {loading
                  ? <div className="h-7 w-16 bg-slate-100 rounded animate-pulse mb-1" />
                  : <p className="text-2xl font-bold">{item.value}</p>
                }
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Leaderboard + Chart ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Leaderboard */}
          <div className="lg:col-span-3 space-y-3">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-500" /> Leaderboard
              <span className="text-xs text-muted-foreground font-normal">({activeDateLabel})</span>
            </h3>

            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : displayAgents.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No agent data for this period</p>
              </div>
            ) : (
              displayAgents.map((r, idx) => {
                const rankStyle = RANK_STYLES[r.rank - 1];
                const RankIcon = rankStyle?.icon || Trophy;
                const isTop3 = r.rank <= 3;
                const maxScore = displayAgents[0]?.score || 1;

                return (
                  <Card
                    key={r.agent.id}
                    className={`border transition-all hover:shadow-md ${isTop3 ? 'border-indigo-100 bg-gradient-to-r from-indigo-50/60 to-purple-50/40' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Rank */}
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${
                          isTop3
                            ? `bg-gradient-to-br ${rankStyle.grad} text-white shadow-md`
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {isTop3 ? <RankIcon className="h-5 w-5" /> : r.rank}
                        </div>

                        {/* Avatar */}
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm shrink-0">
                          <AvatarFallback className="text-xs font-bold bg-indigo-100 text-indigo-700">
                            {getInitials(r.agent.fullName)}
                          </AvatarFallback>
                        </Avatar>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-sm truncate">{r.agent.fullName}</p>
                            <Badge variant="outline" className="text-indigo-600 border-indigo-200 text-xs shrink-0 ml-2">
                              {r.score} pts
                            </Badge>
                          </div>
                          <Progress value={maxScore > 0 ? (r.score / maxScore) * 100 : 0} className="h-1.5 mb-2" />

                          {/* KPI row */}
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Phone className="h-3 w-3" />
                              {r.calls.total} calls
                              <span className={`ml-0.5 ${r.calls.connectRate >= 50 ? 'text-green-600' : r.calls.connectRate >= 25 ? 'text-yellow-600' : 'text-red-500'}`}>
                                ({r.calls.connectRate}%)
                              </span>
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Eye className="h-3 w-3" />
                              {r.visits.total} visits
                              <span className="text-emerald-600 ml-0.5">({r.visits.completed} done)</span>
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Target className="h-3 w-3" /> {r.leads.total} leads
                            </span>
                            <span className={`flex items-center gap-0.5 ${r.leads.closed > 0 ? 'text-green-600 font-medium' : ''}`}>
                              <CheckCircle2 className="h-3 w-3" /> {r.leads.closed} closed
                            </span>
                            {r.leads.token > 0 && (
                              <span className="flex items-center gap-0.5 text-yellow-700">
                                <Target className="h-3 w-3" /> {r.leads.token} token
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Chart + Score weights */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                  Score Chart
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Visits credited to agent who conducted them (conductedBy field)
                </p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[260px] bg-slate-50 rounded-xl animate-pulse" />
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={55} />
                      <Tooltip
                        formatter={(val, name) => [val, name]}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Bar dataKey="Score" radius={[0, 4, 4, 0]}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                    No data available
                  </div>
                )}

                {/* Score weights */}
                <div className="mt-4 border-t pt-4 space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Score Weights
                  </p>
                  {SCORE_WEIGHTS.map(w => (
                    <div key={w.label} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{w.label}</span>
                      <span className="font-semibold text-indigo-700">{w.pts} pt{w.pts > 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Detailed Breakdown Table ──────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-purple-500" />
                Detailed Performance Breakdown
              </CardTitle>
              <Badge variant="outline" className="text-indigo-600 text-xs">
                {displayAgents.length} agents · {activeDateLabel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    {[
                      '#', 'Agent',
                      'Leads', 'Closed', 'Token', 'Conv%',
                      'Visits', 'Completed', 'Visit%',
                      'Calls', 'Connected', 'Connect%',
                      'Score'
                    ].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b">
                        {[...Array(13)].map((__, j) => (
                          <td key={j} className="px-3 py-3">
                            <div className="h-4 bg-slate-100 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : displayAgents.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-12 text-muted-foreground">
                        No data for selected period
                      </td>
                    </tr>
                  ) : (
                    displayAgents.map(r => (
                      <tr
                        key={r.agent.id}
                        className={`border-b hover:bg-slate-50 transition-colors ${r.rank <= 3 ? 'bg-indigo-50/20' : ''}`}
                      >
                        {/* Rank */}
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
                            r.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                            r.rank === 2 ? 'bg-slate-100 text-slate-600' :
                            r.rank === 3 ? 'bg-orange-100 text-orange-700' :
                            'text-slate-500'
                          }`}>
                            {r.rank}
                          </span>
                        </td>

                        {/* Agent */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700">
                                {getInitials(r.agent.fullName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium leading-tight">{r.agent.fullName}</p>
                              <p className="text-[10px] text-muted-foreground">{r.agent.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Leads */}
                        <td className="px-3 py-3 font-medium">{r.leads.total}</td>
                        <td className="px-3 py-3">
                          <span className={r.leads.closed > 0 ? 'text-green-600 font-semibold' : 'text-slate-400'}>
                            {r.leads.closed}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-yellow-700">{r.leads.token}</td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className={`text-[10px] ${r.leads.convRate >= 30 ? 'text-green-600 border-green-200' : r.leads.convRate >= 10 ? 'text-yellow-600 border-yellow-200' : 'text-slate-400'}`}>
                            {r.leads.convRate}%
                          </Badge>
                        </td>

                        {/* Visits */}
                        <td className="px-3 py-3">{r.visits.total}</td>
                        <td className="px-3 py-3 text-emerald-700 font-medium">{r.visits.completed}</td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className={`text-[10px] ${r.visits.completionRate >= 70 ? 'text-green-600 border-green-200' : r.visits.completionRate >= 40 ? 'text-yellow-600 border-yellow-200' : 'text-slate-400'}`}>
                            {r.visits.completionRate}%
                          </Badge>
                        </td>

                        {/* Calls */}
                        <td className="px-3 py-3">{r.calls.total}</td>
                        <td className="px-3 py-3 text-blue-600">{r.calls.connected}</td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className={`text-[10px] ${r.calls.connectRate >= 50 ? 'text-green-600 border-green-200' : r.calls.connectRate >= 25 ? 'text-yellow-600 border-yellow-200' : 'text-red-500 border-red-200'}`}>
                            {r.calls.connectRate}%
                          </Badge>
                        </td>

                        {/* Score */}
                        <td className="px-3 py-3">
                          <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                            {r.score}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Totals footer */}
                {!loading && displayAgents.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-900 text-white text-xs">
                      <td colSpan={2} className="px-3 py-3 font-bold text-sm">TOTAL</td>
                      <td className="px-3 py-3 font-bold">{displayAgents.reduce((s, r) => s + r.leads.total, 0)}</td>
                      <td className="px-3 py-3 font-bold text-green-400">{displayAgents.reduce((s, r) => s + r.leads.closed, 0)}</td>
                      <td className="px-3 py-3 font-bold text-yellow-400">{displayAgents.reduce((s, r) => s + r.leads.token, 0)}</td>
                      <td className="px-3 py-3">—</td>
                      <td className="px-3 py-3 font-bold">{displayAgents.reduce((s, r) => s + r.visits.total, 0)}</td>
                      <td className="px-3 py-3 font-bold text-emerald-400">{displayAgents.reduce((s, r) => s + r.visits.completed, 0)}</td>
                      <td className="px-3 py-3">—</td>
                      <td className="px-3 py-3 font-bold">{displayAgents.reduce((s, r) => s + r.calls.total, 0)}</td>
                      <td className="px-3 py-3 font-bold text-blue-400">{displayAgents.reduce((s, r) => s + r.calls.connected, 0)}</td>
                      <td className="px-3 py-3">—</td>
                      <td className="px-3 py-3 font-bold text-indigo-300">{displayAgents.reduce((s, r) => s + r.score, 0)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Active vs Inactive ────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-green-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                <Flame className="h-4 w-4 text-green-600" />
                Active Agents ({displayAgents.filter(r => r.isActive).length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading && <div className="h-24 bg-green-50 rounded-xl animate-pulse" />}
              {!loading && displayAgents.filter(r => r.isActive).map(r => (
                <div key={r.agent.id} className="flex items-center justify-between p-2.5 rounded-lg bg-green-50 border border-green-100">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-medium">{r.agent.fullName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{r.calls.total}c · {r.visits.total}v · {r.leads.closed}d</span>
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
                      {r.score} pts
                    </Badge>
                  </div>
                </div>
              ))}
              {!loading && displayAgents.filter(r => r.isActive).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No active agents this period</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-red-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Needs Attention ({displayAgents.filter(r => !r.isActive).length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading && <div className="h-24 bg-red-50 rounded-xl animate-pulse" />}
              {!loading && displayAgents.filter(r => !r.isActive).map(r => (
                <div key={r.agent.id} className="flex items-center justify-between p-2.5 rounded-lg bg-red-50 border border-red-100">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-400" />
                    <span className="text-sm font-medium">{r.agent.fullName}</span>
                  </div>
                  <Badge variant="outline" className="text-red-500 border-red-200 text-xs">No activity</Badge>
                </div>
              ))}
              {!loading && displayAgents.filter(r => !r.isActive).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
                  All agents are active! 🎉
                </p>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}
