import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Phone,
  PhoneCall,
  PhoneMissed,
  Clock,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Archive,
  Trash2,
  Users,
  BarChart3,
  Search,
  MoreVertical,
  Loader2,
  Globe,
  ArrowRightCircle,
  AlertCircle,
  Filter,
  X,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  Zap,
  Award,
  Target,
  RefreshCw,
} from 'lucide-react';
import { format, parseISO, subDays, startOfWeek, endOfWeek } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface Lead {
  id: string;
  name: string;
  phone: string;
  stage: string;
  temperature: string;
  source?: string;
  createdAt?: string;
}

interface Agent {
  id: string;
  fullName: string;
}

interface TableRowData {
  id: string;
  isLeadRow: boolean;
  leadId: string;
  agentId?: string;
  callStatus: string;
  displayDate: string;
  duration: number | null;
  notes: string | null;
  lead: Lead;
  agent?: Agent;
  isArchived?: boolean;
  deletedAt?: string | null;
}

interface CallStats {
  totalCalls: number;
  connectedCalls: number;
  notAnswered: number;
  positive: number;
  negative: number;
  callback: number;
  connectRate: number;
  newLeads: number;
}

interface FilterState {
  search: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  agentId: string;
  minDuration: string;
  source: string;
}

const EMPTY_FILTERS: FilterState = {
  search: '',
  dateFrom: '',
  dateTo: '',
  status: 'all',
  agentId: 'all',
  minDuration: 'all',
  source: 'all',
};

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function Telecalling() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeView, setActiveView] = useState(searchParams.get('view') || 'reports');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [tableData, setTableData] = useState<TableRowData[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [selectedItem, setSelectedItem] = useState<TableRowData | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Sync state to URL
  useEffect(() => {
    setSearchParams({ view: activeView });
  }, [activeView, setSearchParams]);

  // Fetch agents list for filter dropdown (admin only)
  useEffect(() => {
    if (user?.role !== 'admin') return;
    fetch(`${API_URL}/users?role=sales_agent`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setAgents(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [token, user]);

  // ─── ACTIVE FILTER COUNT ───
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.status !== 'all') count++;
    if (filters.agentId !== 'all') count++;
    if (filters.minDuration !== 'all') count++;
    if (filters.source !== 'all') count++;
    return count;
  }, [filters]);

  // ─── FETCH DATA ───
  const fetchData = useCallback(async () => {
    if (activeView === 'reports') return;
    setIsLoading(true);
    setTableData([]);
    try {
      if (activeView === 'new_leads') {
        const query = new URLSearchParams({ stage: 'new' });
        if (filters.search) query.append('phone', filters.search);
        const res = await fetch(`${API_URL}/leads?${query}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const leads: Lead[] = await res.json();
        setTableData(leads.map(lead => ({
          id: lead.id,
          isLeadRow: true,
          leadId: lead.id,
          callStatus: 'pending',
          displayDate: lead.createdAt || new Date().toISOString(),
          duration: null,
          notes: 'New lead awaiting connection',
          lead,
        })));
      } else {
        const query = new URLSearchParams({ view: activeView });
        if (filters.search) query.append('search', filters.search);
        if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
        if (filters.dateTo) query.append('dateTo', filters.dateTo);
        if (filters.status !== 'all') query.append('callStatus', filters.status);
        if (filters.agentId !== 'all') query.append('agentId', filters.agentId);
        if (filters.minDuration !== 'all') query.append('minDuration', filters.minDuration);
        if (filters.source !== 'all') query.append('source', filters.source);

        const res = await fetch(`${API_URL}/call-logs?${query}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch logs');
        const logs = await res.json();
        setTableData(logs.map((log: any) => ({
          id: log.id,
          isLeadRow: false,
          leadId: log.leadId,
          agentId: log.agentId,
          callStatus: log.callStatus,
          displayDate: log.callDate,
          duration: log.callDuration,
          notes: log.notes,
          lead: log.lead,
          agent: log.agent,
          isArchived: log.isArchived,
          deletedAt: log.deletedAt,
        })));
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [activeView, filters, token, toast]);

  const fetchStats = useCallback(async () => {
    try {
      const query = new URLSearchParams();
      if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) query.append('dateTo', filters.dateTo);
      if (filters.agentId !== 'all') query.append('agentId', filters.agentId);
      const res = await fetch(`${API_URL}/call-logs/stats?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setStats(data);
    } catch {}
  }, [token, filters]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchData(), fetchStats()]);
    setIsRefreshing(false);
  };

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  // ─── MENU CONFIG ───
  const menuItems = [
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { type: 'separator' },
    { id: 'new_leads', label: 'New Web Leads', icon: Globe, className: 'text-blue-600 font-medium bg-blue-50/50' },
    { type: 'separator' },
    { id: 'all', label: 'All Calls', icon: Phone },
    { id: 'attended', label: 'Attended Calls', icon: PhoneCall },
    { id: 'active', label: 'Active (Today)', icon: CheckCircle2 },
    { id: 'missed', label: 'Missed Calls', icon: PhoneMissed, className: 'text-red-600 font-medium' },
    { id: 'qualified', label: 'Qualified Calls', icon: ThumbsUp },
    { id: 'unqualified', label: 'Unqualified Calls', icon: ThumbsDown },
    { id: 'analytics', label: 'Call Analysis', icon: BarChart3 },
    { id: 'connect_group', label: 'Connect to Group', icon: Users },
    { type: 'separator' },
    { id: 'archive', label: 'Call Archive', icon: Archive },
    { id: 'deleted', label: 'Deleted Calls', icon: Trash2 },
  ];

  // ─── ACTION HANDLERS ───
  const handleViewDetails = (item: TableRowData) => {
    setSelectedItem(item);
    setIsEditOpen(true);
  };

  const handleCallAction = async (item: TableRowData) => {
    toast({ title: 'Dialing...', description: `Connecting to ${item.lead.name} (${item.lead.phone})...` });
    try {
      const res = await fetch(`${API_URL}/call-logs/initiate-mcube`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leadPhone: item.lead.phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Call Failed', description: data.error || 'Could not initiate call.', variant: 'destructive' });
      } else {
        toast({ title: '📞 Dialing...', description: `Your phone will ring first, then ${item.lead.name} will be connected.` });
        setTimeout(() => { fetchData(); fetchStats(); }, 1500);
      }
    } catch {
      toast({ title: 'Error', description: 'Could not reach MCUBE. Check your connection.', variant: 'destructive' });
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/call-logs/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Archived', description: 'Call log moved to archive.' });
      setTableData(prev => prev.filter(r => r.id !== id));
      fetchStats();
    } catch {
      toast({ title: 'Error', description: 'Could not archive call log.', variant: 'destructive' });
    }
  };

  const confirmDelete = (id: string) => { setItemToDelete(id); setIsDeleteAlertOpen(true); };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(`${API_URL}/call-logs/${itemToDelete}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Deleted', description: 'Call log moved to trash.' });
      setTableData(prev => prev.filter(r => r.id !== itemToDelete));
      setIsDeleteAlertOpen(false);
      fetchStats();
    } catch {
      toast({ title: 'Error', description: 'Could not delete call log.', variant: 'destructive' });
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead? This action cannot be undone.')) return;
    try {
      const res = await fetch(`${API_URL}/leads/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Deleted', description: 'Lead deleted successfully.' });
      setTableData(prev => prev.filter(r => r.leadId !== id));
      fetchStats();
    } catch {
      toast({ title: 'Error', description: 'Could not delete lead.', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout title="Telecalling Center" description="Manage your call operations">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-110px)] md:h-[calc(100vh-140px)] gap-4 lg:gap-6">

        {/* ─── SIDEBAR ─── */}
        <Card className="w-full lg:w-64 flex-shrink-0 h-auto lg:h-full overflow-hidden flex flex-col border-r bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm uppercase text-muted-foreground font-bold tracking-wider">Navigation</CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1 max-h-[250px] lg:max-h-none">
            <div className="p-2 space-y-1">
              {menuItems.map((item, idx) =>
                item.type === 'separator' ? (
                  <Separator key={idx} className="my-2" />
                ) : (
                  <Button
                    key={item.id}
                    variant={activeView === item.id ? 'secondary' : 'ghost'}
                    className={`w-full justify-start gap-3 h-10 ${item.className || ''} ${activeView === item.id ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                    onClick={() => setActiveView(item.id || 'reports')}
                  >
                    {item.icon && <item.icon className="h-4 w-4" />}
                    <span className="truncate">{item.label}</span>
                    {stats ? (() => {
                      let count = 0;
                      let badgeClass = 'bg-primary/10 text-primary';
                      if (item.id === 'all') count = stats.totalCalls;
                      else if (item.id === 'missed') { count = stats.notAnswered; badgeClass = 'bg-red-100 text-red-600'; }
                      else if (item.id === 'qualified') count = stats.positive;
                      else if (item.id === 'unqualified') count = stats.negative;
                      else if (item.id === 'new_leads') { count = stats.newLeads; badgeClass = 'bg-blue-100 text-blue-600'; }
                      if (count > 0) return (
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-bold ${badgeClass}`}>{count}</span>
                      );
                      return null;
                    })() : null}
                  </Button>
                )
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* ─── MAIN CONTENT ─── */}
        <div className="flex-1 h-full flex flex-col min-w-0">

          {activeView === 'reports' ? (
            <ReportsView stats={stats} token={token} filters={filters} setFilters={setFilters} agents={agents} onRefresh={handleRefresh} isRefreshing={isRefreshing} />
          ) : (
            <Card className="h-full flex flex-col border shadow-sm">
              {/* ─── TOOLBAR ─── */}
              <div className="p-4 border-b flex items-center justify-between gap-2 bg-card/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-md">
                    {(() => {
                      const menuItem = menuItems.find(m => m.id === activeView);
                      const Icon = menuItem?.icon || Phone;
                      return <Icon className="h-5 w-5 text-primary" />;
                    })()}
                  </div>
                  <h2 className="text-xl font-bold tracking-tight capitalize">
                    {menuItems.find(m => m.id === activeView)?.label || 'Calls'}
                  </h2>
                  {tableData.length > 0 && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {tableData.length} records
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* ─── FILTER BUTTON + FLOATING POPOVER ─── */}
                  <div className="relative">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(p => !p)}
                      className={`gap-2 ${activeFilterCount > 0 ? 'border-primary text-primary' : ''}`}
                    >
                      <Filter className="h-4 w-4" />
                      Filters
                      {activeFilterCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                          {activeFilterCount}
                        </span>
                      )}
                    </Button>

                    {/* Floating popover box — matches image 2 design */}
                    {showFilters && (
                      <>
                        {/* Backdrop to close on outside click */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowFilters(false)}
                        />
                        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 rounded-xl border bg-background shadow-xl overflow-hidden">
                          {/* Header */}
                          <div className="flex items-center justify-between px-4 py-3 border-b">
                            <span className="text-sm font-semibold">Filter Calls</span>
                            <button
                              onClick={() => setShowFilters(false)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Filter fields */}
                          <div className="p-4 space-y-4">
                            {/* Search */}
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-muted-foreground">Search</label>
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                  placeholder="Name or phone..."
                                  className="pl-8 h-9 text-sm"
                                  value={filters.search}
                                  onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
                                />
                              </div>
                            </div>

                            {/* Date Range */}
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-muted-foreground">Date Range</label>
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  type="date"
                                  className="h-9 text-sm"
                                  value={filters.dateFrom}
                                  onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))}
                                />
                                <Input
                                  type="date"
                                  className="h-9 text-sm"
                                  value={filters.dateTo}
                                  onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))}
                                />
                              </div>
                              {/* Quick presets */}
                              <div className="flex gap-1.5 pt-0.5">
                                {[{ label: 'Today', days: 0 }, { label: '7 Days', days: 7 }, { label: '30 Days', days: 30 }].map(preset => (
                                  <button
                                    key={preset.label}
                                    className="flex-1 text-xs border rounded-md py-1.5 hover:bg-muted transition-colors"
                                    onClick={() => {
                                      const today = format(new Date(), 'yyyy-MM-dd');
                                      const from = format(subDays(new Date(), preset.days), 'yyyy-MM-dd');
                                      setFilters(p => ({ ...p, dateFrom: from, dateTo: today }));
                                    }}
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Status */}
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-muted-foreground">Call Status</label>
                              <Select value={filters.status} onValueChange={v => setFilters(p => ({ ...p, status: v }))}>
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="All Statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Statuses</SelectItem>
                                  <SelectItem value="connected_positive">Qualified</SelectItem>
                                  <SelectItem value="connected_callback">Callback</SelectItem>
                                  <SelectItem value="not_connected">Missed</SelectItem>
                                  <SelectItem value="not_interested">Unqualified</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Agent (admin only) */}
                            {agents.length > 0 && (
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">Agent</label>
                                <Select value={filters.agentId} onValueChange={v => setFilters(p => ({ ...p, agentId: v }))}>
                                  <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="All Agents" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Agents</SelectItem>
                                    {agents.map(a => (
                                      <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {/* Duration */}
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-muted-foreground">Min Duration</label>
                              <Select value={filters.minDuration} onValueChange={v => setFilters(p => ({ ...p, minDuration: v }))}>
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Any Duration" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Any Duration</SelectItem>
                                  <SelectItem value="30">30 seconds+</SelectItem>
                                  <SelectItem value="60">1 minute+</SelectItem>
                                  <SelectItem value="180">3 minutes+</SelectItem>
                                  <SelectItem value="300">5 minutes+</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Footer actions */}
                          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
                            <button
                              onClick={clearFilters}
                              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Clear all
                            </button>
                            <Button
                              size="sm"
                              className="bg-foreground text-background hover:bg-foreground/90 font-semibold px-5"
                              onClick={() => setShowFilters(false)}
                            >
                              Apply filter
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>

              {/* ─── TABLE ─── */}
              <div className="flex-1 overflow-hidden relative">
                <ScrollArea className="h-full w-full">
                  <div className="min-w-[800px]">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="w-[160px]">Date & Time</TableHead>
                          <TableHead>Client Name</TableHead>
                          <TableHead>Phone Number</TableHead>
                          <TableHead>Agent</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-64 text-center">
                              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                <Loader2 className="h-6 w-6 animate-spin" />
                                Loading data...
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : tableData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-64 text-center">
                              <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                <Search className="h-10 w-10 opacity-20" />
                                <p className="font-medium">No records found</p>
                                {activeFilterCount > 0 && (
                                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1">
                                    <X className="h-3 w-3" /> Clear filters
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          tableData.map(row => (
                            <TableRow key={row.id} className="hover:bg-muted/50 transition-colors group">
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="text-foreground font-medium">{format(parseISO(row.displayDate), 'MMM dd, yyyy')}</span>
                                  <span className="text-[10px]">{format(parseISO(row.displayDate), 'hh:mm a')}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8 border bg-background">
                                    <AvatarFallback className="text-[10px] bg-primary/5 text-primary">
                                      {row.lead?.name?.substring(0, 2).toUpperCase() || 'NA'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <span className="font-semibold text-sm block">
                                      {row.lead?.name
                                        ? row.lead.name.replace('Unverified MCUBE Caller - ', 'New Inquiry: ').replace('New Lead - ', 'New Inquiry: ')
                                        : 'Unknown Lead'}
                                    </span>
                                    {row.isLeadRow ? (
                                      <span className="text-[10px] text-blue-600 font-medium">New Website Lead</span>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground uppercase">{row.lead?.stage}</span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={`font-mono text-sm ${row.callStatus === 'not_connected' ? 'text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100' : ''}`}>
                                  {row.lead?.phone}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm">
                                {row.agent?.fullName || <span className="text-muted-foreground italic">Unassigned</span>}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={row.callStatus} />
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1.5 my-1">
                                  <span className="text-xs font-mono font-medium">
                                    {row.duration ? `${Math.floor(row.duration / 60)}m ${row.duration % 60}s` : '--'}
                                  </span>
                                  {(() => {
                                    if (!row.notes) return null;
                                    const match = row.notes.match(/Recording:\s*(http[^\s|]+)/);
                                    if (match && match[1] && match[1] !== 'None') {
                                      return (
                                        <a href={match[1]} target="_blank" rel="noreferrer"
                                          className="text-[10px] bg-blue-50 text-blue-600 rounded px-1.5 py-0.5 w-fit border border-blue-100 hover:bg-blue-100 flex items-center gap-1 font-sans shadow-sm transition-colors">
                                          ▶ Play Audio
                                        </a>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              </TableCell>
                              <TableCell className="text-right pr-4">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    {row.isLeadRow && (
                                      <>
                                        <DropdownMenuItem onClick={() => handleCallAction(row)} className="text-blue-600 font-medium">
                                          <Phone className="h-4 w-4 mr-2" /> Call Now
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => handleDeleteLead(row.leadId)}>
                                          <Trash2 className="h-4 w-4 mr-2" /> Delete Lead
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    <DropdownMenuItem onClick={() => handleViewDetails(row)}>
                                      View Details
                                    </DropdownMenuItem>
                                    {!row.isLeadRow && (
                                      <>
                                        <DropdownMenuItem onClick={() => handleArchive(row.id)}>
                                          <Archive className="h-4 w-4 mr-2" /> Archive
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => confirmDelete(row.id)}>
                                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ─── VIEW DIALOG ─── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedItem?.isLeadRow ? 'Lead Details' : 'Call Log Details'}</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Name</label>
                  <Input defaultValue={selectedItem.lead?.name} readOnly className="bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
                  <Input defaultValue={selectedItem.lead?.phone} readOnly className="bg-muted" />
                </div>
              </div>
              {!selectedItem.isLeadRow && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</label>
                    <div className="pt-1"><StatusBadge status={selectedItem.callStatus} /></div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Duration</label>
                    <Input
                      defaultValue={selectedItem.duration ? `${Math.floor(selectedItem.duration / 60)}m ${selectedItem.duration % 60}s` : 'N/A'}
                      readOnly className="bg-muted" />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border bg-muted px-3 py-2 text-sm resize-none"
                  defaultValue={selectedItem.notes || ''}
                  readOnly
                />
              </div>
              {selectedItem.isLeadRow && (
                <Button className="w-full gap-2" onClick={() => { handleCallAction(selectedItem); setIsEditOpen(false); }}>
                  <Phone className="h-4 w-4" /> Initiate Call
                </Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── CONFIRM DELETE ─── */}
      <Dialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" /> Confirm Deletion
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to move this call log to trash? It will be hidden from active views.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsDeleteAlertOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string; icon: any }> = {
    pending: { label: 'To Call', className: 'bg-orange-100 text-orange-700 border-orange-200', icon: ArrowRightCircle },
    connected_positive: { label: 'Qualified', className: 'bg-green-100 text-green-700 border-green-200', icon: ThumbsUp },
    connected_callback: { label: 'Callback', className: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
    not_connected: { label: 'Missed', className: 'bg-red-100 text-red-700 border-red-200', icon: PhoneMissed },
    not_interested: { label: 'Unqualified', className: 'bg-gray-100 text-gray-700 border-gray-200', icon: ThumbsDown },
  };
  const config = configs[status] || { label: status, className: 'bg-gray-100 border-gray-200', icon: Phone };
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`${config.className} flex w-fit items-center gap-1.5 px-2 py-0.5 shadow-sm`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

// ─────────────────────────────────────────────
// REPORTS VIEW — full analytics dashboard
// ─────────────────────────────────────────────
interface ReportsViewProps {
  stats: CallStats | null;
  token: string | null;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  agents: Agent[];
  onRefresh: () => void;
  isRefreshing: boolean;
}

function ReportsView({ stats, token, filters, setFilters, agents, onRefresh, isRefreshing }: ReportsViewProps) {
  const [trend, setTrend] = useState<any[]>([]);
  const [agentPerf, setAgentPerf] = useState<any[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  // Fetch detailed report data
  const fetchReportData = useCallback(async () => {
    if (!token) return;
    setIsLoadingReports(true);
    try {
      // Build query params
      const query = new URLSearchParams({ view: 'all' });
      if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) query.append('dateTo', filters.dateTo);
      if (filters.agentId !== 'all') query.append('agentId', filters.agentId);

      const res = await fetch(`${API_URL}/call-logs?${query}&take=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const logs: any[] = await res.json();

      // ─── Build 7-day trend ───
      const last7: Record<string, { date: string; total: number; connected: number; missed: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = format(subDays(new Date(), i), 'MMM dd');
        last7[format(subDays(new Date(), i), 'yyyy-MM-dd')] = { date: d, total: 0, connected: 0, missed: 0 };
      }
      logs.forEach(log => {
        const day = log.callDate?.split('T')[0];
        if (last7[day]) {
          last7[day].total++;
          if (['connected_positive', 'connected_callback'].includes(log.callStatus)) last7[day].connected++;
          if (log.callStatus === 'not_connected') last7[day].missed++;
        }
      });
      setTrend(Object.values(last7));

      // ─── Build agent performance ───
      const agentMap: Record<string, { name: string; total: number; connected: number; missed: number; qualified: number }> = {};
      logs.forEach(log => {
        const name = log.agent?.fullName || 'Unassigned';
        if (!agentMap[name]) agentMap[name] = { name, total: 0, connected: 0, missed: 0, qualified: 0 };
        agentMap[name].total++;
        if (['connected_positive', 'connected_callback'].includes(log.callStatus)) agentMap[name].connected++;
        if (log.callStatus === 'not_connected') agentMap[name].missed++;
        if (log.callStatus === 'connected_positive') agentMap[name].qualified++;
      });
      const perf = Object.values(agentMap)
        .map(a => ({ ...a, rate: a.total > 0 ? Math.round((a.connected / a.total) * 100) : 0 }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8);
      setAgentPerf(perf);
    } catch { }
    finally { setIsLoadingReports(false); }
  }, [token, filters.dateFrom, filters.dateTo, filters.agentId]);

  useEffect(() => { fetchReportData(); }, [fetchReportData]);

  // Pie data
  const pieData = stats ? [
    { name: 'Qualified', value: stats.positive, color: '#22c55e' },
    { name: 'Callback', value: stats.callback || 0, color: '#3b82f6' },
    { name: 'Missed', value: stats.notAnswered, color: '#ef4444' },
    { name: 'Unqualified', value: stats.negative, color: '#6b7280' },
  ].filter(d => d.value > 0) : [];

  if (!stats) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-1 pb-8">

        {/* ─── REPORT HEADER ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Call Reports & Analytics</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filters.dateFrom && filters.dateTo
                ? `${format(new Date(filters.dateFrom), 'MMM dd')} – ${format(new Date(filters.dateTo), 'MMM dd, yyyy')}`
                : 'All time overview'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick range presets */}
            {[
              { label: 'Today', days: 0 },
              { label: 'This Week', days: 7 },
              { label: 'This Month', days: 30 },
            ].map(p => (
              <Button key={p.label} variant="outline" size="sm" className="h-8 text-xs"
                onClick={() => {
                  const today = format(new Date(), 'yyyy-MM-dd');
                  const from = format(subDays(new Date(), p.days), 'yyyy-MM-dd');
                  setFilters(prev => ({ ...prev, dateFrom: from, dateTo: today }));
                }}>
                {p.label}
              </Button>
            ))}
            {/* Agent filter (admin only) */}
            {agents.length > 0 && (
              <Select value={filters.agentId} onValueChange={v => setFilters(p => ({ ...p, agentId: v }))}>
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue placeholder="All Agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {(filters.dateFrom || filters.agentId !== 'all') && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1"
                onClick={() => setFilters(p => ({ ...p, dateFrom: '', dateTo: '', agentId: 'all' }))}>
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ─── KPI STAT CARDS ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Calls"
            value={stats.totalCalls}
            icon={Phone}
            color="blue"
            subtitle={`${stats.connectRate}% connect rate`}
          />
          <KpiCard
            title="Qualified"
            value={stats.positive}
            icon={ThumbsUp}
            color="green"
            subtitle={stats.totalCalls > 0 ? `${Math.round((stats.positive / stats.totalCalls) * 100)}% of all calls` : '—'}
            trend="up"
          />
          <KpiCard
            title="Missed Calls"
            value={stats.notAnswered}
            icon={PhoneMissed}
            color="red"
            subtitle={stats.totalCalls > 0 ? `${Math.round((stats.notAnswered / stats.totalCalls) * 100)}% miss rate` : '—'}
            trend="down"
          />
          <KpiCard
            title="Callbacks Pending"
            value={stats.callback || 0}
            icon={Clock}
            color="amber"
            subtitle="Awaiting follow-up"
          />
        </div>

        {/* ─── SECONDARY METRICS ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricTile label="Connect Rate" value={`${stats.connectRate}%`} icon={Target}
            sub={stats.connectRate >= 50 ? 'Above target' : 'Below target'}
            good={stats.connectRate >= 50} />
          <MetricTile label="Unqualified" value={stats.negative} icon={ThumbsDown}
            sub={stats.totalCalls > 0 ? `${Math.round((stats.negative / stats.totalCalls) * 100)}% reject rate` : '—'}
            good={false} />
          <MetricTile label="Connected Calls" value={stats.connectedCalls} icon={PhoneCall}
            sub="Answered by customer" good={true} />
          <MetricTile label="New Leads" value={stats.newLeads} icon={Zap}
            sub="In pipeline" good={true} />
        </div>

        {/* ─── CHARTS ROW 1: Trend + Pie ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 7-Day Trend */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">7-Day Call Trend</CardTitle>
                {isLoadingReports && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </CardHeader>
            <CardContent>
              {trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorConnected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorMissed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
                      cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="total" name="Total" stroke="#6366f1" strokeWidth={2} fill="url(#colorTotal)" dot={{ r: 3 }} />
                    <Area type="monotone" dataKey="connected" name="Connected" stroke="#22c55e" strokeWidth={2} fill="url(#colorConnected)" dot={{ r: 3 }} />
                    <Area type="monotone" dataKey="missed" name="Missed" stroke="#ef4444" strokeWidth={2} fill="url(#colorMissed)" dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No trend data available" />
              )}
            </CardContent>
          </Card>

          {/* Call Status Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <div className="flex flex-col items-center gap-4">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any, n: string) => [`${v} calls`, n]}
                        contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full space-y-2">
                    {pieData.map(d => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="text-muted-foreground">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{d.value}</span>
                          <span className="text-muted-foreground w-10 text-right">
                            {stats.totalCalls > 0 ? `${Math.round((d.value / stats.totalCalls) * 100)}%` : '0%'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyChart label="No status data" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── CHARTS ROW 2: Agent Performance ─── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Agent Performance Breakdown</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Calls handled per agent with connect rate</p>
              </div>
              {isLoadingReports && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent>
            {agentPerf.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Bar chart */}
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={agentPerf} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="connected" name="Connected" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="missed" name="Missed" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="qualified" name="Qualified" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Agent leaderboard table */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Leaderboard</p>
                  {agentPerf.map((agent, idx) => (
                    <div key={agent.name} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-100 text-gray-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-muted text-muted-foreground'}`}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{agent.name}</span>
                          <span className="text-xs font-bold text-muted-foreground flex-shrink-0">{agent.total} calls</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all"
                              style={{ width: `${agent.rate}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold flex-shrink-0 ${agent.rate >= 60 ? 'text-green-600' : agent.rate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                            {agent.rate}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyChart label="No agent data for this period" />
            )}
          </CardContent>
        </Card>

        {/* ─── SUMMARY TABLE ─── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Summary Report</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { label: 'Total Calls Made', value: stats.totalCalls, pct: 100, good: null },
                  { label: 'Connected (Answered)', value: stats.connectedCalls, pct: stats.totalCalls > 0 ? Math.round((stats.connectedCalls / stats.totalCalls) * 100) : 0, good: true },
                  { label: 'Qualified Leads', value: stats.positive, pct: stats.totalCalls > 0 ? Math.round((stats.positive / stats.totalCalls) * 100) : 0, good: true },
                  { label: 'Callback Scheduled', value: stats.callback || 0, pct: stats.totalCalls > 0 ? Math.round(((stats.callback || 0) / stats.totalCalls) * 100) : 0, good: null },
                  { label: 'Not Connected (Missed)', value: stats.notAnswered, pct: stats.totalCalls > 0 ? Math.round((stats.notAnswered / stats.totalCalls) * 100) : 0, good: false },
                  { label: 'Not Interested', value: stats.negative, pct: stats.totalCalls > 0 ? Math.round((stats.negative / stats.totalCalls) * 100) : 0, good: false },
                  { label: 'Overall Connect Rate', value: `${stats.connectRate}%`, pct: null, good: stats.connectRate >= 50 },
                  { label: 'New Leads in Pipeline', value: stats.newLeads, pct: null, good: null },
                ].map(row => (
                  <TableRow key={row.label} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-sm">{row.label}</TableCell>
                    <TableCell className="text-right font-bold">{row.value}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {row.pct !== null ? `${row.pct}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.good === null ? (
                        <Badge variant="outline" className="text-xs">Neutral</Badge>
                      ) : row.good ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs hover:bg-green-100">
                          <TrendingUp className="h-3 w-3 mr-1" /> Good
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 border-red-200 text-xs hover:bg-red-100">
                          <TrendingDown className="h-3 w-3 mr-1" /> Needs Attention
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </div>
    </ScrollArea>
  );
}

// ─────────────────────────────────────────────
// KPI CARD
// ─────────────────────────────────────────────
function KpiCard({ title, value, icon: Icon, color, subtitle, trend }: {
  title: string; value: number; icon: any; color: string; subtitle?: string; trend?: 'up' | 'down';
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  const iconBg: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    amber: 'bg-amber-100 text-amber-600',
  };
  return (
    <Card className={`${colors[color]} shadow-sm`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${iconBg[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
          {trend && (
            trend === 'up'
              ? <TrendingUp className="h-4 w-4 text-green-500" />
              : <TrendingDown className="h-4 w-4 text-red-500" />
          )}
        </div>
        <p className="text-2xl font-bold tracking-tight">{value.toLocaleString()}</p>
        <p className="text-xs font-semibold mt-0.5 opacity-90">{title}</p>
        {subtitle && <p className="text-xs opacity-70 mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// METRIC TILE
// ─────────────────────────────────────────────
function MetricTile({ label, value, icon: Icon, sub, good }: {
  label: string; value: number | string; icon: any; sub: string; good: boolean;
}) {
  return (
    <Card className="border bg-card shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${good ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-none">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          <p className="text-xs font-medium text-muted-foreground mt-0.5 truncate">{label}</p>
          <p className="text-[10px] text-muted-foreground/70 truncate">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// EMPTY CHART PLACEHOLDER
// ─────────────────────────────────────────────
function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground rounded-lg border border-dashed bg-muted/10">
      <BarChart3 className="h-8 w-8 mb-2 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  );
}