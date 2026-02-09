import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  IndianRupee, TrendingUp, Calendar, Phone, Building,
  Flame, Thermometer, Snowflake, Target, DollarSign,
  Users, Activity, User, CheckCircle2, Star, Eye,
  Clock, MapPin, MessageSquare, History, PhoneCall,
  FileText, UserPlus, Edit, Trash2
} from 'lucide-react';
import { formatDistanceToNow, format, parseISO } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// TYPE DEFINITIONS
interface Deal {
  id: string;
  dealValue: number | null;
  stage: string;
  expectedCloseDate: string | null;
  notes: string | null;
}

interface CallLog {
  id: string;
  callStatus: string;
  callDate: string;
  notes: string | null;
  duration?: number;
}

interface SiteVisit {
  id: string;
  scheduledAt: string;
  status: string;
  property?: { title: string; location: string };
  project?: { name: string; location: string };
  rating?: number | null;
  feedback?: string | null;
}

interface AssignedAgent {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
}

interface Lead {
  id: string;
  name: string;
  phone: string;
  stage: string;
  temperature: string;
  source: string;
  budgetMin: number | null;
  budgetMax: number | null;
  createdAt: string;
  notes?: string;
  project?: { name: string; location: string };
  property?: { title: string; location: string };
  assignedToId: string | null;
  assignedTo?: AssignedAgent | null;
  deals?: Deal[];
  callLogs?: CallLog[];
  siteVisits?: SiteVisit[];
}

// Extended Lead with Project Context
interface ProjectLead extends Lead {
  displayProject?: string;
  projectKey?: string;
  projectVisitCount?: number;
}

interface ActivityLog {
  id: string;
  action: string;
  entityType: string;
  details: any;
  createdAt: string;
  user?: { fullName: string; id: string };
}

interface PipelineStats {
  totalValue: number;
  totalDeals: number;
  avgDealSize: number;
  closingThisMonth: number;
  conversionRate: number;
}

// ✅ ADDED COMPLETED STAGE
const STAGES = [
  { value: 'new', label: 'New Lead', color: 'bg-blue-500' },
  { value: 'contacted', label: 'Contacted', color: 'bg-indigo-500' },
  { value: 'site_visit', label: 'Site Visit', color: 'bg-purple-500' },
  { value: 'negotiation', label: 'Negotiation', color: 'bg-orange-500' },
  { value: 'token', label: 'Token Paid', color: 'bg-yellow-500' },
  { value: 'completed', label: 'Completed', color: 'bg-teal-500' },
  { value: 'closed', label: 'Closed Won', color: 'bg-green-500' },
  { value: 'lost', label: 'Lost', color: 'bg-red-500' }
];

const ACTION_LABELS: Record<string, string> = {
  'lead_created': 'Lead Created',
  'lead_updated': 'Lead Updated',
  'lead_assigned': 'Lead Assigned',
  'call_logged': 'Call Logged',
  'site_visit_scheduled': 'Site Visit Scheduled',
  'site_visit_completed': 'Visit Completed',
  'site_visit_rescheduled': 'Visit Rescheduled',
  'deal_created': 'Deal Created',
  'deal_updated': 'Deal Updated',
  'deal_closed': 'Deal Closed',
  'user_created': 'User Created',
  'user_updated': 'User Updated',
  'password_reset': 'Password Reset'
};

const ACTION_ICONS: Record<string, any> = {
  'lead_created': UserPlus,
  'lead_updated': Edit,
  'lead_assigned': Users,
  'call_logged': PhoneCall,
  'site_visit_scheduled': Calendar,
  'site_visit_completed': CheckCircle2,
  'site_visit_rescheduled': Clock,
  'deal_created': DollarSign,
  'deal_updated': Edit,
  'deal_closed': CheckCircle2,
  'user_created': UserPlus,
  'user_updated': Edit,
  'password_reset': FileText
};

