// Payments.tsx

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import {
  CreditCard, Search, Plus, CheckCircle, Clock, XCircle,
  AlertCircle, Bell, Receipt, Calendar, TrendingUp, IndianRupee, Pencil,
  ArrowRight, History, Columns, List
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList
} from '@/components/ui/command';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ==================== PIPELINE CONFIG ====================

const PIPELINE_STAGES = [
  { key: 'token',        label: 'Token',          color: '#7F77DD', bg: '#EEEDFE', text: '#3C3489' },
  { key: 'check',        label: 'Check Received', color: '#378ADD', bg: '#E6F1FB', text: '#0C447C' },
  { key: 'agreement',   label: 'Agreement',      color: '#BA7517', bg: '#FAEEDA', text: '#633806' },
  { key: 'registration', label: 'Registration',   color: '#0F6E56', bg: '#E1F5EE', text: '#085041' },
  { key: 'possession',  label: 'Possession',     color: '#993C1D', bg: '#FAECE7', text: '#4A1B0C' },
  { key: 'closed',      label: 'Closed',         color: '#3B6D11', bg: '#EAF3DE', text: '#173404' },
] as const;

type PipelineStageKey = typeof PIPELINE_STAGES[number]['key'];

function getStageConfig(key: string | null | undefined) {
  return PIPELINE_STAGES.find(s => s.key === key) || null;
}

// ==================== INTERFACES ====================

interface StageHistoryEntry {
  id: string;
  stage: PipelineStageKey;
  previousStage: PipelineStageKey | null;
  changedById: string;
  changedBy: { id: string; name: string; role: string };
  notes: string | null;
  changedAt: string;
}

interface Payment {
  id: string;
  amount: number;
  paymentType: string;
  paymentMethod: string | null;
  status: string;
  pipelineStage: PipelineStageKey | null;
  dueDate: string | null;
  paidAt: string | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
  referenceNumber: string | null;
  notes: string | null;
  lead?: { id: string; name: string; phone: string; assignedTo?: string };
  property?: { id: string; title: string };
  deal?: { id: string; dealValue: number };
  stageHistory?: StageHistoryEntry[];
  createdAt: string;
}

interface PaymentScheduleForm {
  dealId: string;
  leadId: string;
  propertyId: string;
  totalAmount: string;
  bookingAmount: string;
  installments: Array<{ amount: string; dueDate: string; description: string }>;
}

// ==================== STATUS CONFIG ====================

const statusConfig = {
  pending:   { color: 'bg-yellow-500', icon: Clock,        label: 'Pending' },
  completed: { color: 'bg-green-500',  icon: CheckCircle,  label: 'Completed' },
  failed:    { color: 'bg-red-500',    icon: XCircle,      label: 'Failed' },
  refunded:  { color: 'bg-purple-500', icon: AlertCircle,  label: 'Refunded' },
  overdue:   { color: 'bg-orange-500', icon: AlertCircle,  label: 'Overdue' },
};

// ==================== SUBCOMPONENTS ====================

function StageBadge({ stage }: { stage: string | null | undefined }) {
  const config = getStageConfig(stage);
  if (!config) return (
    <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full border border-dashed">
      No Stage
    </span>
  );
  return (
    <span
      className="text-xs font-medium px-2.5 py-0.5 rounded-full"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  );
}

