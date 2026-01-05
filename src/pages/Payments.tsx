import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  CreditCard, 
  Plus,
  IndianRupee,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Search,
  TrendingUp
} from 'lucide-react';
import { format, parseISO, isPast, isToday } from 'date-fns';

interface Payment {
  id: string;
  lead_id: string | null;
  deal_id: string | null;
  property_id: string | null;
  amount: number;
  payment_type: string;
  payment_method: string | null;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  lead?: { name: string };
  deal?: { deal_value: number };
  property?: { title: string };
}

const paymentTypes = [
  { value: 'booking', label: 'Booking Amount' },
  { value: 'token', label: 'Token Amount' },
  { value: 'installment', label: 'Installment' },
  { value: 'final', label: 'Final Payment' },
];

const paymentMethods = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'online', label: 'Online Payment' },
];

const paymentStatuses = [
  { value: 'pending', label: 'Pending', color: 'bg-warning text-warning-foreground' },
  { value: 'completed', label: 'Completed', color: 'bg-success text-success-foreground' },
  { value: 'failed', label: 'Failed', color: 'bg-destructive text-destructive-foreground' },
  { value: 'refunded', label: 'Refunded', color: 'bg-muted text-muted-foreground' },
];

export default function Payments() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [leads, setLeads] = useState<{ id: string; name: string }[]>([]);
  const [deals, setDeals] = useState<{ id: string; deal_value: number; lead?: { name: string } }[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  // Form state
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState('booking');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [selectedLead, setSelectedLead] = useState('');
  const [selectedDeal, setSelectedDeal] = useState('');
  const [selectedProperty, setSelectedProperty] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [paymentsRes, leadsRes, dealsRes, propsRes] = await Promise.all([
      supabase
        .from('payments')
        .select('*, lead:leads(name), deal:deals(deal_value), property:properties(title)')
        .order('created_at', { ascending: false }),
      supabase.from('leads').select('id, name'),
      supabase.from('deals').select('id, deal_value, lead:leads(name)'),
      supabase.from('properties').select('id, title'),
    ]);

    if (paymentsRes.data) setPayments(paymentsRes.data as Payment[]);
    if (leadsRes.data) setLeads(leadsRes.data);
    if (dealsRes.data) setDeals(dealsRes.data as typeof deals);
    if (propsRes.data) setProperties(propsRes.data);
    
    setLoading(false);
  }

  async function handleCreatePayment() {
    if (!amount) return;
    
    setIsSubmitting(true);
    
    const { error } = await supabase.from('payments').insert({
      amount: parseFloat(amount),
      payment_type: paymentType,
      payment_method: paymentMethod || null,
      lead_id: selectedLead || null,
      deal_id: selectedDeal || null,
      property_id: selectedProperty || null,
      due_date: dueDate || null,
      reference_number: referenceNumber || null,
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to create payment', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Payment record created' });
      resetForm();
      fetchData();
    }
    
    setIsSubmitting(false);
  }

  function resetForm() {
    setAmount('');
    setPaymentType('booking');
    setPaymentMethod('');
    setSelectedLead('');
    setSelectedDeal('');
    setSelectedProperty('');
    setDueDate('');
    setReferenceNumber('');
    setIsDialogOpen(false);
  }

  function getStatusBadge(status: string) {
    const found = paymentStatuses.find(s => s.value === status);
    if (!found) return <Badge variant="secondary">{status}</Badge>;
    return <Badge className={found.color}>{found.label}</Badge>;
  }

  function formatPrice(price: number) {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
    return `₹${price.toLocaleString()}`;
  }

  // Stats
  const totalReceived = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0);
  const overduePayments = payments.filter(p => p.status === 'pending' && p.due_date && isPast(parseISO(p.due_date)));
  const todayDue = payments.filter(p => p.status === 'pending' && p.due_date && isToday(parseISO(p.due_date)));

  const filteredPayments = payments.filter(p => {
    const matchesSearch = p.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.reference_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || p.status === activeTab || p.payment_type === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <DashboardLayout title="Payments" description="Track bookings, installments, and collections">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Received</p>
                  <p className="text-2xl font-bold">{formatPrice(totalReceived)}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Amount</p>
                  <p className="text-2xl font-bold">{formatPrice(totalPending)}</p>
                </div>
                <Clock className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold">{overduePayments.length}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Due Today</p>
                  <p className="text-2xl font-bold">{todayDue.length}</p>
                </div>
                <Calendar className="h-8 w-8 text-info" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payments List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Payment Records</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search payments..."
                  className="pl-9 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Record Payment
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Record New Payment</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Amount (₹) *</Label>
                      <Input 
                        type="number"
                        placeholder="e.g. 500000"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Payment Type</Label>
                        <Select value={paymentType} onValueChange={setPaymentType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentTypes.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentMethods.map((m) => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Link to Lead</Label>
                      <Select value={selectedLead} onValueChange={setSelectedLead}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select lead (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {leads.map((lead) => (
                            <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Link to Deal</Label>
                      <Select value={selectedDeal} onValueChange={setSelectedDeal}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select deal (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {deals.map((deal) => (
                            <SelectItem key={deal.id} value={deal.id}>
                              {deal.lead?.name || 'Unknown'} - {formatPrice(Number(deal.deal_value))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Due Date</Label>
                        <Input 
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Reference No.</Label>
                        <Input 
                          placeholder="Transaction ID"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={resetForm}>Cancel</Button>
                    <Button onClick={handleCreatePayment} disabled={!amount || isSubmitting}>
                      {isSubmitting ? 'Saving...' : 'Record Payment'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="booking">Bookings</TabsTrigger>
                <TabsTrigger value="installment">Installments</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse h-16 rounded-lg bg-muted/30" />
                    ))}
                  </div>
                ) : filteredPayments.length === 0 ? (
                  <div className="text-center py-12">
                    <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No payment records found</p>
                    <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                      Record First Payment
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredPayments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <IndianRupee className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold">{formatPrice(Number(payment.amount))}</p>
                              {getStatusBadge(payment.status)}
                              <Badge variant="outline">{paymentTypes.find(t => t.value === payment.payment_type)?.label}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {payment.lead?.name && `${payment.lead.name} • `}
                              {payment.property?.title && `${payment.property.title} • `}
                              {payment.due_date && `Due: ${format(parseISO(payment.due_date), 'MMM d, yyyy')}`}
                              {!payment.due_date && `Created ${format(parseISO(payment.created_at), 'MMM d, yyyy')}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {payment.reference_number && (
                            <span className="text-sm text-muted-foreground">Ref: {payment.reference_number}</span>
                          )}
                          {payment.status === 'pending' && (
                            <Button size="sm" className="gap-1">
                              <CheckCircle2 className="h-4 w-4" />
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}