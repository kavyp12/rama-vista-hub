import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Phone, 
  PhoneCall, 
  PhoneMissed, 
  PhoneOff,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  ThumbsUp,
  ThumbsDown,
  Timer,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO, isToday, addHours } from 'date-fns';

interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  stage: string;
  temperature?: string | null;
  assigned_to?: string | null;
}

interface CallLog {
  id: string;
  lead_id: string;
  agent_id: string;
  call_status: string;
  call_date: string;
  call_duration?: number | null;
  notes?: string | null;
  callback_scheduled_at?: string | null;
  rejection_reason?: string | null;
  retry_count?: number;
  lead?: Partial<Lead>;
  profile?: { full_name: string };
}

interface FollowUpTask {
  id: string;
  lead_id: string;
  agent_id: string;
  task_type: string;
  scheduled_at: string;
  status: string;
  notes?: string | null;
  lead?: Partial<Lead>;
}

const callOutcomes = [
  { value: 'connected_positive', label: 'Connected - Positive Response', icon: ThumbsUp, color: 'bg-success text-success-foreground' },
  { value: 'connected_callback', label: 'Connected - Callback Requested', icon: Calendar, color: 'bg-info text-info-foreground' },
  { value: 'not_connected', label: 'Not Connected / No Answer', icon: PhoneMissed, color: 'bg-warning text-warning-foreground' },
  { value: 'not_interested', label: 'Not Interested', icon: ThumbsDown, color: 'bg-destructive text-destructive-foreground' },
];

