import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useAuth, usePermissions } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Lock, FileText, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const UNITS = { 'L': 100000, 'Cr': 10000000, 'K': 1000 };

export function EditLeadDialog({ lead, open, onOpenChange, onSuccess }: any) {
  const { token } = useAuth();
  const { canAssignLeads } = usePermissions(); 
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const isLocked = !canAssignLeads; 

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '',
    budgetMin: '', budgetMax: '',
    preferredLocation: '', notes: '',
    temperature: 'warm', stage: 'new',
    agentNotes: '',
    interestLevel: 5,
    preferredPropertyType: 'apartment',
    nextFollowupAt: ''
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
        name: lead.name, email: lead.email || '', phone: lead.phone,
        budgetMin: lead.budgetMin ? (lead.budgetMin / multiplier).toString() : '',
        budgetMax: lead.budgetMax ? (lead.budgetMax / multiplier).toString() : '',
        preferredLocation: lead.preferredLocation || '',
        notes: lead.notes || '',
        temperature: lead.temperature, stage: lead.stage,
        agentNotes: lead.agentNotes || '',
        interestLevel: lead.interestLevel || 5,
        preferredPropertyType: lead.preferredPropertyType || 'apartment',
        nextFollowupAt: lead.nextFollowupAt ? new Date(lead.nextFollowupAt).toISOString().slice(0, 16) : ''
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
        name: formData.name, email: formData.email || null, phone: formData.phone,
        budgetMin: formData.budgetMin ? Number(formData.budgetMin) * multiplier : null,
        budgetMax: formData.budgetMax ? Number(formData.budgetMax) * multiplier : null,
        preferredLocation: formData.preferredLocation || null,
        notes: formData.notes || null,
        temperature: formData.temperature, stage: formData.stage,
        agentNotes: formData.agentNotes || null,
        interestLevel: formData.interestLevel,
        preferredPropertyType: formData.preferredPropertyType || null,
        nextFollowupAt: formData.nextFollowupAt ? new Date(formData.nextFollowupAt).toISOString() : null
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
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Lead 
            {isLocked && <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground"><Lock className="h-3 w-3 mr-1"/> Restricted View</Badge>}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div className="space-y-2"><Label>Name {isLocked && <Lock className="h-3 w-3 inline text-muted-foreground ml-1"/>}</Label><Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={isLocked} className={isLocked ? "bg-muted" : "bg-white"} /></div>
            <div className="space-y-2"><Label>Phone {isLocked && <Lock className="h-3 w-3 inline text-muted-foreground ml-1"/>}</Label><Input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} disabled={isLocked} className={isLocked ? "bg-muted" : "bg-white"} /></div>
            <div className="space-y-2"><Label>Email {isLocked && <Lock className="h-3 w-3 inline text-muted-foreground ml-1"/>}</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} disabled={isLocked} className={isLocked ? "bg-muted" : "bg-white"} /></div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">Budget {isLocked && <Lock className="h-3 w-3 inline text-muted-foreground"/>}</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="Min" value={formData.budgetMin} onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value })} disabled={isLocked} className={isLocked ? "bg-muted" : "bg-white"} />
                <Input type="number" placeholder="Max" value={formData.budgetMax} onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value })} disabled={isLocked} className={isLocked ? "bg-muted" : "bg-white"} />
                <Select value={budgetUnit} onValueChange={(val: any) => setBudgetUnit(val)} disabled={isLocked}>
                  <SelectTrigger className={`w-[100px] ${isLocked ? "bg-muted" : "bg-white"}`}><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="L">Lakhs</SelectItem><SelectItem value="Cr">Crores</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2 col-span-2">
              <Label>Location {isLocked && <Lock className="h-3 w-3 inline text-muted-foreground ml-1"/>}</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className={`pl-9 ${isLocked ? "bg-muted" : "bg-white"}`} value={formData.preferredLocation} onChange={(e) => setFormData({ ...formData, preferredLocation: e.target.value })} disabled={isLocked} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-blue-600 font-semibold">Stage</Label>
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
              <Label className="text-amber-600 font-semibold">Temperature</Label>
              <Select value={formData.temperature} onValueChange={(val) => setFormData({ ...formData, temperature: val })}>
                <SelectTrigger className="border-amber-200 bg-amber-50/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="hot">🔥 Hot (Ready)</SelectItem>
                    <SelectItem value="warm">⛅ Warm (Interested)</SelectItem>
                    <SelectItem value="cold">❄️ Cold (Browsing)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* New Agent Fields */}
          <div className="space-y-4 p-4 rounded-lg border border-blue-100 bg-blue-50/30">
             <h4 className="font-semibold text-sm text-blue-800 flex items-center gap-2"><FileText className="h-4 w-4"/> Agent Workspace</h4>
             
             <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label>Follow-up Scheduler</Label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="datetime-local" className="pl-9 bg-white" value={formData.nextFollowupAt} onChange={e => setFormData({...formData, nextFollowupAt: e.target.value})} />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <Label>Property Preference</Label>
                    <div className="flex gap-2">
                        {['apartment', 'villa', 'plot'].map(type => (
                            <Badge 
                                key={type} 
                                variant={formData.preferredPropertyType === type ? 'default' : 'outline'} 
                                className={`cursor-pointer capitalize px-3 py-1.5 ${formData.preferredPropertyType === type ? 'bg-blue-600' : 'bg-white'}`}
                                onClick={() => setFormData({...formData, preferredPropertyType: type})}
                            >
                                {type}
                            </Badge>
                        ))}
                    </div>
                 </div>
             </div>

             <div className="space-y-4 pt-2">
                 <div className="flex justify-between items-center">
                    <Label>Interest Level Score (1-10)</Label>
                    <span className="font-bold text-blue-600">{formData.interestLevel}/10</span>
                 </div>
                 <Slider value={[formData.interestLevel]} onValueChange={(val) => setFormData({...formData, interestLevel: val[0]})} max={10} min={1} step={1} />
             </div>

             <div className="space-y-2">
                <Label>Your Private Notes</Label>
                <Textarea className="bg-white border-blue-200" placeholder="These notes are for you to track context..." value={formData.agentNotes} onChange={e => setFormData({...formData, agentNotes: e.target.value})} />
             </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center justify-between">
                <span>Admin Requirements</span>
                {isLocked && <Badge variant="secondary" className="text-[10px] px-1 h-5"><Lock className="h-3 w-3 mr-1"/> Read Only</Badge>}
            </Label>
            <Textarea 
                value={formData.notes} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
                disabled={isLocked}
                className={isLocked ? "bg-amber-50 text-amber-900 border-amber-200 resize-none cursor-not-allowed" : "bg-white"}
                placeholder="Admin instructions..."
            />
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