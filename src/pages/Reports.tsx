import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  TrendingUp,
  Users,
  IndianRupee,
  Building2,
  Phone,
  Target,
  PieChart
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart as RechartsPie, Pie, Cell } from 'recharts';

interface Stats {
  totalLeads: number;
  newLeads: number;
  convertedLeads: number;
  totalDeals: number;
  closedDeals: number;
  totalRevenue: number;
  totalCalls: number;
  connectedCalls: number;
  totalProperties: number;
  availableProperties: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--info))', 'hsl(var(--destructive))'];

export default function Reports() {
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0, newLeads: 0, convertedLeads: 0,
    totalDeals: 0, closedDeals: 0, totalRevenue: 0,
    totalCalls: 0, connectedCalls: 0,
    totalProperties: 0, availableProperties: 0
  });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [leadsBySource, setLeadsBySource] = useState<{ name: string; value: number }[]>([]);
  const [leadsByStage, setLeadsByStage] = useState<{ name: string; value: number }[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number }[]>([]);
  const [callsData, setCallsData] = useState<{ name: string; connected: number; missed: number }[]>([]);

  useEffect(() => {
    fetchStats();
  }, [period]);

  async function fetchStats() {
    setLoading(true);

    const [leadsRes, dealsRes, callsRes, propertiesRes] = await Promise.all([
      supabase.from('leads').select('id, source, stage, created_at'),
      supabase.from('deals').select('id, stage, deal_value, closed_at'),
      supabase.from('call_logs').select('id, call_status, call_date'),
      supabase.from('properties').select('id, status'),
    ]);

    const leads = leadsRes.data || [];
    const deals = dealsRes.data || [];
    const calls = callsRes.data || [];
    const properties = propertiesRes.data || [];

    // Calculate stats
    const closedDeals = deals.filter(d => d.stage === 'closed');
    const totalRevenue = closedDeals.reduce((sum, d) => sum + Number(d.deal_value || 0), 0);

    setStats({
      totalLeads: leads.length,
      newLeads: leads.filter(l => l.stage === 'new').length,
      convertedLeads: leads.filter(l => l.stage === 'closed').length,
      totalDeals: deals.length,
      closedDeals: closedDeals.length,
      totalRevenue,
      totalCalls: calls.length,
      connectedCalls: calls.filter(c => c.call_status?.startsWith('connected')).length,
      totalProperties: properties.length,
      availableProperties: properties.filter(p => p.status === 'available').length,
    });

    // Leads by source
    const sourceMap: Record<string, number> = {};
    leads.forEach(l => {
      const src = l.source || 'Unknown';
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });
    setLeadsBySource(Object.entries(sourceMap).map(([name, value]) => ({ name, value })));

    // Leads by stage
    const stageMap: Record<string, number> = {};
    leads.forEach(l => {
      stageMap[l.stage] = (stageMap[l.stage] || 0) + 1;
    });
    setLeadsByStage(Object.entries(stageMap).map(([name, value]) => ({ name, value })));

    // Monthly revenue (mock data for visualization)
    setMonthlyRevenue([
      { month: 'Jan', revenue: 2500000 },
      { month: 'Feb', revenue: 3200000 },
      { month: 'Mar', revenue: 4100000 },
      { month: 'Apr', revenue: 3800000 },
      { month: 'May', revenue: 5200000 },
      { month: 'Jun', revenue: totalRevenue || 4500000 },
    ]);

    // Calls data
    setCallsData([
      { name: 'Mon', connected: 25, missed: 8 },
      { name: 'Tue', connected: 32, missed: 5 },
      { name: 'Wed', connected: 28, missed: 10 },
      { name: 'Thu', connected: 35, missed: 6 },
      { name: 'Fri', connected: 30, missed: 7 },
    ]);

    setLoading(false);
  }

  function formatPrice(price: number) {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
    return `₹${price.toLocaleString()}`;
  }

  const conversionRate = stats.totalLeads > 0 
    ? Math.round((stats.convertedLeads / stats.totalLeads) * 100) 
    : 0;

  const connectRate = stats.totalCalls > 0 
    ? Math.round((stats.connectedCalls / stats.totalCalls) * 100) 
    : 0;

  return (
    <DashboardLayout title="Reports & Analytics" description="Performance insights and metrics">
      <div className="space-y-6">
        {/* Period Selector */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Overview</h2>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatPrice(stats.totalRevenue)}</p>
                </div>
                <IndianRupee className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Leads</p>
                  <p className="text-2xl font-bold">{stats.totalLeads}</p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Conversion Rate</p>
                  <p className="text-2xl font-bold">{conversionRate}%</p>
                </div>
                <Target className="h-8 w-8 text-info" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Call Connect Rate</p>
                  <p className="text-2xl font-bold">{connectRate}%</p>
                </div>
                <Phone className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sales" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="calls">Telecalling</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
          </TabsList>

          {/* Sales Tab */}
          <TabsContent value="sales" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Monthly Revenue Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyRevenue}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} className="text-xs" />
                        <Tooltip formatter={(v) => formatPrice(Number(v))} />
                        <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Deal Pipeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Total Deals</span>
                      <span className="font-bold">{stats.totalDeals}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Closed Won</span>
                      <span className="font-bold text-success">{stats.closedDeals}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">In Progress</span>
                      <span className="font-bold text-warning">{stats.totalDeals - stats.closedDeals}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Win Rate</span>
                      <span className="font-bold">{stats.totalDeals > 0 ? Math.round((stats.closedDeals / stats.totalDeals) * 100) : 0}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Leads Tab */}
          <TabsContent value="leads" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Leads by Source
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={leadsBySource}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {leadsBySource.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Leads by Stage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={leadsByStage} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Calls Tab */}
          <TabsContent value="calls" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Daily Call Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={callsData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Bar dataKey="connected" fill="hsl(var(--success))" name="Connected" />
                        <Bar dataKey="missed" fill="hsl(var(--warning))" name="Missed" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Call Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Total Calls</span>
                      <span className="font-bold">{stats.totalCalls}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Connected</span>
                      <span className="font-bold text-success">{stats.connectedCalls}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Missed / No Answer</span>
                      <span className="font-bold text-warning">{stats.totalCalls - stats.connectedCalls}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Connect Rate</span>
                      <span className="font-bold">{connectRate}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Building2 className="h-12 w-12 mx-auto text-primary mb-4" />
                    <p className="text-3xl font-bold">{stats.totalProperties}</p>
                    <p className="text-sm text-muted-foreground">Total Properties</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Building2 className="h-12 w-12 mx-auto text-success mb-4" />
                    <p className="text-3xl font-bold">{stats.availableProperties}</p>
                    <p className="text-sm text-muted-foreground">Available</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Building2 className="h-12 w-12 mx-auto text-warning mb-4" />
                    <p className="text-3xl font-bold">{stats.totalProperties - stats.availableProperties}</p>
                    <p className="text-sm text-muted-foreground">Booked / Sold</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}