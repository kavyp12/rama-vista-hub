import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RecentLeads } from '@/components/dashboard/RecentLeads';
import { PropertyOverview } from '@/components/dashboard/PropertyOverview';
import { Users, Building2, TrendingUp, CalendarDays, IndianRupee, Target } from 'lucide-react';

interface DashboardStats {
  totalLeads: number;
  totalProperties: number;
  totalDeals: number;
  scheduledVisits: number;
  pipelineValue: number;
  conversionRate: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    totalProperties: 0,
    totalDeals: 0,
    scheduledVisits: 0,
    pipelineValue: 0,
    conversionRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const [leadsRes, propertiesRes, dealsRes, visitsRes] = await Promise.all([
        supabase.from('leads').select('id, stage', { count: 'exact' }),
        supabase.from('properties').select('id', { count: 'exact' }),
        supabase.from('deals').select('id, deal_value, stage'),
        supabase.from('site_visits').select('id', { count: 'exact' }).eq('status', 'scheduled'),
      ]);

      const totalLeads = leadsRes.count || 0;
      const closedLeads = leadsRes.data?.filter(l => l.stage === 'closed').length || 0;
      const totalProperties = propertiesRes.count || 0;
      const totalDeals = dealsRes.data?.length || 0;
      const scheduledVisits = visitsRes.count || 0;
      const pipelineValue = dealsRes.data?.reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0) || 0;
      const conversionRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;

      setStats({
        totalLeads,
        totalProperties,
        totalDeals,
        scheduledVisits,
        pipelineValue,
        conversionRate,
      });
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

  return (
    <DashboardLayout title="Dashboard" description="Overview of your real estate operations">
      <div className="space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatsCard
            title="Total Leads"
            value={loading ? '...' : stats.totalLeads}
            icon={<Users className="h-6 w-6 text-primary" />}
            trend={{ value: 12, isPositive: true }}
          />
          <StatsCard
            title="Properties"
            value={loading ? '...' : stats.totalProperties}
            icon={<Building2 className="h-6 w-6 text-primary" />}
          />
          <StatsCard
            title="Active Deals"
            value={loading ? '...' : stats.totalDeals}
            icon={<TrendingUp className="h-6 w-6 text-primary" />}
          />
          <StatsCard
            title="Scheduled Visits"
            value={loading ? '...' : stats.scheduledVisits}
            icon={<CalendarDays className="h-6 w-6 text-primary" />}
          />
          <StatsCard
            title="Pipeline Value"
            value={loading ? '...' : formatCurrency(stats.pipelineValue)}
            icon={<IndianRupee className="h-6 w-6 text-primary" />}
          />
          <StatsCard
            title="Conversion Rate"
            value={loading ? '...' : `${stats.conversionRate}%`}
            icon={<Target className="h-6 w-6 text-primary" />}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentLeads />
          <PropertyOverview />
        </div>
      </div>
    </DashboardLayout>
  );
}
