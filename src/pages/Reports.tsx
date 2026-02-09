import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart3, TrendingUp, Users, IndianRupee, Building2, Phone, Target,
  PieChart, Calendar, Eye, Download, Filter, User, Award, Clock, CheckCircle2,
  XCircle, TrendingDown, Activity, ChevronRight, Search, RefreshCw, Loader2,
  FileSpreadsheet, FileText, MapPin, Star,
  Flame,
  Thermometer,
  Snowflake
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart as RechartsPie, Pie, Cell, Area, AreaChart
} from 'recharts';
import { 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, 
  endOfYear, subMonths, format, parseISO, differenceInDays 
} from 'date-fns';
  import { exportToPDF } from '@/pages/Pdfexport';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  teal: '#14b8a6',
  pink: '#ec4899',
};

const CHART_COLORS = [COLORS.primary, COLORS.success, COLORS.warning, COLORS.danger, COLORS.purple];

// ========== INTERFACES ==========

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  stage: string;
  temperature: string;
  source: string;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredLocation: string | null;
  notes: string | null;
  createdAt: string;
  lastContactedAt: string | null;
  nextFollowupAt: string | null;
  assignedToId: string | null;
  projectId: string | null;
  assignedTo?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  project?: {
    id: string;
    name: string;
    location: string;
  } | null;
  deals?: Deal[];
  siteVisits?: SiteVisit[];
  callLogs?: CallLog[];
}

interface Deal {
  id: string;
  leadId: string;
  dealValue: number | null;
  stage: string;
  createdAt: string;
  closedAt: string | null;
  assignedToId: string | null;
  property?: {
    id: string;
    title: string;
    price: number;
  } | null;
}

interface CallLog {
  id: string;
  leadId: string;
  agentId: string;
  callStatus: string;
  callDate: string;
  callDuration: number | null;
  notes: string | null;
  rejectionReason: string | null;
  agent?: {
    fullName: string;
  };
  lead?: {
    name: string;
    phone: string;
  };
}

interface Property {
  id: string;
  title: string;
  status: string;
  price: number;
  projectId: string | null;
  propertyType: string;
  location: string;
}

interface Agent {
  id: string;
  fullName: string;
  email: string;
  role: string;
  _count?: {
    assignedLeads: number;
    callLogs: number;
    assignedDeals: number;
  };
}

interface SiteVisit {
  id: string;
  leadId: string;
  scheduledAt: string;
  status: string;
  rating: number | null;
  feedback: string | null;
  propertyId: string | null;
  projectId: string | null;
  conductedBy: string | null;
  lead?: {
    id: string;
    name: string;
    phone: string;
    temperature: string;
    stage: string;
  };
  property?: {
    title: string;
    location: string;
  } | null;
  project?: {
    name: string;
    location: string;
  } | null;
  conductor?: {
    fullName: string;
  };
}

interface Project {
  id: string;
  name: string;
  location: string;
  city: string;
  status: string;
  category: string;
  _count?: {
    properties: number;
    siteVisits: number;
  };
}

// ========== MAIN COMPONENT ==========

