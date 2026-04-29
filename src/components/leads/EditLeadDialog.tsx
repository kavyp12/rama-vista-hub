import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, usePermissions } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Lock, FileText, Calendar, History, Phone, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { getPhoneInfo } from '@/lib/utils';
import { CountryCodeSelect } from '@/components/ui/CountryCodeSelect';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const UNITS = { 'L': 100000, 'Cr': 10000000, 'K': 1000 };

export function EditLeadDialog({ lead, open, onOpenChange, onSuccess }: any) {
  const { token } = useAuth();
  const { canAssignLeads } = usePermissions(); 
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // History State
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const isLocked = !canAssignLeads; 

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '',
    budgetMin: '', budgetMax: '',
    preferredLocation: '', 
    notes: '',
    agentNotes: '',
    adminNotes: '', // 👈 ADD THIS HERE
    temperature: 'warm', stage: 'new',
    interestLevel: 5,
    preferredPropertyType: 'apartment',
    nextFollowupAt: '',
    agentNextFollowupAt: ''
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
        agentNotes: lead.agentNotes || '',
        adminNotes: lead.adminNotes || '', // 👈 ADD THIS HERE
        temperature: lead.temperature, stage: lead.stage,
        interestLevel: lead.interestLevel || 5,
        preferredPropertyType: lead.preferredPropertyType || 'apartment',
        nextFollowupAt: lead.nextFollowupAt ? new Date(lead.nextFollowupAt).toISOString().slice(0, 16) : '',
        agentNextFollowupAt: lead.agentNextFollowupAt ? new Date(lead.agentNextFollowupAt).toISOString().slice(0, 16) : ''
      });
      // Fetch history when dialog opens
      fetchHistory();
    }
  }, [lead, open]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_URL}/call-logs?leadId=${lead.id}&take=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setHistoryLogs(data);
    } catch (e) {
      console.error("Failed to fetch history");
    } finally {
      setLoadingHistory(false);
    }
  };

 async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !token) return;
    setSubmitting(true);
    try {
      const multiplier = UNITS[budgetUnit];
      
      const payload: any = {
        budgetMin: formData.budgetMin ? Number(formData.budgetMin) * multiplier : null,
        budgetMax: formData.budgetMax ? Number(formData.budgetMax) * multiplier : null,
        preferredLocation: formData.preferredLocation || null,
        notes: formData.notes || null,
        agentNotes: formData.agentNotes || null,
        temperature: formData.temperature, stage: formData.stage,
        interestLevel: formData.interestLevel,
        preferredPropertyType: formData.preferredPropertyType || null
      };
      if (!isLocked) {
        payload.name = formData.name;
        payload.email = formData.email || null;
        payload.phone = formData.phone;
      }

      // Handle Role-based Follow ups
      if (canAssignLeads && formData.nextFollowupAt) {
        payload.nextFollowupAt = new Date(formData.nextFollowupAt).toISOString();
      }
      if (formData.agentNextFollowupAt) {
         payload.agentNextFollowupAt = new Date(formData.agentNextFollowupAt).toISOString();
      }

      const res = await fetch(`${API_URL}/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to update');
      
      // ✅ Fetch the updated interaction history immediately before closing!
      await fetchHistory();
      
      toast({ title: 'Success', description: 'Lead updated successfully' });
      onOpenChange(false);
      onSuccess();
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setSubmitting(false); }
  }

  async function handleCompleteFollowUp(field: 'admin' | 'agent') {
    if (!lead || !token) return;
    try {
      const res = await fetch(`${API_URL}/leads/${lead.id}/complete-followup`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed');
      // Clear the field in form state immediately
      if (field === 'admin') setFormData(f => ({ ...f, nextFollowupAt: '' }));
      else setFormData(f => ({ ...f, agentNextFollowupAt: '' }));
      toast({ title: '✅ Follow-up cleared', description: 'Marked as done and removed.' });
      onSuccess();
    } catch {
      toast({ title: 'Error', description: 'Could not complete follow-up.', variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2">
            Lead Workspace: {lead?.name}
            {isLocked && <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground"><Lock className="h-3 w-3 mr-1"/> Restricted View</Badge>}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
          <div className="px-6 border-b bg-slate-50/50">
            <TabsList className="bg-transparent">
              <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none shadow-none">Lead Details</TabsTrigger>
              <TabsTrigger value="history" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none shadow-none">
                <History className="h-4 w-4" /> Interaction History
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            
            {/* ─── TAB 1: DETAILS & SCHEDULING ─── */}
            <TabsContent value="details" className="m-0">
              <form id="lead-form" onSubmit={handleSubmit} className="space-y-6">
                
                {/* Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <div className="space-y-2"><Label>Name {isLocked && <Lock className="h-3 w-3 inline text-muted-foreground ml-1"/>}</Label><Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={isLocked} className={isLocked ? "bg-muted" : "bg-white"} /></div>
                  <div className="space-y-2">
                    <Label>Phone {isLocked && <Lock className="h-3 w-3 inline text-muted-foreground ml-1"/>}</Label>
                    <div className="flex">
                      <CountryCodeSelect
                        value={getPhoneInfo(formData.phone).code}
                        onChange={(newCode) => {
                          const currentNationalInfo = getPhoneInfo(formData.phone).nationalNumber;
                          setFormData({ ...formData, phone: newCode + currentNationalInfo });
                        }}
                        disabled={isLocked}
                      />
                      <Input
                        required
                        type="tel"
                        className={`rounded-l-none ${isLocked ? "bg-muted" : "bg-white"}`}
                        value={getPhoneInfo(formData.phone).nationalNumber}
                        onChange={(e) => {
                          const currentCode = getPhoneInfo(formData.phone).code;
                          const cleanNumber = e.target.value.replace(/\D/g, '');
                          setFormData({ ...formData, phone: currentCode + cleanNumber });
                        }}
                        disabled={isLocked}
                      />
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Email {isLocked && <Lock className="h-3 w-3 inline text-muted-foreground ml-1"/>}</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} disabled={isLocked} className={isLocked ? "bg-muted" : "bg-white"} /></div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">Budget {isLocked && <Lock className="h-3 w-3 inline text-muted-foreground"/>}</Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input type="number" placeholder="Min" value={formData.budgetMin} onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value })} disabled={isLocked} className={isLocked ? "bg-muted" : "bg-white"} />
                      <Input type="number" placeholder="Max" value={formData.budgetMax} onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value })} disabled={isLocked} className={isLocked ? "bg-muted" : "bg-white"} />
                      <Select value={budgetUnit} onValueChange={(val: any) => setBudgetUnit(val)} disabled={isLocked}>
                        <SelectTrigger className={`w-full sm:w-[100px] shrink-0 ${isLocked ? "bg-muted" : "bg-white"}`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="L">Lakhs</SelectItem><SelectItem value="Cr">Crores</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Location {isLocked && <Lock className="h-3 w-3 inline text-muted-foreground ml-1"/>}</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input className={`pl-9 ${isLocked ? "bg-muted" : "bg-white"}`} value={formData.preferredLocation} onChange={(e) => setFormData({ ...formData, preferredLocation: e.target.value })} disabled={isLocked} />
                    </div>
                  </div>
                </div>

                {/* Stage & Temperature */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-blue-600 font-semibold">Stage</Label>
                    <Select value={formData.stage} onValueChange={(val) => setFormData({ ...formData, stage: val })}>
                      <SelectTrigger className="border-blue-200 bg-blue-50/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="not_connected">Not connected</SelectItem>
                          <SelectItem value="call_back_required">Call back required</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="site_visit">Site Visit</SelectItem>
                          <SelectItem value="site_visit_done">Site visit done</SelectItem>
                          <SelectItem value="re_visit">Re visit</SelectItem>
                          <SelectItem value="re_visit_done">Re visit done</SelectItem>
                          <SelectItem value="negotiation">Negotiation</SelectItem>
                          <SelectItem value="token">Token Received</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                          <SelectItem value="disconnected">Disconnected</SelectItem> {/* <-- ADD THIS */}
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

                {/* ─── ROLE-BASED FOLLOW UP SCHEDULER ─── */}
                <div className="space-y-4 p-4 rounded-lg border border-blue-100 bg-blue-50/30">
                  <h4 className="font-semibold text-sm text-blue-800 flex items-center gap-2"><FileText className="h-4 w-4"/> Follow-up & Planning</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {canAssignLeads ? (
                      <>
                        <div className="space-y-2">
                          <Label className="flex items-center justify-between">
                            <span>Admin / Telecaller Follow-up</span>
                            {formData.nextFollowupAt && (
                              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-green-700 hover:bg-green-50" onClick={() => handleCompleteFollowUp('admin')}>
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Done
                              </Button>
                            )}
                          </Label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input type="datetime-local" className="pl-9 bg-white" value={formData.nextFollowupAt} onChange={e => setFormData({...formData, nextFollowupAt: e.target.value})} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-blue-600">Agent's Personal Follow-up</Label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-blue-400" />
                            <Input type="datetime-local" className="pl-9 bg-slate-100 cursor-not-allowed text-muted-foreground border-blue-200" value={formData.agentNextFollowupAt} readOnly title="Only the assigned agent can change their personal follow-up" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2 sm:col-span-2">
                        <Label className="flex items-center justify-between">
                          <span className="text-blue-700 font-semibold">Your Personal Follow-up</span>
                          {formData.agentNextFollowupAt && (
                            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-green-700 hover:bg-green-50" onClick={() => handleCompleteFollowUp('agent')}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Done
                            </Button>
                          )}
                        </Label>
                        <p className="text-[10px] text-blue-600 mb-1">This is your private schedule, separate from the main telecalling pipeline.</p>
                        <div className="relative max-w-[50%]">
                          <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-blue-600" />
                          <Input type="datetime-local" className="pl-9 bg-white border-blue-300" value={formData.agentNextFollowupAt} onChange={e => setFormData({...formData, agentNextFollowupAt: e.target.value})} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 pt-2">
                      <div className="flex justify-between items-center">
                          <Label>Interest Level Score (1-10)</Label>
                          <span className="font-bold text-blue-600">{formData.interestLevel}/10</span>
                      </div>
                      <Slider value={[formData.interestLevel]} onValueChange={(val) => setFormData({...formData, interestLevel: val[0]})} max={10} min={1} step={1} />
                  </div>
                </div>

                {/* ─── ROW 1: PRIVATE NOTES ─── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  
                  {/* 1. AGENT'S PRIVATE NOTE (Admin can read, Agent can write) */}
                  <div className="space-y-2">
                    <Label className="flex items-center justify-between">
                       <span className="text-blue-800">Agent's Private Notes</span>
                       {canAssignLeads && <Badge variant="secondary" className="text-[10px] px-1 h-5"><Lock className="h-3 w-3 mr-1"/> Read Only</Badge>}
                    </Label>
                    <Textarea 
                      className={`border-blue-200 ${canAssignLeads ? 'bg-slate-50 text-slate-500 cursor-not-allowed resize-none' : 'bg-white'}`} 
                      placeholder={canAssignLeads ? "Agent hasn't added notes..." : "These notes are for you to track context..."} 
                      value={formData.agentNotes} 
                      onChange={e => setFormData({...formData, agentNotes: e.target.value})} 
                      disabled={canAssignLeads} 
                    />
                  </div>

                  {/* 2. ADMIN'S PRIVATE NOTE (Agent can read, Admin can write) */}
                  <div className="space-y-2">
                    <Label className="flex items-center justify-between">
                        <span className="text-purple-800">Admin's Private Notes</span>
                        {isLocked && <Badge variant="secondary" className="text-[10px] px-1 h-5"><Lock className="h-3 w-3 mr-1"/> Read Only</Badge>}
                    </Label>
                    <Textarea 
                        value={formData.adminNotes} 
                        onChange={e => setFormData({...formData, adminNotes: e.target.value})} 
                        disabled={isLocked} 
                        className={`border-purple-200 ${isLocked ? "bg-slate-50 text-slate-500 cursor-not-allowed resize-none" : "bg-white"}`}
                        placeholder={isLocked ? "Admin hasn't added private notes..." : "Your private admin notes..."}
                    />
                  </div>
                  
                </div>

                {/* ─── ROW 2: ADMIN REQUIREMENTS ─── */}
                <div className="space-y-2 pt-2">
                  <Label className="flex items-center justify-between">
                      <span>Admin Requirements & Instructions</span>
                      {isLocked && <Badge variant="secondary" className="text-[10px] px-1 h-5"><Lock className="h-3 w-3 mr-1"/> Read Only</Badge>}
                  </Label>
                  <Textarea 
                      value={formData.notes} 
                      onChange={e => setFormData({...formData, notes: e.target.value})} 
                      disabled={isLocked} 
                      className={isLocked ? "bg-amber-50 text-amber-900 border-amber-200 resize-none cursor-not-allowed" : "bg-white"}
                      placeholder={canAssignLeads ? "Add instructions or requirements for the agent here..." : "No instructions from admin yet..."}
                      rows={2}
                  />
                </div>
              </form>
            </TabsContent>

            {/* ─── TAB 2: INTERACTION HISTORY ─── */}
            <TabsContent value="history" className="m-0">
              {loadingHistory ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : historyLogs.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm border border-dashed rounded-lg bg-slate-50">
                  No previous conversations or follow-ups recorded yet.
                </div>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                  {historyLogs.map((log: any) => (
                    <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                        {log.callStatus === 'connected_positive' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Phone className="h-5 w-5 text-blue-500" />}
                      </div>
                      
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border bg-white shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm capitalize">{log.callStatus.replace('_', ' ')}</span>
                          <span className="text-xs text-muted-foreground">{format(new Date(log.callDate), 'MMM d, h:mm a')}</span>
                        </div>
                        {log.notes && <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded">{log.notes}</p>}
                        {log.agent && <p className="text-[10px] text-muted-foreground mt-2 text-right font-medium">- Logged by {log.agent.fullName}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>

          <div className="p-4 border-t bg-slate-50 flex justify-end gap-2 shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" form="lead-form" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}