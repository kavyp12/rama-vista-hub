import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth, usePermissions } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Lock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Lead } from '@/pages/Leads';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const UNITS = { 'L': 100000, 'Cr': 10000000, 'K': 1000 };

interface EditLeadDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditLeadDialog({ lead, open, onOpenChange, onSuccess }: EditLeadDialogProps) {
  const { user, token } = useAuth();
  const { canAssignLeads } = usePermissions(); // True for Admin/Manager, False for Agent
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // ✅ LOGIC: If user cannot assign leads, they are an Agent -> Lock critical fields
  const isLocked = !canAssignLeads; 

  // Form State
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '',
    budgetMin: '', budgetMax: '',
    preferredLocation: '', notes: '',
    temperature: 'warm', stage: 'new'
  });

  const [budgetUnit, setBudgetUnit] = useState<'L' | 'Cr' | 'K'>('L');

  useEffect(() => {
    if (lead && open) {
      let unit: 'L' | 'Cr' | 'K' = 'L';
      const refValue = lead.budgetMin || lead.budgetMax || 0;
      if (refValue >= 10000000) unit = 'Cr';
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
      
      // Even if locked in UI, we should send the values to backend.
      // Ideally backend also validates, but this frontend check prevents user confusion.
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to update');
      toast({ title: 'Success', description: 'Lead updated successfully' });
      onOpenChange(false);
      onSuccess();
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Lead 
            {isLocked && <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground"><Lock className="h-3 w-3 mr-1"/> Restricted View</Badge>}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name {isLocked && <Lock className="h-3 w-3 inline text-muted-foreground ml-1"/>}</Label>
              <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={isLocked} className={isLocked ? "bg-muted" : ""} />
            </div>
            
            {/* STAGE IS ALWAYS EDITABLE */}
            <div className="space-y-2">
              <Label className="text-blue-600 font-semibold">Stage (Editable)</Label>
              <Select value={formData.stage} onValueChange={(val) => setFormData({ ...formData, stage: val })}>
                <SelectTrigger className="border-blue-200 bg-blue-50/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="site_visit">Site Visit</SelectItem>
                    <SelectItem value="negotiation">Negotiation</SelectItem>
                    <SelectItem value="token">Token Received</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Phone {isLocked && <Lock className="h-3 w-3 inline text-muted-foreground ml-1"/>}</Label>
              <Input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} disabled={isLocked} className={isLocked ? "bg-muted" : ""} />
            </div>
            <div className="space-y-2">
              <Label>Email {isLocked && <Lock className="h-3 w-3 inline text-muted-foreground ml-1"/>}</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} disabled={isLocked} className={isLocked ? "bg-muted" : ""} />
            </div>
          </div>

          <div className="space-y-2">
              <Label className="text-blue-600 font-semibold">Temperature (Editable)</Label>
              <Select value={formData.temperature} onValueChange={(val) => setFormData({ ...formData, temperature: val })}>
                <SelectTrigger className="border-blue-200 bg-blue-50/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="hot">🔥 Hot (Ready)</SelectItem>
                    <SelectItem value="warm">⛅ Warm (Interested)</SelectItem>
                    <SelectItem value="cold">❄️ Cold (Browsing)</SelectItem>
                </SelectContent>
              </Select>
          </div>

          {/* Budget - Locked for Agents */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
                Budget Range 
                {isLocked && <span className="text-xs text-muted-foreground flex items-center"><Lock className="h-3 w-3 mr-1"/> Admin Set</span>}
            </Label>
            <div className="flex gap-2">
              <Input type="number" placeholder="Min" value={formData.budgetMin} onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value })} disabled={isLocked} className={isLocked ? "bg-muted" : ""} />
              <Input type="number" placeholder="Max" value={formData.budgetMax} onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value })} disabled={isLocked} className={isLocked ? "bg-muted" : ""} />
              <Select value={budgetUnit} onValueChange={(val: any) => setBudgetUnit(val)} disabled={isLocked}>
                <SelectTrigger className={`w-[100px] ${isLocked ? "bg-muted" : ""}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Lakhs</SelectItem>
                  <SelectItem value="Cr">Crores</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location - Locked for Agents */}
          <div className="space-y-2">
            <Label>Preferred Location {isLocked && <Lock className="h-3 w-3 inline text-muted-foreground ml-1"/>}</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                className={`pl-9 ${isLocked ? "bg-muted" : ""}`} 
                value={formData.preferredLocation} 
                onChange={(e) => setFormData({ ...formData, preferredLocation: e.target.value })} 
                disabled={isLocked}
              />
            </div>
          </div>

          {/* Notes - Locked for Agents (Critical Change) */}
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
                <span>Admin Notes / Requirements</span>
                {isLocked && <Badge variant="secondary" className="text-[10px] px-1 h-5"><Lock className="h-3 w-3 mr-1"/> Read Only</Badge>}
            </Label>
            <Textarea 
                value={formData.notes} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
                disabled={isLocked} // ✅ LOCKED
                className={isLocked ? "bg-amber-50 text-amber-900 border-amber-200 resize-none cursor-not-allowed" : ""}
                placeholder="Agent instructions..."
            />
            {isLocked && <p className="text-[10px] text-muted-foreground">Only Admins can edit requirements.</p>}
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