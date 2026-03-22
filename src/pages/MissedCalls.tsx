import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  PhoneMissed, PhoneCall, PhoneOff, Phone, MessageSquare,
  Flame, Thermometer, Snowflake, Clock, RefreshCw,
  CheckCircle2, Calendar, CheckSquare,
  ThumbsUp, ThumbsDown, Loader2, Inbox,
  Filter, X, Search, ArrowUpDown, SortAsc, SortDesc,
} from 'lucide-react';
import { formatDistanceToNow, format, addHours, addDays, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface MissedCallDetail {
  id: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  temperature: string;
  stage: string;
  calledAt: string;
  notes: string | null;
  type: 'inbound_missed' | 'outbound_missed';
  followUpStatus?: 'pending' | 'done' | 'scheduled';
  nextFollowupAt?: string | null;
  taskId?: string;
}

interface FilterState {
  search: string;
  dateFrom: string;
  dateTo: string;
  callType: string;
  temperature: string;
  stage: string;
  sortBy: string;
}

const EMPTY_FILTERS: FilterState = {
  search: '',
  dateFrom: '',
  dateTo: '',
  callType: 'all',
  temperature: 'all',
  stage: 'all',
  sortBy: 'newest',
};

const CALL_OUTCOMES = [
  { value: 'connected_positive', label: 'Interested',    icon: ThumbsUp,    color: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' },
  { value: 'connected_callback', label: 'Callback',      icon: Calendar,    color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' },
  { value: 'not_connected',      label: 'No Answer',     icon: PhoneMissed, color: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' },
  { value: 'not_interested',     label: 'Not Interested',icon: ThumbsDown,  color: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' },
];

const QUICK_SCHEDULES = [
  { label: '2 hrs',    fn: () => addHours(new Date(), 2) },
  { label: '4 hrs',    fn: () => addHours(new Date(), 4) },
  { label: 'Tomorrow', fn: () => addHours(addDays(new Date(), 1), 0) },
];

const STAGES = [
  { value: 'new',         label: 'New' },
  { value: 'contacted',   label: 'Contacted' },
  { value: 'site_visit',  label: 'Site Visit' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'token',       label: 'Token' },
  { value: 'closed',      label: 'Closed' },
];

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function MissedCalls() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [calls, setCalls] = useState<MissedCallDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusTab, setStatusTab] = useState<'all' | 'pending' | 'done'>('all');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  // Log dialog
  const [logDialog, setLogDialog] = useState(false);
  const [activeCall, setActiveCall] = useState<MissedCallDetail | null>(null);
  const [callStatus, setCallStatus] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [logging, setLogging] = useState(false);

  useEffect(() => { if (token) fetchMissedCalls(); }, [token]);

  async function fetchMissedCalls(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`${API_URL}/call-logs/missed-calls`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.ok ? await res.json() : [];
      setCalls(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: 'Error', description: 'Could not load missed calls', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openLogDialog(call: MissedCallDetail) {
    setActiveCall(call);
    setCallStatus('');
    setCallNotes('');
    setCallbackAt(format(addHours(new Date(), 2), "yyyy-MM-dd'T'HH:mm"));
    setLogDialog(true);
  }

  async function handleLogCall() {
    if (!activeCall || !callStatus) return;
    setLogging(true);
    try {
      const callRes = await fetch(`${API_URL}/call-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          leadId: activeCall.leadId,
          callStatus,
          notes: callNotes || null,
          callbackScheduledAt:
            (callStatus === 'connected_callback' || callStatus === 'not_connected') && callbackAt
              ? callbackAt : null,
        }),
      });
      if (!callRes.ok) throw new Error('Failed to log call');

      if (activeCall.taskId) {
        await fetch(`${API_URL}/call-logs/tasks/${activeCall.taskId}/complete`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if ((callStatus === 'connected_callback' || callStatus === 'not_connected') && callbackAt) {
        await fetch(`${API_URL}/leads/${activeCall.leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ nextFollowupAt: callbackAt }),
        });
      }

      toast({ title: 'Call Logged ✓', description: `Call with ${activeCall.leadName} saved.` });
      setLogDialog(false);
      fetchMissedCalls(true);
    } catch {
      toast({ title: 'Error', description: 'Failed to log call', variant: 'destructive' });
    } finally {
      setLogging(false);
    }
  }

  async function handleMarkDone(call: MissedCallDetail) {
    try {
      if (call.taskId) {
        await fetch(`${API_URL}/call-logs/tasks/${call.taskId}/complete`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setCalls(prev => prev.map(c => c.id === call.id ? { ...c, followUpStatus: 'done' } : c));
      toast({ title: 'Marked as Done' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  }

  // ─── ACTIVE FILTER COUNT ───
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.search)              n++;
    if (filters.dateFrom)            n++;
    if (filters.dateTo)              n++;
    if (filters.callType !== 'all')  n++;
    if (filters.temperature !== 'all') n++;
    if (filters.stage !== 'all')     n++;
    if (filters.sortBy !== 'newest') n++;
    return n;
  }, [filters]);

  // ─── FILTERED + SORTED LIST ───
  const displayedCalls = useMemo(() => {
    let r = [...calls];

    if (statusTab === 'pending') r = r.filter(c => c.followUpStatus !== 'done');
    if (statusTab === 'done')    r = r.filter(c => c.followUpStatus === 'done');

    if (filters.search) {
      const q = filters.search.toLowerCase();
      r = r.filter(c => c.leadName?.toLowerCase().includes(q) || c.leadPhone?.includes(q));
    }
    if (filters.dateFrom) {
      const from = startOfDay(new Date(filters.dateFrom));
      r = r.filter(c => !isBefore(new Date(c.calledAt), from));
    }
    if (filters.dateTo) {
      const to = endOfDay(new Date(filters.dateTo));
      r = r.filter(c => !isAfter(new Date(c.calledAt), to));
    }
    if (filters.callType !== 'all')    r = r.filter(c => c.type === filters.callType);
    if (filters.temperature !== 'all') r = r.filter(c => c.temperature === filters.temperature);
    if (filters.stage !== 'all')       r = r.filter(c => c.stage === filters.stage);

    switch (filters.sortBy) {
      case 'newest':    r.sort((a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime()); break;
      case 'oldest':    r.sort((a, b) => new Date(a.calledAt).getTime() - new Date(b.calledAt).getTime()); break;
      case 'name_asc':  r.sort((a, b) => (a.leadName || '').localeCompare(b.leadName || '')); break;
      case 'name_desc': r.sort((a, b) => (b.leadName || '').localeCompare(a.leadName || '')); break;
    }
    return r;
  }, [calls, statusTab, filters]);

  const pendingCount = calls.filter(c => c.followUpStatus !== 'done').length;
  const doneCount    = calls.filter(c => c.followUpStatus === 'done').length;
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  return (
    <DashboardLayout title="Missed Calls" description="Leads waiting for your callback">
      <div className="space-y-4">

        {/* ─── HEADER ─── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">

          {/* Status tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: 'all',     label: 'All',    count: calls.length },
              { key: 'pending', label: 'Pending', count: pendingCount },
              { key: 'done',    label: 'Done',    count: doneCount },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setStatusTab(f.key as any)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors flex items-center gap-1.5 ${
                  statusTab === f.key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                {f.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  statusTab === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {f.count}
                </span>
              </button>
            ))}
            {activeFilterCount > 0 && (
              <span className="text-xs text-slate-400 ml-1">
                showing <span className="font-semibold text-slate-800">{displayedCalls.length}</span> results
              </span>
            )}
          </div>

          {/* Right side: filter + refresh */}
          <div className="flex items-center gap-2">

            {/* Filter popover */}
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowFilters(p => !p)}
                className={`gap-2 h-8 text-xs ${activeFilterCount > 0 ? 'border-slate-900 text-slate-900 bg-slate-50' : ''}`}
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="bg-slate-900 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </Button>

              {showFilters && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFilters(false)} />
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 rounded-xl border bg-white shadow-xl overflow-hidden">

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <span className="text-sm font-semibold">Filter Missed Calls</span>
                      <button onClick={() => setShowFilters(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Fields */}
                    <div className="p-4 space-y-4 max-h-[72vh] overflow-y-auto">

                      {/* Search */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Search</label>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            placeholder="Name or phone..."
                            className="pl-8 h-9 text-sm"
                            value={filters.search}
                            onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
                          />
                        </div>
                      </div>

                      {/* Date range */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date Range</label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] text-slate-400 mb-1">From</p>
                            <Input type="date" className="h-9 text-sm" value={filters.dateFrom}
                              onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))} />
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 mb-1">To</p>
                            <Input type="date" className="h-9 text-sm" value={filters.dateTo}
                              onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))} />
                          </div>
                        </div>
                        <div className="flex gap-1.5 pt-0.5">
                          {[{ label: 'Today', days: 0 }, { label: '7 Days', days: 7 }, { label: '30 Days', days: 30 }].map(p => (
                            <button key={p.label}
                              className="flex-1 text-xs border rounded-md py-1.5 hover:bg-slate-50 transition-colors text-slate-600"
                              onClick={() => {
                                const today = format(new Date(), 'yyyy-MM-dd');
                                const from  = format(addDays(new Date(), -p.days), 'yyyy-MM-dd');
                                setFilters(prev => ({ ...prev, dateFrom: from, dateTo: today }));
                              }}>
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Call type */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Call Type</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { value: 'all',             label: 'All' },
                            { value: 'inbound_missed',  label: 'They Called' },
                            { value: 'outbound_missed', label: 'You Called' },
                          ].map(opt => (
                            <button key={opt.value}
                              onClick={() => setFilters(p => ({ ...p, callType: opt.value }))}
                              className={`text-xs py-2 px-2 rounded-lg border font-medium transition-all ${
                                filters.callType === opt.value
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                              }`}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Temperature */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead Temperature</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { value: 'all',  label: 'All',  Icon: null,        cls: '' },
                            { value: 'hot',  label: 'Hot',  Icon: Flame,       cls: 'text-red-600 border-red-200 bg-red-50' },
                            { value: 'warm', label: 'Warm', Icon: Thermometer, cls: 'text-amber-600 border-amber-200 bg-amber-50' },
                            { value: 'cold', label: 'Cold', Icon: Snowflake,   cls: 'text-blue-600 border-blue-200 bg-blue-50' },
                          ].map(opt => {
                            const isActive = filters.temperature === opt.value;
                            return (
                              <button key={opt.value}
                                onClick={() => setFilters(p => ({ ...p, temperature: opt.value }))}
                                className={`text-xs py-2 rounded-lg border font-medium transition-all flex flex-col items-center gap-1 ${
                                  isActive
                                    ? opt.value === 'all' ? 'bg-slate-900 text-white border-slate-900' : `${opt.cls} ring-1 ring-current`
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                }`}>
                                {opt.Icon && <opt.Icon className="h-3.5 w-3.5" />}
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Stage */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead Stage</label>
                        <Select value={filters.stage} onValueChange={v => setFilters(p => ({ ...p, stage: v }))}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="All Stages" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Stages</SelectItem>
                            {STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Sort */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                          <ArrowUpDown className="h-3 w-3" /> Sort By
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { value: 'newest',    label: 'Newest First', Icon: SortDesc },
                            { value: 'oldest',    label: 'Oldest First', Icon: SortAsc  },
                            { value: 'name_asc',  label: 'Name A → Z',  Icon: SortAsc  },
                            { value: 'name_desc', label: 'Name Z → A',  Icon: SortDesc },
                          ].map(opt => (
                            <button key={opt.value}
                              onClick={() => setFilters(p => ({ ...p, sortBy: opt.value }))}
                              className={`text-xs py-2 px-2.5 rounded-lg border font-medium transition-all flex items-center gap-1.5 ${
                                filters.sortBy === opt.value
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                              }`}>
                              <opt.Icon className="h-3 w-3 shrink-0" />
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
                      <button onClick={clearFilters} className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
                        Clear all
                      </button>
                      <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800 font-semibold px-5"
                        onClick={() => setShowFilters(false)}>
                        Apply filter
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Refresh */}
            <Button size="sm" variant="outline" onClick={() => fetchMissedCalls(true)}
              disabled={refreshing} className="gap-2 h-8 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ─── ACTIVE FILTER CHIPS ─── */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400">Active:</span>
            {filters.search && (
              <FilterChip label={`"${filters.search}"`} onRemove={() => setFilters(p => ({ ...p, search: '' }))} />
            )}
            {filters.dateFrom && (
              <FilterChip label={`From ${filters.dateFrom}`} onRemove={() => setFilters(p => ({ ...p, dateFrom: '' }))} />
            )}
            {filters.dateTo && (
              <FilterChip label={`To ${filters.dateTo}`} onRemove={() => setFilters(p => ({ ...p, dateTo: '' }))} />
            )}
            {filters.callType !== 'all' && (
              <FilterChip
                label={filters.callType === 'inbound_missed' ? 'They Called' : 'You Called'}
                onRemove={() => setFilters(p => ({ ...p, callType: 'all' }))}
              />
            )}
            {filters.temperature !== 'all' && (
              <FilterChip
                label={`${filters.temperature.charAt(0).toUpperCase() + filters.temperature.slice(1)} leads`}
                onRemove={() => setFilters(p => ({ ...p, temperature: 'all' }))}
              />
            )}
            {filters.stage !== 'all' && (
              <FilterChip
                label={STAGES.find(s => s.value === filters.stage)?.label || filters.stage}
                onRemove={() => setFilters(p => ({ ...p, stage: 'all' }))}
              />
            )}
            {filters.sortBy !== 'newest' && (
              <FilterChip
                label={({ oldest: 'Oldest first', name_asc: 'Name A→Z', name_desc: 'Name Z→A' } as any)[filters.sortBy] || filters.sortBy}
                onRemove={() => setFilters(p => ({ ...p, sortBy: 'newest' }))}
              />
            )}
            <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 font-medium ml-1 transition-colors">
              Clear all
            </button>
          </div>
        )}

        {/* ─── CARDS GRID ─── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : displayedCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Inbox className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">
              {activeFilterCount > 0
                ? 'No calls match your filters'
                : statusTab === 'done'
                ? 'No completed follow-ups yet'
                : "No missed calls — you're all caught up!"}
            </p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="mt-2 text-xs text-slate-400 hover:text-slate-700 underline underline-offset-2">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {displayedCalls.map(call => (
              <MissedCallCard
                key={call.id}
                call={call}
                onLogCall={() => openLogDialog(call)}
                onMarkDone={() => handleMarkDone(call)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── LOG CALL DIALOG ─── */}
      <Dialog open={logDialog} onOpenChange={setLogDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Log Call — {activeCall?.leadName}</DialogTitle>
            <p className="text-xs text-muted-foreground">{activeCall?.leadPhone}</p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">What happened?</Label>
              <div className="grid grid-cols-2 gap-2">
                {CALL_OUTCOMES.map(o => {
                  const Icon = o.icon;
                  return (
                    <button key={o.value} type="button" onClick={() => setCallStatus(o.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                        callStatus === o.value ? `${o.color} ring-1 ring-current` : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}>
                      <Icon className="h-3.5 w-3.5 shrink-0" />{o.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {(callStatus === 'connected_callback' || callStatus === 'not_connected') && (
              <div className="space-y-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                <Label className="text-xs font-medium text-blue-800 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Schedule Callback
                </Label>
                <div className="flex gap-1.5 flex-wrap">
                  {QUICK_SCHEDULES.map(q => (
                    <button key={q.label} type="button"
                      onClick={() => setCallbackAt(format(q.fn(), "yyyy-MM-dd'T'HH:mm"))}
                      className="text-xs px-2.5 py-1 rounded-md border bg-white border-blue-200 text-blue-700 hover:bg-blue-100 font-medium">
                      {q.label}
                    </button>
                  ))}
                </div>
                <Input type="datetime-local" value={callbackAt}
                  onChange={e => setCallbackAt(e.target.value)} className="h-8 text-xs bg-white" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Notes (optional)</Label>
              <Textarea placeholder="What was discussed..." value={callNotes}
                onChange={e => setCallNotes(e.target.value)} rows={2} className="text-xs resize-none" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setLogDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={handleLogCall} disabled={!callStatus || logging} className="gap-2">
              {logging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────
// FILTER CHIP
// ─────────────────────────────────────────────
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-slate-900 text-white px-2.5 py-1 rounded-full font-medium">
      {label}
      <button onClick={onRemove} className="hover:opacity-70 transition-opacity ml-0.5">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ─────────────────────────────────────────────
// MISSED CALL CARD
// ─────────────────────────────────────────────
function MissedCallCard({
  call, onLogCall, onMarkDone,
}: {
  call: MissedCallDetail;
  onLogCall: () => void;
  onMarkDone: () => void;
}) {
  const isInbound = call.type === 'inbound_missed';
  const isDone    = call.followUpStatus === 'done';
  const timeAgo   = formatDistanceToNow(new Date(call.calledAt), { addSuffix: true });

  const tempConfig = {
    hot:  { icon: Flame,       color: 'text-red-500 bg-red-50',    label: 'Hot'  },
    warm: { icon: Thermometer, color: 'text-amber-500 bg-amber-50', label: 'Warm' },
    cold: { icon: Snowflake,   color: 'text-blue-500 bg-blue-50',  label: 'Cold' },
  }[call.temperature] || { icon: Thermometer, color: 'text-slate-400 bg-slate-50', label: '' };

  const TempIcon   = tempConfig.icon;
  const cleanPhone = call.leadPhone.replace(/\D/g, '').slice(-10);
  const waLink     = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(`Hi ${call.leadName}, following up on your property inquiry.`)}`;

  return (
    <div className={`rounded-xl border bg-white flex flex-col transition-all hover:shadow-sm ${isDone ? 'opacity-60' : ''}`}>
      <div className={`flex items-center justify-between px-3 py-1.5 rounded-t-xl text-[10px] font-semibold ${
        isDone ? 'bg-green-50 text-green-600' : isInbound ? 'bg-rose-50 text-rose-600' : 'bg-orange-50 text-orange-600'
      }`}>
        <span className="flex items-center gap-1">
          {isDone ? <><CheckCircle2 className="h-3 w-3" /> Done</>
           : isInbound ? <><Phone className="h-3 w-3 rotate-[135deg]" /> They Called You</>
           : <><PhoneOff className="h-3 w-3" /> You Called – No Answer</>}
        </span>
        <span className="flex items-center gap-1 text-slate-400 font-normal">
          <Clock className="h-2.5 w-2.5" />{timeAgo}
        </span>
      </div>

      <div className="px-3 py-2.5 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-slate-900 truncate">
              {call.leadName
                ? call.leadName.replace('Unverified MCUBE Caller - ', 'New Inquiry: ').replace('New Lead - ', 'New Inquiry: ')
                : 'Unknown Lead'}
            </p>
            <a href={`tel:${call.leadPhone}`} className="text-xs text-blue-600 font-medium flex items-center gap-1 hover:underline">
              <Phone className="h-3 w-3" />{call.leadPhone}
            </a>
          </div>
          <div className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${tempConfig.color}`}>
            <TempIcon className="h-3 w-3" />{tempConfig.label}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap pb-1">
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize font-normal">
            {call.stage.replace(/_/g, ' ')}
          </Badge>
          {call.nextFollowupAt && !isDone && (
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-blue-400" />
              {format(new Date(call.nextFollowupAt), 'MMM d, h:mm a')}
            </span>
          )}
        </div>

        {(() => {
          if (!call.notes) return null;
          const match = call.notes.match(/Recording:\s*(http[^\s|]+)/);
          if (match && match[1] && match[1] !== 'None') {
            return (
              <div className="pt-2 mt-1 border-t border-slate-100">
                <a href={match[1]} target="_blank" rel="noreferrer"
                  className="text-[10px] font-semibold w-fit bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 rounded px-2 py-1 flex items-center gap-1.5 transition-colors">
                  ▶ Play Audio Recording
                </a>
              </div>
            );
          }
          return null;
        })()}
      </div>

      <div className="border-t grid grid-cols-4 divide-x">
        <a href={`tel:${call.leadPhone}`} onClick={onLogCall} className="contents">
          <button className="h-9 flex items-center justify-center text-rose-500 hover:bg-rose-50 transition-colors rounded-bl-xl" title="Call Back">
            <PhoneCall className="h-4 w-4" />
          </button>
        </a>
        <a href={waLink} target="_blank" rel="noreferrer" className="contents">
          <button className="h-9 flex items-center justify-center text-green-600 hover:bg-green-50 transition-colors" title="WhatsApp">
            <MessageSquare className="h-4 w-4" />
          </button>
        </a>
        <button onClick={onLogCall} className="h-9 flex items-center justify-center text-indigo-500 hover:bg-indigo-50 transition-colors" title="Log Outcome">
          <CheckSquare className="h-4 w-4" />
        </button>
        <button onClick={onMarkDone} disabled={isDone}
          className={`h-9 flex items-center justify-center transition-colors rounded-br-xl ${
            isDone ? 'text-green-500 bg-green-50' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
          }`} title={isDone ? 'Done' : 'Mark as Done'}>
          <CheckCircle2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}