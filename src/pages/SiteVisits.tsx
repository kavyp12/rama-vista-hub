import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Calendar, Clock, MapPin, User, Star, Filter, CalendarDays } from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';

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
    name: string;
    phone: string;
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

const visitStatuses = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
];

export default function SiteVisits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchVisits();
  }, [statusFilter]);

  async function fetchVisits() {
    let query = supabase
      .from('site_visits')
      .select(`
        *,
        lead:leads(name, phone),
        property:properties(title, location),
        project:projects(name, location)
      `)
      .order('scheduled_at', { ascending: true });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (!error && data) {
      setVisits(data as SiteVisit[]);
    }
    setLoading(false);
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge className="bg-info/10 text-info border-info/20">Scheduled</Badge>;
      case 'completed':
        return <Badge className="bg-success/10 text-success border-success/20">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      case 'no_show':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">No Show</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isPast(date)) return 'Overdue';
    return format(date, 'MMM dd');
  };

  const getDateBadgeClass = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isPast(date) && !isToday(date)) return 'bg-destructive/10 text-destructive';
    if (isToday(date)) return 'bg-warning/10 text-warning';
    if (isTomorrow(date)) return 'bg-info/10 text-info';
    return 'bg-muted text-muted-foreground';
  };

  // Group visits by date
  const groupedVisits = visits.reduce((groups, visit) => {
    const date = format(parseISO(visit.scheduled_at), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(visit);
    return groups;
  }, {} as Record<string, SiteVisit[]>);

  return (
    <DashboardLayout title="Site Visits" description="Manage property site visits and schedules">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Visits</SelectItem>
                {visitStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Visit
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Today</p>
                  <p className="text-2xl font-bold">
                    {visits.filter(v => isToday(parseISO(v.scheduled_at)) && v.status === 'scheduled').length}
                  </p>
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
                  <p className="text-2xl font-bold">
                    {visits.filter(v => v.status === 'scheduled').length}
                  </p>
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
                  <p className="text-2xl font-bold">
                    {visits.filter(v => v.status === 'completed').length}
                  </p>
                </div>
                <Star className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cancelled</p>
                  <p className="text-2xl font-bold">
                    {visits.filter(v => v.status === 'cancelled' || v.status === 'no_show').length}
                  </p>
                </div>
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

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
        ) : visits.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No site visits</h3>
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
                  <Badge className={getDateBadgeClass(dateVisits[0].scheduled_at)}>
                    {getDateLabel(dateVisits[0].scheduled_at)}
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
                            <div className="flex items-center gap-2 mb-1">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold">{visit.lead?.name || 'Unknown Lead'}</span>
                              {getStatusBadge(visit.status || 'scheduled')}
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
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}