export default function Telecalling() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false);
  const [callOutcome, setCallOutcome] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [callDuration, setCallDuration] = useState('');
  const [callbackDate, setCallbackDate] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchData();
  }, [user]);

  async function fetchData() {
    if (!user) return;
    
    setLoading(true);
    
    // Fetch leads assigned to agent or all if admin
    const leadsQuery = supabase.from('leads').select('*').order('created_at', { ascending: false });
    
    if (role === 'sales_agent') {
      leadsQuery.eq('assigned_to', user.id);
    }
    
    const [leadsRes, callLogsRes, tasksRes] = await Promise.all([
      leadsQuery,
      supabase
        .from('call_logs')
        .select('*, lead:leads(id, name, phone, email, stage, temperature)')
        .order('call_date', { ascending: false })
        .limit(100),
      supabase
        .from('follow_up_tasks')
        .select('*, lead:leads(id, name, phone, email, stage, temperature)')
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true })
    ]);

    if (leadsRes.data) setLeads(leadsRes.data as unknown as Lead[]);
    if (callLogsRes.data) setCallLogs(callLogsRes.data as unknown as CallLog[]);
    if (tasksRes.data) setTasks(tasksRes.data as unknown as FollowUpTask[]);
    
    setLoading(false);
  }

  async function handleLogCall() {
    if (!selectedLead || !callOutcome || !user) return;
    
    setIsSubmitting(true);
    
    try {
      // Create call log
      const callLogData = {
        lead_id: selectedLead.id,
        agent_id: user.id,
        call_status: callOutcome as 'connected_positive' | 'connected_callback' | 'not_connected' | 'not_interested',
        call_duration: callDuration ? parseInt(callDuration) : null,
        notes: callNotes || null,
        callback_scheduled_at: callbackDate ? new Date(callbackDate).toISOString() : null,
        rejection_reason: rejectionReason || null,
      };

      const { error: callError } = await supabase.from('call_logs').insert(callLogData);
      
      if (callError) throw callError;

      // Handle outcome-specific actions
      if (callOutcome === 'connected_positive') {
        // Move lead to next stage
        const nextStage = getNextStage(selectedLead.stage) as 'new' | 'contacted' | 'site_visit' | 'negotiation' | 'token' | 'closed';
        await supabase.from('leads').update({ 
          stage: nextStage,
          temperature: 'hot' as const
        }).eq('id', selectedLead.id);
        
        toast({ title: 'Call logged', description: 'Lead marked as interested and moved to next stage.' });
      } else if (callOutcome === 'connected_callback') {
        // Create follow-up task
        if (callbackDate) {
          await supabase.from('follow_up_tasks').insert({
            lead_id: selectedLead.id,
            agent_id: user.id,
            task_type: 'callback',
            scheduled_at: new Date(callbackDate).toISOString(),
            notes: callNotes,
          });
        }
        toast({ title: 'Call logged', description: 'Callback scheduled successfully.' });
      } else if (callOutcome === 'not_connected') {
        // Schedule retry call
        await supabase.from('follow_up_tasks').insert({
          lead_id: selectedLead.id,
          agent_id: user.id,
          task_type: 'retry_call',
          scheduled_at: addHours(new Date(), 2).toISOString(),
          notes: 'Auto-scheduled retry call',
        });
        
        // Update retry count
        const currentLog = callLogs.find(c => c.lead_id === selectedLead.id);
        const retryCount = (currentLog?.retry_count || 0) + 1;
        await supabase.from('call_logs').update({ retry_count: retryCount }).eq('lead_id', selectedLead.id);
        
        toast({ title: 'Call logged', description: 'Retry call scheduled in 2 hours.' });
      } else if (callOutcome === 'not_interested') {
        // Close lead
        await supabase.from('leads').update({ 
          stage: 'closed',
          notes: `Closed - Reason: ${rejectionReason || 'Not interested'}`
        }).eq('id', selectedLead.id);
        
        toast({ title: 'Call logged', description: 'Lead marked as closed.' });
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'call_logged',
        entity_type: 'lead',
        entity_id: selectedLead.id,
        details: { call_status: callOutcome, lead_name: selectedLead.name }
      });

      // Reset and refresh
      resetForm();
      fetchData();
      
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to log call', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function getNextStage(currentStage: string): string {
    const stages = ['new', 'contacted', 'site_visit', 'negotiation', 'token', 'closed'];
    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex < stages.length - 2) {
      return stages[currentIndex + 1];
    }
    return currentStage;
  }

  function resetForm() {
    setSelectedLead(null);
    setCallOutcome('');
    setCallNotes('');
    setCallDuration('');
    setCallbackDate('');
    setRejectionReason('');
    setIsCallDialogOpen(false);
  }

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  function getOutcomeIcon(status: string) {
    const outcome = callOutcomes.find(o => o.value === status);
    if (!outcome) return <Phone className="h-4 w-4" />;
    const Icon = outcome.icon;
    return <Icon className="h-4 w-4" />;
  }

  function getOutcomeBadge(status: string) {
    const outcome = callOutcomes.find(o => o.value === status);
    if (!outcome) return <Badge variant="secondary">{status}</Badge>;
    return <Badge className={outcome.color}>{outcome.label}</Badge>;
  }

  // Calculate stats
  const todayCalls = callLogs.filter(c => isToday(parseISO(c.call_date)));
  const connectedCalls = todayCalls.filter(c => c.call_status.startsWith('connected'));
  const missedCalls = todayCalls.filter(c => c.call_status === 'not_connected');
  const pendingCallbacks = tasks.filter(t => t.task_type === 'callback');
  const pendingRetries = tasks.filter(t => t.task_type === 'retry_call');

  return (
    <DashboardLayout title="IVR & Telecalling" description="Manage calls and follow-ups">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Today's Calls</p>
                  <p className="text-2xl font-bold">{todayCalls.length}</p>
                </div>
                <PhoneCall className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Connected</p>
                  <p className="text-2xl font-bold">{connectedCalls.length}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Missed/No Answer</p>
                  <p className="text-2xl font-bold">{missedCalls.length}</p>
                </div>
                <PhoneMissed className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Callbacks</p>
                  <p className="text-2xl font-bold">{pendingCallbacks.length}</p>
                </div>
                <Calendar className="h-8 w-8 text-info" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leads to Call */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Leads to Call</CardTitle>
              <Badge variant="secondary">{leads.length} leads</Badge>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="pending">All Leads</TabsTrigger>
                  <TabsTrigger value="callbacks">Callbacks ({pendingCallbacks.length})</TabsTrigger>
                  <TabsTrigger value="retries">Retries ({pendingRetries.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="space-y-3 max-h-[400px] overflow-y-auto">
                  {loading ? (
                    [...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                        <div className="h-10 w-10 rounded-full bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-1/3 rounded bg-muted" />
                          <div className="h-3 w-1/4 rounded bg-muted" />
                        </div>
                      </div>
                    ))
                  ) : leads.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No leads assigned</p>
                  ) : (
                    leads.slice(0, 10).map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(lead.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{lead.name}</p>
                            <p className="text-sm text-muted-foreground">{lead.phone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{lead.stage}</Badge>
                          <Dialog open={isCallDialogOpen && selectedLead?.id === lead.id} onOpenChange={(open) => {
                            setIsCallDialogOpen(open);
                            if (open) setSelectedLead(lead);
                            else resetForm();
                          }}>
                            <DialogTrigger asChild>
                              <Button size="sm" className="gap-2">
                                <Phone className="h-4 w-4" />
                                Call
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle>Log Call - {lead.name}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>Call Outcome *</Label>
                                  <Select value={callOutcome} onValueChange={setCallOutcome}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select outcome" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {callOutcomes.map((outcome) => (
                                        <SelectItem key={outcome.value} value={outcome.value}>
                                          <div className="flex items-center gap-2">
                                            <outcome.icon className="h-4 w-4" />
                                            {outcome.label}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label>Call Duration (seconds)</Label>
                                  <Input 
                                    type="number" 
                                    placeholder="e.g. 120"
                                    value={callDuration}
                                    onChange={(e) => setCallDuration(e.target.value)}
                                  />
                                </div>

                                {callOutcome === 'connected_callback' && (
                                  <div className="space-y-2">
                                    <Label>Callback Date & Time *</Label>
                                    <Input 
                                      type="datetime-local"
                                      value={callbackDate}
                                      onChange={(e) => setCallbackDate(e.target.value)}
                                    />
                                  </div>
                                )}

                                {callOutcome === 'not_interested' && (
                                  <div className="space-y-2">
                                    <Label>Rejection Reason</Label>
                                    <Select value={rejectionReason} onValueChange={setRejectionReason}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select reason" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="budget">Budget constraints</SelectItem>
                                        <SelectItem value="location">Location not suitable</SelectItem>
                                        <SelectItem value="timing">Not the right time</SelectItem>
                                        <SelectItem value="competitor">Chose competitor</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <Label>Notes</Label>
                                  <Textarea 
                                    placeholder="Add call notes..."
                                    value={callNotes}
                                    onChange={(e) => setCallNotes(e.target.value)}
                                    rows={3}
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={resetForm}>Cancel</Button>
                                <Button onClick={handleLogCall} disabled={!callOutcome || isSubmitting}>
                                  {isSubmitting ? 'Saving...' : 'Log Call'}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="callbacks" className="space-y-3 max-h-[400px] overflow-y-auto">
                  {pendingCallbacks.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No pending callbacks</p>
                  ) : (
                    pendingCallbacks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-info" />
                          </div>
                          <div>
                            <p className="font-medium">{task.lead?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(parseISO(task.scheduled_at), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => {
                          const lead = leads.find(l => l.id === task.lead_id);
                          if (lead) {
                            setSelectedLead(lead);
                            setIsCallDialogOpen(true);
                          }
                        }}>
                          <Phone className="h-4 w-4" />
                          Call Now
                        </Button>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="retries" className="space-y-3 max-h-[400px] overflow-y-auto">
                  {pendingRetries.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No pending retries</p>
                  ) : (
                    pendingRetries.map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                            <PhoneMissed className="h-5 w-5 text-warning" />
                          </div>
                          <div>
                            <p className="font-medium">{task.lead?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Scheduled: {format(parseISO(task.scheduled_at), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => {
                          const lead = leads.find(l => l.id === task.lead_id);
                          if (lead) {
                            setSelectedLead(lead);
                            setIsCallDialogOpen(true);
                          }
                        }}>
                          <Phone className="h-4 w-4" />
                          Retry
                        </Button>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Recent Call History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Calls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[450px] overflow-y-auto">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3 p-2">
                    <div className="h-8 w-8 rounded-full bg-muted" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 w-2/3 rounded bg-muted" />
                      <div className="h-2 w-1/2 rounded bg-muted" />
                    </div>
                  </div>
                ))
              ) : callLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No call history</p>
              ) : (
                callLogs.slice(0, 15).map((call) => (
                  <div key={call.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="mt-0.5">{getOutcomeIcon(call.call_status)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{call.lead?.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(parseISO(call.call_date), { addSuffix: true })}
                        {call.call_duration && ` • ${Math.floor(call.call_duration / 60)}m ${call.call_duration % 60}s`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Admin/Manager View - Agent Performance */}
        {(role === 'admin' || role === 'sales_manager') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Agent Call Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/30 text-center">
                  <p className="text-3xl font-bold">{callLogs.length}</p>
                  <p className="text-sm text-muted-foreground">Total Calls</p>
                </div>
                <div className="p-4 rounded-lg bg-success/10 text-center">
                  <p className="text-3xl font-bold text-success">
                    {callLogs.filter(c => c.call_status === 'connected_positive').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Positive Responses</p>
                </div>
                <div className="p-4 rounded-lg bg-warning/10 text-center">
                  <p className="text-3xl font-bold text-warning">
                    {callLogs.filter(c => c.call_status === 'not_connected').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Not Connected</p>
                </div>
                <div className="p-4 rounded-lg bg-info/10 text-center">
                  <p className="text-3xl font-bold text-info">
                    {callLogs.length > 0 
                      ? Math.round((callLogs.filter(c => c.call_status.startsWith('connected')).length / callLogs.length) * 100)
                      : 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">Connect Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}