export default function Pipeline() {
  const { token, user } = useAuth();

  const [rawLeads, setRawLeads] = useState<Lead[]>([]);
  const [expandedLeads, setExpandedLeads] = useState<ProjectLead[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [agents, setAgents] = useState<AssignedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [relatedLeads, setRelatedLeads] = useState<Lead[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const [stats, setStats] = useState<PipelineStats>({
    totalValue: 0,
    totalDeals: 0,
    avgDealSize: 0,
    closingThisMonth: 0,
    conversionRate: 0
  });

  useEffect(() => {
    if (token) fetchData();
  }, [token, agentFilter]);

  useEffect(() => {
    expandLeadsByProject();
  }, [rawLeads]);

  async function fetchData() {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      let leadsUrl = `${API_URL}/leads`;
      if (agentFilter !== 'all') leadsUrl += `?assignedTo=${agentFilter}`;

      const [leadsRes, activityRes, agentsRes] = await Promise.all([
        fetch(leadsUrl, { headers }).then(r => r.json()),
        fetch(`${API_URL}/activities?limit=50`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/users?role=sales_agent`, { headers }).then(r => r.json())
      ]);

      if (Array.isArray(leadsRes)) {
        setRawLeads(leadsRes);
        calculateStats(leadsRes);
      }

      const logs = Array.isArray(activityRes) ? activityRes : activityRes.data || [];
      setActivities(logs);
      if (Array.isArray(agentsRes)) setAgents(agentsRes);
    } catch (error) {
      console.error('Error fetching pipeline data:', error);
    } finally {
      setLoading(false);
    }
  }

  // ✅ EXPAND LEADS BY PROJECT - Show same lead multiple times
  function expandLeadsByProject() {
    const expanded: ProjectLead[] = [];

    rawLeads.forEach(lead => {
      const projectsMap = new Map<string, SiteVisit[]>();
      
      lead.siteVisits?.forEach(visit => {
        const projectName = visit.project?.name || visit.property?.title || null;
        if (!projectName) return;
        
        if (!projectsMap.has(projectName)) {
          projectsMap.set(projectName, []);
        }
        projectsMap.get(projectName)!.push(visit);
      });

      if (projectsMap.size === 0) {
        expanded.push({
          ...lead,
          displayProject: lead.project?.name || lead.property?.title || undefined,
          projectKey: lead.id,
          projectVisitCount: 0
        });
      } else {
        projectsMap.forEach((visits, projectName) => {
          expanded.push({
            ...lead,
            displayProject: projectName,
            projectKey: `${lead.id}-${projectName}`,
            projectVisitCount: visits.length
          });
        });
      }
    });

    // Handle leads without projects
    rawLeads.forEach(lead => {
      if (!lead.siteVisits || lead.siteVisits.length === 0) {
        const exists = expanded.find(e => e.id === lead.id);
        if (!exists) {
          expanded.push({
            ...lead,
            displayProject: lead.project?.name || lead.property?.title,
            projectKey: lead.id,
            projectVisitCount: lead.siteVisits?.length || 0
          });
        }
      }
    });

    setExpandedLeads(expanded);
  }

  const handleViewLead = async (lead: ProjectLead) => {
    const originalLead = rawLeads.find(l => l.id === lead.id);
    if (!originalLead) return;

    setSelectedLead(originalLead);
    setIsDetailOpen(true);
    setRelatedLeads([]);
    setLoadingRelated(true);

    try {
      const detailsRes = await fetch(`${API_URL}/leads/${lead.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (detailsRes.ok) {
        const fullLead = await detailsRes.json();
        setSelectedLead(fullLead);
      }

      const relatedRes = await fetch(`${API_URL}/leads?phone=${originalLead.phone}`, {
         headers: { 'Authorization': `Bearer ${token}` }
      });
      if (relatedRes.ok) {
        const allLeadsForPerson = await relatedRes.json();
        setRelatedLeads(allLeadsForPerson.filter((l: Lead) => l.id !== lead.id));
      }
    } catch(e) {
      console.error("Failed to load details", e);
    } finally {
      setLoadingRelated(false);
    }
  };

  function calculateStats(data: Lead[]) {
    const totalValue = data.reduce((sum, lead) => {
      if (lead.stage === 'lost') return sum;
      const activeDeal = lead.deals && lead.deals.length > 0 ? lead.deals[0] : null;
      const value = activeDeal?.dealValue || lead.budgetMax || lead.budgetMin || 0;
      return sum + Number(value);
    }, 0);

    const totalDeals = data.length;
    const closingThisMonth = data
      .filter(lead => ['negotiation', 'token'].includes(lead.stage))
      .reduce((sum, lead) => {
        const val = lead.deals?.[0]?.dealValue || lead.budgetMax || lead.budgetMin || 0;
        return sum + Number(val);
      }, 0);

    const closedCount = data.filter(l => l.stage === 'closed').length;
    const conversionRate = totalDeals > 0 ? (closedCount / totalDeals) * 100 : 0;

    setStats({
      totalValue,
      totalDeals,
      avgDealSize: totalDeals > 0 ? totalValue / totalDeals : 0,
      closingThisMonth,
      conversionRate
    });
  }

  function formatCurrency(amount: number) {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
    return `₹${amount.toLocaleString()}`;
  }

  function getInitials(name: string) {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
  }

  function getTemperatureIcon(temp: string) {
    switch (temp) {
      case 'hot': return <Flame className="h-4 w-4 text-red-500" />;
      case 'warm': return <Thermometer className="h-4 w-4 text-orange-500" />;
      case 'cold': return <Snowflake className="h-4 w-4 text-blue-500" />;
      default: return null;
    }
  }

  const leadsByStage = STAGES.reduce((acc, stage) => {
    acc[stage.value] = expandedLeads.filter(l => l.stage === stage.value);
    return acc;
  }, {} as Record<string, ProjectLead[]>);

  const getUnifiedHistory = (lead: Lead) => {
    const visits = (lead.siteVisits || []).map(v => ({ ...v, type: 'visit', date: v.scheduledAt }));
    const calls = (lead.callLogs || []).map(c => ({ ...c, type: 'call', date: c.callDate }));
    return [...visits, ...calls].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // ✅ NEW FUNCTION: Get activities filtered by lead
  const getLeadActivities = (lead: Lead) => {
    return activities.filter(activity => {
      // Filter activities related to this lead
      if (activity.entityType === 'lead' && activity.details?.leadId === lead.id) return true;
      if (activity.entityType === 'call_log' && activity.details?.leadId === lead.id) return true;
      if (activity.entityType === 'site_visit' && activity.details?.leadId === lead.id) return true;
      if (activity.entityType === 'deal' && activity.details?.leadId === lead.id) return true;
      // Also check if lead name matches (for backwards compatibility)
      if (activity.details?.leadName === lead.name) return true;
      return false;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const getProjectGroups = () => {
    if (!selectedLead) return [];
    
    const allLeads = [selectedLead, ...relatedLeads];
    const projectMap = new Map<string, {
      projectName: string;
      projectId: string | null;
      visits: SiteVisit[];
      lead: Lead;
    }>();

    allLeads.forEach(lead => {
      const projectId = lead.project?.name || lead.property?.title || 'No Project';
      
      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, {
          projectName: projectId,
          projectId: lead.project?.name || null,
          visits: [],
          lead: lead
        });
      }

      if (lead.siteVisits && lead.siteVisits.length > 0) {
        const group = projectMap.get(projectId)!;
        group.visits.push(...lead.siteVisits);
      }
    });

    return Array.from(projectMap.values());
  };

  return (
    <DashboardLayout title="Sales Pipeline" description="Track deals and monitor team activity">
      <div className="space-y-6 h-full flex flex-col">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between shrink-0">
          <div className="flex gap-3 w-full sm:w-auto ml-auto">
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-48">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>{agent.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="flex border rounded-lg p-1 bg-white">
              <Button
                variant={view === 'pipeline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('pipeline')}
                className="gap-2"
              >
                <Target className="h-4 w-4" />
                Pipeline
              </Button>
              <Button
                variant={view === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('list')}
                className="gap-2"
              >
                <Activity className="h-4 w-4" />
                Activity
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pipeline Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
                </div>
                <IndianRupee className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Deals</p>
                  <p className="text-2xl font-bold">{stats.totalDeals}</p>
                </div>
                <Target className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Closing Soon</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.closingThisMonth)}</p>
                </div>
                <Calendar className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Win Rate</p>
                  <p className="text-2xl font-bold">{stats.conversionRate.toFixed(1)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {view === 'pipeline' ? (
          <div className="flex-1 overflow-x-auto pb-4">
            <div className="min-w-[1600px] space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button variant={stageFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStageFilter('all')}>
                  All Stages ({expandedLeads.length})
                </Button>
                {STAGES.map(stage => (
                  <Button key={stage.value} variant={stageFilter === stage.value ? 'default' : 'outline'} size="sm" onClick={() => setStageFilter(stage.value)}>
                    {stage.label} ({leadsByStage[stage.value]?.length || 0})
                  </Button>
                ))}
              </div>

              {/* ✅ 8 COLUMNS NOW */}
              <div className="grid grid-cols-8 gap-4 items-start">
                {STAGES.map(stage => (
                  <div key={stage.value} className="space-y-3 min-w-[200px]">
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border-2">
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${stage.color}`} />
                        <h3 className="font-semibold text-sm">{stage.label}</h3>
                      </div>
                      <Badge variant="secondary">{leadsByStage[stage.value]?.length || 0}</Badge>
                    </div>

                    <div className="space-y-3">
                      {leadsByStage[stage.value]?.map(lead => {
                         const displayValue = lead.deals?.[0]?.dealValue || lead.budgetMax || lead.budgetMin || 0;
                         const agentName = lead.assignedTo?.fullName;
                         const agentInitial = agentName ? getInitials(agentName) : '?';
                         const agentAvatar = lead.assignedTo?.avatarUrl;

                         const projectVisits = lead.siteVisits?.filter(v => 
                           (v.project?.name || v.property?.title) === lead.displayProject
                         );
                         
                         const lastCompletedVisit = projectVisits
                            ?.filter(v => v.status === 'completed')
                            .sort((a,b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())[0];

                         return (
                          <Card key={lead.projectKey} className="hover:shadow-md transition-shadow cursor-pointer bg-white group relative">
                            <CardContent className="p-4">
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="secondary" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleViewLead(lead); }}>
                                   <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center justify-between pr-6">
                                  <span className="text-lg font-bold text-slate-900">
                                    {formatCurrency(Number(displayValue))}
                                  </span>
                                  {getTemperatureIcon(lead.temperature)}
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="font-medium text-sm truncate">{lead.name}</span>
                                  </div>
                                  {lead.displayProject && (
                                     <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-1 rounded">
                                        <Building className="h-3 w-3" />
                                        <span className="truncate">{lead.displayProject}</span>
                                     </div>
                                  )}
                                  {lead.projectVisitCount && lead.projectVisitCount > 0 && (
                                     <Badge variant="outline" className="text-[9px] h-4">{lead.projectVisitCount} visit{lead.projectVisitCount > 1 ? 's' : ''}</Badge>
                                  )}
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Phone className="h-3 w-3" />
                                    {lead.phone}
                                  </div>
                                </div>

                                {lastCompletedVisit && (
                                  <div className="bg-emerald-50 border border-emerald-100 p-2 rounded text-[10px] text-emerald-800">
                                     <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3" /> Visit Done
                                        </span>
                                        <span className="flex items-center">
                                          {lastCompletedVisit.rating && (
                                            <>
                                              <span className="font-bold mr-0.5">{lastCompletedVisit.rating}</span>
                                              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                            </>
                                          )}
                                        </span>
                                     </div>
                                     {lastCompletedVisit.feedback && (
                                       <p className="line-clamp-2 italic opacity-90 leading-tight">
                                         {lastCompletedVisit.feedback.includes('Outcome:') 
                                            ? lastCompletedVisit.feedback.split('Outcome:')[1] 
                                            : lastCompletedVisit.feedback.split('\n').pop()}
                                       </p>
                                     )}
                                  </div>
                                )}

                                <div className="flex items-center justify-between pt-2 border-t text-xs">
                                  {agentName ? (
                                    <div className="flex items-center gap-1" title={agentName}>
                                      <Avatar className="h-5 w-5">
                                        <AvatarImage src={agentAvatar || undefined} />
                                        <AvatarFallback className="text-[10px] bg-primary/10">{agentInitial}</AvatarFallback>
                                      </Avatar>
                                      <span className="text-muted-foreground truncate max-w-[80px]">
                                        {agentName.split(' ')[0]}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground italic">Unassigned</span>
                                  )}
                                  <span className="text-muted-foreground text-xs">
                                    {formatDistanceToNow(new Date(lead.createdAt))}
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                         );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {activities.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No recent activity</p>
                  </div>
                ) : (
                  activities.map((activity) => {
                    const IconComponent = ACTION_ICONS[activity.action] || Activity;
                    const actionLabel = ACTION_LABELS[activity.action] || activity.action;
                    
                    return (
                      <div key={activity.id} className="flex gap-4 group">
                        <div className="flex flex-col items-center">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <IconComponent className="h-4 w-4 text-primary" />
                          </div>
                          <div className="w-px h-full bg-slate-200 my-1 group-last:hidden" />
                        </div>
                        
                        <div className="flex-1 pb-4">
                          <div className="flex items-start justify-between mb-1">
                            <div>
                              <span className="font-semibold text-sm">{actionLabel}</span>
                              {activity.user && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  by {activity.user.fullName}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(parseISO(activity.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          
                          {activity.details && (
                            <div className="bg-slate-50 rounded-lg border p-3 text-sm mt-2">
                              {activity.details.leadName && (
                                <p className="text-slate-700">
                                  <span className="font-medium">Lead:</span> {activity.details.leadName}
                                </p>
                              )}
                              {activity.details.callStatus && (
                                <p className="text-slate-700">
                                  <span className="font-medium">Status:</span> {activity.details.callStatus}
                                </p>
                              )}
                              {activity.details.rating && (
                                <div className="flex items-center gap-1 text-yellow-500 mt-1">
                                  <span className="font-medium text-slate-700">Rating:</span>
                                  {[...Array(5)].map((_, i) => (
                                    <Star key={i} className={`h-3 w-3 ${i < activity.details.rating ? 'fill-current' : 'text-slate-200'}`} />
                                  ))}
                                </div>
                              )}
                              {activity.details.newStage && (
                                <p className="text-slate-700">
                                  <span className="font-medium">New Stage:</span> {activity.details.newStage}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* LEAD DETAIL DIALOG */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-7xl h-[90vh] p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-2xl flex items-center gap-3">
                  <User className="h-6 w-6" />
                  {selectedLead?.name}
                  {selectedLead && getTemperatureIcon(selectedLead.temperature)}
                </DialogTitle>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {selectedLead?.phone}
                  </span>
                  <Badge variant="outline">{selectedLead?.stage.replace('_', ' ')}</Badge>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {selectedLead?.source}
                  </span>
                </div>
              </div>
              
              {selectedLead?.budgetMin && selectedLead?.budgetMax && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Budget Range</p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(selectedLead.budgetMin)} - {formatCurrency(selectedLead.budgetMax)}
                  </p>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 flex overflow-hidden">
            <div className="w-1/3 border-r overflow-y-auto bg-slate-50 p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Related Projects
                  </h3>
                  {loadingRelated ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : relatedLeads.length === 0 ? (
                    <div className="text-sm text-muted-foreground bg-white p-3 rounded-lg border">
                       No other projects for this contact
                    </div>
                  ) : (
                    <div className="space-y-2">
                       {relatedLeads.map(rel => (
                         <div 
                           key={rel.id} 
                           className="group p-3 rounded-lg border bg-white shadow-sm hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                           onClick={() => handleViewLead(rel as ProjectLead)}
                         >
                            <div className="flex justify-between items-start mb-1">
                               <div className="font-semibold text-sm text-slate-800 truncate pr-2">
                                  {rel.project?.name || rel.property?.title || 'Unknown Project'}
                               </div>
                               {getTemperatureIcon(rel.temperature)}
                            </div>
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                               <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{rel.stage}</Badge>
                               <span>{formatDistanceToNow(new Date(rel.createdAt))} ago</span>
                            </div>
                         </div>
                       ))}
                    </div>
                  )}
               </div>
            </div>
          </div>

            <div className="w-2/3 flex flex-col bg-white h-full min-h-0 overflow-hidden">
               {(() => {
                 const projectGroups = getProjectGroups();
                 
                 if (projectGroups.length === 0 || projectGroups.every(g => g.visits.length === 0)) {
                   return (
                     <Tabs defaultValue="history" className="flex-1 flex flex-col h-full min-h-0">
                        <div className="px-4 pt-2 border-b shrink-0">
                          <TabsList className="w-full justify-start h-10 bg-transparent p-0">
                             <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 px-4">
                                Full Timeline
                             </TabsTrigger>
                             <TabsTrigger value="activity" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 px-4">
                                Activity Log
                             </TabsTrigger>
                             <TabsTrigger value="notes" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 px-4">
                                Notes
                             </TabsTrigger>
                          </TabsList>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4">
                           <TabsContent value="history" className="m-0 space-y-4">
                              {selectedLead && getUnifiedHistory(selectedLead).length === 0 ? (
                                 <div className="text-center py-10 text-muted-foreground">
                                    <History className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                    <p>No activity history yet.</p>
                                 </div>
                              ) : (
                                selectedLead && getUnifiedHistory(selectedLead).map((item: any, i) => (
                                   <div key={i} className="flex gap-4 group">
                                      <div className="flex flex-col items-center">
                                         <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 
                                            ${item.type === 'visit' 
                                               ? (item.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-600')
                                               : 'bg-blue-100 text-blue-600'
                                            }`}>
                                            {item.type === 'visit' ? <MapPin className="h-4 w-4" /> : <PhoneCall className="h-4 w-4" />}
                                         </div>
                                         {i < getUnifiedHistory(selectedLead!).length - 1 && (
                                            <div className="w-px h-full bg-slate-200 my-1 group-last:hidden" />
                                         )}
                                      </div>
                                      
                                      <div className="flex-1 pb-6">
                                         <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-sm">
                                               {item.type === 'visit' ? 'Site Visit' : 'Call Log'} 
                                               <span className="font-normal text-muted-foreground ml-2 text-xs">
                                                  - {item.type === 'visit' ? item.status : item.callStatus}
                                               </span>
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                               {format(parseISO(item.date), 'MMM dd, h:mm a')}
                                            </span>
                                         </div>

                                         <div className="bg-slate-50 rounded-lg border p-3 text-sm">
                                            {item.type === 'visit' && item.rating && (
                                               <div className="flex items-center gap-1 mb-2 text-yellow-500">
                                                  {[...Array(5)].map((_, i) => (
                                                     <Star key={i} className={`h-3 w-3 ${i < item.rating ? 'fill-current' : 'text-slate-200'}`} />
                                                  ))}
                                               </div>
                                            )}
                                            <p className="text-slate-700 whitespace-pre-wrap">
                                               {item.feedback || item.notes || 'No notes provided.'}
                                            </p>
                                         </div>
                                      </div>
                                   </div>
                                ))
                              )}
                           </TabsContent>

                           {/* ✅ NEW ACTIVITY LOG TAB */}
                           <TabsContent value="activity" className="m-0 space-y-4">
                              {selectedLead && getLeadActivities(selectedLead).length === 0 ? (
                                 <div className="text-center py-10 text-muted-foreground">
                                    <Activity className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                    <p>No activities logged yet.</p>
                                 </div>
                              ) : (
                                selectedLead && getLeadActivities(selectedLead).map((activity, i) => {
                                  const IconComponent = ACTION_ICONS[activity.action] || Activity;
                                  const actionLabel = ACTION_LABELS[activity.action] || activity.action;
                                  
                                  return (
                                    <div key={activity.id} className="flex gap-4 group">
                                      <div className="flex flex-col items-center">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                          <IconComponent className="h-4 w-4 text-primary" />
                                        </div>
                                        {i < getLeadActivities(selectedLead!).length - 1 && (
                                          <div className="w-px h-full bg-slate-200 my-1 group-last:hidden" />
                                        )}
                                      </div>
                                      
                                      <div className="flex-1 pb-6">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="font-semibold text-sm">
                                            {actionLabel}
                                            {activity.user && (
                                              <span className="font-normal text-muted-foreground ml-2 text-xs">
                                                by {activity.user.fullName}
                                              </span>
                                            )}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            {format(parseISO(activity.createdAt), 'MMM dd, h:mm a')}
                                          </span>
                                        </div>

                                        {activity.details && Object.keys(activity.details).length > 0 && (
                                          <div className="bg-slate-50 rounded-lg border p-3 text-sm">
                                            {activity.details.callStatus && (
                                              <p className="text-slate-700">
                                                <span className="font-medium">Status:</span> {activity.details.callStatus}
                                              </p>
                                            )}
                                            {activity.details.rating && (
                                              <div className="flex items-center gap-1 mt-1">
                                                <span className="font-medium text-slate-700">Rating:</span>
                                                {[...Array(5)].map((_, idx) => (
                                                  <Star key={idx} className={`h-3 w-3 ${idx < activity.details.rating ? 'fill-yellow-500 text-yellow-500' : 'text-slate-200'}`} />
                                                ))}
                                              </div>
                                            )}
                                            {activity.details.newStage && (
                                              <p className="text-slate-700 mt-1">
                                                <span className="font-medium">Stage:</span> {activity.details.newStage}
                                              </p>
                                            )}
                                            {activity.details.scheduledAt && (
                                              <p className="text-slate-700 mt-1">
                                                <span className="font-medium">Scheduled:</span> {format(parseISO(activity.details.scheduledAt), 'MMM dd, h:mm a')}
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                           </TabsContent>

                           <TabsContent value="notes" className="m-0">
                              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-yellow-900 text-sm">
                                 {selectedLead?.notes || 'No general notes for this lead.'}
                              </div>
                           </TabsContent>
                        </div>
                     </Tabs>
                   );
                 }
                 
                 return (
                   <Tabs defaultValue={projectGroups[0].projectName} className="flex-1 flex flex-col h-full min-h-0">
                      <div className="px-4 pt-2 border-b shrink-0 overflow-x-auto">
                        <TabsList className="w-full justify-start h-10 bg-transparent p-0 flex-nowrap">
                           {projectGroups.map((group) => (
                             <TabsTrigger 
                               key={group.projectName} 
                               value={group.projectName}
                               className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 px-4 flex items-center gap-1.5 whitespace-nowrap"
                             >
                               <Building className="h-3.5 w-3.5" />
                               {group.projectName}
                               <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
                                 {group.visits.length}
                               </Badge>
                             </TabsTrigger>
                           ))}
                        </TabsList>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto">
                         {projectGroups.map((group) => (
                           <TabsContent key={group.projectName} value={group.projectName} className="m-0 p-4 space-y-4">
                              <div className="flex items-center justify-between pb-2 border-b">
                                 <div className="flex items-center gap-2">
                                   <Badge variant={group.lead.stage === 'closed' ? 'default' : 'outline'} className="text-xs">
                                     {group.lead.stage.replace('_', ' ').toUpperCase()}
                                   </Badge>
                                   {getTemperatureIcon(group.lead.temperature)}
                                 </div>
                                 <span className="text-xs text-muted-foreground">
                                   {group.visits.length} visit{group.visits.length !== 1 ? 's' : ''}
                                 </span>
                              </div>

                              {group.visits.length === 0 ? (
                                 <div className="text-center py-10 text-muted-foreground">
                                    <History className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                    <p>No site visits yet for this project.</p>
                                 </div>
                              ) : (
                                <div className="space-y-4">
                                   {group.visits
                                     .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
                                     .map((visit, idx) => (
                                       <div key={visit.id || idx} className="flex gap-4 group">
                                          <div className="flex flex-col items-center">
                                             <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 
                                                ${visit.status === 'completed' 
                                                   ? 'bg-green-100 text-green-600' 
                                                   : visit.status === 'cancelled'
                                                   ? 'bg-red-100 text-red-600'
                                                   : 'bg-purple-100 text-purple-600'
                                                }`}>
                                                <MapPin className="h-4 w-4" />
                                             </div>
                                             {idx < group.visits.length - 1 && (
                                                <div className="w-px h-full bg-slate-200 my-1" />
                                             )}
                                          </div>
                                          
                                          <div className="flex-1 pb-6">
                                             <div className="flex items-center justify-between mb-1">
                                                <span className="font-semibold text-sm">
                                                   Site Visit
                                                   <span className="font-normal text-muted-foreground ml-2 text-xs capitalize">
                                                      - {visit.status}
                                                   </span>
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                   {format(parseISO(visit.scheduledAt), 'MMM dd, h:mm a')}
                                                </span>
                                             </div>

                                             <div className="bg-slate-50 rounded-lg border p-3 text-sm">
                                                {visit.rating && (
                                                   <div className="flex items-center gap-1 mb-2 text-yellow-500">
                                                      {[...Array(5)].map((_, i) => (
                                                         <Star key={i} className={`h-3 w-3 ${i < visit.rating! ? 'fill-current' : 'text-slate-200'}`} />
                                                      ))}
                                                   </div>
                                                )}
                                                <p className="text-slate-700 whitespace-pre-wrap">
                                                   {visit.feedback || 'No notes provided.'}
                                                </p>
                                             </div>
                                          </div>
                                       </div>
                                    ))}
                                </div>
                              )}
                           </TabsContent>
                         ))}
                      </div>
                   </Tabs>
                 );
               })()}
            </div>
         </div>
       </DialogContent>
     </Dialog>
   </DashboardLayout>
 );
}