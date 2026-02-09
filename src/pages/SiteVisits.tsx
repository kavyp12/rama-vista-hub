import { useEffect, useState } from 'react';
import { useAuth, usePermissions } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar, MapPin, User, Star, CalendarDays, CheckCircle2,
  Flame, Clock, Search, Phone, Filter, Building2, Home,
  AlertCircle, TrendingUp, X, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isPast, startOfWeek, endOfWeek, isWithinInterval, addHours, addDays } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface SiteVisit {
  id: string;
  leadId: string;
  scheduledAt: string;
  status: 'scheduled' | 'rescheduled' | 'completed' | 'cancelled';
  feedback: string | null;
  rating: number | null;
  conductedBy: string | null;
  lead?: {
    id: string;
    name: string;
    phone: string;
    stage: string;
    temperature: string | null;
  };
  property?: {
    title: string;
    location: string;
    city: string | null;
  };
  project?: {
    name: string;
    location: string;
  };
  conductor?: {
    id: string;
    fullName: string;
  };
}

interface Agent {
  id: string;
  fullName: string;
}

interface VisitStats {
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  missed: number;
  todayCount: number;
  tomorrowCount: number;
  weekCount: number;
  avgRating: number;
}

export default function SiteVisits() {
  const { user, token } = useAuth();
  const { canAssignLeads } = usePermissions();
  const { toast } = useToast();

  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<VisitStats>({
    total: 0,
    scheduled: 0,
    completed: 0,
    cancelled: 0,
    missed: 0,
    todayCount: 0,
    tomorrowCount: 0,
    weekCount: 0,
    avgRating: 0
  });

  const [activeTab, setActiveTab] = useState('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const [selectedVisit, setSelectedVisit] = useState<SiteVisit | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionTab, setActionTab] = useState('complete');
  const [rating, setRating] = useState(0);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [nextStage, setNextStage] = useState<string>('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (token) {
      fetchVisits();
      if (canAssignLeads) fetchAgents();
    }
  }, [token, canAssignLeads]);

  async function fetchVisits() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/site-visits`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (res.ok && Array.isArray(data)) {
        setVisits(data);
        calculateStats(data);
        
        const todayDate = format(new Date(), 'yyyy-MM-dd');
        setExpandedDates(new Set([todayDate]));
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to load visits', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function fetchAgents() {
    try {
      const res = await fetch(`${API_URL}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setAgents(data);
    } catch (error) {
      console.error(error);
    }
  }

  function calculateStats(visitsData: SiteVisit[]) {
    const now = new Date();
    const todayVisits = visitsData.filter(v => isToday(parseISO(v.scheduledAt)));
    const tomorrowVisits = visitsData.filter(v => isTomorrow(parseISO(v.scheduledAt)));
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const weekVisits = visitsData.filter(v => 
      isWithinInterval(parseISO(v.scheduledAt), { start: weekStart, end: weekEnd })
    );
    
    const missedVisits = visitsData.filter(v => 
      v.status === 'scheduled' && isPast(parseISO(v.scheduledAt)) && !isToday(parseISO(v.scheduledAt))
    );

    const completedVisits = visitsData.filter(v => v.status === 'completed');
    const ratingsSum = completedVisits.reduce((sum, v) => sum + (v.rating || 0), 0);
    
    setStats({
      total: visitsData.length,
      scheduled: visitsData.filter(v => v.status === 'scheduled').length,
      completed: completedVisits.length,
      cancelled: visitsData.filter(v => v.status === 'cancelled').length,
      missed: missedVisits.length,
      todayCount: todayVisits.length,
      tomorrowCount: tomorrowVisits.length,
      weekCount: weekVisits.length,
      avgRating: completedVisits.length > 0 ? Math.round((ratingsSum / completedVisits.length) * 10) / 10 : 0
    });
  }

  function getFilteredVisits() {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    let filtered = visits.filter(visit => {
      const visitDate = parseISO(visit.scheduledAt);
      switch (activeTab) {
        case 'missed':
          return visit.status === 'scheduled' && isPast(visitDate) && !isToday(visitDate);
        case 'today':
          return isToday(visitDate);
        case 'tomorrow':
          return isTomorrow(visitDate);
        case 'week':
          return isWithinInterval(visitDate, { start: weekStart, end: weekEnd });
        case 'completed':
          return visit.status === 'completed';
        case 'all':
        default:
          return true;
      }
    });

    if (canAssignLeads && selectedAgent !== 'all') {
      filtered = filtered.filter(v => v.conductedBy === selectedAgent);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v =>
        v.lead?.name.toLowerCase().includes(query) ||
        v.lead?.phone.includes(query) ||
        v.property?.title.toLowerCase().includes(query) ||
        v.project?.name.toLowerCase().includes(query) ||
        v.conductor?.fullName.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => {
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });
  }

  function groupVisitsByDate(visits: SiteVisit[]) {
    const grouped: Record<string, SiteVisit[]> = {};
    visits.forEach(visit => {
      const date = format(parseISO(visit.scheduledAt), 'yyyy-MM-dd');
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(visit);
    });
    return grouped;
  }

  function toggleDateExpansion(date: string) {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  }

  function openActionDialog(visit: SiteVisit) {
    setSelectedVisit(visit);
    setRating(visit.rating || 0);
    setFeedbackNotes(visit.feedback || '');
    setNextStage(visit.lead?.stage || '');
    setActionTab(visit.status === 'completed' ? 'complete' : 'complete');
    setShowActionDialog(true);
  }

  function setQuickTime(type: string) {
    const now = new Date();
    let newDate;
    
    switch (type) {
      case 'later_today':
        newDate = addHours(now, 3);
        break;
      case 'tomorrow_morning':
        newDate = addDays(now, 1);
        newDate.setHours(11, 0, 0, 0);
        break;
      case 'next_week':
        newDate = addDays(now, 7);
        newDate.setHours(11, 0, 0, 0);
        break;
      default:
        return;
    }
    
    setRescheduleDate(format(newDate, "yyyy-MM-dd'T'HH:mm"));
  }

  async function handleUpdateVisit(action: 'complete' | 'reschedule') {
    if (!selectedVisit) return;

    if (action === 'complete' && rating === 0) {
      toast({ title: 'Rating Required', description: 'Please provide a rating', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    try {
      const payload: any = {};

      if (action === 'complete') {
        payload.status = 'completed';
        payload.rating = rating;
        payload.feedback = feedbackNotes || null;

        if (nextStage && nextStage !== selectedVisit.lead?.stage) {
          await fetch(`${API_URL}/leads/${selectedVisit.leadId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              stage: nextStage,
              temperature: nextStage === 'token' || nextStage === 'negotiation' ? 'hot' :
                           nextStage === 'lost' ? 'cold' : undefined
            })
          });
        }
      } else {
        if (!rescheduleDate) {
          toast({ title: 'Date Required', description: 'Please select a new date/time', variant: 'destructive' });
          return;
        }
        
        payload.status = 'rescheduled';
        payload.scheduledAt = new Date(rescheduleDate).toISOString();
        payload.feedback = feedbackNotes ? 
          `${selectedVisit.feedback || ''}\n[Rescheduled]: ${feedbackNotes}` : 
          selectedVisit.feedback;
      }

      const res = await fetch(`${API_URL}/site-visits/${selectedVisit.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to update visit');

      toast({
        title: 'Success',
        description: action === 'complete' ? 'Visit marked as completed' : 'Visit rescheduled',
        className: 'bg-green-50 text-green-800'
      });

      setShowActionDialog(false);
      resetForm();
      fetchVisits();
      
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSelectedVisit(null);
    setRating(0);
    setFeedbackNotes('');
    setNextStage('');
    setRescheduleDate('');
    setShowActionDialog(false);
  }

  function getStatusBadge(visit: SiteVisit) {
    const visitDate = parseISO(visit.scheduledAt);
    const isMissed = visit.status === 'scheduled' && isPast(visitDate) && !isToday(visitDate);

    if (isMissed) {
      return <Badge variant="destructive" className="text-[10px]"><AlertCircle className="h-3 w-3 mr-1" />Missed</Badge>;
    }

    switch (visit.status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>;
      case 'rescheduled':
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]"><Clock className="h-3 w-3 mr-1" />Moved</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="text-[10px]"><X className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]"><Calendar className="h-3 w-3 mr-1" />Scheduled</Badge>;
    }
  }

  const filteredVisits = getFilteredVisits();
  const groupedVisits = groupVisitsByDate(filteredVisits);

  return (
    <DashboardLayout title="Site Visits" description="Manage property viewing appointments">
      <div className="space-y-6">
        
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="hover-lift cursor-pointer" onClick={() => setActiveTab('today')}>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.todayCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Today</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift cursor-pointer" onClick={() => setActiveTab('tomorrow')}>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600">{stats.tomorrowCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Tomorrow</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift cursor-pointer" onClick={() => setActiveTab('week')}>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{stats.weekCount}</p>
                <p className="text-xs text-muted-foreground mt-1">This Week</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift cursor-pointer" onClick={() => setActiveTab('missed')}>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{stats.missed}</p>
                <p className="text-xs text-muted-foreground mt-1">Missed</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift cursor-pointer" onClick={() => setActiveTab('completed')}>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                <p className="text-xs text-muted-foreground mt-1">Completed</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{stats.scheduled}</p>
                <p className="text-xs text-muted-foreground mt-1">Scheduled</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="p-4">
              <div className="text-center flex flex-col items-center">
                <div className="flex items-center gap-1">
                  <p className="text-2xl font-bold text-yellow-600">{stats.avgRating}</p>
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Avg Rating</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search visits..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {canAssignLeads && (
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList>
              <TabsTrigger value="today" className="text-xs">Today</TabsTrigger>
              <TabsTrigger value="tomorrow" className="text-xs">Tomorrow</TabsTrigger>
              <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
              <TabsTrigger value="missed" className="text-xs gap-1">
                <AlertCircle className="h-3 w-3" />
                Missed
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs">Completed</TabsTrigger>
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Visits List */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : filteredVisits.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium">No visits found</p>
                <p className="text-sm mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="divide-y">
                {Object.entries(groupedVisits).map(([date, dateVisits]) => {
                  const isExpanded = expandedDates.has(date);
                  const dateObj = parseISO(date);
                  const dateLabel = isToday(dateObj) ? 'Today' :
                                   isTomorrow(dateObj) ? 'Tomorrow' :
                                   format(dateObj, 'EEEE, MMMM dd, yyyy');

                  return (
                    <div key={date}>
                      {/* Date Header */}
                      <div
                        className="sticky top-0 z-10 bg-gradient-to-r from-blue-50 to-white backdrop-blur-sm px-4 py-3 border-b cursor-pointer hover:from-blue-100 transition-colors"
                        onClick={() => toggleDateExpansion(date)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            <Calendar className="h-4 w-4 text-primary" />
                            <span className="font-semibold text-sm text-primary">{dateLabel}</span>
                            <Badge variant="secondary" className="text-xs">{dateVisits.length} visits</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {dateVisits.filter(v => v.status === 'completed').length} done
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Visits for this date */}
                      {isExpanded && (
                        <div className="divide-y bg-slate-50/30">
                          {dateVisits.map((visit) => {
                            const visitDate = parseISO(visit.scheduledAt);
                            const isMissed = visit.status === 'scheduled' && isPast(visitDate) && !isToday(visitDate);

                            return (
                              <div
                                key={visit.id}
                                className={`p-4 hover:bg-white transition-colors ${isMissed ? 'bg-red-50/50' : ''}`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  
                                  {/* Time */}
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="text-center min-w-[60px]">
                                      <p className="text-xs text-muted-foreground">Time</p>
                                      <p className="font-mono font-semibold">{format(visitDate, 'h:mm a')}</p>
                                    </div>

                                    {/* Lead Info */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-semibold truncate">{visit.lead?.name || 'Unknown'}</h4>
                                        {visit.lead?.temperature === 'hot' && <Flame className="h-4 w-4 text-red-500" />}
                                        {visit.lead?.temperature === 'warm' && <TrendingUp className="h-4 w-4 text-orange-500" />}
                                      </div>
                                      
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                        <Phone className="h-3 w-3" />
                                        <span>{visit.lead?.phone}</span>
                                        <span>•</span>
                                        <Badge variant="outline" className="text-[10px] capitalize">
                                          {visit.lead?.stage?.replace('_', ' ')}
                                        </Badge>
                                      </div>

                                      {/* Property/Project */}
                                      <div className="flex items-start gap-2 text-sm">
                                        {visit.property ? (
                                          <Home className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                                        ) : (
                                          <Building2 className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
                                        )}
                                        <div className="min-w-0">
                                          <p className="font-medium truncate">
                                            {visit.property?.title || visit.project?.name || 'No Location'}
                                          </p>
                                          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                            <MapPin className="h-3 w-3" />
                                            {visit.property?.location || visit.project?.location || 'Unknown'}
                                            {(visit.property?.city || visit.project) && `, ${visit.property?.city || ''}`}
                                          </p>
                                        </div>
                                      </div>

                                      {/* Conductor (if admin) */}
                                      {canAssignLeads && visit.conductor && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                                          <User className="h-3 w-3" />
                                          <span>Agent: {visit.conductor.fullName}</span>
                                        </div>
                                      )}

                                      {/* Feedback (if completed) */}
                                      {visit.status === 'completed' && visit.feedback && (
                                        <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground border-l-2 border-green-300">
                                          <span className="font-semibold text-green-700">Note: </span>
                                          {visit.feedback.split('\n').pop()?.replace(/\[.*?\]: /, '')}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Status & Actions */}
                                  <div className="flex flex-col items-end gap-2 shrink-0">
                                    {getStatusBadge(visit)}
                                    
                                    {visit.status === 'completed' && visit.rating && (
                                      <div className="flex gap-0.5">
                                        {[...Array(5)].map((_, i) => (
                                          <Star
                                            key={i}
                                            className={`h-3.5 w-3.5 ${i < visit.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`}
                                          />
                                        ))}
                                      </div>
                                    )}

                                    <Button
                                      size="sm"
                                      variant={visit.status === 'completed' ? 'outline' : 'default'}
                                      className="gap-1"
                                      onClick={() => openActionDialog(visit)}
                                    >
                                      {visit.status === 'completed' ? (
                                        <>
                                          <Star className="h-3.5 w-3.5" />
                                          View
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                          Update
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Update Dialog */}
        <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Update Visit - {selectedVisit?.lead?.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {selectedVisit && format(parseISO(selectedVisit.scheduledAt), 'EEEE, MMM dd, yyyy • h:mm a')}
              </p>
            </DialogHeader>

            <Tabs value={actionTab} onValueChange={setActionTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="complete" className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Complete
                </TabsTrigger>
                <TabsTrigger value="reschedule" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Reschedule
                </TabsTrigger>
              </TabsList>

              {/* Complete Tab */}
              <TabsContent value="complete" className="space-y-4 mt-4">
                <div className="flex flex-col items-center gap-3 py-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Interest Rating</span>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="focus:outline-none transition-all hover:scale-110 active:scale-95"
                      >
                        <Star
                          className={`h-10 w-10 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-gray-400'}`}
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {rating === 0 ? 'Tap to rate' :
                     rating === 5 ? 'Extremely interested!' :
                     rating === 4 ? 'Very interested' :
                     rating === 3 ? 'Moderately interested' :
                     rating === 2 ? 'Slightly interested' :
                     'Not interested'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Feedback / Notes</Label>
                  <Textarea
                    placeholder="How did the visit go? What did the client say?"
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Update Lead Stage</Label>
                  <Select value={nextStage} onValueChange={setNextStage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select outcome..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="negotiation" className="text-green-600 font-medium">
                        🚀 Positive - Move to Negotiation
                      </SelectItem>
                      <SelectItem value="token" className="text-green-700 font-bold">
                        💰 Success - Token Received
                      </SelectItem>
                      <SelectItem value="site_visit">
                        🤔 Neutral - Keep in Site Visit
                      </SelectItem>
                      <SelectItem value="lost" className="text-red-600">
                        ❌ Negative - Mark as Lost
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    This will update the lead's pipeline stage automatically
                  </p>
                </div>

                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => handleUpdateVisit('complete')}
                  disabled={rating === 0 || submitting}
                >
                  {submitting ? 'Saving...' : 'Complete Visit & Update Lead'}
                </Button>
              </TabsContent>

              {/* Reschedule Tab */}
              <TabsContent value="reschedule" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickTime('later_today')}
                    className="text-xs gap-1"
                  >
                    <Clock className="h-3 w-3" />
                    +3 Hours
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickTime('tomorrow_morning')}
                    className="text-xs gap-1"
                  >
                    <Calendar className="h-3 w-3" />
                    Tmrw 11am
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickTime('next_week')}
                    className="text-xs gap-1"
                  >
                    <TrendingUp className="h-3 w-3" />
                    Next Week
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>New Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Reason for Rescheduling</Label>
                  <Textarea
                    placeholder="Why was this visit rescheduled?"
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={() => handleUpdateVisit('reschedule')}
                  disabled={!rescheduleDate || submitting}
                >
                  {submitting ? 'Saving...' : 'Reschedule Visit'}
                </Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

