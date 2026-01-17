import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Lead {
  id: string;
  name: string;
}

interface ScheduleVisitDialogProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ScheduleVisitDialog({ lead, open, onOpenChange, onSuccess }: ScheduleVisitDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [properties, setProperties] = useState<{ id: string; title: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [agents, setAgents] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedProperty, setSelectedProperty] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [visitTime, setVisitTime] = useState('');
  const [assignedAgent, setAssignedAgent] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      fetchData();
      if (user) {
        setAssignedAgent(user.id);
      }
    }
  }, [open, user]);

  async function fetchData() {
    setLoading(true);
    const [propsRes, projsRes, profilesRes] = await Promise.all([
      supabase.from('properties').select('id, title').eq('status', 'available'),
      supabase.from('projects').select('id, name').eq('status', 'active'),
      supabase.from('profiles').select('id, full_name'),
    ]);

    if (propsRes.data) setProperties(propsRes.data);
    if (projsRes.data) setProjects(projsRes.data);
    if (profilesRes.data) setAgents(profilesRes.data);
    setLoading(false);
  }

  async function handleSubmit() {
    if (!visitDate || !visitTime || !user) return;

    setSubmitting(true);
    const scheduledAt = new Date(`${visitDate}T${visitTime}`).toISOString();

    const { error } = await supabase.from('site_visits').insert({
      lead_id: lead.id,
      property_id: selectedProperty || null,
      project_id: selectedProject || null,
      scheduled_at: scheduledAt,
      conducted_by: assignedAgent || user.id,
      status: 'scheduled',
      feedback: notes || null,
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to schedule visit', variant: 'destructive' });
    } else {
      // Update lead stage to site_visit if not already past that
      await supabase.from('leads')
        .update({ stage: 'site_visit' })
        .eq('id', lead.id)
        .in('stage', ['new', 'contacted']);

      toast({ title: 'Success', description: `Site visit scheduled for ${lead.name}` });
      resetForm();
      onOpenChange(false);
      onSuccess();
    }
    setSubmitting(false);
  }

  function resetForm() {
    setSelectedProperty('');
    setSelectedProject('');
    setVisitDate('');
    setVisitTime('');
    setNotes('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Site Visit - {lead.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label>Time *</Label>
              <Input
                type="time"
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Property</Label>
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger>
                <SelectValue placeholder="Select property (optional)" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((prop) => (
                  <SelectItem key={prop.id} value={prop.id}>{prop.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder="Select project (optional)" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((proj) => (
                  <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assigned Agent</Label>
            <Select value={assignedAgent} onValueChange={setAssignedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>{agent.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Any special instructions or notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!visitDate || !visitTime || submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Schedule Visit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