export default function Reports() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const isAgent = user?.role === 'sales_agent';

  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);

  // Raw Data States
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Computed Stats
  const [overviewStats, setOverviewStats] = useState({
    totalRevenue: 0,
    revenueGrowth: 0,
    totalLeads: 0,
    leadsGrowth: 0,
    conversionRate: 0,
    conversionGrowth: 0,
    avgDealSize: 0,
    dealGrowth: 0,
  });

  // ========== DATA FETCHING ==========

  useEffect(() => {
    if (token) {
      fetchAllData();
    }
  }, [token, period]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      const [leadsRes, dealsRes, callsRes, propsRes, agentsRes, visitsRes, projectsRes] = await Promise.all([
        fetch(`${API_URL}/leads`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/deals`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/call-logs`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/properties`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/users`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/site-visits`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/projects`, { headers }).then(r => r.json()),
      ]);

      setLeads(Array.isArray(leadsRes) ? leadsRes : []);
      setDeals(Array.isArray(dealsRes) ? dealsRes : []);
      setCallLogs(Array.isArray(callsRes) ? callsRes : []);
      setProperties(Array.isArray(propsRes) ? propsRes : []);
      setAgents(Array.isArray(agentsRes) ? agentsRes.filter((a: any) => a.role !== 'admin') : []);
      setSiteVisits(Array.isArray(visitsRes) ? visitsRes : []);
      setProjects(Array.isArray(projectsRes) ? projectsRes : []);

      calculateStats(leadsRes, dealsRes);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({ title: 'Error', description: 'Failed to load reports data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
    toast({ title: 'Success', description: 'Data refreshed successfully' });
  };

  // ========== CALCULATIONS ==========

  const getPeriodDates = (p: string) => {
    const now = new Date();
    switch (p) {
      case 'week':
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const getPreviousPeriodDates = (p: string) => {
    const now = new Date();
    switch (p) {
      case 'week':
        const prevWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: startOfWeek(prevWeek), end: endOfWeek(prevWeek) };
      case 'year':
        const prevYear = new Date(now.getFullYear() - 1, 0, 1);
        return { start: startOfYear(prevYear), end: endOfYear(prevYear) };
      default:
        const prevMonth = subMonths(now, 1);
        return { start: startOfMonth(prevMonth), end: endOfMonth(prevMonth) };
    }
  };

  const calculateStats = (leadsData: Lead[], dealsData: Deal[]) => {
    const { start: periodStart, end: periodEnd } = getPeriodDates(period);
    const { start: prevStart, end: prevEnd } = getPreviousPeriodDates(period);

    const currentLeads = leadsData.filter(l => {
      const date = new Date(l.createdAt);
      return date >= periodStart && date <= periodEnd;
    });

    const prevLeads = leadsData.filter(l => {
      const date = new Date(l.createdAt);
      return date >= prevStart && date <= prevEnd;
    });

    const closedDeals = dealsData.filter(d => d.stage === 'closed');
    const currentDeals = closedDeals.filter(d => {
      const date = new Date(d.createdAt);
      return date >= periodStart && date <= periodEnd;
    });

    const prevDeals = closedDeals.filter(d => {
      const date = new Date(d.createdAt);
      return date >= prevStart && date <= prevEnd;
    });

    const currentRevenue = currentDeals.reduce((sum, d) => sum + (Number(d.dealValue) || 0), 0);
    const prevRevenue = prevDeals.reduce((sum, d) => sum + (Number(d.dealValue) || 0), 0);

    const totalConverted = leadsData.filter(l => ['closed', 'token'].includes(l.stage)).length;
    const conversionRate = leadsData.length > 0 ? (totalConverted / leadsData.length) * 100 : 0;

    const prevConverted = prevLeads.filter(l => ['closed', 'token'].includes(l.stage)).length;
    const prevConversionRate = prevLeads.length > 0 ? (prevConverted / prevLeads.length) * 100 : 0;

    setOverviewStats({
      totalRevenue: currentRevenue,
      revenueGrowth: prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0,
      totalLeads: currentLeads.length,
      leadsGrowth: prevLeads.length > 0 ? ((currentLeads.length - prevLeads.length) / prevLeads.length) * 100 : 0,
      conversionRate,
      conversionGrowth: prevConversionRate > 0 ? conversionRate - prevConversionRate : 0,
      avgDealSize: currentDeals.length > 0 ? currentRevenue / currentDeals.length : 0,
      dealGrowth: prevDeals.length > 0 ? ((currentDeals.length - prevDeals.length) / prevDeals.length) * 100 : 0,
    });
  };

  // ========== EXPORT FUNCTIONS ==========

   const exportReport = (agentId?: string) => {
    setExporting(true);
    try {
      const agentName = agentId 
        ? agents.find(a => a.id === agentId)?.fullName 
        : 'All_Agents';
      
      exportToPDF(
        leads,
        deals,
        callLogs,
        siteVisits,
        projects,
        agents,
        period,
        agentId,
        agentName
      );
      
      toast({ 
        title: 'Success', 
        description: 'PDF report generated successfully',
        className: 'bg-green-50 border-green-200'
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to generate PDF', 
        variant: 'destructive' 
      });
    } finally {
      setExporting(false);
    }
  };

  // ========== UTILITY FUNCTIONS ==========

  const formatPrice = (amount: number) => {
    if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `${(amount / 100000).toFixed(2)} L`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(2)} K`;
    return amount.toFixed(0);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-gray-500" />;
  };

  // ========== CHART DATA PREPARATION ==========

  const stageDistribution = [
    { name: 'New', value: leads.filter(l => l.stage === 'new').length, color: COLORS.primary },
    { name: 'Contacted', value: leads.filter(l => l.stage === 'contacted').length, color: COLORS.success },
    { name: 'Site Visit', value: leads.filter(l => l.stage === 'site_visit').length, color: COLORS.warning },
    { name: 'Negotiation', value: leads.filter(l => l.stage === 'negotiation').length, color: COLORS.purple },
    { name: 'Token', value: leads.filter(l => l.stage === 'token').length, color: COLORS.teal },
    { name: 'Closed', value: leads.filter(l => l.stage === 'closed').length, color: COLORS.pink },
  ];

  const sourceDistribution = Object.entries(
    leads.reduce((acc, lead) => {
      acc[lead.source] = (acc[lead.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(new Date(), 5 - i);
    const monthLeads = leads.filter(l => {
      const date = new Date(l.createdAt);
      return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
    });
    const monthDeals = deals.filter(d => {
      const date = new Date(d.createdAt);
      return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear() && d.stage === 'closed';
    });

    return {
      month: format(month, 'MMM'),
      leads: monthLeads.length,
      deals: monthDeals.length,
      revenue: monthDeals.reduce((sum, d) => sum + (Number(d.dealValue) || 0), 0) / 100000,
    };
  });

  const callMetrics = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayCalls = callLogs.filter(c => {
      const callDate = new Date(c.callDate);
      return callDate.toDateString() === date.toDateString();
    });

    return {
      day: format(date, 'EEE'),
      total: dayCalls.length,
      connected: dayCalls.filter(c => c.callStatus?.startsWith('connected')).length,
      positive: dayCalls.filter(c => c.callStatus === 'connected_positive').length,
      callbacks: dayCalls.filter(c => c.callStatus === 'connected_callback').length,
    };
  });

  // Agent Performance Data
  const agentPerformance = agents.map(agent => {
    const agentLeads = leads.filter(l => l.assignedToId === agent.id);
    const agentDeals = deals.filter(d => d.assignedToId === agent.id);
    const closedDeals = agentDeals.filter(d => d.stage === 'closed');
    const revenue = closedDeals.reduce((sum, d) => sum + (Number(d.dealValue) || 0), 0);

    return {
      id: agent.id,
      name: agent.fullName,
      leads: agentLeads.length,
      conversions: closedDeals.length,
      revenue,
      calls: callLogs.filter(c => c.agentId === agent.id).length,
      visits: siteVisits.filter(v => v.conductedBy === agent.id).length,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const selectedAgentData = agentPerformance.find(a => a.id === selectedAgentId);

  const selectedAgentMonthly = Array.from({ length: 5 }, (_, i) => {
    const month = subMonths(new Date(), 4 - i);
    const monthLeads = leads.filter(l => {
      const date = new Date(l.createdAt);
      return l.assignedToId === selectedAgentId && 
             date.getMonth() === month.getMonth() && 
             date.getFullYear() === month.getFullYear();
    });
    const monthDeals = deals.filter(d => {
      const date = new Date(d.createdAt);
      return d.assignedToId === selectedAgentId && 
             d.stage === 'closed' &&
             date.getMonth() === month.getMonth() && 
             date.getFullYear() === month.getFullYear();
    });

    return {
      month: format(month, 'MMM'),
      leads: monthLeads.length,
      conversions: monthDeals.length,
    };
  });

  const filteredAgents = agentPerformance.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ========== RENDER ==========

  if (loading) {
    return (
      <DashboardLayout title="Reports" description="Comprehensive sales analytics and insights">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Loading analytics data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Reports & Analytics" description="Comprehensive sales performance insights">
      <div className="space-y-6">
        
        {/* HEADER CONTROLS */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

           <Button 
            onClick={() => exportReport(isAgent ? user?.id : undefined)}
            disabled={exporting}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <FileText className="h-4 w-4" />
            {exporting ? 'Generating...' : isAgent ? 'Download PDF Report' : 'Download PDF Report'}
          </Button>
        </div>

        {/* KEY METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold mt-1">₹{formatPrice(overviewStats.totalRevenue)}</p>
                  <div className="flex items-center gap-1 mt-2">
                    {getTrendIcon(overviewStats.revenueGrowth)}
                    <span className={`text-sm ${overviewStats.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Math.abs(overviewStats.revenueGrowth).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <IndianRupee className="h-10 w-10 text-blue-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
                  <p className="text-2xl font-bold mt-1">{overviewStats.totalLeads}</p>
                  <div className="flex items-center gap-1 mt-2">
                    {getTrendIcon(overviewStats.leadsGrowth)}
                    <span className={`text-sm ${overviewStats.leadsGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Math.abs(overviewStats.leadsGrowth).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <Users className="h-10 w-10 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
                  <p className="text-2xl font-bold mt-1">{overviewStats.conversionRate.toFixed(1)}%</p>
                  <div className="flex items-center gap-1 mt-2">
                    {getTrendIcon(overviewStats.conversionGrowth)}
                    <span className={`text-sm ${overviewStats.conversionGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Math.abs(overviewStats.conversionGrowth).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <Target className="h-10 w-10 text-purple-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Deal Size</p>
                  <p className="text-2xl font-bold mt-1">₹{formatPrice(overviewStats.avgDealSize)}</p>
                  <div className="flex items-center gap-1 mt-2">
                    {getTrendIcon(overviewStats.dealGrowth)}
                    <span className={`text-sm ${overviewStats.dealGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Math.abs(overviewStats.dealGrowth).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <BarChart3 className="h-10 w-10 text-orange-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TABS */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="calls">Calls</TabsTrigger>
            <TabsTrigger value="agents">
              {isAgent ? 'My Performance' : 'Team Performance'}
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    Revenue & Lead Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monthlyTrend}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={COLORS.success} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis yAxisId="left" className="text-xs" />
                      <YAxis yAxisId="right" orientation="right" className="text-xs" />
                      <Tooltip />
                      <Area 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="revenue" 
                        stroke={COLORS.primary} 
                        fillOpacity={1} 
                        fill="url(#colorRevenue)" 
                        name="Revenue (L)"
                      />
                      <Area 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="leads" 
                        stroke={COLORS.success} 
                        fillOpacity={1} 
                        fill="url(#colorLeads)"
                        name="Leads"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-purple-500" />
                    Pipeline Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPie>
                      <Pie
                        data={stageDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {stageDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPie>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Lead Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={sourceDistribution}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Bar dataKey="value" fill={COLORS.teal} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Lead Temperature</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                        <div className="flex items-center gap-2 mb-2">
                          <Flame className="h-5 w-5 text-red-600" />
                          <p className="text-sm font-medium text-red-900">Hot</p>
                        </div>
                        <p className="text-3xl font-bold text-red-600">
                          {leads.filter(l => l.temperature === 'hot').length}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          {leads.length > 0 
                            ? `${((leads.filter(l => l.temperature === 'hot').length / leads.length) * 100).toFixed(0)}%`
                            : '0%'}
                        </p>
                      </div>
                      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                        <div className="flex items-center gap-2 mb-2">
                          <Thermometer className="h-5 w-5 text-yellow-600" />
                          <p className="text-sm font-medium text-yellow-900">Warm</p>
                        </div>
                        <p className="text-3xl font-bold text-yellow-600">
                          {leads.filter(l => l.temperature === 'warm').length}
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                          {leads.length > 0 
                            ? `${((leads.filter(l => l.temperature === 'warm').length / leads.length) * 100).toFixed(0)}%`
                            : '0%'}
                        </p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                          <Snowflake className="h-5 w-5 text-blue-600" />
                          <p className="text-sm font-medium text-blue-900">Cold</p>
                        </div>
                        <p className="text-3xl font-bold text-blue-600">
                          {leads.filter(l => l.temperature === 'cold').length}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          {leads.length > 0 
                            ? `${((leads.filter(l => l.temperature === 'cold').length / leads.length) * 100).toFixed(0)}%`
                            : '0%'}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* LEADS TAB */}
          <TabsContent value="leads" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Monthly Lead Generation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="leads" 
                      stroke={COLORS.primary} 
                      strokeWidth={3}
                      dot={{ fill: COLORS.primary, r: 6 }}
                      name="Leads"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="deals" 
                      stroke={COLORS.success} 
                      strokeWidth={3}
                      dot={{ fill: COLORS.success, r: 6 }}
                      name="Closed Deals"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Active Leads</p>
                      <p className="text-3xl font-bold mt-1">
                        {leads.filter(l => !['closed', 'lost'].includes(l.stage)).length}
                      </p>
                      <p className="text-xs opacity-75 mt-2">Currently in pipeline</p>
                    </div>
                    <Activity className="h-12 w-12 opacity-30" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Converted</p>
                      <p className="text-3xl font-bold mt-1">
                        {leads.filter(l => ['closed', 'token'].includes(l.stage)).length}
                      </p>
                      <p className="text-xs opacity-75 mt-2">Success rate</p>
                    </div>
                    <CheckCircle2 className="h-12 w-12 opacity-30" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Lost</p>
                      <p className="text-3xl font-bold mt-1">
                        {leads.filter(l => l.stage === 'lost').length}
                      </p>
                      <p className="text-xs opacity-75 mt-2">Needs follow-up</p>
                    </div>
                    <XCircle className="h-12 w-12 opacity-30" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* CALLS TAB */}
          <TabsContent value="calls" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Phone className="h-5 w-5 text-blue-500" />
                  Daily Call Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={callMetrics}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="total" fill={COLORS.primary} name="Total Calls" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="connected" fill={COLORS.success} name="Connected" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="positive" fill={COLORS.purple} name="Positive" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Total Calls</p>
                      <p className="text-3xl font-bold mt-1">{callLogs.length}</p>
                      <p className="text-xs opacity-75 mt-2">{period === 'week' ? 'This week' : period === 'month' ? 'This month' : 'This year'}</p>
                    </div>
                    <Phone className="h-12 w-12 opacity-30" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Connect Rate</p>
                      <p className="text-3xl font-bold mt-1">
                        {callLogs.length > 0
                          ? Math.round((callLogs.filter(c => c.callStatus?.startsWith('connected')).length / callLogs.length) * 100)
                          : 0}%
                      </p>
                      <p className="text-xs opacity-75 mt-2">Overall performance</p>
                    </div>
                    <CheckCircle2 className="h-12 w-12 opacity-30" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Positive Calls</p>
                      <p className="text-3xl font-bold mt-1">
                        {callLogs.filter(c => c.callStatus === 'connected_positive').length}
                      </p>
                      <p className="text-xs opacity-75 mt-2">Interested leads</p>
                    </div>
                    <Star className="h-12 w-12 opacity-30" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* AGENTS TAB */}
          <TabsContent value="agents" className="space-y-6">
            {isAgent ? (
              // Agent's Own Performance
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-lg">
                          {user?.fullName ? getInitials(user.fullName) : 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-xl font-bold">{user?.fullName}</h3>
                        <p className="text-sm text-muted-foreground">Your Performance Overview</p>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <Card className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-4 pb-4">
                          <p className="text-sm text-muted-foreground">My Leads</p>
                          <p className="text-2xl font-bold mt-1">
                            {leads.filter(l => l.assignedToId === user?.id).length}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-green-500">
                        <CardContent className="pt-4 pb-4">
                          <p className="text-sm text-muted-foreground">Conversions</p>
                          <p className="text-2xl font-bold text-green-600 mt-1">
                            {deals.filter(d => d.assignedToId === user?.id && d.stage === 'closed').length}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-purple-500">
                        <CardContent className="pt-4 pb-4">
                          <p className="text-sm text-muted-foreground">My Revenue</p>
                          <p className="text-lg font-bold mt-1">
                            ₹{formatPrice(
                              deals
                                .filter(d => d.assignedToId === user?.id && d.stage === 'closed')
                                .reduce((sum, d) => sum + (Number(d.dealValue) || 0), 0)
                            )}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-orange-500">
                        <CardContent className="pt-4 pb-4">
                          <p className="text-sm text-muted-foreground">Win Rate</p>
                          <p className="text-2xl font-bold mt-1">
                            {leads.filter(l => l.assignedToId === user?.id).length > 0
                              ? ((deals.filter(d => d.assignedToId === user?.id && d.stage === 'closed').length / 
                                  leads.filter(l => l.assignedToId === user?.id).length) * 100).toFixed(0)
                              : 0}%
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-3">My Call Statistics</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                            <span className="text-sm">Total Calls</span>
                            <span className="font-bold">{callLogs.filter(c => c.agentId === user?.id).length}</span>
                          </div>
                          <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                            <span className="text-sm">Connected</span>
                            <span className="font-bold text-green-600">
                              {callLogs.filter(c => c.agentId === user?.id && c.callStatus?.startsWith('connected')).length}
                            </span>
                          </div>
                          <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                            <span className="text-sm">Connect Rate</span>
                            <span className="font-bold text-blue-600">
                              {callLogs.filter(c => c.agentId === user?.id).length > 0
                                ? `${((callLogs.filter(c => c.agentId === user?.id && c.callStatus?.startsWith('connected')).length / 
                                    callLogs.filter(c => c.agentId === user?.id).length) * 100).toFixed(1)}%`
                                : '0%'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3">My Site Visits</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                            <span className="text-sm">Total Visits</span>
                            <span className="font-bold">{siteVisits.filter(v => v.conductedBy === user?.id).length}</span>
                          </div>
                          <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                            <span className="text-sm">Completed</span>
                            <span className="font-bold text-green-600">
                              {siteVisits.filter(v => v.conductedBy === user?.id && v.status === 'completed').length}
                            </span>
                          </div>
                          <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                            <span className="text-sm">Avg Rating</span>
                            <span className="font-bold text-blue-600">
                              {siteVisits.filter(v => v.conductedBy === user?.id && v.rating).length > 0
                                ? (siteVisits.filter(v => v.conductedBy === user?.id && v.rating)
                                    .reduce((sum, v) => sum + (v.rating || 0), 0) / 
                                    siteVisits.filter(v => v.conductedBy === user?.id && v.rating).length).toFixed(1)
                                : 'N/A'} ⭐
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <Button 
                        onClick={() => exportReport(user?.id)}
                        disabled={exporting}
                        className="gap-2 bg-green-600 hover:bg-green-700"
                      >
                        <FileText className="h-4 w-4" />
                        {exporting ? 'Generating...' : 'Download My PDF Report'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              // Manager/Admin View - Team Performance
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="relative w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search agents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAgents.map((agent) => (
                    <Card 
                      key={agent.id} 
                      className="hover:shadow-lg transition-shadow cursor-pointer group"
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setAgentDialogOpen(true);
                      }}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                                {getInitials(agent.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold group-hover:text-blue-600 transition-colors">
                                {agent.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {agent.leads} leads · {agent.conversions} closed
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Revenue</span>
                            <span className="font-bold">₹{formatPrice(agent.revenue)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Win Rate</span>
                            <span className="font-bold">
                              {agent.leads > 0 ? ((agent.conversions / agent.leads) * 100).toFixed(0) : 0}%
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Calls Made</span>
                            <span className="font-bold">{agent.calls}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Site Visits</span>
                            <span className="font-bold">{agent.visits}</span>
                          </div>
                        </div>

                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full mt-4"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportReport(agent.id);
                          }}
                        >
                          <Download className="h-3 w-3 mr-2" />
                          Download PDF
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* AGENT DETAIL DIALOG (FOR MANAGERS) */}
        {!isAgent && (
          <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                      {selectedAgentData ? getInitials(selectedAgentData.name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold">{selectedAgentData?.name}</h3>
                    <p className="text-sm text-muted-foreground">Detailed Performance Report</p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              {selectedAgentData && (
                <div className="space-y-6 py-4">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-4 gap-4">
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-4 pb-4">
                        <p className="text-sm text-muted-foreground">Total Leads</p>
                        <p className="text-2xl font-bold mt-1">{selectedAgentData.leads}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-green-500">
                      <CardContent className="pt-4 pb-4">
                        <p className="text-sm text-muted-foreground">Conversions</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">{selectedAgentData.conversions}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-purple-500">
                      <CardContent className="pt-4 pb-4">
                        <p className="text-sm text-muted-foreground">Revenue</p>
                        <p className="text-lg font-bold mt-1">₹{formatPrice(selectedAgentData.revenue)}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-orange-500">
                      <CardContent className="pt-4 pb-4">
                        <p className="text-sm text-muted-foreground">Win Rate</p>
                        <p className="text-2xl font-bold mt-1">
                          {selectedAgentData.leads > 0
                            ? ((selectedAgentData.conversions / selectedAgentData.leads) * 100).toFixed(0)
                            : 0}%
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Monthly Performance */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Monthly Performance (Last 5 Months)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={selectedAgentMonthly}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip />
                          <Line 
                            type="monotone" 
                            dataKey="conversions" 
                            stroke={COLORS.success} 
                            strokeWidth={2} 
                            name="Conversions" 
                            dot={{ fill: COLORS.success, r: 4 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="leads" 
                            stroke={COLORS.primary} 
                            strokeWidth={2} 
                            name="Leads"
                            dot={{ fill: COLORS.primary, r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setAgentDialogOpen(false)}>
                      Close
                    </Button>
  <Button 
                      className="gap-2 bg-green-600 hover:bg-green-700"
                      onClick={() => exportReport(selectedAgentId!)}
                      disabled={exporting}
                    >
                      <Download className="h-4 w-4" />
                      {exporting ? 'Generating...' : 'Download PDF Report'}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}