import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin } from 'lucide-react';
import { Lead } from '@/pages/Leads';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const UNITS = {
  'L': 100000,
  'Cr': 10000000,
  'K': 1000
};

interface EditLeadDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditLeadDialog({ lead, open, onOpenChange, onSuccess }: EditLeadDialogProps) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    budgetMin: '',
    budgetMax: '',
    preferredLocation: '',
    notes: '',
    temperature: 'warm',
    stage: 'new'
  });

  const [budgetUnit, setBudgetUnit] = useState<'L' | 'Cr' | 'K'>('L');

  // Load Lead Data when opened
  useEffect(() => {
    if (lead && open) {
      // 1. Determine Unit based on Min Budget (default to L if null)
      let unit: 'L' | 'Cr' | 'K' = 'L';
      const refValue = lead.budgetMin || lead.budgetMax || 0;
      
      if (refValue >= 10000000) unit = 'Cr';
      else if (refValue >= 100000) unit = 'L';
      else if (refValue >= 1000) unit = 'K';

      setBudgetUnit(unit);
      const multiplier = UNITS[unit];

      setFormData({
        name: lead.name,
        email: lead.email || '',
        phone: lead.phone,
        budgetMin: lead.budgetMin ? (lead.budgetMin / multiplier).toString() : '',
        budgetMax: lead.budgetMax ? (lead.budgetMax / multiplier).toString() : '',
        preferredLocation: lead.preferredLocation || '',
        notes: lead.notes || '',
        temperature: lead.temperature,
        stage: lead.stage
      });
    }
  }, [lead, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !token) return;

    setSubmitting(true);
    try {
      const multiplier = UNITS[budgetUnit];

      const payload = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone,
        budgetMin: formData.budgetMin ? Number(formData.budgetMin) * multiplier : null,
        budgetMax: formData.budgetMax ? Number(formData.budgetMax) * multiplier : null,
        preferredLocation: formData.preferredLocation || null,
        notes: formData.notes || null,
        temperature: formData.temperature,
        stage: formData.stage
      };

      const res = await fetch(`${API_URL}/leads/${lead.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to update lead');

      toast({ title: 'Success', description: 'Lead updated successfully' });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update lead', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
             <div className="space-y-2">
              <Label>Temperature</Label>
              <Select value={formData.temperature} onValueChange={(val) => setFormData({ ...formData, temperature: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="hot">Hot (Ready to buy)</SelectItem>
                    <SelectItem value="warm">Warm (Interested)</SelectItem>
                    <SelectItem value="cold">Cold (Just browsing)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Budget */}
          <div className="space-y-2">
            <Label>Budget Range ({budgetUnit})</Label>
            <div className="flex gap-2">
              <Input 
                type="number" 
                placeholder="Min" 
                value={formData.budgetMin} 
                onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value })} 
              />
              <Input 
                type="number" 
                placeholder="Max" 
                value={formData.budgetMax} 
                onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value })} 
              />
              <Select value={budgetUnit} onValueChange={(val: any) => setBudgetUnit(val)}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Lakhs</SelectItem>
                  <SelectItem value="Cr">Crores</SelectItem>
                  <SelectItem value="K">Thousands</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label>Preferred Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                className="pl-9" 
                value={formData.preferredLocation} 
                onChange={(e) => setFormData({ ...formData, preferredLocation: e.target.value })} 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}