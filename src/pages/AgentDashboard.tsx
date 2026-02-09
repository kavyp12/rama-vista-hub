import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  MapPin, Calendar, Phone, Mail, User, Building2, 
  Navigation, Clock, Flame, Thermometer, Snowflake, Home, 
  AlertCircle, TrendingUp, Target, Briefcase, Award
} from 'lucide-react';
import { format, parseISO, isToday, isPast } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
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
}

interface PerformanceStats {
  leadsByStage: { stage: string; count: number }[];
  leadsByTemperature: { temperature: string; count: number }[];
  callStats: { total: number; connected: number; connectRate: number };
  dealStats: { total: number; closed: number; winRate: number; totalRevenue: number };
  totalLeads: number;
  conversionRate: number;
}

// --- COLORS FOR CHARTS ---
const COLORS = {
  hot: '#ef4444',   // Red-500
  warm: '#f59e0b',  // Amber-500
  cold: '#3b82f6',  // Blue-500
  connected: '#10b981', // Emerald-500
  missed: '#ef4444',    // Red-500
  primary: '#4f46e5'    // Indigo-600
};

export default function AgentDashboard() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  
  // State
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpLead[]>([]);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token && user?.id) fetchAllData();
  }, [token, user]);

  async function fetchAllData() {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // We fetch specific user stats to get the funnel/charts data
      const [visitsRes, followUpsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/site-visits`, { headers }),
        fetch(`${API_URL}/leads?needsFollowup=true`, { headers }),
        fetch(`${API_URL}/users/${user?.id}/stats`, { headers })
      ]);

      const visitsData = await visitsRes.json();
      const followUpsData = await followUpsRes.json();
      const statsData = await statsRes.json();

      // Filter visits for "My Schedule"
      const myVisits = Array.isArray(visitsData) ? visitsData
        .filter((v: SiteVisit) => v.status === 'scheduled')
        .sort((a: SiteVisit, b: SiteVisit) => 
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        ) : [];
      
      setVisits(myVisits);
      setFollowUps(Array.isArray(followUpsData) ? followUpsData : []);
      setStats(statsData);

    } catch (error) {
      console.error(error);
      toast({ 
        title: 'Error', 
        description: 'Failed to load dashboard data',
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }

  // Helper Logic
  const todayVisits = visits.filter(v => isToday(parseISO(v.scheduledAt)));
  const upcomingVisits = visits.filter(v => !isToday(parseISO(v.scheduledAt)) && !isPast(parseISO(v.scheduledAt)));

  // Data formatting for Charts
  const callChartData = stats ? [
    { name: 'Connected', value: stats.callStats.connected },
    { name: 'Missed/Other', value: stats.callStats.total - stats.callStats.connected }
  ] : [];

  const tempChartData = stats ? stats.leadsByTemperature.map(item => ({
    name: item.temperature.charAt(0).toUpperCase() + item.temperature.slice(1),
    value: item.count
  })) : [];

  const funnelData = stats ? stats.leadsByStage.map(item => ({
    stage: item.stage.replace('_', ' ').toUpperCase(),
    count: item.count
  })) : [];

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
    if (visit.property) {
      return {
        name: visit.property.title,
        address: `${visit.property.location}`,
        details: `${visit.property.bedrooms || ''} BHK ${visit.property.propertyType || ''}`.trim(),
        icon: <Home className="h-4 w-4 text-blue-600" />
      };
    }
    if (visit.project) {
      return {
        name: visit.project.name,
        address: `${visit.project.location}`,
        details: 'Project Site',
        icon: <Building2 className="h-4 w-4 text-purple-600" />
      };
    }
    return {
      name: 'Location Not Specified',
      address: 'Contact manager',
      details: 'Site Visit',
      icon: <MapPin className="h-4 w-4 text-gray-500" />
    };
  };

  // --- COMPONENT RENDER ---
  return (
    <DashboardLayout 
      title="Agent Dashboard" 
      description={`Welcome back, ${user?.fullName || 'Agent'}. Here is your performance overview.`}
    >
      <div className="space-y-6">
        
        {/* 1. KEY PERFORMANCE INDICATORS (KPIs) */}
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
              <p className="text-xs text-muted-foreground mt-2">{stats?.callStats.connected} connected / {stats?.callStats.total} total</p>
            </CardContent>
          </Card>
        </div>

        {/* 2. ANALYTICAL CHARTS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales Funnel */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Pipeline Stages
              </CardTitle>
              <CardDescription>Distribution of your leads across stages</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {loading || !stats ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">Loading charts...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="stage" tick={{fontSize: 10}} interval={0} />
                    <YAxis allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      cursor={{fill: 'transparent'}}
                    />
                    <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Lead Quality & Calls */}
          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Lead Temperature</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tempChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
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
          </div>
        </div>

        {/* 3. ACTIONABLE ITEMS (WORKFLOW) */}
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="tasks">Urgent Tasks</TabsTrigger>
            <TabsTrigger value="schedule">My Schedule</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tasks" className="space-y-4 mt-4">
            {followUps.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircleIcon />
                  <p className="mt-2">You're all caught up! No pending follow-ups.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {followUps.slice(0, 9).map(lead => (
                  <FollowUpCard key={lead.id} lead={lead} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Today */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-indigo-900">
                  <Calendar className="h-4 w-4" /> Today's Visits ({todayVisits.length})
                </h3>
                {todayVisits.length === 0 ? (
                  <div className="p-4 border rounded-lg bg-slate-50 text-center text-sm text-muted-foreground">
                    No visits scheduled for today.
                  </div>
                ) : (
                  todayVisits.map(visit => <VisitCard key={visit.id} visit={visit} isToday />)
                )}
              </div>

              {/* Upcoming */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" /> Upcoming
                </h3>
                {upcomingVisits.length === 0 ? (
                  <div className="p-4 border rounded-lg bg-slate-50 text-center text-sm text-muted-foreground">
                    No upcoming visits in the next 7 days.
                  </div>
                ) : (
                  upcomingVisits.slice(0, 5).map(visit => <VisitCard key={visit.id} visit={visit} />)
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );

  // --- SUB COMPONENTS ---

  function FollowUpCard({ lead }: { lead: FollowUpLead }) {
    const followUpDate = parseISO(lead.nextFollowupAt);
    const isOverdue = isPast(followUpDate) && !isToday(followUpDate);

    return (
      <Card className={`border-l-4 ${isOverdue ? 'border-l-red-600' : 'border-l-amber-500'} hover:shadow-md transition-all`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm truncate">{lead.name}</h4>
                {getTemperatureIcon(lead.temperature)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{lead.source}</p>
            </div>
            {isOverdue && <Badge variant="destructive" className="text-[10px] h-5">Overdue</Badge>}
          </div>
          
          <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3" />
              <span>{lead.phone}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                Due: {format(followUpDate, 'MMM dd, h:mm a')}
              </span>
            </div>
          </div>

          <a href={`tel:${lead.phone}`} className="block w-full">
            <Button size="sm" variant="outline" className="w-full h-8 text-xs border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800">
              <Phone className="h-3 w-3 mr-1" /> Call Lead
            </Button>
          </a>
        </CardContent>
      </Card>
    );
  }

  function VisitCard({ visit, isToday: today }: { visit: SiteVisit; isToday?: boolean }) {
    const location = getLocationDetails(visit);
    const visitDate = parseISO(visit.scheduledAt);

    const openInMaps = () => {
      const query = encodeURIComponent(location.address);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
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
                <p className="text-sm font-medium">{format(visitDate, 'h:mm a')}</p>
                <p className="text-xs text-muted-foreground">{format(visitDate, 'EEEE, MMM dd')}</p>
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

          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{visit.lead.name}</span>
              {getTemperatureIcon(visit.lead.temperature)}
            </div>
            <a href={`tel:${visit.lead.phone}`}>
              <Button size="sm" className="h-7 gap-1 text-xs bg-indigo-600 hover:bg-indigo-700">
                <Phone className="h-3 w-3" /> Call
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }
}

function CheckCircleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-green-500/50">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}