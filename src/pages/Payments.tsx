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
  AlertCircle, Bell, Receipt, Calendar, TrendingUp, IndianRupee, Pencil
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Payment {
  id: string;
  amount: number;
  paymentType: string;
  paymentMethod: string | null;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
  referenceNumber: string | null;
  notes: string | null;
  lead?: { id: string; name: string; phone: string };
  property?: { id: string; title: string };
  deal?: { id: string; dealValue: number };
  createdAt: string;
}

interface PaymentScheduleForm {
  dealId: string;
  leadId: string;
  propertyId: string;
  totalAmount: string;
  bookingAmount: string;
  installments: Array<{
    amount: string;
    dueDate: string;
    description: string;
  }>;
}

const statusConfig = {
  pending: { color: 'bg-yellow-500', icon: Clock, label: 'Pending' },
  completed: { color: 'bg-green-500', icon: CheckCircle, label: 'Completed' },
  failed: { color: 'bg-red-500', icon: XCircle, label: 'Failed' },
  refunded: { color: 'bg-purple-500', icon: AlertCircle, label: 'Refunded' },
  overdue: { color: 'bg-orange-500', icon: AlertCircle, label: 'Overdue' },
};

export default function Payments() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'ledger'>('all');

  // Payment Schedule Dialog
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  
  // Popover states
  const [leadOpen, setLeadOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);

  const [scheduleForm, setScheduleForm] = useState<PaymentScheduleForm>({
    dealId: '',
    leadId: '',
    propertyId: '',
    totalAmount: '',
    bookingAmount: '',
    installments: [{ amount: '', dueDate: '', description: '' }]
  });

  // Record Payment Dialog
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [paymentToRecord, setPaymentToRecord] = useState<Payment | null>(null);
  const [recordForm, setRecordForm] = useState({
    paymentMethod: 'bank_transfer',
    referenceNumber: '',
    notes: '',
    receiptGenerate: true
  });

  // Edit Payment Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    status: '',
    dueDate: '',
    paymentMethod: '',
    referenceNumber: '',
    notes: ''
  });

  // Stats
  const [stats, setStats] = useState({
    totalPending: 0,
    totalCompleted: 0,
    overdueCount: 0,
    overdueAmount: 0
  });

  useEffect(() => {
    if (token) {
      fetchPayments();
      fetchLeadsAndDeals();
    }
  }, [token, filterStatus, activeTab]);

  useEffect(() => {
    calculateStats();
  }, [payments]);

  async function fetchLeadsAndDeals() {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      const [leadsRes, propsRes, projsRes] = await Promise.all([
        fetch(`${API_URL}/leads`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/properties`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/projects`, { headers }).then(r => r.json()),
      ]);

      if (Array.isArray(leadsRes)) {
        setLeads(leadsRes);
        const extractedDeals = leadsRes.flatMap((lead: any) => 
          (lead.deals || []).map((deal: any) => ({
            id: deal.id,
            dealValue: deal.dealValue,
            stage: deal.stage,
            leadId: lead.id,
            leadName: lead.name,
            leadPhone: lead.phone
          }))
        );
        setDeals(extractedDeals);
      }

      if (Array.isArray(propsRes)) setProperties(propsRes);
      if (Array.isArray(projsRes)) setProjects(projsRes);
    } catch (err) {
      console.error("Failed to load select options", err);
    }
  }

  async function fetchPayments() {
    setLoading(true);
    try {
      let url = `${API_URL}/payments`;
      const params = new URLSearchParams();
      
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (activeTab === 'overdue') params.append('overdueOnly', 'true');
      
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
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

  async function handleCreateSchedule(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        dealId: scheduleForm.dealId || undefined,
        leadId: scheduleForm.leadId,
        propertyId: scheduleForm.propertyId || null,
        totalAmount: Number(scheduleForm.totalAmount),
        bookingAmount: Number(scheduleForm.bookingAmount),
        installments: scheduleForm.installments.map(inst => ({
          amount: Number(inst.amount),
          dueDate: inst.dueDate,
          description: inst.description
        }))
      };

      const res = await fetch(`${API_URL}/payments/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to create payment schedule');

      toast({ title: 'Success', description: 'Payment schedule created successfully' });
      setIsScheduleDialogOpen(false);
      setScheduleForm({
        dealId: '',
        leadId: '',
        propertyId: '',
        totalAmount: '',
        bookingAmount: '',
        installments: [{ amount: '', dueDate: '', description: '' }]
      });
      fetchPayments();
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to create schedule', variant: 'destructive' });
    }
  }

  async function handleRecordPayment() {
    if (!paymentToRecord) return;

    try {
      const res = await fetch(`${API_URL}/payments/${paymentToRecord.id}/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(recordForm)
      });

      if (!res.ok) throw new Error('Failed to record payment');

      toast({ title: 'Success', description: 'Payment recorded successfully' });
      setIsRecordDialogOpen(false);
      setPaymentToRecord(null);
      setRecordForm({
        paymentMethod: 'bank_transfer',
        referenceNumber: '',
        notes: '',
        receiptGenerate: true
      });
      fetchPayments();
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to record payment', variant: 'destructive' });
    }
  }

  // Open Edit Dialog
  const openEditDialog = (payment: Payment) => {
    setEditingPayment(payment);
    setEditForm({
      amount: String(payment.amount),
      status: payment.status,
      dueDate: payment.dueDate ? new Date(payment.dueDate).toISOString().split('T')[0] : '',
      paymentMethod: payment.paymentMethod || 'bank_transfer',
      referenceNumber: payment.referenceNumber || '',
      notes: payment.notes || ''
    });
    setIsEditDialogOpen(true);
  };

  // Handle Update Payment
  async function handleUpdatePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPayment) return;

    try {
      const res = await fetch(`${API_URL}/payments/${editingPayment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: Number(editForm.amount),
          status: editForm.status,
          dueDate: editForm.dueDate || null,
          paymentMethod: editForm.paymentMethod,
          referenceNumber: editForm.referenceNumber,
          notes: editForm.notes
        })
      });

      if (!res.ok) throw new Error('Failed to update payment');

      toast({ title: 'Success', description: 'Payment updated successfully' });
      setIsEditDialogOpen(false);
      setEditingPayment(null);
      fetchPayments();
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to update payment', variant: 'destructive' });
    }
  }

  const addInstallment = () => {
    setScheduleForm({
      ...scheduleForm,
      installments: [...scheduleForm.installments, { amount: '', dueDate: '', description: '' }]
    });
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.lead?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         payment.referenceNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <DashboardLayout title="Payments" description="Track and manage payments">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-2xl font-bold">
                  ₹{stats.totalPending.toLocaleString('en-IN')}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-2xl font-bold">
                  ₹{stats.totalCompleted.toLocaleString('en-IN')}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <div>
                  <div className="text-2xl font-bold">{stats.overdueCount}</div>
                  <div className="text-xs text-muted-foreground">
                    ₹{stats.overdueAmount.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Collection Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="text-2xl font-bold">
                  {stats.totalPending + stats.totalCompleted > 0 
                    ? Math.round((stats.totalCompleted / (stats.totalPending + stats.totalCompleted)) * 100)
                    : 0}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search payments..." 
              className="pl-10" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(statusConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Create Schedule
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Payment Schedule</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateSchedule} className="space-y-4 py-4">
                  {/* Searchable Lead Dropdown */}
                  <div className="space-y-2">
                    <Label>Select Customer (Lead) *</Label>
                    <Popover open={leadOpen} onOpenChange={setLeadOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                        >
                          {scheduleForm.leadId
                            ? leads.find((lead) => lead.id === scheduleForm.leadId)?.name
                            : "Search customer..."}
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[500px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search customer..." />
                          <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty>No customer found.</CommandEmpty>
                            <CommandGroup>
                              {leads.map((lead) => (
                                <CommandItem
                                  key={lead.id}
                                  value={`${lead.name} ${lead.phone}`}
                                  onSelect={() => {
                                    setScheduleForm({...scheduleForm, leadId: lead.id});
                                    setLeadOpen(false);
                                  }}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium">{lead.name}</span>
                                    <span className="text-xs text-muted-foreground">{lead.phone}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Searchable Deal Dropdown */}
                  <div className="space-y-2">
                    <Label>Select Deal (Optional)</Label>
                    <Popover open={dealOpen} onOpenChange={setDealOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                        >
                          {scheduleForm.dealId
                            ? `${deals.find((d) => d.id === scheduleForm.dealId)?.leadName} - ₹${deals.find((d) => d.id === scheduleForm.dealId)?.dealValue?.toLocaleString('en-IN')}`
                            : "Search deal (optional)..."}
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[500px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search deal..." />
                          <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty>
                              {deals.length === 0 
                                ? "No deals available."
                                : "No deal found."}
                            </CommandEmpty>
                            <CommandGroup>
                              {deals.map((deal) => (
                                <CommandItem
                                  key={deal.id}
                                  value={`${deal.leadName} ${deal.dealValue}`}
                                  onSelect={() => {
                                    setScheduleForm({...scheduleForm, dealId: deal.id});
                                    setDealOpen(false);
                                  }}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium">{deal.leadName}</span>
                                    <span className="text-xs text-muted-foreground">
                                      ₹{deal.dealValue?.toLocaleString('en-IN')} • {deal.stage}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Total Amount *</Label>
                      <Input 
                        type="number"
                        required
                        value={scheduleForm.totalAmount}
                        onChange={(e) => setScheduleForm({...scheduleForm, totalAmount: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Booking Amount *</Label>
                      <Input 
                        type="number"
                        required
                        value={scheduleForm.bookingAmount}
                        onChange={(e) => setScheduleForm({...scheduleForm, bookingAmount: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Installments</Label>
                      <Button type="button" size="sm" onClick={addInstallment}>
                        <Plus className="h-4 w-4 mr-1" /> Add Installment
                      </Button>
                    </div>

                    {scheduleForm.installments.map((inst, index) => (
                      <div key={index} className="grid grid-cols-3 gap-2 p-3 border rounded-lg">
                        <Input
                          type="number"
                          placeholder="Amount"
                          value={inst.amount}
                          onChange={(e) => {
                            const newInst = [...scheduleForm.installments];
                            newInst[index].amount = e.target.value;
                            setScheduleForm({...scheduleForm, installments: newInst});
                          }}
                        />
                        <Input
                          type="date"
                          value={inst.dueDate}
                          onChange={(e) => {
                            const newInst = [...scheduleForm.installments];
                            newInst[index].dueDate = e.target.value;
                            setScheduleForm({...scheduleForm, installments: newInst});
                          }}
                        />
                        <Input
                          placeholder="Description"
                          value={inst.description}
                          onChange={(e) => {
                            const newInst = [...scheduleForm.installments];
                            newInst[index].description = e.target.value;
                            setScheduleForm({...scheduleForm, installments: newInst});
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Schedule</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Payments List */}
        <div className="space-y-3">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse h-24" />
            ))
          ) : filteredPayments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No payments found</h3>
              </CardContent>
            </Card>
          ) : (
            filteredPayments.map((payment) => {
              const StatusIcon = statusConfig[payment.status as keyof typeof statusConfig]?.icon || Clock;
              const isOverdue = payment.status === 'pending' && payment.dueDate && new Date(payment.dueDate) < new Date();

              return (
                <Card key={payment.id} className={`${isOverdue ? 'border-orange-300 bg-orange-50/30' : ''} group relative`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-3">
                          <IndianRupee className="h-5 w-5 text-green-600" />
                          <div>
                            <h3 className="font-semibold text-lg">
                              ₹{payment.amount.toLocaleString('en-IN')}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {payment.paymentType.replace(/_/g, ' ').toUpperCase()}
                              {payment.installmentNumber && ` (${payment.installmentNumber}/${payment.totalInstallments})`}
                            </p>
                          </div>
                        </div>

                        {payment.lead && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Customer: </span>
                            <span className="font-medium">{payment.lead.name}</span>
                          </p>
                        )}

                        {payment.dueDate && (
                          <p className="text-sm text-muted-foreground">
                            Due: {format(new Date(payment.dueDate), 'MMM dd, yyyy')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                         <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => openEditDialog(payment)}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>

                        <Badge className={`${statusConfig[payment.status as keyof typeof statusConfig]?.color} text-white`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig[payment.status as keyof typeof statusConfig]?.label}
                        </Badge>

                        {payment.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setPaymentToRecord(payment);
                              setIsRecordDialogOpen(true);
                            }}
                          >
                            <Receipt className="h-4 w-4 mr-1" />
                            Record Payment
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
      </div>

      {/* Edit Payment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Payment Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdatePayment} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                value={editForm.amount}
                onChange={(e) => setEditForm({...editForm, amount: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={editForm.dueDate}
                onChange={(e) => setEditForm({...editForm, dueDate: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={editForm.status} 
                onValueChange={(val) => setEditForm({...editForm, status: val})}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                   {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                   ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select 
                value={editForm.paymentMethod} 
                onValueChange={(val) => setEditForm({...editForm, paymentMethod: val})}
              >
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
                value={editForm.referenceNumber}
                onChange={(e) => setEditForm({...editForm, referenceNumber: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Payment</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Payment Method *</Label>
              <Select 
                value={recordForm.paymentMethod} 
                onValueChange={(val) => setRecordForm({...recordForm, paymentMethod: val})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
                onChange={(e) => setRecordForm({...recordForm, referenceNumber: e.target.value})}
                placeholder="Transaction ID / Cheque No."
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={recordForm.notes}
                onChange={(e) => setRecordForm({...recordForm, notes: e.target.value})}
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={recordForm.receiptGenerate}
                onChange={(e) => setRecordForm({...recordForm, receiptGenerate: e.target.checked})}
              />
              <Label>Generate Receipt</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsRecordDialogOpen(false)}>
                Cancel
              </Button>
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