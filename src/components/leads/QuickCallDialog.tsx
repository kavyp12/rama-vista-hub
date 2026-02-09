import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ThumbsUp, Calendar, PhoneMissed, ThumbsDown, Clock } from 'lucide-react';
import { addHours, addDays, addWeeks } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Lead {
  id: string;
  name: string;
  phone: string;
  stage: string;
}

interface QuickCallDialogProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

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

export function QuickCallDialog({ lead, open, onOpenChange, onSuccess }: QuickCallDialogProps) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [callOutcome, setCallOutcome] = useState('');
  const [callDuration, setCallDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [callbackOption, setCallbackOption] = useState('');
  const [customCallbackDate, setCustomCallbackDate] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  async function handleSubmit() {
    if (!callOutcome || !token) return;

    setSubmitting(true);

    try {
      // Calculate callback time
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
            // Default: retry in 2 hours
            callbackTime = addHours(new Date(), 2);
          }
        }
      }

      // Prepare Payload
      const payload = {
        callStatus: callOutcome,
        callDuration: callDuration ? parseInt(callDuration) : null,
        notes: notes || null,
        callbackScheduledAt: callbackTime ? callbackTime.toISOString() : null,
        rejectionReason: rejectionReason || null
      };

      // Send to Backend
      const res = await fetch(`${API_URL}/leads/${lead.id}/call-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to log call');
      }

      toast({ title: 'Call Logged', description: getSuccessMessage() });
      resetForm();
      onOpenChange(false);
      onSuccess();

    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to log call', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  function getSuccessMessage() {
    switch (callOutcome) {
      case 'connected_positive': return 'Lead marked as interested';
      case 'connected_callback': return 'Callback scheduled';
      case 'not_connected': return 'Retry call scheduled';
      case 'not_interested': return 'Lead closed';
      default: return 'Call logged successfully';
    }
  }

  function resetForm() {
    setCallOutcome('');
    setCallDuration('');
    setNotes('');
    setCallbackOption('');
    setCustomCallbackDate('');
    setRejectionReason('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Call - {lead.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">{lead.phone}</p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Call Outcome Buttons */}
          <div className="space-y-2">
            <Label>Call Outcome *</Label>
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

          {/* Call Duration */}
          <div className="space-y-2">
            <Label>Duration (seconds)</Label>
            <Input
              type="number"
              placeholder="e.g. 120"
              value={callDuration}
              onChange={(e) => setCallDuration(e.target.value)}
            />
          </div>

          {/* Quick Notes */}
          <div className="space-y-2">
            <Label>Quick Notes</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {quickNotes.map((note) => (
                <Button
                  key={note}
                  type="button"
                  size="sm"
                  variant={notes === note ? 'default' : 'outline'}
                  onClick={() => setNotes(note)}
                  className="h-7 text-xs"
                >
                  {note}
                </Button>
              ))}
            </div>
            <Textarea
              placeholder="Add custom notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Callback Options */}
          {(callOutcome === 'connected_callback' || callOutcome === 'not_connected') && (
            <div className="space-y-2 bg-blue-50 p-3 rounded-md border border-blue-100">
              <Label className="flex items-center gap-2 text-blue-900">
                <Clock className="h-4 w-4" />
                Schedule {callOutcome === 'connected_callback' ? 'Callback' : 'Retry'}
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {callbackOptions.map((option) => (
                  <Button
                    key={option.label}
                    type="button"
                    size="sm"
                    variant={callbackOption === option.label ? 'default' : 'outline'}
                    className={callbackOption === option.label ? 'bg-blue-600 hover:bg-blue-700' : 'bg-white'}
                    onClick={() => setCallbackOption(option.label)}
                  >
                    {option.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={callbackOption === 'custom' ? 'default' : 'outline'}
                  className={callbackOption === 'custom' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-white'}
                  onClick={() => setCallbackOption('custom')}
                >
                  Custom
                </Button>
              </div>
              {callbackOption === 'custom' && (
                <div className="mt-2">
                  <Input
                    type="datetime-local"
                    value={customCallbackDate}
                    onChange={(e) => setCustomCallbackDate(e.target.value)}
                    className="bg-white"
                  />
                </div>
              )}
            </div>
          )}

          {/* Rejection Reason */}
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
                  <SelectItem value="timing">Bad timing</SelectItem>
                  <SelectItem value="competitor">Chose competitor</SelectItem>
                  <SelectItem value="not_buying">Not in market</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!callOutcome || submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Log Call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}