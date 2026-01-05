import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IndianRupee, TrendingUp, Clock, CheckCircle2, AlertCircle, User, Activity } from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';

interface Deal {
  id: string;
  deal_value: number;
  probability: number | null;
  stage: string;
  expected_close_date: string | null;
  notes: string | null;
  created_at: string;
  assigned_to: string | null;
  lead?: {
    name: string;
    phone: string;
  };
  property?: {
    title: string;
    location: string;
  };
  project?: {
    name: string;
  };
  profile?: {
    full_name: string;
  };
}

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  user_id: string | null;
  profile?: {
    full_name: string;
  };
}

const pipelineStages = [
  { value: 'negotiation', label: 'Negotiation', color: 'bg-amber-500' },
  { value: 'token', label: 'Token Received', color: 'bg-blue-500' },
  { value: 'documentation', label: 'Documentation', color: 'bg-purple-500' },
  { value: 'closed', label: 'Closed Won', color: 'bg-green-500' },
  { value: 'lost', label: 'Lost', color: 'bg-red-500' },
];

export default function Pipeline() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pipeline');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [dealsRes, activitiesRes] = await Promise.all([
      supabase
        .from('deals')
        .select(`
          *,
          lead:leads(name, phone),
          property:properties(title, location),
          project:projects(name)
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
    ]);

    if (dealsRes.data) {
      // Fetch agent profiles for deals
      const agentIds = [...new Set(dealsRes.data.filter(d => d.assigned_to).map(d => d.assigned_to))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', agentIds.filter(Boolean) as string[]);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      const dealsWithProfiles = dealsRes.data.map(deal => ({
        ...deal,
        profile: deal.assigned_to ? profileMap.get(deal.assigned_to) : undefined
      }));
      
      setDeals(dealsWithProfiles as unknown as Deal[]);
    }
    
    if (activitiesRes.data) {
      // Fetch user profiles for activities
      const userIds = [...new Set(activitiesRes.data.filter(a => a.user_id).map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds.filter(Boolean) as string[]);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      const activitiesWithProfiles = activitiesRes.data.map(activity => ({
        ...activity,
        profile: activity.user_id ? profileMap.get(activity.user_id) : undefined
      }));
      
      setActivities(activitiesWithProfiles as unknown as ActivityLog[]);
    }
    
    setLoading(false);
  }

  const formatPrice = (price: number) => {
    if (price >= 10000000) {
      return `₹${(price / 10000000).toFixed(2)} Cr`;
    } else if (price >= 100000) {
      return `₹${(price / 100000).toFixed(2)} L`;
    }
    return `₹${price.toLocaleString()}`;
  };

  const getStageColor = (stage: string) => {
    const found = pipelineStages.find(s => s.value === stage);
    return found?.color || 'bg-muted';
  };

  const getStageLabel = (stage: string) => {
    const found = pipelineStages.find(s => s.value === stage);
    return found?.label || stage;
  };

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  function getActionLabel(action: string) {
    const labels: Record<string, string> = {
      'call_logged': 'Logged a call',
      'lead_created': 'Created a lead',
      'lead_updated': 'Updated a lead',
      'deal_created': 'Created a deal',
      'deal_updated': 'Updated a deal',
      'site_visit_scheduled': 'Scheduled site visit',
      'document_created': 'Created document',
      'payment_recorded': 'Recorded payment',
    };
    return labels[action] || action.replace(/_/g, ' ');
  }

  // Calculate pipeline metrics
  const totalPipelineValue = deals.reduce((sum, d) => sum + Number(d.deal_value), 0);
  const weightedPipelineValue = deals.reduce((sum, d) => sum + (Number(d.deal_value) * (d.probability || 50) / 100), 0);
  const closedDeals = deals.filter(d => d.stage === 'closed');
  const closedValue = closedDeals.reduce((sum, d) => sum + Number(d.deal_value), 0);
  const avgDealSize = deals.length > 0 ? totalPipelineValue / deals.length : 0;

  // Group deals by stage
  const dealsByStage = pipelineStages.reduce((acc, stage) => {
    acc[stage.value] = deals.filter(d => d.stage === stage.value);
    return acc;
  }, {} as Record<string, Deal[]>);

  return (
    <DashboardLayout title="Sales Pipeline" description="Track deals, agent assignments, and activity">
      <div className="space-y-6">
        {/* Pipeline Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Pipeline</p>
                  <p className="text-2xl font-bold">{formatPrice(totalPipelineValue)}</p>
                </div>
                <IndianRupee className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Weighted Value</p>
                  <p className="text-2xl font-bold">{formatPrice(weightedPipelineValue)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-info" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Closed Won</p>
                  <p className="text-2xl font-bold">{formatPrice(closedValue)}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Deal Size</p>
                  <p className="text-2xl font-bold">{formatPrice(avgDealSize)}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline Board</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          </TabsList>

          {/* Pipeline Board */}
          <TabsContent value="pipeline" className="mt-4">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader className="pb-3">
                      <div className="h-5 w-2/3 rounded bg-muted" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[...Array(2)].map((_, j) => (
                          <div key={j} className="h-24 rounded bg-muted" />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {pipelineStages.filter(s => s.value !== 'lost').map((stage) => (
                  <Card key={stage.value} className="flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
                          <CardTitle className="text-sm font-medium">{stage.label}</CardTitle>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {dealsByStage[stage.value]?.length || 0}
                        </Badge>
                      </div>
                      <p className="text-lg font-bold">
                        {formatPrice(dealsByStage[stage.value]?.reduce((sum, d) => sum + Number(d.deal_value), 0) || 0)}
                      </p>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-3 overflow-y-auto max-h-[400px]">
                      {dealsByStage[stage.value]?.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No deals</p>
                      ) : (
                        dealsByStage[stage.value]?.map((deal) => (
                          <Card key={deal.id} className="cursor-pointer hover:shadow-md transition-shadow">
                            <CardContent className="p-3">
                              <div className="space-y-2">
                                <div className="flex items-start justify-between">
                                  <p className="font-medium text-sm truncate">
                                    {deal.lead?.name || 'Unknown'}
                                  </p>
                                  <p className="text-sm font-bold text-nowrap">
                                    {formatPrice(Number(deal.deal_value))}
                                  </p>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                  {deal.property?.title || deal.project?.name || 'No property'}
                                </p>
                                
                                {/* Agent Assignment */}
                                {deal.profile && (
                                  <div className="flex items-center gap-2 pt-1">
                                    <Avatar className="h-5 w-5">
                                      <AvatarFallback className="text-[10px] bg-primary/10">
                                        {getInitials(deal.profile.full_name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs text-muted-foreground truncate">
                                      {deal.profile.full_name}
                                    </span>
                                  </div>
                                )}
                                
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {formatDistanceToNow(parseISO(deal.created_at), { addSuffix: true })}
                                  </div>
                                  {deal.probability && (
                                    <span className="text-muted-foreground">{deal.probability}%</span>
                                  )}
                                </div>
                                {deal.probability && (
                                  <Progress value={deal.probability} className="h-1" />
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Activity Feed */}
          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-1/3 rounded bg-muted" />
                          <div className="h-3 w-1/4 rounded bg-muted" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activities.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No recent activity</p>
                ) : (
                  <div className="space-y-4">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {activity.profile ? getInitials(activity.profile.full_name) : <User className="h-4 w-4" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{activity.profile?.full_name || 'System'}</span>
                            {' '}
                            <span className="text-muted-foreground">{getActionLabel(activity.action)}</span>
                          </p>
                          {activity.details && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {(activity.details as Record<string, string>).lead_name && `Lead: ${(activity.details as Record<string, string>).lead_name}`}
                              {(activity.details as Record<string, string>).call_status && ` • Status: ${(activity.details as Record<string, string>).call_status}`}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(parseISO(activity.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {activity.entity_type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}