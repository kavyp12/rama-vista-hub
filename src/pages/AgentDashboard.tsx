import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  MapPin, Calendar, Phone, Mail, User, Building2,
  Navigation, Clock, Flame, Thermometer, Snowflake, Home,
  TrendingUp, Target, Briefcase, Award, CheckCircle2,
  PhoneCall, PhoneMissed, PhoneOff, MessageSquare, Edit3,
  AlertTriangle, Star, Zap, BarChart3, Plus, ChevronRight,
  CheckSquare, Circle, ArrowRight
} from 'lucide-react';
import { format, parseISO, isToday, isPast, differenceInDays } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// --- TYPES ---
interface SiteVisit {
  id: string;
  scheduledAt: string;
  status: string;
  lead: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    temperature: string;
  };
  property?: {
    id: string;
    title: string;
    location: string;
    city: string | null;
    bedrooms: number | null;
    propertyType: string;
  } | null;
  project?: {
    id: string;
    name: string;
    location: string;
    city: string | null;
  } | null;
}

interface FollowUpLead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  temperature: string;
  nextFollowupAt: string;
  source: string;
  stage?: string;
}

interface PerformanceStats {
  leadsByStage: { stage: string; count: number }[];
  leadsByTemperature: { temperature: string; count: number }[];
  callStats: { total: number; connected: number; connectRate: number };
  dealStats: { total: number; closed: number; winRate: number; totalRevenue: number };
  totalLeads: number;
  conversionRate: number;
  monthlyTarget?: number;
  monthlyAchieved?: number;
}

interface CallLog {
  id: string;
  leadId: string;
  leadName: string;
  outcome: 'connected' | 'not_answered' | 'busy' | 'wrong_number' | 'callback_requested';
  notes: string;
  duration?: number;
  calledAt: string;
}

interface Task {
  id: string;
  title: string;
  type: 'followup' | 'visit' | 'document' | 'call' | 'other';
  dueAt: string;
  done: boolean;
  leadName?: string;
  priority: 'high' | 'medium' | 'low';
}

// --- COLORS ---
const COLORS = {
  hot: '#ef4444',
  warm: '#f59e0b',
  cold: '#3b82f6',
  connected: '#10b981',
  missed: '#ef4444',
  primary: '#4f46e5'
};

const CALL_OUTCOMES = [
  { value: 'connected', label: 'Connected', icon: PhoneCall, color: 'text-green-600' },
  { value: 'not_answered', label: 'Not Answered', icon: PhoneMissed, color: 'text-red-500' },
  { value: 'busy', label: 'Busy', icon: PhoneOff, color: 'text-amber-500' },
  { value: 'callback_requested', label: 'Callback Requested', icon: Clock, color: 'text-blue-500' },
  { value: 'wrong_number', label: 'Wrong Number', icon: PhoneOff, color: 'text-gray-400' },
];

const LEAD_STAGES = [
  'new', 'contacted', 'site_visit_scheduled', 'site_visit_done',
  'negotiation', 'booking_done', 'lost'
];

