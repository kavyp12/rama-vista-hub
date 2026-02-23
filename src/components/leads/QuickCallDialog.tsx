import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ThumbsUp, Calendar, PhoneMissed, ThumbsDown, Clock, Phone, MessageCircle, CheckCircle2 } from 'lucide-react';
import { addHours, addDays, addWeeks } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const callOutcomes = [
  { value: 'connected_positive', label: 'Interested', icon: ThumbsUp, color: 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200' },
  { value: 'connected_callback', label: 'Callback', icon: Calendar, color: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200' },
  { value: 'not_connected', label: 'Busy / No Answer', icon: PhoneMissed, color: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200' },
  { value: 'not_interested', label: 'Not Interested', icon: ThumbsDown, color: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200' },
];

const quickNotes = [
  'Interested in property',
  'Busy, call back later',
  'Wrong number',
  'Not answering',
  'Asked for details',
];

const callbackOptions = [
  { label: '2 Hours', value: 'hours', amount: 2 },
  { label: 'Tomorrow', value: 'days', amount: 1 },
  { label: 'Next Week', value: 'weeks', amount: 1 },
];

export function QuickCallDialog({ lead, open, onOpenChange, onSuccess }: any) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [isSuccessState, setIsSuccessState] = useState(false);

  // Form state
  const [callOutcome, setCallOutcome] = useState('');
  const [callDuration, setCallDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [callbackOption, setCallbackOption] = useState('');
  const [customCallbackDate, setCustomCallbackDate] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const callCount = lead.callLogs?.length || 0;

  // --- NEW MCUBE AUTO-DIALER ---
  useEffect(() => {
    if (open) {
      initiateCallViaMCUBE();
      setIsSuccessState(false);
    }
  }, [open, lead.phone]);

  async function initiateCallViaMCUBE() {
    try {
      toast({ title: 'Dialing...', description: 'Connecting call via MCUBE...' });
      const res = await fetch(`${API_URL}/call-logs/initiate-mcube`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ leadPhone: lead.phone })
      });
      
      if (!res.ok) throw new Error('Failed to connect call');
      
      toast({ title: 'Ringing', description: 'Please answer your phone to connect to the lead.' });
    } catch (error) {
      toast({ title: 'Dialer Error', description: 'Could not connect to MCUBE. Showing manual log format.', variant: 'destructive' });
    }
  }

  // Allow manual submission in case the agent still wants to add specific notes 
  // (MCUBE handles duration and recording in the background, but this form handles extra text notes)
  async function handleSubmit() {
    if (!callOutcome || !token) return;

    setSubmitting(true);

    try {
      let callbackTime: Date | null = null;
      if (callOutcome === 'connected_callback' || callOutcome === 'not_connected') {
        if (callbackOption === 'custom' && customCallbackDate) {
          callbackTime = new Date(customCallbackDate);
        } else {
          const option = callbackOptions.find(o => o.label === callbackOption);
          if (option) {
            const now = new Date();
            switch (option.value) {
              case 'hours': callbackTime = addHours(now, option.amount); break;
              case 'days': callbackTime = addDays(now, option.amount); break;
              case 'weeks': callbackTime = addWeeks(now, option.amount); break;
            }
          } else if (callOutcome === 'not_connected') {
            callbackTime = addHours(new Date(), 2);
          }
        }
      }

      const payload = {
        callStatus: callOutcome,
        callDuration: callDuration ? parseInt(callDuration) : null,
        notes: notes || null,
        callbackScheduledAt: callbackTime ? callbackTime.toISOString() : null,
        rejectionReason: rejectionReason || null
      };

      const res = await fetch(`${API_URL}/leads/${lead.id}/call-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to save manual log');

      toast({ title: 'Notes Saved', description: 'Manual notes attached to lead successfully.' });
      
      if (callOutcome === 'connected_positive' || callOutcome === 'connected_callback') {
          setIsSuccessState(true);
      } else {
          resetForm();
          onOpenChange(false);
      }
      onSuccess();

    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to log call', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setCallOutcome('');
    setCallDuration('');
    setNotes('');
    setCallbackOption('');
    setCustomCallbackDate('');
    setRejectionReason('');
    setIsSuccessState(false);
  }

  const handleWhatsAppFollowUp = () => {
    const msg = `Hi ${lead.name}, this is regarding our recent call about the property inquiry. Please let me know if you need any further details!`;
    const cleanPhone = lead.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    resetForm();
    onOpenChange(false);
  };

  if (isSuccessState) {
      return (
        <Dialog open={open} onOpenChange={(val) => { resetForm(); onOpenChange(val); }}>
          <DialogContent className="sm:max-w-md text-center py-10">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <DialogTitle className="text-xl">Notes Logged Successfully</DialogTitle>
            <p className="text-muted-foreground mb-6">Would you like to send a follow-up WhatsApp message?</p>
            <div className="flex justify-center gap-3">
               <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Skip</Button>
               <Button className="bg-green-600 hover:bg-green-700" onClick={handleWhatsAppFollowUp}>
                  <MessageCircle className="h-4 w-4 mr-2" /> Send Message
               </Button>
            </div>
          </DialogContent>
        </Dialog>
      )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex justify-between items-start">
              <div>
                <DialogTitle>Add Manual Notes - {lead.name}</DialogTitle>
                <p className="text-sm text-muted-foreground">{lead.phone} (Dialing via MCUBE)</p>
              </div>
              <Badge variant="outline" className="text-xs bg-slate-50"><Phone className="h-3 w-3 mr-1"/> Called {callCount}x</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-xs bg-blue-50 text-blue-700 p-2 rounded-md border border-blue-200">
            <strong>Note:</strong> MCUBE automatically tracks call duration and call recordings. Use this form only if you need to schedule a callback or leave specific text notes.
          </div>

          <div className="space-y-2">
            <Label>Call Outcome (For scheduling)</Label>
            <div className="grid grid-cols-2 gap-2">
              {callOutcomes.map((outcome) => {
                const Icon = outcome.icon;
                return (
                  <Button
                    key={outcome.value}
                    type="button"
                    variant="outline"
                    className={`justify-start gap-2 h-auto py-3 ${
                      callOutcome === outcome.value 
                        ? `${outcome.color} border-current ring-1 ring-current` 
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => setCallOutcome(outcome.value)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{outcome.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Agent Notes</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {quickNotes.map((note) => (
                <Button key={note} type="button" size="sm" variant={notes === note ? 'default' : 'outline'} onClick={() => setNotes(note)} className="h-7 text-xs">
                  {note}
                </Button>
              ))}
            </div>
            <Textarea placeholder="Add specific conversation notes here..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {(callOutcome === 'connected_callback' || callOutcome === 'not_connected') && (
            <div className="space-y-2 bg-blue-50 p-3 rounded-md border border-blue-100">
              <Label className="flex items-center gap-2 text-blue-900">
                <Clock className="h-4 w-4" /> Schedule {callOutcome === 'connected_callback' ? 'Callback' : 'Retry'}
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {callbackOptions.map((option) => (
                  <Button
                    key={option.label} type="button" size="sm"
                    variant={callbackOption === option.label ? 'default' : 'outline'}
                    className={callbackOption === option.label ? 'bg-blue-600 hover:bg-blue-700' : 'bg-white'}
                    onClick={() => setCallbackOption(option.label)}
                  >
                    {option.label}
                  </Button>
                ))}
                <Button
                  type="button" size="sm"
                  variant={callbackOption === 'custom' ? 'default' : 'outline'}
                  className={callbackOption === 'custom' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-white'}
                  onClick={() => setCallbackOption('custom')}
                >Custom</Button>
              </div>
              {callbackOption === 'custom' && (
                <div className="mt-2">
                  <Input type="datetime-local" value={customCallbackDate} onChange={(e) => setCustomCallbackDate(e.target.value)} className="bg-white" />
                </div>
              )}
            </div>
          )}

          {callOutcome === 'not_interested' && (
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Select value={rejectionReason} onValueChange={setRejectionReason}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget">Budget constraints</SelectItem>
                  <SelectItem value="location">Location not suitable</SelectItem>
                  <SelectItem value="competitor">Chose competitor</SelectItem>
                  <SelectItem value="not_buying">Not in market</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleSubmit} disabled={!callOutcome || submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Notes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}