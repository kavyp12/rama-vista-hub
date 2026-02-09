import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, usePermissions } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Building2, TrendingUp, CalendarDays, IndianRupee, Target, Phone, ArrowUp, ArrowDown, Clock, AlertCircle, CheckCircle2, Handshake, Home, Briefcase, LandPlot } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface DashboardStats {
  totalLeads: number;
  totalProperties: number;
  totalDeals: number;
  scheduledVisits: number;
  pipelineValue: number;
  conversionRate: number;
  totalCalls: number;
  connectedCalls: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  newLeads: number;
  followupLeads: number;
  todayVisits: number;
  completedVisits: number;
  totalBrokers: number;
  availableProperties: number;
  soldProperties: number;
  residentialProperties: number;
  commercialProperties: number;
  landProperties: number;
}

interface SourceData {
  name: string;
  value: number;
  converted: number;
}

interface StageData {
  name: string;
  value: number;
}

interface RecentActivity {
  id: string;
  type: 'lead' | 'visit' | 'deal' | 'call';
  title: string;
  description: string;
  timestamp: string;
  status?: string;
}

interface TopPerformer {
  id: string;
  name: string;
  leads: number;
  conversions: number;
  conversionRate: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--info))', 'hsl(var(--destructive))'];

const TEMPERATURE_COLORS = {
  hot: 'hsl(var(--destructive))',
  warm: 'hsl(var(--warning))',
  cold: 'hsl(var(--info))'
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { canViewAllLeads, canAssignLeads } = usePermissions();
  
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    totalProperties: 0,
    totalDeals: 0,
    scheduledVisits: 0,
    pipelineValue: 0,
    conversionRate: 0,
    totalCalls: 0,
    connectedCalls: 0,
    hotLeads: 0,
    warmLeads: 0,
    coldLeads: 0,
    newLeads: 0,
    followupLeads: 0,
    todayVisits: 0,
    completedVisits: 0,
    totalBrokers: 0,
    availableProperties: 0,
    soldProperties: 0,
    residentialProperties: 0,
    commercialProperties: 0,
    landProperties: 0,
  });
  
  const [leadSources, setLeadSources] = useState<SourceData[]>([]);
  const [stageDistribution, setStageDistribution] = useState<StageData[]>([]);
  const [temperatureData, setTemperatureData] = useState<StageData[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) fetchDashboardData();
  }, [token]);

  async function fetchDashboardData() {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      const [leadsRes, propertiesRes, dealsRes, visitsRes, callsRes, brokersRes] = await Promise.all([
        fetch(`${API_URL}/leads`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/properties`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/deals`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/site-visits`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/call-logs`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/brokers`, { headers }).then(r => r.json()).catch(() => []),
      ]);

      const leads = Array.isArray(leadsRes) ? leadsRes : [];
      const properties = Array.isArray(propertiesRes) ? propertiesRes : [];
      const deals = Array.isArray(dealsRes) ? dealsRes : [];
      const visits = Array.isArray(visitsRes) ? visitsRes : [];
      const calls = Array.isArray(callsRes) ? callsRes : [];
      const brokers = Array.isArray(brokersRes) ? brokersRes : [];

      const totalLeads = leads.length;
      const convertedLeads = leads.filter((l: any) => l.stage === 'closed' || l.stage === 'token').length;
      const pipelineValue = deals.reduce((sum: number, deal: any) => sum + (deal.dealValue || 0), 0);
      const connectedCalls = calls.filter((c: any) => c.callStatus?.startsWith('connected')).length;

      const hotLeads = leads.filter((l: any) => l.temperature === 'hot').length;
      const warmLeads = leads.filter((l: any) => l.temperature === 'warm').length;
      const coldLeads = leads.filter((l: any) => l.temperature === 'cold').length;

      const today = new Date().toISOString().split('T')[0];
      const newLeads = leads.filter((l: any) => l.createdAt?.startsWith(today)).length;
      const followupLeads = leads.filter((l: any) => l.nextFollowupAt?.startsWith(today)).length;
      const todayVisits = visits.filter((v: any) => v.scheduledAt?.startsWith(today)).length;
      const completedVisits = visits.filter((v: any) => v.status === 'completed').length;

      const availableProperties = properties.filter((p: any) => p.status === 'available').length;
      const soldProperties = properties.filter((p: any) => p.status === 'sold').length;

      const residentialProperties = properties.filter((p: any) => {
        const type = p.propertyType?.toLowerCase();
        return type?.includes('apartment') || type?.includes('villa') || type?.includes('penthouse');
      }).length;

      const commercialProperties = properties.filter((p: any) => {
        const type = p.propertyType?.toLowerCase();
        return type?.includes('commercial') || type?.includes('office');
      }).length;

      const landProperties = properties.filter((p: any) => {
        const type = p.propertyType?.toLowerCase();
        return type?.includes('plot') || type?.includes('land');
      }).length;

      const sourceMap: Record<string, { total: number; converted: number }> = {};
      leads.forEach((l: any) => {
        const source = l.source || 'Unknown';
        if (!sourceMap[source]) sourceMap[source] = { total: 0, converted: 0 };
        sourceMap[source].total++;
        if (l.stage === 'closed' || l.stage === 'token') {
          sourceMap[source].converted++;
        }
      });

      const sourcesArray = Object.entries(sourceMap)
        .map(([name, data]) => ({
          name,
          value: data.total,
          converted: data.converted
        }))
        .sort((a, b) => b.value - a.value);

      const stageMap: Record<string, number> = {};
      leads.forEach((l: any) => {
        const stage = l.stage || 'new';
        stageMap[stage] = (stageMap[stage] || 0) + 1;
      });

      const stagesArray = Object.entries(stageMap).map(([name, value]) => ({ name, value }));

      const tempData = [
        { name: 'Hot', value: hotLeads },
        { name: 'Warm', value: warmLeads },
        { name: 'Cold', value: coldLeads }
      ];

      const activities: RecentActivity[] = [];

      leads.slice(0, 3).forEach((l: any) => {
        activities.push({
          id: l.id,
          type: 'lead',
          title: `New Lead: ${l.name}`,
          description: `${l.source} • ${l.phone}`,
          timestamp: l.createdAt,
          status: l.temperature
        });
      });

      visits.slice(0, 3).forEach((v: any) => {
        activities.push({
          id: v.id,
          type: 'visit',
          title: `Site Visit Scheduled`,
          description: v.property?.title || v.project?.name || 'Property',
          timestamp: v.scheduledAt,
          status: v.status
        });
      });

      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (canAssignLeads) {
        const agentMap: Record<string, { name: string; leads: number; conversions: number }> = {};
        
        leads.forEach((l: any) => {
          const agentId = l.assignedToId || 'unassigned';
          const agentName = l.assignedTo?.fullName || 'Unassigned';
          
          if (!agentMap[agentId]) {
            agentMap[agentId] = { name: agentName, leads: 0, conversions: 0 };
          }
          
          agentMap[agentId].leads++;
          if (l.stage === 'closed' || l.stage === 'token') {
            agentMap[agentId].conversions++;
          }
        });

        const performersArray = Object.entries(agentMap)
          .map(([id, data]) => ({
            id,
            name: data.name,
            leads: data.leads,
            conversions: data.conversions,
            conversionRate: data.leads > 0 ? Math.round((data.conversions / data.leads) * 100) : 0
          }))
          .filter(p => p.id !== 'unassigned')
          .sort((a, b) => b.conversions - a.conversions)
          .slice(0, 5);

        setTopPerformers(performersArray);
      }

      setStats({
        totalLeads,
        totalProperties: properties.length,
        totalDeals: deals.length,
        scheduledVisits: visits.filter((v: any) => v.status === 'scheduled').length,
        pipelineValue,
        conversionRate: totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0,
        totalCalls: calls.length,
        connectedCalls,
        hotLeads,
        warmLeads,
        coldLeads,
        newLeads,
        followupLeads,
        todayVisits,
        completedVisits,
        totalBrokers: brokers.length,
        availableProperties,
        soldProperties,
        residentialProperties,
        commercialProperties,
        landProperties,
      });

      setLeadSources(sourcesArray);
      setStageDistribution(stagesArray);
      setTemperatureData(tempData);
      setRecentActivities(activities.slice(0, 8));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number) {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
    return `₹${amount.toLocaleString()}`;
  }

  function getTimeAgo(timestamp: string) {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  return (
    <DashboardLayout title="Dashboard" description={`Welcome back, ${user?.fullName || 'User'}`}>
      <div className="space-y-6">
        
        {/* Primary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover-lift cursor-pointer" onClick={() => navigate('/leads')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {canViewAllLeads ? 'Total Leads' : 'My Leads'}
                </p>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{stats.totalLeads}</div>
                <Badge variant="secondary" className="bg-success/10 text-success">
                  <ArrowUp className="h-3 w-3 mr-1" />
                  {stats.conversionRate}% Conv.
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.newLeads} new today • {stats.followupLeads} followups
              </p>
            </CardContent>
          </Card>

          <Card className="hover-lift cursor-pointer" onClick={() => navigate('/pipeline')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Pipeline Value</p>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{formatCurrency(stats.pipelineValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalDeals} active deals
              </p>
            </CardContent>
          </Card>

          <Card className="hover-lift cursor-pointer" onClick={() => navigate('/site-visits')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Site Visits</p>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{stats.scheduledVisits}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.todayVisits} today • {stats.completedVisits} completed
              </p>
            </CardContent>
          </Card>

          <Card className="hover-lift cursor-pointer" onClick={() => navigate('/properties')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Properties</p>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{stats.totalProperties}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.availableProperties} available • {stats.soldProperties} sold
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Hot Leads</p>
                  <p className="text-2xl font-bold text-red-600">{stats.hotLeads}</p>
                </div>
                <div className="h-12 w-12 bg-red-50 rounded-full flex items-center justify-center">
                  <Target className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Warm Leads</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.warmLeads}</p>
                </div>
                <div className="h-12 w-12 bg-orange-50 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift cursor-pointer" onClick={() => navigate('/telecalling')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Call Connect Rate</p>
                  <p className="text-2xl font-bold">
                    {stats.totalCalls > 0 ? Math.round((stats.connectedCalls / stats.totalCalls) * 100) : 0}%
                  </p>
                </div>
                <div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center">
                  <Phone className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.connectedCalls}/{stats.totalCalls} calls
              </p>
            </CardContent>
          </Card>

          <Card className="hover-lift cursor-pointer" onClick={() => navigate('/brokers')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Channel Partners</p>
                  <p className="text-2xl font-bold">{stats.totalBrokers}</p>
                </div>
                <div className="h-12 w-12 bg-purple-50 rounded-full flex items-center justify-center">
                  <Handshake className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Lead Sources & Temperature */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Lead Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Sources</h4>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={leadSources}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {leadSources.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Temperature</h4>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={temperatureData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                          {temperatureData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={TEMPERATURE_COLORS[entry.name.toLowerCase() as keyof typeof TEMPERATURE_COLORS]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Source Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Source Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 animate-pulse">
                      <div className="h-4 w-24 bg-muted rounded" />
                      <div className="h-4 w-12 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {leadSources.slice(0, 6).map((source, index) => {
                    const conversionRate = source.value > 0 ? Math.round((source.converted / source.value) * 100) : 0;
                    return (
                      <div key={source.name} className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <div>
                            <p className="font-medium text-sm">{source.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {source.value} leads • {source.converted} converted
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${conversionRate >= 20 ? 'text-success border-success/30' : conversionRate >= 10 ? 'text-warning border-warning/30' : ''}`}
                        >
                          {conversionRate}%
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Property Breakdown & Stage Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Property Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-blue-50 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Home className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold">Residential</p>
                      <p className="text-sm text-muted-foreground">Apartments, Villas, Penthouses</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">{stats.residentialProperties}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.totalProperties > 0 ? Math.round((stats.residentialProperties / stats.totalProperties) * 100) : 0}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-purple-50 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Briefcase className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold">Commercial</p>
                      <p className="text-sm text-muted-foreground">Offices, Shops, Spaces</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-600">{stats.commercialProperties}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.totalProperties > 0 ? Math.round((stats.commercialProperties / stats.totalProperties) * 100) : 0}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-green-50 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <LandPlot className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold">Land / Plots</p>
                      <p className="text-sm text-muted-foreground">Residential & Commercial Plots</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">{stats.landProperties}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.totalProperties > 0 ? Math.round((stats.landProperties / stats.totalProperties) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pipeline Stages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities & Top Performers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No recent activities</p>
                ) : (
                  recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                        activity.type === 'lead' ? 'bg-blue-50' :
                        activity.type === 'visit' ? 'bg-green-50' :
                        activity.type === 'deal' ? 'bg-purple-50' :
                        'bg-orange-50'
                      }`}>
                        {activity.type === 'lead' && <Users className="h-5 w-5 text-blue-600" />}
                        {activity.type === 'visit' && <CalendarDays className="h-5 w-5 text-green-600" />}
                        {activity.type === 'deal' && <TrendingUp className="h-5 w-5 text-purple-600" />}
                        {activity.type === 'call' && <Phone className="h-5 w-5 text-orange-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{activity.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-xs text-muted-foreground">{getTimeAgo(activity.timestamp)}</span>
                        {activity.status && (
                          <Badge variant="outline" className="text-[10px] mt-1">
                            {activity.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {canAssignLeads && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Performers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topPerformers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
                  ) : (
                    topPerformers.map((performer, index) => (
                      <div key={performer.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-slate-100 text-slate-700' :
                            index === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-50 text-blue-600'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{performer.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {performer.leads} leads • {performer.conversions} conversions
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-success/10 text-success">
                          {performer.conversionRate}%
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}