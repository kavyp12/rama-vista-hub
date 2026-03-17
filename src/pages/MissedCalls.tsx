import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  PhoneMissed, PhoneCall, PhoneOff, Phone, MessageSquare,
  Flame, Thermometer, Snowflake, Clock, RefreshCw,
  CheckCircle2, Calendar, CheckSquare, ArrowUpRight,
  ThumbsUp, ThumbsDown, Loader2, Inbox
} from 'lucide-react';
import { formatDistanceToNow, format, addHours, addDays } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

const CALL_OUTCOMES = [
  { value: 'connected_positive', label: 'Interested', icon: ThumbsUp, color: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' },
  { value: 'connected_callback', label: 'Callback', icon: Calendar, color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' },
  { value: 'not_connected', label: 'No Answer', icon: PhoneMissed, color: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' },
  { value: 'not_interested', label: 'Not Interested', icon: ThumbsDown, color: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' },
];

const QUICK_SCHEDULES = [
  { label: '2 hrs', fn: () => addHours(new Date(), 2) },
  { label: '4 hrs', fn: () => addHours(new Date(), 4) },
  { label: 'Tomorrow', fn: () => addHours(addDays(new Date(), 1), 0) },
];

export default function MissedCalls() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [calls, setCalls] = useState<MissedCallDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');

  // Log dialog
  const [logDialog, setLogDialog] = useState(false);
  const [activeCall, setActiveCall] = useState<MissedCallDetail | null>(null);
  const [callStatus, setCallStatus] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    if (token) fetchMissedCalls();
  }, [token]);

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
      // 1. Log the call
      const callRes = await fetch(`${API_URL}/call-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          leadId: activeCall.leadId,
          callStatus,
          notes: callNotes || null,
          callbackScheduledAt:
            (callStatus === 'connected_callback' || callStatus === 'not_connected') && callbackAt
              ? callbackAt
              : null,
        }),
      });
      if (!callRes.ok) throw new Error('Failed to log call');

      // 2. Mark the follow-up task as done
      if (activeCall.taskId) {
        await fetch(`${API_URL}/call-logs/tasks/${activeCall.taskId}/complete`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      // 3. If callback — schedule follow-up on lead
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
      // optimistic UI
      setCalls(prev => prev.map(c => c.id === call.id ? { ...c, followUpStatus: 'done' } : c));
      toast({ title: 'Marked as Done' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  }

  const filteredCalls = calls.filter(c => {
    if (filter === 'pending') return c.followUpStatus !== 'done';
    if (filter === 'done') return c.followUpStatus === 'done';
    return true;
  });

  const pendingCount = calls.filter(c => c.followUpStatus !== 'done').length;
  const doneCount = calls.filter(c => c.followUpStatus === 'done').length;

  return (
    <DashboardLayout
      title="Missed Calls"
      description="Leads waiting for your callback"
    >
      <div className="space-y-4">

        {/* Header row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {/* Filter pills */}
            {[
              { key: 'all', label: `All (${calls.length})` },
              { key: 'pending', label: `Pending (${pendingCount})` },
              { key: 'done', label: `Done (${doneCount})` },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as any)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                  filter === f.key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchMissedCalls(true)}
            disabled={refreshing}
            className="gap-2 h-8 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Inbox className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">
              {filter === 'done' ? 'No completed follow-ups yet' : 'No missed calls — you\'re all caught up!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredCalls.map((call) => (
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

      {/* Log Call Dialog */}
      <Dialog open={logDialog} onOpenChange={setLogDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Log Call — {activeCall?.leadName}</DialogTitle>
            <p className="text-xs text-muted-foreground">{activeCall?.leadPhone}</p>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Outcome buttons */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">What happened?</Label>
              <div className="grid grid-cols-2 gap-2">
                {CALL_OUTCOMES.map((o) => {
                  const Icon = o.icon;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setCallStatus(o.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                        callStatus === o.value
                          ? `${o.color} ring-1 ring-current`
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Callback scheduler — shows for callback/not_connected */}
            {(callStatus === 'connected_callback' || callStatus === 'not_connected') && (
              <div className="space-y-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                <Label className="text-xs font-medium text-blue-800 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Schedule Callback
                </Label>
                <div className="flex gap-1.5 flex-wrap">
                  {QUICK_SCHEDULES.map(q => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => setCallbackAt(format(q.fn(), "yyyy-MM-dd'T'HH:mm"))}
                      className="text-xs px-2.5 py-1 rounded-md border bg-white border-blue-200 text-blue-700 hover:bg-blue-100 font-medium"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                <Input
                  type="datetime-local"
                  value={callbackAt}
                  onChange={e => setCallbackAt(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Notes (optional)</Label>
              <Textarea
                placeholder="What was discussed..."
                value={callNotes}
                onChange={e => setCallNotes(e.target.value)}
                rows={2}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setLogDialog(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleLogCall}
              disabled={!callStatus || logging}
              className="gap-2"
            >
              {logging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// ── COMPACT MISSED CALL CARD ──────────────────────────────────────────────────
function MissedCallCard({
  call,
  onLogCall,
  onMarkDone,
}: {
  call: MissedCallDetail;
  onLogCall: () => void;
  onMarkDone: () => void;
}) {
  const isInbound = call.type === 'inbound_missed';
  const isDone = call.followUpStatus === 'done';
  const timeAgo = formatDistanceToNow(new Date(call.calledAt), { addSuffix: true });

  const tempConfig = {
    hot: { icon: Flame, color: 'text-red-500 bg-red-50', label: 'Hot' },
    warm: { icon: Thermometer, color: 'text-amber-500 bg-amber-50', label: 'Warm' },
    cold: { icon: Snowflake, color: 'text-blue-500 bg-blue-50', label: 'Cold' },
  }[call.temperature] || { icon: Thermometer, color: 'text-slate-400 bg-slate-50', label: '' };

  const TempIcon = tempConfig.icon;

  const cleanPhone = call.leadPhone.replace(/\D/g, '').slice(-10);
  const waLink = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(`Hi ${call.leadName}, following up on your property inquiry.`)}`;

  return (
    <div className={`rounded-xl border bg-white flex flex-col transition-all hover:shadow-sm ${isDone ? 'opacity-60' : ''}`}>
      {/* Top strip */}
      <div className={`flex items-center justify-between px-3 py-1.5 rounded-t-xl text-[10px] font-semibold ${
        isDone ? 'bg-green-50 text-green-600' :
        isInbound ? 'bg-rose-50 text-rose-600' : 'bg-orange-50 text-orange-600'
      }`}>
        <span className="flex items-center gap-1">
          {isDone
            ? <><CheckCircle2 className="h-3 w-3" /> Done</>
            : isInbound
              ? <><Phone className="h-3 w-3 rotate-[135deg]" /> They Called You</>
              : <><PhoneOff className="h-3 w-3" /> You Called – No Answer</>
          }
        </span>
        <span className="flex items-center gap-1 text-slate-400 font-normal">
          <Clock className="h-2.5 w-2.5" />{timeAgo}
        </span>
      </div>

      {/* Card body */}
      <div className="px-3 py-2.5 flex-1 space-y-2">
        {/* Name + temp + stage */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-slate-900 truncate">{call.leadName}</p>
            <a href={`tel:${call.leadPhone}`} className="text-xs text-blue-600 font-medium flex items-center gap-1 hover:underline">
              <Phone className="h-3 w-3" />{call.leadPhone}
            </a>
          </div>
          <div className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${tempConfig.color}`}>
            <TempIcon className="h-3 w-3" />
            {tempConfig.label}
          </div>
        </div>

        {/* Stage + follow-up date */}
        <div className="flex items-center gap-2 flex-wrap">
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
      </div>

      {/* Action footer */}
      <div className="border-t grid grid-cols-4 divide-x">
        {/* Call back */}
        <a href={`tel:${call.leadPhone}`} onClick={onLogCall} className="contents">
          <button
            className="h-9 flex items-center justify-center text-rose-500 hover:bg-rose-50 transition-colors rounded-bl-xl"
            title="Call Back"
          >
            <PhoneCall className="h-4 w-4" />
          </button>
        </a>

        {/* WhatsApp */}
        <a href={waLink} target="_blank" rel="noreferrer" className="contents">
          <button
            className="h-9 flex items-center justify-center text-green-600 hover:bg-green-50 transition-colors"
            title="WhatsApp"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        </a>

        {/* Log outcome */}
        <button
          onClick={onLogCall}
          className="h-9 flex items-center justify-center text-indigo-500 hover:bg-indigo-50 transition-colors"
          title="Log Outcome"
        >
          <CheckSquare className="h-4 w-4" />
        </button>

        {/* Mark done */}
        <button
          onClick={onMarkDone}
          disabled={isDone}
          className={`h-9 flex items-center justify-center transition-colors rounded-br-xl ${
            isDone ? 'text-green-500 bg-green-50' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
          }`}
          title={isDone ? 'Done' : 'Mark as Done'}
        >
          <CheckCircle2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}