function StageTimeline({ history }: { history: StageHistoryEntry[] }) {
  if (!history || history.length === 0) {
    return <p className="text-sm text-muted-foreground">No stage changes recorded yet.</p>;
  }
  return (
    <div className="space-y-3">
      {history.map((entry, i) => {
        const stageConfig = getStageConfig(entry.stage);
        const prevConfig = getStageConfig(entry.previousStage);
        return (
          <div key={entry.id} className="flex gap-3 items-start">
            <div className="flex flex-col items-center">
              <div
                className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                style={{ backgroundColor: stageConfig?.color || '#888' }}
              />
              {i < history.length - 1 && (
                <div className="w-px flex-1 bg-border mt-1 min-h-[20px]" />
              )}
            </div>
            <div className="pb-3 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {prevConfig && (
                  <>
                    <StageBadge stage={entry.previousStage} />
                    <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  </>
                )}
                <StageBadge stage={entry.stage} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                by <span className="font-medium text-foreground">{entry.changedBy.name}</span>
                {' · '}
                {format(new Date(entry.changedAt), 'MMM dd, yyyy hh:mm a')}
              </p>
              {entry.notes && (
                <p className="text-xs text-muted-foreground mt-0.5 italic">"{entry.notes}"</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PipelineStageSelector({
  currentStage,
  paymentId,
  onStageChange
}: {
  currentStage: PipelineStageKey | null;
  paymentId: string;
  onStageChange: (paymentId: string, stage: PipelineStageKey, notes?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedStage, setSelectedStage] = useState<PipelineStageKey | null>(null);

  function handleSelect(stageKey: PipelineStageKey) {
    setSelectedStage(stageKey);
  }

  function handleConfirm() {
    if (!selectedStage) return;
    onStageChange(paymentId, selectedStage, notes || undefined);
    setOpen(false);
    setNotes('');
    setSelectedStage(null);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <StageBadge stage={currentStage} />
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <p className="text-xs font-medium text-muted-foreground mb-2">Move to stage</p>
        <div className="flex flex-col gap-1 mb-3">
          {PIPELINE_STAGES.map(stage => (
            <button
              key={stage.key}
              onClick={() => handleSelect(stage.key)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors ${
                selectedStage === stage.key
                  ? 'bg-secondary'
                  : 'hover:bg-secondary/50'
              } ${currentStage === stage.key ? 'opacity-50' : ''}`}
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
              <span>{stage.label}</span>
              {currentStage === stage.key && (
                <span className="ml-auto text-xs text-muted-foreground">current</span>
              )}
            </button>
          ))}
        </div>
        {selectedStage && (
          <div className="space-y-2 border-t pt-2">
            <Textarea
              placeholder="Add a note (optional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="text-xs min-h-[60px] resize-none"
            />
            <Button size="sm" className="w-full text-xs h-7" onClick={handleConfirm}>
              Confirm Move
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ==================== MAIN COMPONENT ====================

export default function Payments() {
  const { token, user } = useAuth();
  const { toast } = useToast();

  const isAdmin = user?.role === 'admin' || (user?.role as string) === 'superadmin';

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'ledger' | 'pipeline'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Stage history dialog
  const [historyPayment, setHistoryPayment] = useState<Payment | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Payment Schedule Dialog
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);

  const [leadOpen, setLeadOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);

  const [scheduleForm, setScheduleForm] = useState<PaymentScheduleForm>({
    dealId: '', leadId: '', propertyId: '', totalAmount: '', bookingAmount: '',
    installments: [{ amount: '', dueDate: '', description: '' }]
  });

  // Record Payment Dialog
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [paymentToRecord, setPaymentToRecord] = useState<Payment | null>(null);
  const [recordForm, setRecordForm] = useState({
    paymentMethod: 'bank_transfer', referenceNumber: '', notes: '', receiptGenerate: true
  });

  // Edit Payment Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editForm, setEditForm] = useState({
    amount: '', status: '', dueDate: '', paymentMethod: '', referenceNumber: '', notes: ''
  });

  // Stats
  const [stats, setStats] = useState({
    totalPending: 0, totalCompleted: 0, overdueCount: 0, overdueAmount: 0
  });

  useEffect(() => {
    if (token) {
      fetchPayments();
      fetchLeadsAndDeals();
    }
  }, [token, filterStatus, filterStage, activeTab]);

  useEffect(() => { calculateStats(); }, [payments]);

  async function fetchLeadsAndDeals() {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [leadsRes, propsRes] = await Promise.all([
        fetch(`${API_URL}/leads`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/properties`, { headers }).then(r => r.json()),
      ]);
      if (Array.isArray(leadsRes)) {
        setLeads(leadsRes);
        setDeals(leadsRes.flatMap((lead: any) =>
          (lead.deals || []).map((deal: any) => ({
            id: deal.id, dealValue: deal.dealValue, stage: deal.stage,
            leadId: lead.id, leadName: lead.name, leadPhone: lead.phone
          }))
        ));
      }
      if (Array.isArray(propsRes)) setProperties(propsRes);
    } catch (err) {
      console.error('Failed to load options', err);
    }
  }

  async function fetchPayments() {
    setLoading(true);
    try {
      let url = `${API_URL}/payments`;
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterStage !== 'all') params.append('pipelineStage', filterStage);
      if (activeTab === 'overdue') params.append('overdueOnly', 'true');
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) setPayments(data);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
      toast({ title: 'Error', description: 'Failed to load payments', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function calculateStats() {
    const pending = payments.filter(p => p.status === 'pending');
    const completed = payments.filter(p => p.status === 'completed');
    const overdue = payments.filter(p =>
      p.status === 'pending' && p.dueDate && new Date(p.dueDate) < new Date()
    );
    setStats({
      totalPending: pending.reduce((sum, p) => sum + p.amount, 0),
      totalCompleted: completed.reduce((sum, p) => sum + p.amount, 0),
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((sum, p) => sum + p.amount, 0)
    });
  }

  async function handleStageChange(paymentId: string, stage: PipelineStageKey, notes?: string) {
    try {
      const res = await fetch(`${API_URL}/payments/${paymentId}/stage`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pipelineStage: stage, notes })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update stage');
      }

      const updated = await res.json();

      setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, ...updated } : p));

      const stageLabel = getStageConfig(stage)?.label || stage;
      toast({ title: 'Stage updated', description: `Moved to ${stageLabel}` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  }

  // Filtered payments
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.lead?.name?.toLowerCase().includes(q) ||
        p.property?.title?.toLowerCase().includes(q) ||
        p.referenceNumber?.toLowerCase().includes(q)
      );
    });
  }, [payments, searchQuery]);

  // Kanban grouped by stage
  const kanbanGroups = useMemo(() => {
    const groups: Record<string, Payment[]> = { unassigned: [] };
    for (const s of PIPELINE_STAGES) groups[s.key] = [];

    for (const p of filteredPayments) {
      const key = p.pipelineStage || 'unassigned';
      if (groups[key]) groups[key].push(p);
      else groups['unassigned'].push(p);
    }
    return groups;
  }, [filteredPayments]);

  function openEditDialog(payment: Payment) {
    setEditingPayment(payment);
    setEditForm({
      amount: payment.amount.toString(),
      status: payment.status,
      dueDate: payment.dueDate ? payment.dueDate.split('T')[0] : '',
      paymentMethod: payment.paymentMethod || '',
      referenceNumber: payment.referenceNumber || '',
      notes: payment.notes || ''
    });
    setIsEditDialogOpen(true);
  }

  async function handleUpdatePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPayment) return;
    try {
      const res = await fetch(`${API_URL}/payments/${editingPayment.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: parseFloat(editForm.amount),
          status: editForm.status,
          dueDate: editForm.dueDate || null,
          paymentMethod: editForm.paymentMethod || null,
          referenceNumber: editForm.referenceNumber || null,
          notes: editForm.notes || null
        })
      });
      if (!res.ok) throw new Error('Failed to update');
      const updated = await res.json();
      setPayments(prev => prev.map(p => p.id === editingPayment.id ? updated : p));
      setIsEditDialogOpen(false);
      toast({ title: 'Updated', description: 'Payment updated successfully' });
    } catch {
      toast({ title: 'Error', description: 'Failed to update payment', variant: 'destructive' });
    }
  }

  async function handleRecordPayment() {
    if (!paymentToRecord) return;
    try {
      const res = await fetch(`${API_URL}/payments/${paymentToRecord.id}/record`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(recordForm)
      });
      if (!res.ok) throw new Error('Failed to record');
      const { payment: updated } = await res.json();
      setPayments(prev => prev.map(p => p.id === paymentToRecord.id ? updated : p));
      setIsRecordDialogOpen(false);
      toast({ title: 'Payment recorded', description: 'Payment marked as completed' });
    } catch {
      toast({ title: 'Error', description: 'Failed to record payment', variant: 'destructive' });
    }
  }

  async function handleCreateSchedule(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/payments/schedule`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          leadId: scheduleForm.leadId,
          dealId: scheduleForm.dealId || null,
          propertyId: scheduleForm.propertyId || null,
          totalAmount: parseFloat(scheduleForm.totalAmount),
          bookingAmount: parseFloat(scheduleForm.bookingAmount),
          installments: scheduleForm.installments.map(i => ({
            amount: parseFloat(i.amount),
            dueDate: i.dueDate,
            description: i.description
          }))
        })
      });
      if (!res.ok) throw new Error('Failed to create schedule');
      await fetchPayments();
      setIsScheduleDialogOpen(false);
      toast({ title: 'Schedule created', description: 'Payment schedule created successfully' });
    } catch {
      toast({ title: 'Error', description: 'Failed to create schedule', variant: 'destructive' });
    }
  }

  // ==================== RENDER ====================

  return (
    <DashboardLayout title="Payments">
      <div className="space-y-6 p-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isAdmin ? 'All payments across all agents' : 'Your payments'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center border rounded-md p-0.5 bg-muted/20 mr-2">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
                List View
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs"
                onClick={() => setViewMode('kanban')}
              >
                <Columns className="h-4 w-4" />
                Pipeline View
              </Button>
            </div>

            <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  New Schedule
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Payment Schedule</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateSchedule} className="space-y-4 py-4">
                  {/* Lead selector */}
                  <div className="space-y-2">
                    <Label>Customer (Lead) *</Label>
                    <Popover open={leadOpen} onOpenChange={setLeadOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start font-normal">
                          {scheduleForm.leadId
                            ? leads.find(l => l.id === scheduleForm.leadId)?.name || 'Select lead'
                            : 'Select lead'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search lead..." />
                          <CommandList>
                            <CommandEmpty>No leads found.</CommandEmpty>
                            <CommandGroup>
                              {leads.map(lead => (
                                <CommandItem key={lead.id} onSelect={() => {
                                  setScheduleForm(f => ({ ...f, leadId: lead.id }));
                                  setLeadOpen(false);
                                }}>
                                  {lead.name} · {lead.phone}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Total Amount *</Label>
                      <Input
                        type="number"
                        placeholder="₹0"
                        value={scheduleForm.totalAmount}
                        onChange={e => setScheduleForm(f => ({ ...f, totalAmount: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Token / Booking Amount *</Label>
                      <Input
                        type="number"
                        placeholder="₹0"
                        value={scheduleForm.bookingAmount}
                        onChange={e => setScheduleForm(f => ({ ...f, bookingAmount: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Installments</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setScheduleForm(f => ({
                          ...f,
                          installments: [...f.installments, { amount: '', dueDate: '', description: '' }]
                        }))}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    {scheduleForm.installments.map((inst, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Amount"
                          className="flex-1 w-full"
                          value={inst.amount}
                          onChange={e => {
                            const arr = [...scheduleForm.installments];
                            arr[i].amount = e.target.value;
                            setScheduleForm(f => ({ ...f, installments: arr }));
                          }}
                        />
                        <Input
                          type="date"
                          className="flex-1 w-full"
                          value={inst.dueDate}
                          onChange={e => {
                            const arr = [...scheduleForm.installments];
                            arr[i].dueDate = e.target.value;
                            setScheduleForm(f => ({ ...f, installments: arr }));
                          }}
                        />
                        <div className="flex flex-1 w-full gap-2 items-center">
                          <Input
                            placeholder="Note"
                            className="flex-1"
                            value={inst.description}
                            onChange={e => {
                              const arr = [...scheduleForm.installments];
                              arr[i].description = e.target.value;
                              setScheduleForm(f => ({ ...f, installments: arr }));
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-10 w-10 p-0 flex-shrink-0 text-red-500"
                            onClick={() => {
                              setScheduleForm(f => ({
                                ...f,
                                installments: f.installments.filter((_, idx) => idx !== i)
                              }));
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Schedule</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats — admin sees all, agent sees their own */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-xl font-bold mt-1">₹{stats.totalPending.toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Collected</p>
              <p className="text-xl font-bold mt-1 text-green-600">₹{stats.totalCompleted.toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Overdue Count</p>
              <p className="text-xl font-bold mt-1 text-orange-500">{stats.overdueCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Overdue Amount</p>
              <p className="text-xl font-bold mt-1 text-red-500">₹{stats.overdueAmount.toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer, property, reference..."
              className="pl-9"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {PIPELINE_STAGES.map(s => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {(['all', 'overdue', 'ledger'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ==================== KANBAN VIEW ==================== */}
        {viewMode === 'kanban' && (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {/* Unassigned column */}
              {kanbanGroups['unassigned']?.length > 0 && (
                <div className="w-64 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                    <span className="text-sm font-medium text-muted-foreground">No Stage</span>
                    <Badge variant="secondary" className="text-xs ml-auto">{kanbanGroups['unassigned'].length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {kanbanGroups['unassigned'].map(payment => (
                      <KanbanCard key={payment.id} payment={payment} onStageChange={handleStageChange} onHistory={() => { setHistoryPayment(payment); setIsHistoryOpen(true); }} />
                    ))}
                  </div>
                </div>
              )}

              {PIPELINE_STAGES.map(stage => (
                <div key={stage.key} className="w-64 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-sm font-medium">{stage.label}</span>
                    <Badge variant="secondary" className="text-xs ml-auto">{kanbanGroups[stage.key]?.length || 0}</Badge>
                  </div>
                  <div className="space-y-2">
                    {(kanbanGroups[stage.key] || []).map(payment => (
                      <KanbanCard key={payment.id} payment={payment} onStageChange={handleStageChange} onHistory={() => { setHistoryPayment(payment); setIsHistoryOpen(true); }} />
                    ))}
                    {(kanbanGroups[stage.key] || []).length === 0 && (
                      <div className="border border-dashed rounded-lg h-20 flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">No payments</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== LIST VIEW ==================== */}
        {viewMode === 'list' && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading payments...</div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No payments found.</div>
            ) : (
              filteredPayments.map(payment => {
                const cfg = statusConfig[payment.status as keyof typeof statusConfig];
                const StatusIcon = cfg?.icon || Clock;

                return (
                  <Card key={payment.id} className="group">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <IndianRupee className="h-4 w-4 text-green-600 flex-shrink-0" />
                            <span className="font-semibold text-lg">₹{payment.amount.toLocaleString('en-IN')}</span>
                            <span className="text-xs text-muted-foreground">
                              {payment.paymentType.replace(/_/g, ' ').toUpperCase()}
                              {payment.installmentNumber && ` (${payment.installmentNumber}/${payment.totalInstallments})`}
                            </span>
                          </div>

                          {payment.lead && (
                            <p className="text-sm">
                              <span className="text-muted-foreground">Customer: </span>
                              <span className="font-medium">{payment.lead.name}</span>
                            </p>
                          )}

                          {payment.dueDate && (
                            <p className="text-xs text-muted-foreground">
                              Due: {format(new Date(payment.dueDate), 'MMM dd, yyyy')}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {/* Pipeline Stage Selector */}
                          <PipelineStageSelector
                            currentStage={payment.pipelineStage}
                            paymentId={payment.id}
                            onStageChange={handleStageChange}
                          />

                          {/* Stage History Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => { setHistoryPayment(payment); setIsHistoryOpen(true); }}
                          >
                            <History className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>

                          {/* Edit Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => openEditDialog(payment)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>

                          {/* Payment Status Badge */}
                          <Badge className={`${cfg?.color} text-white`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {cfg?.label}
                          </Badge>

                          {/* Record Payment */}
                          {payment.status === 'pending' && (
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => { setPaymentToRecord(payment); setIsRecordDialogOpen(true); }}
                            >
                              <Receipt className="h-3.5 w-3.5 mr-1" />
                              Record
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ==================== STAGE HISTORY DIALOG ==================== */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Stage History
            </DialogTitle>
          </DialogHeader>
          {historyPayment && (
            <div className="py-2 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b">
                <div>
                  <p className="font-medium">₹{historyPayment.amount.toLocaleString('en-IN')}</p>
                  <p className="text-sm text-muted-foreground">{historyPayment.lead?.name}</p>
                </div>
                <div className="ml-auto">
                  <StageBadge stage={historyPayment.pipelineStage} />
                </div>
              </div>
              <StageTimeline history={historyPayment.stageHistory || []} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================== EDIT DIALOG ==================== */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Edit Payment</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdatePayment} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={editForm.dueDate} onChange={e => setEditForm({ ...editForm, dueDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={val => setEditForm({ ...editForm, status: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={editForm.paymentMethod} onValueChange={val => setEditForm({ ...editForm, paymentMethod: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input value={editForm.referenceNumber} onChange={e => setEditForm({ ...editForm, referenceNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Update</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================== RECORD PAYMENT DIALOG ==================== */}
      <Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Payment Method *</Label>
              <Select value={recordForm.paymentMethod} onValueChange={val => setRecordForm({ ...recordForm, paymentMethod: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input
                value={recordForm.referenceNumber}
                onChange={e => setRecordForm({ ...recordForm, referenceNumber: e.target.value })}
                placeholder="Transaction ID / Cheque No."
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={recordForm.notes}
                onChange={e => setRecordForm({ ...recordForm, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={recordForm.receiptGenerate}
                onChange={e => setRecordForm({ ...recordForm, receiptGenerate: e.target.checked })}
              />
              <Label>Generate Receipt</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsRecordDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleRecordPayment}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// ==================== KANBAN CARD ====================

function KanbanCard({
  payment,
  onStageChange,
  onHistory
}: {
  payment: Payment;
  onStageChange: (id: string, stage: PipelineStageKey, notes?: string) => void;
  onHistory: () => void;
}) {
  const cfg = statusConfig[payment.status as keyof typeof statusConfig];
  const StatusIcon = cfg?.icon || Clock;

  return (
    <Card className="group">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm">₹{payment.amount.toLocaleString('en-IN')}</p>
          <Badge className={`${cfg?.color} text-white text-[10px] px-1.5 py-0`}>
            <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
            {cfg?.label}
          </Badge>
        </div>

        {payment.lead && (
          <p className="text-xs text-muted-foreground truncate">{payment.lead.name}</p>
        )}

        {payment.dueDate && (
          <p className="text-[10px] text-muted-foreground">
            Due: {format(new Date(payment.dueDate), 'MMM dd, yyyy')}
          </p>
        )}

        <div className="flex items-center gap-1 pt-1">
          <PipelineStageSelector
            currentStage={payment.pipelineStage}
            paymentId={payment.id}
            onStageChange={onStageChange}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
            onClick={onHistory}
          >
            <History className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}