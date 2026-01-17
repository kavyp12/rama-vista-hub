import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, MapPin, User, Star, CalendarDays, CheckCircle2, AlertCircle, Flame, Thermometer, Snowflake } from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isPast, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';

interface SiteVisit {
  id: string;
  lead_id: string;
  property_id: string | null;
  project_id: string | null;
  scheduled_at: string;
  status: string;
  feedback: string | null;
  rating: number | null;
  conducted_by: string | null;
  lead?: {
    id: string;
    name: string;
    phone: string;
    temperature: string | null;
  };
  property?: {
    title: string;
    location: string;
  };
  project?: {
    name: string;
    location: string;
  };
}

export default function SiteVisits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('today');
  const [selectedVisit, setSelectedVisit] = useState<SiteVisit | null>(null);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  
  // Feedback form state
  const [rating, setRating] = useState(0);
  const [interestLevel, setInterestLevel] = useState<'hot' | 'warm' | 'cold'>('warm');
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchVisits();
  }, []);

  async function fetchVisits() {
    const { data, error } = await supabase
      .from('site_visits')
      .select(`
        *,
        lead:leads(id, name, phone, temperature),
        property:properties(title, location),
        project:projects(name, location)
      `)
      .order('scheduled_at', { ascending: true });

    if (!error && data) {
      setVisits(data as SiteVisit[]);
    }
    setLoading(false);
  }

  const getFilteredVisits = () => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    return visits.filter(visit => {
      const visitDate = parseISO(visit.scheduled_at);
      
      switch (activeTab) {
        case 'today':
          return isToday(visitDate);
        case 'tomorrow':
          return isTomorrow(visitDate);
        case 'week':
          return isWithinInterval(visitDate, { start: weekStart, end: weekEnd });
        case 'all':
        default:
          return true;
      }
    });
  };

  const getStatusBadge = (visit: SiteVisit) => {
    const visitDate = parseISO(visit.scheduled_at);
    
    if (visit.status === 'completed') {
      return <Badge className="bg-success/10 text-success border-success/20">Completed</Badge>;
    }
    if (visit.status === 'cancelled') {
      return <Badge variant="secondary">Cancelled</Badge>;
    }
    if (isPast(visitDate) && !isToday(visitDate)) {
      return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Overdue</Badge>;
    }
    if (isToday(visitDate)) {
      return <Badge className="bg-warning/10 text-warning border-warning/20">Today</Badge>;
    }
    if (isTomorrow(visitDate)) {
      return <Badge className="bg-info/10 text-info border-info/20">Tomorrow</Badge>;
    }
    return <Badge className="bg-info/10 text-info border-info/20">Upcoming</Badge>;
  };

  const getDateBadgeClass = (dateStr: string, status: string) => {
    if (status === 'completed') return 'bg-success/10 text-success';
    const date = parseISO(dateStr);
    if (isPast(date) && !isToday(date)) return 'bg-destructive/10 text-destructive';
    if (isToday(date)) return 'bg-warning/10 text-warning';
    if (isTomorrow(date)) return 'bg-info/10 text-info';
    return 'bg-muted text-muted-foreground';
  };

  async function handleCompleteVisit() {
    if (!selectedVisit || !user) return;

    setSubmitting(true);

    try {
      // Update site visit
      const { error: visitError } = await supabase
        .from('site_visits')
        .update({
          status: 'completed',
          rating,
          feedback: `${feedbackNotes}${nextSteps ? `\n\nNext Steps: ${nextSteps}` : ''}`,
        })
        .eq('id', selectedVisit.id);

      if (visitError) throw visitError;

      // Update lead temperature
      if (selectedVisit.lead) {
        await supabase
          .from('leads')
          .update({ temperature: interestLevel })
          .eq('id', selectedVisit.lead.id);
      }

      toast({ title: 'Success', description: 'Visit completed and feedback saved' });
      setShowFeedbackDialog(false);
      resetFeedbackForm();
      fetchVisits();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to complete visit', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  function resetFeedbackForm() {
    setSelectedVisit(null);
    setRating(0);
    setInterestLevel('warm');
    setFeedbackNotes('');
    setNextSteps('');
  }

  // Group visits by date
  const filteredVisits = getFilteredVisits();
  const groupedVisits = filteredVisits.reduce((groups, visit) => {
    const date = format(parseISO(visit.scheduled_at), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(visit);
    return groups;
  }, {} as Record<string, SiteVisit[]>);

  // Stats
  const todayCount = visits.filter(v => isToday(parseISO(v.scheduled_at)) && v.status === 'scheduled').length;
  const scheduledCount = visits.filter(v => v.status === 'scheduled').length;
  const completedCount = visits.filter(v => v.status === 'completed').length;
  const overdueCount = visits.filter(v => v.status === 'scheduled' && isPast(parseISO(v.scheduled_at)) && !isToday(parseISO(v.scheduled_at))).length;

  return (
    <DashboardLayout title="Site Visits" description="Manage property site visits and schedules">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className={todayCount > 0 ? 'border-warning' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Today</p>
                  <p className="text-2xl font-bold">{todayCount}</p>
                </div>
                <CalendarDays className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="text-2xl font-bold">{scheduledCount}</p>
                </div>
                <Calendar className="h-8 w-8 text-info" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{completedCount}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card className={overdueCount > 0 ? 'border-destructive' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold">{overdueCount}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="tomorrow">Tomorrow</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {/* Visits Timeline */}
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 w-1/4 rounded bg-muted mb-4" />
                      <div className="h-20 rounded bg-muted" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredVisits.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No visits {activeTab !== 'all' ? `for ${activeTab}` : 'found'}</h3>
                  <p className="text-muted-foreground">
                    Schedule site visits from the leads page
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedVisits).map(([date, dateVisits]) => (
                  <div key={date}>
                    <div className="flex items-center gap-3 mb-4">
                      <Badge className={getDateBadgeClass(dateVisits[0].scheduled_at, dateVisits[0].status)}>
                        {isToday(parseISO(date)) ? 'Today' : isTomorrow(parseISO(date)) ? 'Tomorrow' : format(parseISO(date), 'MMM dd')}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {dateVisits.map((visit) => (
                        <Card key={visit.id} className="hover-lift">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <div className="flex-shrink-0 w-16 text-center">
                                <p className="text-lg font-bold">
                                  {format(parseISO(visit.scheduled_at), 'HH:mm')}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(parseISO(visit.scheduled_at), 'a')}
                                </p>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-semibold">{visit.lead?.name || 'Unknown Lead'}</span>
                                  {getStatusBadge(visit)}
                                  {visit.lead?.temperature && (
                                    <>
                                      {visit.lead.temperature === 'hot' && <Flame className="h-4 w-4 text-red-500" />}
                                      {visit.lead.temperature === 'warm' && <Thermometer className="h-4 w-4 text-amber-500" />}
                                      {visit.lead.temperature === 'cold' && <Snowflake className="h-4 w-4 text-blue-500" />}
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <MapPin className="h-3.5 w-3.5" />
                                  <span>
                                    {visit.property?.title || visit.project?.name || 'No property assigned'}
                                  </span>
                                </div>
                              </div>
                              {visit.rating && (
                                <div className="flex items-center gap-1">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`h-4 w-4 ${
                                        i < visit.rating! ? 'fill-warning text-warning' : 'text-muted'
                                      }`}
                                    />
                                  ))}
                                </div>
                              )}
                              {visit.status === 'scheduled' && (
                                <Button 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedVisit(visit);
                                    setShowFeedbackDialog(true);
                                  }}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Complete
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Visit - {selectedVisit?.lead?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Star Rating */}
            <div className="space-y-2">
              <Label>Rating (1-5 Stars)</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1"
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        star <= rating ? 'fill-warning text-warning' : 'text-muted hover:text-warning/50'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Interest Level */}
            <div className="space-y-2">
              <Label>Interest Level</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={interestLevel === 'hot' ? 'default' : 'outline'}
                  className={interestLevel === 'hot' ? 'bg-red-500 hover:bg-red-600' : ''}
                  onClick={() => setInterestLevel('hot')}
                >
                  <Flame className="h-4 w-4 mr-1" /> Hot
                </Button>
                <Button
                  type="button"
                  variant={interestLevel === 'warm' ? 'default' : 'outline'}
                  className={interestLevel === 'warm' ? 'bg-amber-500 hover:bg-amber-600' : ''}
                  onClick={() => setInterestLevel('warm')}
                >
                  <Thermometer className="h-4 w-4 mr-1" /> Warm
                </Button>
                <Button
                  type="button"
                  variant={interestLevel === 'cold' ? 'default' : 'outline'}
                  className={interestLevel === 'cold' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                  onClick={() => setInterestLevel('cold')}
                >
                  <Snowflake className="h-4 w-4 mr-1" /> Cold
                </Button>
              </div>
            </div>

            {/* Feedback Notes */}
            <div className="space-y-2">
              <Label>Feedback Notes</Label>
              <Textarea
                placeholder="How did the visit go? What did the lead like/dislike?"
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Next Steps */}
            <div className="space-y-2">
              <Label>Next Steps</Label>
              <Textarea
                placeholder="What are the recommended next steps?"
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>Cancel</Button>
            <Button onClick={handleCompleteVisit} disabled={rating === 0 || submitting}>
              {submitting ? 'Saving...' : 'Complete Visit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
