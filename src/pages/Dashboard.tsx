import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, TrendingUp, CalendarDays, IndianRupee, Target, Phone, ArrowUp, ArrowDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface DashboardStats {
  totalLeads: number;
  totalProperties: number;
  totalDeals: number;
  scheduledVisits: number;
  pipelineValue: number;
  conversionRate: number;
  totalCalls: number;
  connectedCalls: number;
}

interface SourceData {
  name: string;
  value: number;
  converted: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--info))', 'hsl(var(--destructive))'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    totalProperties: 0,
    totalDeals: 0,
    scheduledVisits: 0,
    pipelineValue: 0,
    conversionRate: 0,
    totalCalls: 0,
    connectedCalls: 0,
  });
  const [loading, setLoading] = useState(true);
  const [leadSources, setLeadSources] = useState<SourceData[]>([]);

  useEffect(() => {
    async function fetchStats() {
      const [leadsRes, propertiesRes, dealsRes, visitsRes, callsRes] = await Promise.all([
        supabase.from('leads').select('id, stage, source', { count: 'exact' }),
        supabase.from('properties').select('id', { count: 'exact' }),
        supabase.from('deals').select('id, deal_value, stage'),
        supabase.from('site_visits').select('id', { count: 'exact' }).eq('status', 'scheduled'),
        supabase.from('call_logs').select('id, call_status'),
      ]);

      const leads = leadsRes.data || [];
      const totalLeads = leadsRes.count || 0;
      const closedLeads = leads.filter(l => l.stage === 'closed').length;
      const totalProperties = propertiesRes.count || 0;
      const deals = dealsRes.data || [];
      const totalDeals = deals.length;
      const scheduledVisits = visitsRes.count || 0;
      const pipelineValue = deals.reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0);
      const conversionRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;
      const calls = callsRes.data || [];
      const totalCalls = calls.length;
      const connectedCalls = calls.filter(c => c.call_status?.startsWith('connected')).length;

      setStats({
        totalLeads,
        totalProperties,
        totalDeals,
        scheduledVisits,
        pipelineValue,
        conversionRate,
        totalCalls,
        connectedCalls,
      });

      // Calculate lead sources
      const sourceMap: Record<string, { total: number; converted: number }> = {};
      leads.forEach(l => {
        const src = l.source || 'Unknown';
        if (!sourceMap[src]) {
          sourceMap[src] = { total: 0, converted: 0 };
        }
        sourceMap[src].total++;
        if (l.stage === 'closed') {
          sourceMap[src].converted++;
        }
      });
      
      const sourcesArray = Object.entries(sourceMap)
        .map(([name, data]) => ({ name, value: data.total, converted: data.converted }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      
      setLeadSources(sourcesArray);
      setLoading(false);
    }

    fetchStats();
  }, []);

  const formatCurrency = (value: number) => {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(1)} Cr`;
    } else if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)} L`;
    }
    return `₹${value.toLocaleString()}`;
  };

  const StatCard = ({ 
    title, 
    value, 
    icon, 
    trend, 
    onClick 
  }: { 
    title: string; 
    value: string | number; 
    icon: React.ReactNode; 
    trend?: { value: number; isPositive: boolean }; 
    onClick?: () => void;
  }) => (
    <Card 
      className={`${onClick ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}`}
      onClick={onClick}
    >
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{loading ? '...' : value}</p>
              {trend && (
                <Badge variant="outline" className={trend.isPositive ? 'text-success' : 'text-destructive'}>
                  {trend.isPositive ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
                  {trend.value}%
                </Badge>
              )}
            </div>
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout title="Dashboard" description="Overview of your real estate operations">
      <div className="space-y-8">
        {/* Stats Grid - Clickable */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Leads"
            value={stats.totalLeads}
            icon={<Users className="h-6 w-6 text-primary" />}
            trend={{ value: 12, isPositive: true }}
            onClick={() => navigate('/leads')}
          />
          <StatCard
            title="Properties"
            value={stats.totalProperties}
            icon={<Building2 className="h-6 w-6 text-primary" />}
            onClick={() => navigate('/properties')}
          />
          <StatCard
            title="Active Deals"
            value={stats.totalDeals}
            icon={<TrendingUp className="h-6 w-6 text-primary" />}
            onClick={() => navigate('/pipeline')}
          />
          <StatCard
            title="Scheduled Visits"
            value={stats.scheduledVisits}
            icon={<CalendarDays className="h-6 w-6 text-primary" />}
            onClick={() => navigate('/site-visits')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Pipeline Value"
            value={formatCurrency(stats.pipelineValue)}
            icon={<IndianRupee className="h-6 w-6 text-success" />}
            onClick={() => navigate('/pipeline')}
          />
          <StatCard
            title="Conversion Rate"
            value={`${stats.conversionRate}%`}
            icon={<Target className="h-6 w-6 text-info" />}
            onClick={() => navigate('/reports')}
          />
          <StatCard
            title="Total Calls"
            value={stats.totalCalls}
            icon={<Phone className="h-6 w-6 text-warning" />}
            onClick={() => navigate('/telecalling')}
          />
          <StatCard
            title="Call Connect Rate"
            value={stats.totalCalls > 0 ? `${Math.round((stats.connectedCalls / stats.totalCalls) * 100)}%` : '0%'}
            icon={<Phone className="h-6 w-6 text-success" />}
            onClick={() => navigate('/telecalling')}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lead Sources Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lead Sources</CardTitle>
            </CardHeader>
            <CardContent>
              {leadSources.length === 0 ? (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  No lead data available
                </div>
              ) : (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={leadSources}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {leadSources.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Performing Sources */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Performing Sources</CardTitle>
            </CardHeader>
            <CardContent>
              {leadSources.length === 0 ? (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  No source data available
                </div>
              ) : (
                <div className="space-y-4">
                  {leadSources.map((source, index) => {
                    const conversionRate = source.value > 0 ? Math.round((source.converted / source.value) * 100) : 0;
                    return (
                      <div key={source.name} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <div>
                            <p className="font-medium">{source.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {source.value} leads • {source.converted} converted
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={conversionRate >= 20 ? 'text-success' : conversionRate >= 10 ? 'text-warning' : ''}
                        >
                          {conversionRate}% conversion
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
