import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  { value: 'connected_positive', label: 'Interested', icon: ThumbsUp, color: 'bg-success hover:bg-success/90' },
  { value: 'connected_callback', label: 'Callback', icon: Calendar, color: 'bg-info hover:bg-info/90' },
  { value: 'not_connected', label: 'Busy / No Answer', icon: PhoneMissed, color: 'bg-warning hover:bg-warning/90' },
  { value: 'not_interested', label: 'Not Interested', icon: ThumbsDown, color: 'bg-destructive hover:bg-destructive/90' },
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
  const { user } = useAuth();
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
    if (!callOutcome || !user) return;

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

      // Create call log
      const { error: callError } = await supabase.from('call_logs').insert({
        lead_id: lead.id,
        agent_id: user.id,
        call_status: callOutcome as 'connected_positive' | 'connected_callback' | 'not_connected' | 'not_interested',
        call_duration: callDuration ? parseInt(callDuration) : null,
        notes: notes || null,
        callback_scheduled_at: callbackTime?.toISOString() || null,
        rejection_reason: rejectionReason || null,
      });

      if (callError) throw callError;

      // Handle outcome-specific actions
      if (callOutcome === 'connected_positive') {
        // Move lead to next stage
        const stages = ['new', 'contacted', 'site_visit', 'negotiation', 'token', 'closed'];
        const currentIndex = stages.indexOf(lead.stage);
        const nextStage = currentIndex < stages.length - 2 ? stages[currentIndex + 1] : lead.stage;
        
        await supabase.from('leads').update({ 
          stage: nextStage as 'new' | 'contacted' | 'site_visit' | 'negotiation' | 'token' | 'closed',
          temperature: 'hot' as const,
          last_contacted_at: new Date().toISOString()
        }).eq('id', lead.id);

      } else if (callOutcome === 'connected_callback' || callOutcome === 'not_connected') {
        // Create follow-up task
        if (callbackTime) {
          await supabase.from('follow_up_tasks').insert({
            lead_id: lead.id,
            agent_id: user.id,
            task_type: callOutcome === 'connected_callback' ? 'callback' : 'retry_call',
            scheduled_at: callbackTime.toISOString(),
            notes: notes || (callOutcome === 'not_connected' ? 'Auto-scheduled retry' : null),
          });
        }
        
        await supabase.from('leads').update({ 
          last_contacted_at: new Date().toISOString(),
          next_followup_at: callbackTime?.toISOString()
        }).eq('id', lead.id);

      } else if (callOutcome === 'not_interested') {
        await supabase.from('leads').update({ 
          stage: 'closed',
          notes: `Closed - ${rejectionReason || 'Not interested'}`,
          last_contacted_at: new Date().toISOString()
        }).eq('id', lead.id);
      }

      toast({ title: 'Call Logged', description: getSuccessMessage() });
      resetForm();
      onOpenChange(false);
      onSuccess();

    } catch (error) {
      toast({ title: 'Error', description: 'Failed to log call', variant: 'destructive' });
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
                    variant={callOutcome === outcome.value ? 'default' : 'outline'}
                    className={`justify-start gap-2 ${callOutcome === outcome.value ? outcome.color : ''}`}
                    onClick={() => setCallOutcome(outcome.value)}
                  >
                    <Icon className="h-4 w-4" />
                    {outcome.label}
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
            <div className="flex flex-wrap gap-2">
              {quickNotes.map((note) => (
                <Button
                  key={note}
                  type="button"
                  size="sm"
                  variant={notes === note ? 'default' : 'outline'}
                  onClick={() => setNotes(note)}
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
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Schedule {callOutcome === 'connected_callback' ? 'Callback' : 'Retry'}
              </Label>
              <div className="flex flex-wrap gap-2">
                {callbackOptions.map((option) => (
                  <Button
                    key={option.label}
                    type="button"
                    size="sm"
                    variant={callbackOption === option.label ? 'default' : 'outline'}
                    onClick={() => setCallbackOption(option.label)}
                  >
                    {option.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={callbackOption === 'custom' ? 'default' : 'outline'}
                  onClick={() => setCallbackOption('custom')}
                >
                  Custom
                </Button>
              </div>
              {callbackOption === 'custom' && (
                <Input
                  type="datetime-local"
                  value={customCallbackDate}
                  onChange={(e) => setCustomCallbackDate(e.target.value)}
                />
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