export default function AgentDashboard() {
  const { user, token } = useAuth();
  const { toast } = useToast();

  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpLead[]>([]);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Update Lead Stage
  const [stageUpdateDialog, setStageUpdateDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<FollowUpLead | null>(null);
  const [newStage, setNewStage] = useState('');

  // Log Call Dialog
  const [callLogDialog, setCallLogDialog] = useState(false);
  const [callLeadId, setCallLeadId] = useState('');
  const [callLeadName, setCallLeadName] = useState('');
  const [callOutcome, setCallOutcome] = useState<CallLog['outcome']>('connected');
  const [callNotes, setCallNotes] = useState('');
  const [callDuration, setCallDuration] = useState('');
  const [loggingCall, setLoggingCall] = useState(false);

  useEffect(() => {
    if (token && user?.id) fetchAllData();
  }, [token, user]);

  async function fetchAllData() {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [visitsRes, followUpsRes, statsRes, callLogsRes] = await Promise.all([
        fetch(`${API_URL}/site-visits`, { headers }),
        fetch(`${API_URL}/leads?needsFollowup=true`, { headers }),
        fetch(`${API_URL}/users/${user?.id}/stats`, { headers }),
        fetch(`${API_URL}/call-logs?limit=20`, { headers }),
      ]);

      const visitsData = await visitsRes.json();
      const followUpsData = await followUpsRes.json();
      const statsData = await statsRes.json();
      const callLogsData = callLogsRes.ok ? await callLogsRes.json() : [];

      const myVisits = Array.isArray(visitsData)
        ? visitsData
            .filter((v: SiteVisit) => v.status === 'scheduled')
            .sort((a: SiteVisit, b: SiteVisit) =>
              new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
            )
        : [];

      setVisits(myVisits);
      setFollowUps(Array.isArray(followUpsData) ? followUpsData : []);
      setStats(statsData);
      setCallLogs(Array.isArray(callLogsData) ? callLogsData : []);

      // Build today's task list from follow-ups + visits (with date safety)
      const generatedTasks: Task[] = [
        ...myVisits
          .filter(v => v.scheduledAt && isToday(parseISO(v.scheduledAt)))
          .map(v => ({
            id: `visit-${v.id}`,
            title: `Site visit with ${v.lead.name}`,
            type: 'visit' as const,
            dueAt: v.scheduledAt,
            done: false,
            leadName: v.lead.name,
            priority: 'high' as const,
          })),
        ...(Array.isArray(followUpsData) ? followUpsData : [])
          .filter((l: FollowUpLead) => {
            if (!l.nextFollowupAt) return false; // Skip if no date
            const d = parseISO(l.nextFollowupAt);
            return isToday(d) || isPast(d);
          })
          .map((l: FollowUpLead) => ({
            id: `followup-${l.id}`,
            title: `Follow up with ${l.name}`,
            type: 'followup' as const,
            dueAt: l.nextFollowupAt,
            done: false,
            leadName: l.name,
            priority: l.nextFollowupAt && isPast(parseISO(l.nextFollowupAt)) && !isToday(parseISO(l.nextFollowupAt))
              ? ('high' as const)
              : ('medium' as const),
          })),
      ];
      setTasks(generatedTasks);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to load dashboard data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleStageUpdate() {
    if (!selectedLead || !newStage) return;
    try {
      const res = await fetch(`${API_URL}/leads/${selectedLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Updated', description: `${selectedLead.name} moved to ${newStage.replace('_', ' ')}` });
      setStageUpdateDialog(false);
      fetchAllData();
    } catch {
      toast({ title: 'Error', description: 'Failed to update stage', variant: 'destructive' });
    }
  }

  async function handleLogCall() {
    if (!callLeadId) return;
    setLoggingCall(true);
    try {
      const res = await fetch(`${API_URL}/call-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          leadId: callLeadId,
          outcome: callOutcome,
          notes: callNotes,
          duration: callDuration ? parseInt(callDuration) : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Call Logged', description: 'Your call has been recorded.' });
      setCallLogDialog(false);
      setCallNotes('');
      setCallDuration('');
      fetchAllData();
    } catch {
      toast({ title: 'Error', description: 'Failed to log call', variant: 'destructive' });
    } finally {
      setLoggingCall(false);
    }
  }

  function openCallLog(leadId: string, leadName: string) {
    setCallLeadId(leadId);
    setCallLeadName(leadName);
    setCallOutcome('connected');
    setCallNotes('');
    setCallDuration('');
    setCallLogDialog(true);
  }

  function openStageUpdate(lead: FollowUpLead) {
    setSelectedLead(lead);
    setNewStage(lead.stage || '');
    setStageUpdateDialog(true);
  }

  function toggleTask(taskId: string) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done: !t.done } : t));
  }

 // Derived Data (Added null checks so it doesn't crash on undefined dates)
  const todayVisits = visits.filter(v => v.scheduledAt && isToday(parseISO(v.scheduledAt)));
  const upcomingVisits = visits.filter(v => v.scheduledAt && !isToday(parseISO(v.scheduledAt)) && !isPast(parseISO(v.scheduledAt)));
  const overdueFollowUps = followUps.filter(l => l.nextFollowupAt && isPast(parseISO(l.nextFollowupAt)) && !isToday(parseISO(l.nextFollowupAt)));
  const todayFollowUps = followUps.filter(l => l.nextFollowupAt && isToday(parseISO(l.nextFollowupAt)));
  const pendingTasks = tasks.filter(t => !t.done).length;
  const doneTasks = tasks.filter(t => t.done).length;

  // Target meter
  const targetPct = stats?.monthlyTarget
    ? Math.min(100, Math.round(((stats.monthlyAchieved || 0) / stats.monthlyTarget) * 100))
    : stats
    ? Math.min(100, Math.round((stats.dealStats.closed / Math.max(1, 5)) * 100))
    : 0;

  // Charts
  const funnelData = stats
    ? stats.leadsByStage.map(item => ({
        stage: item.stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        count: item.count,
      }))
    : [];

  const tempChartData = stats
    ? stats.leadsByTemperature.map(item => ({
        name: item.temperature.charAt(0).toUpperCase() + item.temperature.slice(1),
        value: item.count,
      }))
    : [];

  const callOutcomeData = callLogs.reduce(
    (acc, log) => {
      const key = log.outcome === 'connected' ? 'Connected' : 'Not Connected';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const callChartData = Object.entries(callOutcomeData).map(([name, value]) => ({ name, value }));

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
    return `₹${amount.toLocaleString()}`;
  };

  const getTemperatureIcon = (temp: string) => {
    switch (temp) {
      case 'hot': return <Flame className="h-3.5 w-3.5 text-red-500" />;
      case 'warm': return <Thermometer className="h-3.5 w-3.5 text-amber-500" />;
      case 'cold': return <Snowflake className="h-3.5 w-3.5 text-blue-500" />;
      default: return null;
    }
  };

  const getLocationDetails = (visit: SiteVisit) => {
    if (visit.property) return {
      name: visit.property.title,
      address: visit.property.location,
      details: `${visit.property.bedrooms || ''} BHK ${visit.property.propertyType || ''}`.trim(),
      icon: <Home className="h-4 w-4 text-blue-600" />,
    };
    if (visit.project) return {
      name: visit.project.name,
      address: visit.project.location,
      details: 'Project Site',
      icon: <Building2 className="h-4 w-4 text-purple-600" />,
    };
    return {
      name: 'Location Not Specified',
      address: 'Contact manager',
      details: 'Site Visit',
      icon: <MapPin className="h-4 w-4 text-gray-500" />,
    };
  };

  // ---- RENDER ----
  return (
    <DashboardLayout
      title="My Dashboard"
      description={`Welcome back, ${user?.fullName || 'Agent'}. Here's your day at a glance.`}
    >
      <div className="space-y-6">

        {/* === DAILY SUMMARY BANNER === */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-3">
            <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-red-500 font-medium">Overdue</p>
              <p className="text-2xl font-bold text-red-700">{overdueFollowUps.length}</p>
              <p className="text-[10px] text-red-400">Follow-ups</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center gap-3">
            <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-amber-500 font-medium">Today</p>
              <p className="text-2xl font-bold text-amber-700">{todayFollowUps.length}</p>
              <p className="text-[10px] text-amber-400">Follow-ups due</p>
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-indigo-500 font-medium">Visits Today</p>
              <p className="text-2xl font-bold text-indigo-700">{todayVisits.length}</p>
              <p className="text-[10px] text-indigo-400">Scheduled</p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
            <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
              <CheckSquare className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-emerald-500 font-medium">Tasks Done</p>
              <p className="text-2xl font-bold text-emerald-700">{doneTasks}/{tasks.length}</p>
              <p className="text-[10px] text-emerald-400">Completed</p>
            </div>
          </div>
        </div>

        {/* === KPI CARDS === */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-900">Total Revenue</p>
                  <p className="text-2xl font-bold text-indigo-700">
                    {stats ? formatCurrency(stats.dealStats.totalRevenue) : '₹0'}
                  </p>
                </div>
                <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <Award className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
              <p className="text-xs text-indigo-600/70 mt-2">Closed Deals Value</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Pipeline</p>
                  <p className="text-2xl font-bold">{stats?.totalLeads || 0}</p>
                </div>
                <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Total leads assigned</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
                  <p className="text-2xl font-bold">{stats?.conversionRate || 0}%</p>
                </div>
                <div className="h-10 w-10 bg-emerald-50 rounded-full flex items-center justify-center">
                  <Target className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Leads to Closed Deals</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Call Efficiency</p>
                  <p className="text-2xl font-bold">{stats?.callStats.connectRate || 0}%</p>
                </div>
                <div className="h-10 w-10 bg-amber-50 rounded-full flex items-center justify-center">
                  <Phone className="h-5 w-5 text-amber-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {stats?.callStats.connected} connected / {stats?.callStats.total} total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* === TARGET METER + CHARTS === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Monthly Target Meter */}
          <Card className="border-2 border-indigo-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" /> Monthly Target
              </CardTitle>
              <CardDescription>Your performance vs goal this month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-extrabold text-indigo-700">{targetPct}%</p>
                  <p className="text-xs text-muted-foreground mt-1">of monthly target achieved</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-700">{stats?.dealStats.closed || 0} closed</p>
                  <p className="text-xs text-muted-foreground">deals this month</p>
                </div>
              </div>
              <Progress
                value={targetPct}
                className="h-3 rounded-full"
              />
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Hot Leads</p>
                  <p className="font-bold text-red-600">
                    {stats?.leadsByTemperature.find(t => t.temperature === 'hot')?.count || 0}
                  </p>
                </div>
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Warm Leads</p>
                  <p className="font-bold text-amber-600">
                    {stats?.leadsByTemperature.find(t => t.temperature === 'warm')?.count || 0}
                  </p>
                </div>
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                  <p className="font-bold text-emerald-600">{stats?.dealStats.winRate || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline Funnel */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Pipeline Stages
              </CardTitle>
              <CardDescription>Distribution of your leads across stages</CardDescription>
            </CardHeader>
            <CardContent className="h-[230px]">
              {loading || !stats ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="stage" tick={{ fontSize: 9 }} interval={0} />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      cursor={{ fill: 'transparent' }}
                    />
                    <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* === CHARTS ROW 2 === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lead Temperature Pie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Lead Temperature</CardTitle>
            </CardHeader>
            <CardContent className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tempChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {tempChartData.map((entry, index) => {
                      const key = entry.name.toLowerCase();
                      return <Cell key={`cell-${index}`} fill={COLORS[key as keyof typeof COLORS] || '#ccc'} />;
                    })}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Call Outcome Pie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent Call Outcomes</CardTitle>
              <CardDescription>Last {callLogs.length} calls logged</CardDescription>
            </CardHeader>
            <CardContent className="h-[220px]">
              {callLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <PhoneCall className="h-8 w-8 opacity-30" />
                  <p>No calls logged yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={callChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">
                      <Cell fill={COLORS.connected} />
                      <Cell fill={COLORS.missed} />
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* === MAIN TABS === */}
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
            <TabsTrigger value="tasks" className="relative">
              Today's Tasks
              {pendingTasks > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {pendingTasks}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="followups">Follow-ups</TabsTrigger>
            <TabsTrigger value="schedule">My Schedule</TabsTrigger>
          </TabsList>

          {/* === TODAY'S TASKS TAB === */}
          <TabsContent value="tasks" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Today's To-Do List</CardTitle>
                  <Badge variant="secondary">{doneTasks}/{tasks.length} done</Badge>
                </div>
                {tasks.length > 0 && (
                  <Progress value={tasks.length > 0 ? (doneTasks / tasks.length) * 100 : 0} className="h-1.5" />
                )}
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <CheckCircle2 className="h-12 w-12 text-green-400 opacity-50" />
                    <p className="text-sm">All clear! No tasks for today.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tasks
                      .sort((a, b) => {
                        const p = { high: 0, medium: 1, low: 2 };
                        return p[a.priority] - p[b.priority];
                      })
                      .map(task => (
                        <div
                          key={task.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer
                            ${task.done ? 'bg-slate-50 opacity-60' : task.priority === 'high' ? 'bg-red-50 border-red-100' : 'bg-white hover:bg-slate-50'}`}
                          onClick={() => toggleTask(task.id)}
                        >
                          <div className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center
                            ${task.done ? 'bg-emerald-500 border-emerald-500' : task.priority === 'high' ? 'border-red-400' : 'border-slate-300'}`}>
                            {task.done && <CheckCircle2 className="h-4 w-4 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${task.done ? 'line-through text-muted-foreground' : ''}`}>
                              {task.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {task.dueAt ? (
                                <>
                                  Due: {format(parseISO(task.dueAt), 'h:mm a')}
                                  {isPast(parseISO(task.dueAt)) && !task.done && (
                                    <span className="text-red-500 ml-1 font-medium">• Overdue</span>
                                  )}
                                </>
                              ) : (
                                'No due date'
                              )}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0
                              ${task.type === 'visit' ? 'border-indigo-200 text-indigo-600' : 'border-amber-200 text-amber-600'}`}
                          >
                            {task.type === 'visit' ? 'Visit' : 'Follow-up'}
                          </Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === FOLLOW-UPS TAB === */}
          <TabsContent value="followups" className="space-y-4 mt-4">
            {followUps.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 text-green-400 opacity-50" />
                  <p className="mt-2 text-sm">You're all caught up! No pending follow-ups.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {followUps.slice(0, 12).map(lead => (
                  <FollowUpCard
                    key={lead.id}
                    lead={lead}
                    onStageUpdate={openStageUpdate}
                    onLogCall={openCallLog}
                    getTemperatureIcon={getTemperatureIcon}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* === SCHEDULE TAB === */}
          <TabsContent value="schedule" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-indigo-900">
                  <Calendar className="h-4 w-4" /> Today's Visits ({todayVisits.length})
                </h3>
                {todayVisits.length === 0 ? (
                  <div className="p-4 border rounded-lg bg-slate-50 text-center text-sm text-muted-foreground">
                    No visits scheduled for today.
                  </div>
                ) : (
                  todayVisits.map(visit => (
                    <VisitCard
                      key={visit.id}
                      visit={visit}
                      isToday
                      getLocationDetails={getLocationDetails}
                      getTemperatureIcon={getTemperatureIcon}
                      onLogCall={openCallLog}
                    />
                  ))
                )}
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" /> Upcoming
                </h3>
                {upcomingVisits.length === 0 ? (
                  <div className="p-4 border rounded-lg bg-slate-50 text-center text-sm text-muted-foreground">
                    No upcoming visits.
                  </div>
                ) : (
                  upcomingVisits.slice(0, 5).map(visit => (
                    <VisitCard
                      key={visit.id}
                      visit={visit}
                      getLocationDetails={getLocationDetails}
                      getTemperatureIcon={getTemperatureIcon}
                      onLogCall={openCallLog}
                    />
                  ))
                )}
              </div>
            </div>
          </TabsContent>

         
        </Tabs>
      </div>

      {/* === LOG CALL DIALOG === */}
      <Dialog open={callLogDialog} onOpenChange={setCallLogDialog}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-indigo-600" />
              Log Call {callLeadName ? `— ${callLeadName}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Call Outcome</Label>
              <div className="grid grid-cols-1 gap-2">
                {CALL_OUTCOMES.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCallOutcome(opt.value as CallLog['outcome'])}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all
                        ${callOutcome === opt.value ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${opt.color}`} />
                      <span className="text-sm font-medium">{opt.label}</span>
                      {callOutcome === opt.value && <CheckCircle2 className="h-4 w-4 text-indigo-500 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <input
                type="number"
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                placeholder="e.g. 5"
                value={callDuration}
                onChange={e => setCallDuration(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="What was discussed? Any next steps?"
                value={callNotes}
                onChange={e => setCallNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCallLogDialog(false)}>Cancel</Button>
            <Button onClick={handleLogCall} disabled={loggingCall} className="gap-2">
              <PhoneCall className="h-4 w-4" />
              {loggingCall ? 'Saving...' : 'Save Call'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === QUICK STAGE UPDATE DIALOG === */}
      <Dialog open={stageUpdateDialog} onOpenChange={setStageUpdateDialog}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-indigo-600" />
              Update Stage — {selectedLead?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {LEAD_STAGES.map(stage => (
              <button
                key={stage}
                type="button"
                onClick={() => setNewStage(stage)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all text-sm
                  ${newStage === stage ? 'border-indigo-400 bg-indigo-50 font-medium' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <span className="capitalize">{stage.replace(/_/g, ' ')}</span>
                {newStage === stage && <CheckCircle2 className="h-4 w-4 text-indigo-500" />}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageUpdateDialog(false)}>Cancel</Button>
            <Button onClick={handleStageUpdate} disabled={!newStage}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// === SUB-COMPONENTS ===

function FollowUpCard({
  lead,
  onStageUpdate,
  onLogCall,
  getTemperatureIcon,
}: {
  lead: FollowUpLead;
  onStageUpdate: (lead: FollowUpLead) => void;
  onLogCall: (leadId: string, leadName: string) => void;
  getTemperatureIcon: (temp: string) => React.ReactNode;
}) {
  // Add safe parsing: Check if the date exists before parsing
  const followUpDate = lead.nextFollowupAt ? parseISO(lead.nextFollowupAt) : null;
  const isOverdue = followUpDate ? (isPast(followUpDate) && !isToday(followUpDate)) : false;
  const daysOverdue = isOverdue && followUpDate ? Math.abs(differenceInDays(new Date(), followUpDate)) : 0;

  return (
    <Card className={`border-l-4 hover:shadow-md transition-all ${isOverdue ? 'border-l-red-600' : 'border-l-amber-400'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="font-semibold text-sm truncate">{lead.name}</h4>
              {getTemperatureIcon(lead.temperature)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{lead.source}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isOverdue && (
              <Badge variant="destructive" className="text-[10px] h-5">
                {daysOverdue}d overdue
              </Badge>
            )}
            {lead.stage && (
              <Badge variant="outline" className="text-[10px] h-5 capitalize">
                {lead.stage.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3" />
            <span>{lead.phone}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
              {followUpDate ? `Due: ${format(followUpDate, 'MMM dd, h:mm a')}` : 'No due date set'}
            </span>
          </div>
          {lead.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3 w-3" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <a href={`tel:${lead.phone}`} className="col-span-1">
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs border-green-200 text-green-700 hover:bg-green-50"
              onClick={(e) => { e.preventDefault(); onLogCall(lead.id, lead.name); window.location.href = `tel:${lead.phone}`; }}
            >
              <Phone className="h-3 w-3" />
            </Button>
          </a>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => onLogCall(lead.id, lead.name)}
          >
            <MessageSquare className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            onClick={() => onStageUpdate(lead)}
          >
            <Edit3 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function VisitCard({
  visit,
  isToday: today,
  getLocationDetails,
  getTemperatureIcon,
  onLogCall,
}: {
  visit: SiteVisit;
  isToday?: boolean;
  getLocationDetails: (v: SiteVisit) => { name: string; address: string; details: string; icon: React.ReactNode };
  getTemperatureIcon: (temp: string) => React.ReactNode;
  onLogCall: (leadId: string, leadName: string) => void;
}) {
  const location = getLocationDetails(visit);
  
  // Safe parsing
  const visitDate = visit.scheduledAt ? parseISO(visit.scheduledAt) : null;

  const openInMaps = () => {
    const query = encodeURIComponent(location.address);
    window.open(`http://maps.google.com/?q=${query}`, '_blank');
  };

  return (
    <Card className={`transition-all ${today ? 'border-l-4 border-l-indigo-500 shadow-sm' : 'hover:bg-accent/5'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${today ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              {visitDate ? (
                <>
                  <p className="text-sm font-medium">{format(visitDate, 'h:mm a')}</p>
                  <p className="text-xs text-muted-foreground">{format(visitDate, 'EEEE, MMM dd')}</p>
                </>
              ) : (
                <p className="text-sm font-medium">Unscheduled</p>
              )}
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={openInMaps} className="h-7 w-7 p-0 rounded-full">
            <Navigation className="h-4 w-4 text-blue-600" />
          </Button>
        </div>

        <div className="flex items-start gap-2 mb-3">
          {location.icon}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{location.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {location.address}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">{visit.lead.name}</span>
            {getTemperatureIcon(visit.lead.temperature)}
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              onClick={() => onLogCall(visit.lead.id, visit.lead.name)}
            >
              <MessageSquare className="h-3 w-3" />
            </Button>
            <a href={`tel:${visit.lead.phone}`}>
              <Button size="sm" className="h-7 gap-1 text-xs bg-indigo-600 hover:bg-indigo-700">
                <Phone className="h-3 w-3" /> Call
              </Button>
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}