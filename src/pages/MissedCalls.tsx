import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Flame, Thermometer, Snowflake, Clock, User, RefreshCw,
  CheckCircle2, ArrowRight, Calendar, AlertTriangle, Info,
  CheckSquare, X
} from 'lucide-react';
import { formatDistanceToNow, format, parseISO, addHours } from 'date-fns';

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
}

const CALL_OUTCOMES = [
  { value: 'connected_positive', label: 'Connected – Positive', icon: PhoneCall, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  { value: 'connected_callback', label: 'Connected – Callback Requested', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { value: 'not_connected', label: 'Not Connected / No Answer', icon: PhoneMissed, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  { value: 'not_interested', label: 'Not Interested', icon: PhoneOff, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' },
];

export default function MissedCalls() {
  const { user, token } = useAuth();
  const { toast } = useToast();

  const [calls, setCalls] = useState<MissedCallDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Log call dialog
  const [logDialog, setLogDialog] = useState(false);
  const [activeCall, setActiveCall] = useState<MissedCallDetail | null>(null);
  const [callStatus, setCallStatus] = useState('connected_positive');
  const [callNotes, setCallNotes] = useState('');
  const [callDuration, setCallDuration] = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [logging, setLogging] = useState(false);

  // Follow-up dialog
  const [followupDialog, setFollowupDialog] = useState(false);
  const [followupCall, setFollowupCall] = useState<MissedCallDetail | null>(null);
  const [followupDate, setFollowupDate] = useState('');
  const [followupNote, setFollowupNote] = useState('');
  const [schedulingFollowup, setSchedulingFollowup] = useState(false);

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
    setCallStatus('connected_positive');
    setCallNotes('');
    setCallDuration('');
    setCallbackAt('');
    setLogDialog(true);
  }

  function openFollowupDialog(call: MissedCallDetail) {
    setFollowupCall(call);
    // default to 2 hours from now
    const twohrs = addHours(new Date(), 2);
    setFollowupDate(format(twohrs, "yyyy-MM-dd'T'HH:mm"));
    setFollowupNote(`Call back ${call.leadName} (${call.leadPhone})`);
    setFollowupDialog(true);
  }

  async function handleLogCall() {
    if (!activeCall) return;
    setLogging(true);
    try {
      const res = await fetch(`${API_URL}/call-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          leadId: activeCall.leadId,
          callStatus,
          notes: callNotes,
          duration: callDuration ? parseInt(callDuration) : undefined,
          callbackScheduledAt: callStatus === 'connected_callback' && callbackAt ? callbackAt : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Call Logged ✓', description: `Call with ${activeCall.leadName} saved.` });
      setLogDialog(false);
      fetchMissedCalls(true);
    } catch {
      toast({ title: 'Error', description: 'Failed to log call', variant: 'destructive' });
    } finally {
      setLogging(false);
    }
  }

  async function handleScheduleFollowup() {
    if (!followupCall || !followupDate) return;
    setSchedulingFollowup(true);
    try {
      const res = await fetch(`${API_URL}/leads/${followupCall.leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nextFollowupAt: followupDate }),
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Follow-up Scheduled ✓', description: `Reminder set for ${followupCall.leadName}.` });
      setFollowupDialog(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to schedule follow-up', variant: 'destructive' });
    } finally {
      setSchedulingFollowup(false);
    }
  }

  function getTemperatureTag(temp: string) {
    switch (temp) {
      case 'hot': return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
          <Flame className="h-3 w-3" /> Hot
        </span>
      );
      case 'warm': return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
          <Thermometer className="h-3 w-3" /> Warm
        </span>
      );
      case 'cold': return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
          <Snowflake className="h-3 w-3" /> Cold
        </span>
      );
      default: return null;
    }
  }

  const inboundCount = calls.filter(c => c.type === 'inbound_missed').length;
  const outboundCount = calls.filter(c => c.type === 'outbound_missed').length;

  return (
    <DashboardLayout
      title="Missed Calls"
      description="Leads waiting for your callback — act fast before they lose interest"
    >
      <div className="space-y-6">

        {/* ── HEADER STATS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-center gap-3">
            <div className="h-11 w-11 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
              <PhoneMissed className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-xs text-rose-500 font-medium">Total Pending</p>
              <p className="text-3xl font-extrabold text-rose-700">{calls.length}</p>
              <p className="text-[10px] text-rose-400">callback{calls.length !== 1 ? 's' : ''} needed</p>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center gap-3">
            <div className="h-11 w-11 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
              <Phone className="h-5 w-5 text-orange-500 rotate-[135deg]" />
            </div>
            <div>
              <p className="text-xs text-orange-500 font-medium">They Called You</p>
              <p className="text-3xl font-extrabold text-orange-700">{inboundCount}</p>
              <p className="text-[10px] text-orange-400">inbound missed</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center gap-3">
            <div className="h-11 w-11 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
              <PhoneOff className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-amber-500 font-medium">No Answer (Outbound)</p>
              <p className="text-3xl font-extrabold text-amber-700">{outboundCount}</p>
              <p className="text-[10px] text-amber-400">you called, no pick up</p>
            </div>
          </div>
        </div>

        {/* ── CALL LIST ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <PhoneMissed className="h-4 w-4 text-rose-500" />
                  Pending Callbacks
                </CardTitle>
                <CardDescription className="mt-1">
                  Call back these leads — listed from newest to oldest
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 h-8"
                onClick={() => fetchMissedCalls(true)}
                disabled={refreshing}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : calls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                </div>
                <p className="font-bold text-base text-slate-700">All caught up! 🎉</p>
                <p className="text-sm text-slate-400">No pending missed calls. Great work!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {calls.map((call, idx) => (
                  <MissedCallCard
                    key={call.id}
                    call={call}
                    index={idx + 1}
                    getTemperatureTag={getTemperatureTag}
                    onLogCall={() => openLogDialog(call)}
                    onScheduleFollowup={() => openFollowupDialog(call)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── TIPS BANNER ── */}
        {calls.length > 0 && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-indigo-800">Pro Tips for Callbacks</p>
              <ul className="mt-1 space-y-0.5 text-xs text-indigo-600 list-disc list-inside">
                <li>Call back within 5 minutes — conversion drops 80% after 5 min</li>
                <li>Hot leads should be your first priority</li>
                <li>Always log your call outcome so nothing falls through the cracks</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ====== LOG CALL DIALOG ====== */}
      <Dialog open={logDialog} onOpenChange={setLogDialog}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <PhoneCall className="h-5 w-5 text-indigo-600" />
              Log Call — {activeCall?.leadName}
            </DialogTitle>
          </DialogHeader>

          {activeCall && (
            <div className="space-y-4 py-1">
              {/* Lead summary pill */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
                <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{activeCall.leadName}</p>
                  <p className="text-xs text-muted-foreground font-medium">{activeCall.leadPhone}</p>
                </div>
                {getTemperatureTag(activeCall.temperature)}
              </div>

              {/* Outcome */}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Call Outcome</Label>
                <div className="grid grid-cols-1 gap-2">
                  {CALL_OUTCOMES.map(opt => {
                    const Icon = opt.icon;
                    const selected = callStatus === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCallStatus(opt.value)}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all
                          ${selected ? `${opt.bg} ${opt.border} border-2` : 'border-slate-200 hover:bg-slate-50'}`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${opt.color}`} />
                        <span className={`text-sm font-medium ${selected ? opt.color : 'text-slate-700'}`}>
                          {opt.label}
                        </span>
                        {selected && <CheckCircle2 className={`h-4 w-4 ml-auto ${opt.color}`} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Callback time if needed */}
              {callStatus === 'connected_callback' && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Schedule Callback At</Label>
                  <Input
                    type="datetime-local"
                    value={callbackAt}
                    onChange={e => setCallbackAt(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              )}

              {/* Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Duration (seconds)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 120"
                    value={callDuration}
                    onChange={e => setCallDuration(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Stage</Label>
                  <div className="h-9 px-3 flex items-center text-sm bg-slate-50 border rounded-md text-muted-foreground capitalize">
                    {activeCall.stage.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Notes</Label>
                <Textarea
                  placeholder="What was discussed? Any next steps or key points from the call?"
                  value={callNotes}
                  onChange={e => setCallNotes(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLogDialog(false)}>Cancel</Button>
            <Button onClick={handleLogCall} disabled={logging} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              <CheckCircle2 className="h-4 w-4" />
              {logging ? 'Saving...' : 'Save Call'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== FOLLOW-UP DIALOG ====== */}
      <Dialog open={followupDialog} onOpenChange={setFollowupDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              Schedule Follow-up — {followupCall?.leadName}
            </DialogTitle>
          </DialogHeader>

          {followupCall && (
            <div className="space-y-4 py-1">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
                <div className="h-9 w-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <Phone className="h-4 w-4 text-rose-600" />
                </div>
                <div>
                  <p className="text-sm font-bold">{followupCall.leadName}</p>
                  <p className="text-xs text-muted-foreground">{followupCall.leadPhone}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Follow-up Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={followupDate}
                  onChange={e => setFollowupDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Note (optional)</Label>
                <Textarea
                  value={followupNote}
                  onChange={e => setFollowupNote(e.target.value)}
                  rows={2}
                  className="text-sm"
                  placeholder="What to discuss on follow-up?"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '30 min', hours: 0.5 },
                  { label: '2 hrs', hours: 2 },
                  { label: 'Tomorrow', hours: 24 },
                ].map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    className="text-xs border rounded-lg py-2 hover:bg-indigo-50 hover:border-indigo-300 transition-colors font-medium text-slate-600"
                    onClick={() => setFollowupDate(format(addHours(new Date(), preset.hours), "yyyy-MM-dd'T'HH:mm"))}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFollowupDialog(false)}>Cancel</Button>
            <Button
              onClick={handleScheduleFollowup}
              disabled={schedulingFollowup || !followupDate}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              <Calendar className="h-4 w-4" />
              {schedulingFollowup ? 'Scheduling...' : 'Set Reminder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// ── MISSED CALL CARD COMPONENT ──
function MissedCallCard({
  call,
  index,
  getTemperatureTag,
  onLogCall,
  onScheduleFollowup,
}: {
  call: MissedCallDetail;
  index: number;
  getTemperatureTag: (temp: string) => React.ReactNode;
  onLogCall: () => void;
  onScheduleFollowup: () => void;
}) {
  const isInbound = call.type === 'inbound_missed';
  const calledAt = new Date(call.calledAt);
  const timeAgo = formatDistanceToNow(calledAt, { addSuffix: true });
  const exactTime = format(calledAt, 'dd MMM yyyy, h:mm a');

  // Strip emoji prefixes from notes for cleaner display
  const cleanNote = call.notes
    ? call.notes.replace(/📵|📞|📋|⚠️/g, '').trim()
    : null;

  return (
    <div className={`rounded-xl border-2 transition-all hover:shadow-md ${
      isInbound
        ? 'border-rose-200 bg-gradient-to-r from-rose-50 to-white'
        : 'border-orange-200 bg-gradient-to-r from-orange-50 to-white'
    }`}>
      {/* Top bar */}
      <div className={`flex items-center justify-between px-4 py-2 rounded-t-xl ${
        isInbound ? 'bg-rose-100/60' : 'bg-orange-100/60'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500">#{index}</span>
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
            isInbound ? 'text-rose-700 bg-rose-200' : 'text-orange-700 bg-orange-200'
          }`}>
            {isInbound
              ? <><Phone className="h-2.5 w-2.5 rotate-[135deg]" /> They Called You</>
              : <><PhoneOff className="h-2.5 w-2.5" /> You Called — No Answer</>
            }
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Clock className="h-3 w-3" />
          <span>{timeAgo}</span>
        </div>
      </div>

      {/* Main card body */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Call icon */}
          <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
            isInbound ? 'bg-rose-100' : 'bg-orange-100'
          }`}>
            {isInbound
              ? <PhoneMissed className="h-6 w-6 text-rose-600" />
              : <PhoneOff className="h-6 w-6 text-orange-500" />
            }
          </div>

          {/* Lead Details */}
          <div className="flex-1 min-w-0">
            {/* Name + badges */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-base font-bold text-slate-900">{call.leadName}</h3>
              {getTemperatureTag(call.temperature)}
              <Badge variant="outline" className="text-[10px] h-5 capitalize font-medium">
                {call.stage.replace(/_/g, ' ')}
              </Badge>
            </div>

            {/* Phone number — large and tappable */}
            <a
              href={`tel:${call.leadPhone}`}
              className="inline-flex items-center gap-1.5 text-indigo-600 font-bold text-sm hover:underline mb-2"
            >
              <Phone className="h-3.5 w-3.5" />
              {call.leadPhone}
            </a>

            {/* Time info */}
            <p className="text-[11px] text-slate-400 mb-2">
              Called: {exactTime}
            </p>

            {/* Notes if any */}
            {cleanNote && cleanNote.length > 5 && (
              <div className="bg-white/70 border border-slate-200 rounded-lg px-3 py-2 mb-3">
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{cleanNote}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── ACTION BUTTONS ── */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dashed border-slate-200 flex-wrap">
          {/* CALL BACK — primary CTA */}
          <a href={`tel:${call.leadPhone}`} className="flex-1 min-w-[100px]">
            <Button
              className="w-full gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold h-10"
              onClick={onLogCall}
            >
              <PhoneCall className="h-4 w-4" />
              Call Back
            </Button>
          </a>

          {/* LOG CALL */}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-10 border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-medium"
            onClick={onLogCall}
          >
            <CheckSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Log Call</span>
          </Button>

          {/* WHATSAPP */}
          <a
            href={`https://wa.me/91${call.leadPhone.replace(/\D/g, '').slice(-10)}`}
            target="_blank"
            rel="noreferrer"
            className="h-10"
          >
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-10 border-green-200 text-green-700 hover:bg-green-50 font-medium"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </Button>
          </a>

          {/* SCHEDULE FOLLOW-UP */}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-10 border-amber-200 text-amber-700 hover:bg-amber-50 font-medium"
            onClick={onScheduleFollowup}
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Follow-up</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
