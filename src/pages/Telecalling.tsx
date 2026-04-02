// import { useEffect, useState, useCallback, useMemo } from 'react';
// import { useAuth } from '@/lib/auth-context';
// import { useSearchParams } from 'react-router-dom';
// import { DashboardLayout } from '@/components/layout/DashboardLayout';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
// import { Badge } from '@/components/ui/badge';
// import { Avatar, AvatarFallback } from '@/components/ui/avatar';
// import { Input } from '@/components/ui/input';
// import { ScrollArea } from '@/components/ui/scroll-area';
// import { Separator } from '@/components/ui/separator';
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { useToast } from '@/hooks/use-toast';
// import {
//   AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
//   XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
// } from 'recharts';
// import {
//   Phone,
//   PhoneCall,
//   PhoneMissed,
//   PhoneIncoming,
//   PhoneOutgoing,
//   Clock,
//   CheckCircle2,
//   ThumbsUp,
//   ThumbsDown,
//   Archive,
//   Trash2,
//   Users,
//   BarChart3,
//   Search,
//   MoreVertical,
//   Loader2,
//   Globe,
//   ArrowRightCircle,
//   AlertCircle,
//   Filter,
//   X,
//   TrendingUp,
//   TrendingDown,
//   Download,
//   Calendar,
//   Zap,
//   Award,
//   Target,
//   RefreshCw,
//   ArrowUpRight,
//   Play,
// Mic,
//   ArrowDownLeft,
//   Edit, // 👈 ADD THIS RIGHT HERE
// } from 'lucide-react';
// import { format, parseISO, subDays, startOfWeek, endOfWeek } from 'date-fns';
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";

// const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// // ─────────────────────────────────────────────
// // TYPES
// // ─────────────────────────────────────────────
// interface Lead {
//   id: string;
//   name: string;
//   phone: string;
//   stage: string;
//   temperature: string;
//   source?: string;
//   createdAt?: string;
// }

// interface Agent {
//   id: string;
//   fullName: string;
// }

// interface TableRowData {
//   id: string;
//   isLeadRow: boolean;
//   leadId: string;
//   agentId?: string;
//   callStatus: string;
//   displayDate: string;
//   duration: number | null;
//   notes: string | null;
//   lead: Lead;
//   agent?: Agent;
//   isArchived?: boolean;
//   deletedAt?: string | null;
// }

// interface CallStats {
//   totalCalls: number;
//   connectedCalls: number;
//   notAnswered: number;
//   positive: number;
//   negative: number;
//   callback: number;
//   connectRate: number;
//   newLeads: number;
//   // New: direction-specific breakdown
//   inboundTotal?: number;
//   outboundTotal?: number;
//   inboundConnected?: number;
//   outboundConnected?: number;
//   inboundMissed?: number;
//   outboundMissed?: number;
// }

// interface FilterState {
//   search: string;
//   dateFrom: string;
//   dateTo: string;
//   status: string;
//   agentId: string;
//   minDuration: string;
//   source: string;
//   direction: string;
// }

// const EMPTY_FILTERS: FilterState = {
//   search: '',
//   dateFrom: '',
//   dateTo: '',
//   status: 'all',
//   agentId: 'all',
//   minDuration: 'all',
//   source: 'all',
//   direction: 'all',
// };

// // ─────────────────────────────────────────────
// // MAIN COMPONENT
// // ─────────────────────────────────────────────
// export default function Telecalling() {
//   const { token, user } = useAuth();
//   const { toast } = useToast();
//   const [searchParams, setSearchParams] = useSearchParams();

//   const [activeView, setActiveView] = useState(searchParams.get('view') || 'reports');
//   const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
//   const [showFilters, setShowFilters] = useState(false);
//   const [tableData, setTableData] = useState<TableRowData[]>([]);
//   const [stats, setStats] = useState<CallStats | null>(null);
//   const [agents, setAgents] = useState<Agent[]>([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const [isRefreshing, setIsRefreshing] = useState(false);

//   // Modals
//   const [selectedItem, setSelectedItem] = useState<TableRowData | null>(null);
//   const [isEditOpen, setIsEditOpen] = useState(false);
//   const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
//   const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  

//   const [isEditNameOpen, setIsEditNameOpen] = useState(false);
//   const [nameToEdit, setNameToEdit] = useState('');
//   const [leadIdToEdit, setLeadIdToEdit] = useState('');


//   const handleSaveName = async () => {
//     try {
//       const res = await fetch(`${API_URL}/leads/${leadIdToEdit}`, {
//         method: 'PATCH',
//         headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
//         body: JSON.stringify({ name: nameToEdit }),
//       });
//       if (!res.ok) throw new Error();
//       toast({ title: 'Updated', description: 'Caller name updated successfully.' });
//       setIsEditNameOpen(false);
//       fetchData(); 
//     } catch {
//       toast({ title: 'Error', description: 'Could not update name.', variant: 'destructive' });
//     }
//   };

//   const handlePushToLeads = async (leadId: string) => {
//     try {
//       const res = await fetch(`${API_URL}/leads/${leadId}`, {
//         method: 'PATCH',
//         headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
//         body: JSON.stringify({ stage: 'new' }), 
//       });
//       if (!res.ok) throw new Error();
//       toast({ title: 'Pushed to Leads', description: 'Caller successfully added to your active Leads pipeline.' });
//       fetchData();
//     } catch {
//       toast({ title: 'Error', description: 'Could not push to leads.', variant: 'destructive' });
//     }
//   };

//   // Sync state to URL
//   useEffect(() => {
//     setSearchParams({ view: activeView });
//   }, [activeView, setSearchParams]);

//   // Fetch agents list for filter dropdown (admin only)
// // REPLACE THIS:
// useEffect(() => {
//   if (user?.role !== 'admin') return;
//   fetch(`${API_URL}/users?role=sales_agent`, {
//     headers: { Authorization: `Bearer ${token}` }
//   })
//     .then(r => r.json())
//     .then(data => setAgents(Array.isArray(data) ? data : []))
//     .catch(() => {});
// }, [token, user]);

// // WITH THIS:
// useEffect(() => {
//   if (user?.role !== 'admin' && user?.role !== 'sales_manager') return;
//   fetch(`${API_URL}/users`, {
//     headers: { Authorization: `Bearer ${token}` }
//   })
//     .then(r => r.json())
//     .then(data => setAgents(Array.isArray(data) ? data : []))
//     .catch(() => {});
// }, [token, user]);

//   // ─── ACTIVE FILTER COUNT ───
//   const activeFilterCount = useMemo(() => {
//     let count = 0;
//     if (filters.search) count++;
//     if (filters.dateFrom) count++;
//     if (filters.dateTo) count++;
//     if (filters.status !== 'all') count++;
//     if (filters.agentId !== 'all') count++;
//     if (filters.minDuration !== 'all') count++;
//     if (filters.source !== 'all') count++;
//     if (filters.direction !== 'all') count++;
//     return count;
//   }, [filters]);

//   // ─── FETCH DATA ───
//   const fetchData = useCallback(async () => {
//     if (activeView === 'reports') return;
//     setIsLoading(true);
//     setTableData([]);
//     try {
//       if (activeView === 'new_leads') {
//         const query = new URLSearchParams({ stage: 'new' });
//         if (filters.search) query.append('phone', filters.search);
//         const res = await fetch(`${API_URL}/leads?${query}`, {
//           headers: { Authorization: `Bearer ${token}` }
//         });
//         const leads: Lead[] = await res.json();
//         setTableData(leads.map(lead => ({
//           id: lead.id,
//           isLeadRow: true,
//           leadId: lead.id,
//           callStatus: 'pending',
//           displayDate: lead.createdAt || new Date().toISOString(),
//           duration: null,
//           notes: 'New lead awaiting connection',
//           lead,
//         })));
//       } else {
//         const query = new URLSearchParams({ view: activeView });
//         if (filters.search) query.append('search', filters.search);
//         if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
//         if (filters.dateTo) query.append('dateTo', filters.dateTo);
//         if (filters.status !== 'all') query.append('callStatus', filters.status);
//         if (filters.agentId !== 'all') query.append('agentId', filters.agentId);
//         if (filters.minDuration !== 'all') query.append('minDuration', filters.minDuration);
//         if (filters.source !== 'all') query.append('source', filters.source);
//         if (filters.direction !== 'all') query.append('direction', filters.direction);

//         const res = await fetch(`${API_URL}/call-logs?${query}`, {
//           headers: { Authorization: `Bearer ${token}` }
//         });
//         if (!res.ok) throw new Error('Failed to fetch logs');
//         const logs = await res.json();
//         setTableData(logs.map((log: any) => ({
//           id: log.id,
//           isLeadRow: false,
//           leadId: log.leadId,
//           agentId: log.agentId,
//           callStatus: log.callStatus,
//           displayDate: log.callDate,
//           duration: log.callDuration,
//           notes: log.notes,
//           lead: log.lead,
//           agent: log.agent,
//           isArchived: log.isArchived,
//           deletedAt: log.deletedAt,
//         })));
//       }
//     } catch (err) {
//       toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
//     } finally {
//       setIsLoading(false);
//     }
//   }, [activeView, filters, token, toast]);

//   const fetchStats = useCallback(async () => {
//     try {
//       const query = new URLSearchParams();
//       if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
//       if (filters.dateTo) query.append('dateTo', filters.dateTo);
//       if (filters.agentId !== 'all') query.append('agentId', filters.agentId);
//       if (filters.direction !== 'all') query.append('direction', filters.direction);

//       if (activeView === 'inbound' || activeView === 'outbound') {
//         query.set('direction', activeView);
//       }

//       const res = await fetch(`${API_URL}/call-logs/stats?${query}`, {
//         headers: { Authorization: `Bearer ${token}` }
//       });
//       const data = await res.json();
//       setStats(data);
//     } catch {}
//   }, [token, filters, activeView]);

//   useEffect(() => { fetchStats(); }, [fetchStats]);
//   useEffect(() => { fetchData(); }, [fetchData]);

//   const handleRefresh = async () => {
//     setIsRefreshing(true);
//     await Promise.all([fetchData(), fetchStats()]);
//     setIsRefreshing(false);
//   };

//   const clearFilters = () => setFilters(EMPTY_FILTERS);

//   // ─── MENU CONFIG ───
//   const menuItems = [
//     { id: 'reports', label: 'Reports', icon: BarChart3 },
//     { type: 'separator' },
//     { id: 'new_leads', label: 'New Web Leads', icon: Globe, className: 'text-blue-600 font-medium bg-blue-50/50' },
//     { type: 'separator' },
//     { id: 'all', label: 'All Calls', icon: Phone },
//     { id: 'inbound', label: 'Incoming Calls', icon: PhoneIncoming },
//     { id: 'outbound', label: 'Outgoing Calls', icon: PhoneOutgoing },
//     { id: 'attended', label: 'Attended Calls', icon: PhoneCall },
//     { id: 'active', label: 'Active (Today)', icon: CheckCircle2 },
//     { id: 'missed', label: 'Missed Calls', icon: PhoneMissed, className: 'text-red-600 font-medium' },
//     { id: 'qualified', label: 'Qualified Calls', icon: ThumbsUp },
//     { id: 'unqualified', label: 'Unqualified Calls', icon: ThumbsDown },
//     { id: 'analytics', label: 'Call Analysis', icon: BarChart3 },
//     { id: 'connect_group', label: 'Connect to Group', icon: Users },
//     { type: 'separator' },
//     { id: 'archive', label: 'Call Archive', icon: Archive },
//     { id: 'deleted', label: 'Deleted Calls', icon: Trash2 },
//   ];

//   // ─── ACTION HANDLERS ───
//   const handleViewDetails = (item: TableRowData) => {
//     setSelectedItem(item);
//     setIsEditOpen(true);
//   };

//   const handleCallAction = async (item: TableRowData) => {
//     toast({ title: 'Dialing...', description: `Connecting to ${item.lead.name} (${item.lead.phone})...` });
//     try {
//       const res = await fetch(`${API_URL}/call-logs/initiate-mcube`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ leadPhone: item.lead.phone }),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         toast({ title: 'Call Failed', description: data.error || 'Could not initiate call.', variant: 'destructive' });
//       } else {
//         toast({ title: '📞 Dialing...', description: `Your phone will ring first, then ${item.lead.name} will be connected.` });
//         setTimeout(() => { fetchData(); fetchStats(); }, 1500);
//       }
//     } catch {
//       toast({ title: 'Error', description: 'Could not reach MCUBE. Check your connection.', variant: 'destructive' });
//     }
//   };

//   const handleArchive = async (id: string) => {
//     try {
//       const res = await fetch(`${API_URL}/call-logs/${id}`, {
//         method: 'PATCH',
//         headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
//         body: JSON.stringify({ isArchived: true }),
//       });
//       if (!res.ok) throw new Error();
//       toast({ title: 'Archived', description: 'Call log moved to archive.' });
//       setTableData(prev => prev.filter(r => r.id !== id));
//       fetchStats();
//     } catch {
//       toast({ title: 'Error', description: 'Could not archive call log.', variant: 'destructive' });
//     }
//   };

//   const confirmDelete = (id: string) => { setItemToDelete(id); setIsDeleteAlertOpen(true); };

//   const handleDelete = async () => {
//     if (!itemToDelete) return;
//     try {
//       const res = await fetch(`${API_URL}/call-logs/${itemToDelete}`, {
//         method: 'DELETE',
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       if (!res.ok) throw new Error();
//       toast({ title: 'Deleted', description: 'Call log moved to trash.' });
//       setTableData(prev => prev.filter(r => r.id !== itemToDelete));
//       setIsDeleteAlertOpen(false);
//       fetchStats();
//     } catch {
//       toast({ title: 'Error', description: 'Could not delete call log.', variant: 'destructive' });
//     }
//   };

//   const handleDeleteLead = async (id: string) => {
//     if (!confirm('Are you sure you want to delete this lead? This action cannot be undone.')) return;
//     try {
//       const res = await fetch(`${API_URL}/leads/${id}`, {
//         method: 'DELETE',
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       if (!res.ok) throw new Error();
//       toast({ title: 'Deleted', description: 'Lead deleted successfully.' });
//       setTableData(prev => prev.filter(r => r.leadId !== id));
//       fetchStats();
//     } catch {
//       toast({ title: 'Error', description: 'Could not delete lead.', variant: 'destructive' });
//     }
//   };

//   // Helper to get call direction from notes
//   // KEEP getCallDirection as is, then ADD extractRecording right below it:

// const getCallDirection = (notes: string | null): 'inbound' | 'outbound' | null => {
//   if (!notes) return null;
//   if (notes.toLowerCase().includes('inbound')) return 'inbound';
//   if (notes.toLowerCase().includes('outbound')) return 'outbound';
//   return null;
// };

// // ✅ NEW: Extract recording filename/URL from notes
// const extractRecording = (notes: string | null): string | null => {
//   if (!notes) return null;
//   const match = notes.match(/Recording:\s*([^\s|]+)/i);
//   if (!match) return null;
//   const val = match[1].trim();
//   if (val === 'None' || val === '' || val === 'N/A') return null;
//   return val;
// };

//   return (
//     <DashboardLayout title="Telecalling Center" description="Manage your call operations">
//       <div className="flex flex-col lg:flex-row h-[calc(100vh-110px)] md:h-[calc(100vh-140px)] gap-4 lg:gap-6">

//         {/* ─── SIDEBAR ─── */}
//         <Card className="w-full lg:w-64 flex-shrink-0 h-auto lg:h-full overflow-hidden flex flex-col border-r bg-card">
//           <CardHeader className="pb-2 pt-4 px-4">
//             <CardTitle className="text-sm uppercase text-muted-foreground font-bold tracking-wider">Navigation</CardTitle>
//           </CardHeader>
//           <ScrollArea className="flex-1 max-h-[250px] lg:max-h-none">
//             <div className="p-2 space-y-1">
//               {menuItems.map((item, idx) =>
//                 item.type === 'separator' ? (
//                   <Separator key={idx} className="my-2" />
//                 ) : (
//                   <Button
//                     key={item.id}
//                     variant={activeView === item.id ? 'secondary' : 'ghost'}
//                     className={`w-full justify-start gap-3 h-10 ${item.className || ''} ${activeView === item.id ? 'bg-primary/10 text-primary font-semibold' : ''}`}
//                     onClick={() => setActiveView(item.id || 'reports')}
//                   >
//                     {item.icon && <item.icon className="h-4 w-4" />}
//                     <span className="truncate">{item.label}</span>
//                     {stats ? (() => {
//                       let count = 0;
//                       let badgeClass = 'bg-primary/10 text-primary';
//                       if (item.id === 'all') count = stats.totalCalls;
//                       else if (item.id === 'missed') { count = stats.notAnswered; badgeClass = 'bg-red-100 text-red-600'; }
//                       else if (item.id === 'qualified') count = stats.positive;
//                       else if (item.id === 'unqualified') count = stats.negative;
//                       else if (item.id === 'new_leads') { count = stats.newLeads; badgeClass = 'bg-blue-100 text-blue-600'; }
//                       else if (item.id === 'inbound') { count = stats.inboundTotal || 0; badgeClass = 'bg-green-100 text-green-700'; }
//                       else if (item.id === 'outbound') { count = stats.outboundTotal || 0; badgeClass = 'bg-indigo-100 text-indigo-700'; }
//                       if (count > 0) return (
//                         <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-bold ${badgeClass}`}>{count}</span>
//                       );
//                       return null;
//                     })() : null}
//                   </Button>
//                 )
//               )}
//             </div>
//           </ScrollArea>
//         </Card>

//         {/* ─── MAIN CONTENT ─── */}
//         <div className="flex-1 h-full flex flex-col min-w-0">

//           {activeView === 'reports' ? (
//             <ReportsView stats={stats} token={token} filters={filters} setFilters={setFilters} agents={agents} onRefresh={handleRefresh} isRefreshing={isRefreshing} />
//           ) : activeView === 'analytics' ? (
//             <AnalyticsView token={token} filters={filters} setFilters={setFilters} agents={agents} onRefresh={handleRefresh} isRefreshing={isRefreshing} />
//           ) : (
//             <Card className="h-full flex flex-col border shadow-sm">
//               {/* ─── TOOLBAR ─── */}
//               <div className="p-4 border-b flex items-center justify-between gap-2 bg-card/50">
//                 <div className="flex items-center gap-2">
//                   <div className="p-2 bg-primary/10 rounded-md">
//                     {(() => {
//                       const menuItem = menuItems.find(m => m.id === activeView);
//                       const Icon = menuItem?.icon || Phone;
//                       return <Icon className="h-5 w-5 text-primary" />;
//                     })()}
//                   </div>
//                   <h2 className="text-xl font-bold tracking-tight capitalize">
//                     {menuItems.find(m => m.id === activeView)?.label || 'Calls'}
//                   </h2>
//                   {tableData.length > 0 && (
//                     <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
//                       {tableData.length} records
//                     </span>
//                   )}
//                 </div>
//                 <div className="flex items-center gap-2">
//                   {/* ─── FILTER BUTTON + FLOATING POPOVER ─── */}
//                   <div className="relative">
//                     <Button
//                       variant="outline"
//                       size="sm"
//                       onClick={() => setShowFilters(p => !p)}
//                       className={`gap-2 ${activeFilterCount > 0 ? 'border-primary text-primary' : ''}`}
//                     >
//                       <Filter className="h-4 w-4" />
//                       Filters
//                       {activeFilterCount > 0 && (
//                         <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
//                           {activeFilterCount}
//                         </span>
//                       )}
//                     </Button>

//                     {showFilters && (
//                       <>
//                         <div className="fixed inset-0 z-40" onClick={() => setShowFilters(false)} />
//                         <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[340px] rounded-xl border bg-background shadow-2xl overflow-hidden">

//                           {/* ── HEADER ── */}
//                           <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
//                             <div className="flex items-center gap-2">
//                               <Filter className="h-4 w-4 text-muted-foreground" />
//                               <span className="text-sm font-semibold">Filter Calls</span>
//                               {activeFilterCount > 0 && (
//                                 <span className="bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
//                                   {activeFilterCount}
//                                 </span>
//                               )}
//                             </div>
//                             <button onClick={() => setShowFilters(false)} className="text-muted-foreground hover:text-foreground transition-colors rounded-md p-0.5 hover:bg-muted">
//                               <X className="h-4 w-4" />
//                             </button>
//                           </div>

//                           {/* ── FIELDS ── */}
//                           <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">

//                             {/* Search */}
//                             <div className="space-y-1.5">
//                               <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Search</label>
//                               <div className="relative">
//                                 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
//                                 <Input
//                                   placeholder="Name or phone..."
//                                   className="pl-8 h-9 text-sm"
//                                   value={filters.search}
//                                   onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
//                                 />
//                                 {filters.search && (
//                                   <button onClick={() => setFilters(p => ({ ...p, search: '' }))} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
//                                     <X className="h-3.5 w-3.5" />
//                                   </button>
//                                 )}
//                               </div>
//                             </div>

//                             {/* Date Range */}
//                             <div className="space-y-1.5">
//                               <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date Range</label>
//                               <div className="grid grid-cols-2 gap-2">
//                                 <div>
//                                   <p className="text-[10px] text-muted-foreground mb-1">From</p>
//                                   <Input
//                                     type="date"
//                                     className="h-9 text-sm"
//                                     value={filters.dateFrom}
//                                     onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))}
//                                   />
//                                 </div>
//                                 <div>
//                                   <p className="text-[10px] text-muted-foreground mb-1">To</p>
//                                   <Input
//                                     type="date"
//                                     className="h-9 text-sm"
//                                     value={filters.dateTo}
//                                     min={filters.dateFrom}
//                                     onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))}
//                                   />
//                                 </div>
//                               </div>
//                               {/* Quick presets */}
//                               <div className="flex gap-1.5 pt-0.5">
//                                 {[{ label: 'Today', days: 0 }, { label: '7 Days', days: 7 }, { label: '30 Days', days: 30 }].map(preset => {
//                                   const today = format(new Date(), 'yyyy-MM-dd');
//                                   const from = format(subDays(new Date(), preset.days), 'yyyy-MM-dd');
//                                   const isActive = filters.dateFrom === from && filters.dateTo === today;
//                                   return (
//                                     <button
//                                       key={preset.label}
//                                       className={`flex-1 text-xs border rounded-md py-1.5 transition-colors font-medium ${isActive ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
//                                       onClick={() => setFilters(p => ({ ...p, dateFrom: from, dateTo: today }))}
//                                     >
//                                       {preset.label}
//                                     </button>
//                                   );
//                                 })}
//                               </div>
//                             </div>

//                             {/* Call Status */}
//                             <div className="space-y-1.5">
//                               <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Call Status</label>
//                               <Select value={filters.status} onValueChange={v => setFilters(p => ({ ...p, status: v }))}>
//                                 <SelectTrigger className="h-9 text-sm">
//                                   <SelectValue placeholder="All Statuses" />
//                                 </SelectTrigger>
//                                 <SelectContent>
//                                   <SelectItem value="all">All Statuses</SelectItem>
//                                   <SelectItem value="connected_positive">✅ Qualified</SelectItem>
//                                   <SelectItem value="connected_callback">🔄 Callback</SelectItem>
//                                   <SelectItem value="not_connected">❌ Missed</SelectItem>
//                                   <SelectItem value="not_interested">👎 Unqualified</SelectItem>
//                                 </SelectContent>
//                               </Select>
//                             </div>

//                             {/* Call Direction */}
//                             <div className="space-y-1.5">
//                               <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Call Direction</label>
//                               <div className="grid grid-cols-3 gap-1.5">
//                                 {[
//                                   { value: 'all', label: 'All', icon: Phone },
//                                   { value: 'inbound', label: 'Incoming', icon: PhoneIncoming },
//                                   { value: 'outbound', label: 'Outgoing', icon: PhoneOutgoing },
//                                 ].map(opt => {
//                                   const Icon = opt.icon;
//                                   const isActive = filters.direction === opt.value;
//                                   return (
//                                     <button
//                                       key={opt.value}
//                                       onClick={() => setFilters(p => ({ ...p, direction: opt.value }))}
//                                       className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg border text-xs font-medium transition-all ${isActive ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'hover:bg-muted border-border'}`}
//                                     >
//                                       <Icon className="h-4 w-4" />
//                                       {opt.label}
//                                     </button>
//                                   );
//                                 })}
//                               </div>
//                             </div>

//                             {/* Agent (admin only) */}
//                             {agents.length > 0 && (
//                               <div className="space-y-1.5">
//                                 <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agent</label>
//                                 <Select value={filters.agentId} onValueChange={v => setFilters(p => ({ ...p, agentId: v }))}>
//                                   <SelectTrigger className="h-9 text-sm">
//                                     <SelectValue placeholder="All Agents" />
//                                   </SelectTrigger>
//                                   <SelectContent>
//                                     <SelectItem value="all">All Agents</SelectItem>
//                                     {agents.map(a => (
//                                       <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>
//                                     ))}
//                                   </SelectContent>
//                                 </Select>
//                               </div>
//                             )}

//                             {/* Duration */}
//                             <div className="space-y-1.5">
//                               <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Min Duration</label>
//                               <Select value={filters.minDuration} onValueChange={v => setFilters(p => ({ ...p, minDuration: v }))}>
//                                 <SelectTrigger className="h-9 text-sm">
//                                   <SelectValue placeholder="Any Duration" />
//                                 </SelectTrigger>
//                                 <SelectContent>
//                                   <SelectItem value="all">Any Duration</SelectItem>
//                                   <SelectItem value="30">30 seconds+</SelectItem>
//                                   <SelectItem value="60">1 minute+</SelectItem>
//                                   <SelectItem value="180">3 minutes+</SelectItem>
//                                   <SelectItem value="300">5 minutes+</SelectItem>
//                                 </SelectContent>
//                               </Select>
//                             </div>

//                             {/* Active filters summary */}
//                             {activeFilterCount > 0 && (
//                               <div className="flex flex-wrap gap-1.5 pt-1">
//                                 {filters.search && (
//                                   <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
//                                     Search: {filters.search}
//                                     <button onClick={() => setFilters(p => ({ ...p, search: '' }))}><X className="h-2.5 w-2.5" /></button>
//                                   </span>
//                                 )}
//                                 {filters.status !== 'all' && (
//                                   <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
//                                     Status: {filters.status}
//                                     <button onClick={() => setFilters(p => ({ ...p, status: 'all' }))}><X className="h-2.5 w-2.5" /></button>
//                                   </span>
//                                 )}
//                                 {filters.direction !== 'all' && (
//                                   <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
//                                     {filters.direction === 'inbound' ? '↙ Incoming' : '↗ Outgoing'}
//                                     <button onClick={() => setFilters(p => ({ ...p, direction: 'all' }))}><X className="h-2.5 w-2.5" /></button>
//                                   </span>
//                                 )}
//                                 {(filters.dateFrom || filters.dateTo) && (
//                                   <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
//                                     Date range
//                                     <button onClick={() => setFilters(p => ({ ...p, dateFrom: '', dateTo: '' }))}><X className="h-2.5 w-2.5" /></button>
//                                   </span>
//                                 )}
//                               </div>
//                             )}
//                           </div>

//                           {/* ── FOOTER ACTIONS ── */}
//                           <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
//                             <button
//                               onClick={clearFilters}
//                               className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
//                             >
//                               Clear all
//                             </button>
//                             <Button
//                               size="sm"
//                               className="bg-foreground text-background hover:bg-foreground/90 font-semibold px-5"
//                               onClick={() => setShowFilters(false)}
//                             >
//                               Apply filter
//                             </Button>
//                           </div>
//                         </div>
//                       </>
//                     )}
//                   </div>

//                   <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
//                     <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
//                   </Button>
//                 </div>
//               </div>

//               {/* ─── TABLE ─── */}
//               <div className="flex-1 overflow-hidden relative">
//                 <ScrollArea className="h-full w-full">
//                   <div className="min-w-[800px]">
//                     <Table>
//                       <TableHeader className="bg-muted/50 sticky top-0 z-10">
//                         <TableRow>
//                           <TableHead className="w-[160px]">Date & Time</TableHead>
//                           <TableHead>Client Name</TableHead>
//                           <TableHead>Phone Number</TableHead>
//                           <TableHead>Agent</TableHead>
//                           <TableHead>Direction</TableHead>
//                           <TableHead>Status</TableHead>
//                           <TableHead>Duration</TableHead>
//                           <TableHead className="text-right pr-6">Actions</TableHead>
//                         </TableRow>
//                       </TableHeader>
//                       <TableBody>
//                         {isLoading ? (
//                           <TableRow>
//                             <TableCell colSpan={8} className="h-64 text-center">
//                               <div className="flex items-center justify-center gap-2 text-muted-foreground">
//                                 <Loader2 className="h-6 w-6 animate-spin" />
//                                 Loading data...
//                               </div>
//                             </TableCell>
//                           </TableRow>
//                         ) : tableData.length === 0 ? (
//                           <TableRow>
//                             <TableCell colSpan={8} className="h-64 text-center">
//                               <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
//                                 <Search className="h-10 w-10 opacity-20" />
//                                 <p className="font-medium">No records found</p>
//                                 {activeFilterCount > 0 && (
//                                   <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1">
//                                     <X className="h-3 w-3" /> Clear filters
//                                   </Button>
//                                 )}
//                               </div>
//                             </TableCell>
//                           </TableRow>
//                         ) : (
//                           tableData.map(row => {
//                             const dir = getCallDirection(row.notes);
//                             return (
//                               <TableRow key={row.id} className="hover:bg-muted/50 transition-colors group">
//                                 <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
//                                   <div className="flex flex-col">
//                                     <span className="text-foreground font-medium">{format(parseISO(row.displayDate), 'MMM dd, yyyy')}</span>
//                                     <span className="text-[10px]">{format(parseISO(row.displayDate), 'hh:mm a')}</span>
//                                   </div>
//                                 </TableCell>
//                                 <TableCell>
//                                   <div className="flex items-center gap-2">
//                                     <Avatar className="h-8 w-8 border bg-background">
//                                       <AvatarFallback className="text-[10px] bg-primary/5 text-primary">
//                                         {row.lead?.name?.substring(0, 2).toUpperCase() || 'NA'}
//                                       </AvatarFallback>
//                                     </Avatar>
//                                     <div>
//                                       <span className="font-semibold text-sm block">
//                                         {row.lead?.name
//                                           ? row.lead.name.replace('Unverified MCUBE Caller - ', 'New Inquiry: ').replace('New Lead - ', 'New Inquiry: ')
//                                           : 'Unknown Lead'}
//                                       </span>
//                                       {row.isLeadRow ? (
//                                         <span className="text-[10px] text-blue-600 font-medium">New Website Lead</span>
//                                       ) : (
//                                         <span className="text-[10px] text-muted-foreground uppercase">{row.lead?.stage}</span>
//                                       )}
//                                     </div>
//                                   </div>
//                                 </TableCell>
//                                 <TableCell className="text-sm font-mono">{row.lead?.phone || '—'}</TableCell>
//                                 <TableCell className="text-sm text-muted-foreground">{row.agent?.fullName || '—'}</TableCell>
//                                 <TableCell>
//                                   {row.isLeadRow ? (
//                                     <span className="text-xs text-muted-foreground">—</span>
//                                   ) : dir === 'inbound' ? (
//                                     <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
//                                       <ArrowDownLeft className="h-3 w-3" /> Incoming
//                                     </span>
//                                   ) : dir === 'outbound' ? (
//                                     <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
//                                       <ArrowUpRight className="h-3 w-3" /> Outgoing
//                                     </span>
//                                   ) : (
//                                     <span className="text-xs text-muted-foreground">—</span>
//                                   )}
//                                 </TableCell>
//                                 <TableCell><StatusBadge status={row.callStatus} /></TableCell>
//                             <TableCell className="text-sm text-muted-foreground">
//   {(() => {
//     const rec = extractRecording(row.notes);
//     const durationText = row.duration
//       ? `${Math.floor(row.duration / 60)}m ${row.duration % 60}s`
//       : '—';

//     if (!rec) {
//       return <span>{durationText}</span>;
//     }

//     return (
//       <button
//         onClick={() => {
//           setSelectedItem(row);
//           setIsEditOpen(true);
//         }}
//         className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors group/rec"
//         title="Click to play recording"
//       >
//         <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 group-hover/rec:bg-blue-200 transition-colors">
//           <Play className="h-2.5 w-2.5 fill-blue-600 text-blue-600" />
//         </span>
//         {durationText}
//       </button>
//     );
//   })()}
// </TableCell>
//                                 <TableCell className="text-right pr-4">
//   <DropdownMenu>
//     <DropdownMenuTrigger asChild>
//       <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
//         <MoreVertical className="h-4 w-4" />
//       </Button>
//     </DropdownMenuTrigger>
//     <DropdownMenuContent align="end" className="w-48">
//       <DropdownMenuItem onClick={() => handleViewDetails(row)}>
//         View Details
//       </DropdownMenuItem>

//       {/* NEW: Edit Name */}
//       <DropdownMenuItem onClick={() => {
//         setLeadIdToEdit(row.leadId);
//         setNameToEdit(row.lead?.name || '');
//         setIsEditNameOpen(true);
//       }}>
//         <Edit className="h-3.5 w-3.5 mr-2" /> Edit Caller Name
//       </DropdownMenuItem>

//       {/* NEW: Push to Leads */}
//       {row.lead?.stage === 'unverified' && (
//         <DropdownMenuItem 
//           onClick={() => handlePushToLeads(row.leadId)} 
//           className="text-green-600 focus:text-green-700 font-medium"
//         >
//           <ArrowRightCircle className="h-3.5 w-3.5 mr-2" /> Push to Leads
//         </DropdownMenuItem>
//       )}

//       {!row.isLeadRow && (
//         <>
//           <DropdownMenuItem onClick={() => handleCallAction(row)}>
//             <Phone className="h-3.5 w-3.5 mr-2" /> Call Again
//           </DropdownMenuItem>
//           <DropdownMenuItem onClick={() => handleArchive(row.id)}>
//             <Archive className="h-3.5 w-3.5 mr-2" /> Archive
//           </DropdownMenuItem>
//           <DropdownMenuItem onClick={() => confirmDelete(row.id)} className="text-destructive focus:text-destructive">
//             <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
//           </DropdownMenuItem>
//         </>
//       )}
//       {row.isLeadRow && (
//         <>
//           <DropdownMenuItem onClick={() => handleCallAction(row)}>
//             <Phone className="h-3.5 w-3.5 mr-2" /> Initiate Call
//           </DropdownMenuItem>
//           <DropdownMenuItem onClick={() => handleDeleteLead(row.leadId)} className="text-destructive focus:text-destructive">
//             <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Lead
//           </DropdownMenuItem>
//         </>
//       )}
//     </DropdownMenuContent>
//   </DropdownMenu>
// </TableCell>
//                               </TableRow>
//                             );
//                           })
//                         )}
//                       </TableBody>
//                     </Table>
//                   </div>
//                 </ScrollArea>
//               </div>
//             </Card>
//           )}
//         </div>
//       </div>

//       {/* ─── VIEW DETAILS DIALOG ─── */}
//    {/* ─── VIEW DETAILS DIALOG ─── */}
// <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
//   <DialogContent className="sm:max-w-md">
//     <DialogHeader>
//       <DialogTitle>Call Details</DialogTitle>
//     </DialogHeader>
//     {selectedItem && (
//       <div className="space-y-4">
//         <div className="grid grid-cols-2 gap-4">
//           <div className="space-y-1.5">
//             <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Name</label>
//             <Input defaultValue={selectedItem.lead?.name} readOnly className="bg-muted" />
//           </div>
//           <div className="space-y-1.5">
//             <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
//             <Input defaultValue={selectedItem.lead?.phone} readOnly className="bg-muted" />
//           </div>
//         </div>
//         {!selectedItem.isLeadRow && (
//           <>
//             <div className="grid grid-cols-2 gap-4">
//               <div className="space-y-1.5">
//                 <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</label>
//                 <div className="pt-1"><StatusBadge status={selectedItem.callStatus} /></div>
//               </div>
//               <div className="space-y-1.5">
//                 <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Duration</label>
//                 <Input
//                   defaultValue={selectedItem.duration ? `${Math.floor(selectedItem.duration / 60)}m ${selectedItem.duration % 60}s` : 'N/A'}
//                   readOnly className="bg-muted" />
//               </div>
//             </div>
//             <div className="space-y-1.5">
//               <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Direction</label>
//               <div className="pt-1">
//                 {(() => {
//                   const dir = getCallDirection(selectedItem.notes);
//                   return dir === 'inbound' ? (
//                     <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
//                       <ArrowDownLeft className="h-3.5 w-3.5" /> Incoming Call
//                     </span>
//                   ) : dir === 'outbound' ? (
//                     <span className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
//                       <ArrowUpRight className="h-3.5 w-3.5" /> Outgoing Call
//                     </span>
//                   ) : <span className="text-sm text-muted-foreground">Unknown</span>;
//                 })()}
//               </div>
//             </div>

//             {/* ✅ NEW: Call Recording Player */}
//             {(() => {
//               const rec = extractRecording(selectedItem.notes);
//               return rec ? (
//                 <div className="space-y-1.5">
//                   <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Call Recording</label>
//                   <div className="rounded-lg border bg-muted/30 p-3">
//                     {rec.startsWith('http') ? (
//                       <audio controls className="w-full h-10">
//                         <source src={rec} />
//                         <a href={rec} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
//                           Download Recording
//                         </a>
//                       </audio>
//                     ) : (
//                       <p className="text-sm text-muted-foreground font-mono break-all">{rec}</p>
//                     )}
//                   </div>
//                 </div>
//               ) : (
//                 <div className="space-y-1.5">
//                   <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Call Recording</label>
//                   <p className="text-sm text-muted-foreground italic">No recording available</p>
//                 </div>
//               );
//             })()}
//           </>
//         )}
//         <div className="space-y-1.5">
//           <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
//           <textarea
//             className="w-full min-h-[80px] rounded-md border bg-muted px-3 py-2 text-sm resize-none"
//             defaultValue={selectedItem.notes || ''}
//             readOnly
//           />
//         </div>
//         {selectedItem.isLeadRow && (
//           <Button className="w-full gap-2" onClick={() => { handleCallAction(selectedItem); setIsEditOpen(false); }}>
//             <Phone className="h-4 w-4" /> Initiate Call
//           </Button>
//         )}
//       </div>
//     )}
//     <DialogFooter>
//       <Button variant="outline" onClick={() => setIsEditOpen(false)}>Close</Button>
//     </DialogFooter>
//   </DialogContent>
// </Dialog>

     
//       {/* ─── EDIT CALLER NAME DIALOG ─── */}
//       <Dialog open={isEditNameOpen} onOpenChange={setIsEditNameOpen}>
//         <DialogContent className="sm:max-w-sm">
//           <DialogHeader>
//             <DialogTitle>Edit Caller Name</DialogTitle>
//           </DialogHeader>
//           <div className="space-y-4 py-4">
//             <div className="space-y-2">
//               <label className="text-sm font-medium">Name</label>
//               <Input 
//                 value={nameToEdit} 
//                 onChange={(e) => setNameToEdit(e.target.value)} 
//                 placeholder="Enter caller's real name"
//                 autoFocus
//               />
//             </div>
//           </div>
//           <DialogFooter>
//             <Button variant="ghost" onClick={() => setIsEditNameOpen(false)}>Cancel</Button>
//             <Button onClick={handleSaveName}>Save Name</Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>

//       {/* ─── CONFIRM DELETE ─── */}
//       <Dialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
//         <DialogContent className="sm:max-w-md">
//           <DialogHeader>
//             <DialogTitle className="flex items-center gap-2 text-red-600">
//               <AlertCircle className="h-5 w-5" /> Confirm Deletion
//             </DialogTitle>
//           </DialogHeader>
//           <p className="text-sm text-muted-foreground py-2">
//             Are you sure you want to move this call log to trash? It will be hidden from active views.
//           </p>
//           <DialogFooter className="gap-2 sm:gap-0">
//             <Button variant="ghost" onClick={() => setIsDeleteAlertOpen(false)}>Cancel</Button>
//             <Button variant="destructive" onClick={handleDelete}>Delete</Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </DashboardLayout>
//   );
// }

// // ─────────────────────────────────────────────
// // STATUS BADGE
// // ─────────────────────────────────────────────
// function StatusBadge({ status }: { status: string }) {
//   const configs: Record<string, { label: string; className: string; icon: any }> = {
//     pending: { label: 'To Call', className: 'bg-orange-100 text-orange-700 border-orange-200', icon: ArrowRightCircle },
//     connected_positive: { label: 'Qualified', className: 'bg-green-100 text-green-700 border-green-200', icon: ThumbsUp },
//     connected_callback: { label: 'Callback', className: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
//     not_connected: { label: 'Missed', className: 'bg-red-100 text-red-700 border-red-200', icon: PhoneMissed },
//     not_interested: { label: 'Unqualified', className: 'bg-gray-100 text-gray-700 border-gray-200', icon: ThumbsDown },
//   };
//   const config = configs[status] || { label: status, className: 'bg-gray-100 border-gray-200', icon: Phone };
//   const Icon = config.icon;
//   return (
//     <Badge variant="outline" className={`${config.className} flex w-fit items-center gap-1.5 px-2 py-0.5 shadow-sm`}>
//       <Icon className="h-3 w-3" />
//       {config.label}
//     </Badge>
//   );
// }

// // ─────────────────────────────────────────────
// // DIRECTION BADGE MINI
// // ─────────────────────────────────────────────
// function DirectionBadge({ direction }: { direction: 'inbound' | 'outbound' }) {
//   return direction === 'inbound' ? (
//     <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
//       <ArrowDownLeft className="h-3.5 w-3.5" /> Incoming
//     </span>
//   ) : (
//     <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700">
//       <ArrowUpRight className="h-3.5 w-3.5" /> Outgoing
//     </span>
//   );
// }

// // ─────────────────────────────────────────────
// // REPORTS VIEW — full analytics dashboard
// // ─────────────────────────────────────────────
// interface ReportsViewProps {
//   stats: CallStats | null;
//   token: string | null;
//   filters: FilterState;
//   setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
//   agents: Agent[];
//   onRefresh: () => void;
//   isRefreshing: boolean;
// }

// function ReportsView({ stats, token, filters, setFilters, agents, onRefresh, isRefreshing }: ReportsViewProps) {
//   const [trend, setTrend] = useState<any[]>([]);
//   const [agentPerf, setAgentPerf] = useState<any[]>([]);
//   const [directionTrend, setDirectionTrend] = useState<any[]>([]);
//   const [isLoadingReports, setIsLoadingReports] = useState(false);

//   const fetchReportData = useCallback(async () => {
//     if (!token) return;
//     setIsLoadingReports(true);
//     try {
//       const query = new URLSearchParams({ view: 'all' });
//       if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
//       if (filters.dateTo) query.append('dateTo', filters.dateTo);
//       if (filters.agentId !== 'all') query.append('agentId', filters.agentId);
//       if (filters.direction !== 'all') query.append('direction', filters.direction);

//       const res = await fetch(`${API_URL}/call-logs?${query}&take=1000`, {
//         headers: { Authorization: `Bearer ${token}` }
//       });
//       if (!res.ok) return;
//       const logs: any[] = await res.json();

//       // ─── Build 7-day trend (total, inbound, outbound) ───
//       const last7: Record<string, { date: string; total: number; connected: number; missed: number; inbound: number; outbound: number }> = {};
//       for (let i = 6; i >= 0; i--) {
//         const d = format(subDays(new Date(), i), 'MMM dd');
//         last7[format(subDays(new Date(), i), 'yyyy-MM-dd')] = { date: d, total: 0, connected: 0, missed: 0, inbound: 0, outbound: 0 };
//       }
//       logs.forEach(log => {
//         const day = log.callDate?.split('T')[0];
//         if (last7[day]) {
//           last7[day].total++;
//           if (['connected_positive', 'connected_callback'].includes(log.callStatus)) last7[day].connected++;
//           if (log.callStatus === 'not_connected') last7[day].missed++;
//           const notes = (log.notes || '').toLowerCase();
//           if (notes.includes('inbound')) last7[day].inbound++;
//           else if (notes.includes('outbound')) last7[day].outbound++;
//         }
//       });
//       setTrend(Object.values(last7));

//       // ─── Direction trend (7-day) ───
//       setDirectionTrend(Object.values(last7));

//       // ─── Build agent performance ───
//       const agentMap: Record<string, { name: string; total: number; connected: number; missed: number; qualified: number; inbound: number; outbound: number }> = {};
//       logs.forEach(log => {
//         const name = log.agent?.fullName || 'Unassigned';
//         if (!agentMap[name]) agentMap[name] = { name, total: 0, connected: 0, missed: 0, qualified: 0, inbound: 0, outbound: 0 };
//         agentMap[name].total++;
//         if (['connected_positive', 'connected_callback'].includes(log.callStatus)) agentMap[name].connected++;
//         if (log.callStatus === 'not_connected') agentMap[name].missed++;
//         if (log.callStatus === 'connected_positive') agentMap[name].qualified++;
//         const notes = (log.notes || '').toLowerCase();
//         if (notes.includes('inbound')) agentMap[name].inbound++;
//         else if (notes.includes('outbound')) agentMap[name].outbound++;
//       });
//       const perf = Object.values(agentMap)
//         .map(a => ({ ...a, rate: a.total > 0 ? Math.round((a.connected / a.total) * 100) : 0 }))
//         .sort((a, b) => b.total - a.total)
//         .slice(0, 8);
//       setAgentPerf(perf);
//     } catch { }
//     finally { setIsLoadingReports(false); }
//   }, [token, filters.dateFrom, filters.dateTo, filters.agentId, filters.direction]);

//   useEffect(() => { fetchReportData(); }, [fetchReportData]);

//   // ─── Derived stats for inbound/outbound ───
//   const inboundTotal = stats?.inboundTotal ?? 0;
//   const outboundTotal = stats?.outboundTotal ?? 0;
//   const inboundConnected = stats?.inboundConnected ?? 0;
//   const outboundConnected = stats?.outboundConnected ?? 0;
//   const inboundMissed = stats?.inboundMissed ?? 0;
//   const outboundMissed = stats?.outboundMissed ?? 0;

//   // ─── Direction Pie ───
//   const directionPieData = [
//     { name: 'Incoming', value: inboundTotal, color: '#22c55e' },
//     { name: 'Outgoing', value: outboundTotal, color: '#6366f1' },
//   ].filter(d => d.value > 0);

//   // Pie data
//   const pieData = stats ? [
//     { name: 'Qualified', value: stats.positive, color: '#22c55e' },
//     { name: 'Callback', value: stats.callback || 0, color: '#3b82f6' },
//     { name: 'Missed', value: stats.notAnswered, color: '#ef4444' },
//     { name: 'Unqualified', value: stats.negative, color: '#6b7280' },
//   ].filter(d => d.value > 0) : [];

//   if (!stats) return (
//     <div className="flex-1 flex items-center justify-center">
//       <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
//     </div>
//   );

//   return (
//     <ScrollArea className="h-full">
//       <div className="space-y-6 p-1 pb-8">

//         {/* ─── REPORT HEADER ─── */}
//         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
//           <div>
//             <h2 className="text-2xl font-bold tracking-tight">Call Reports & Analytics</h2>
//             <p className="text-sm text-muted-foreground mt-0.5">
//               {filters.dateFrom && filters.dateTo
//                 ? `${format(new Date(filters.dateFrom), 'MMM dd')} – ${format(new Date(filters.dateTo), 'MMM dd, yyyy')}`
//                 : 'All time overview'}
//             </p>
//           </div>
//           <div className="flex items-center gap-2 flex-wrap">
//             <div className="flex items-center gap-1.5 bg-background border rounded-md px-2 py-0.5 shadow-sm">
//               <span className="text-xs font-semibold text-muted-foreground">From:</span>
//               <Input type="date" className="h-7 w-fit text-xs border-none shadow-none px-0 py-0 bg-transparent focus-visible:ring-0"
//                 value={filters.dateFrom} onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))} />
//               <span className="text-xs font-semibold text-muted-foreground ml-1">To:</span>
//               <Input type="date" className="h-7 w-fit text-xs border-none shadow-none px-0 py-0 bg-transparent focus-visible:ring-0"
//                 value={filters.dateTo} onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))} min={filters.dateFrom} />
//             </div>
//             {[{ label: 'Today', days: 0 }, { label: 'This Week', days: 7 }, { label: 'This Month', days: 30 }].map(p => (
//               <Button key={p.label} variant="outline" size="sm" className="h-8 text-xs"
//                 onClick={() => {
//                   const today = format(new Date(), 'yyyy-MM-dd');
//                   const from = format(subDays(new Date(), p.days), 'yyyy-MM-dd');
//                   setFilters(prev => ({ ...prev, dateFrom: from, dateTo: today }));
//                 }}>
//                 {p.label}
//               </Button>
//             ))}
//             {agents.length > 0 && (
//               <Select value={filters.agentId} onValueChange={v => setFilters(p => ({ ...p, agentId: v }))}>
//                 <SelectTrigger className="h-8 text-xs w-36">
//                   <SelectValue placeholder="All Agents" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="all">All Agents</SelectItem>
//                   {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>)}
//                 </SelectContent>
//               </Select>
//             )}
//             {(filters.dateFrom || filters.agentId !== 'all') && (
//               <Button variant="ghost" size="sm" className="h-8 text-xs gap-1"
//                 onClick={() => setFilters(p => ({ ...p, dateFrom: '', dateTo: '', agentId: 'all' }))}>
//                 <X className="h-3 w-3" /> Clear
//               </Button>
//             )}
//             <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onRefresh} disabled={isRefreshing}>
//               <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
//               Refresh
//             </Button>
//           </div>
//         </div>

//         {/* ─── KPI STAT CARDS ─── */}
//         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//           <KpiCard title="Total Calls" value={stats.totalCalls} icon={Phone} color="blue" subtitle={`${stats.connectRate}% connect rate`} />
//           <KpiCard title="Qualified" value={stats.positive} icon={ThumbsUp} color="green"
//             subtitle={stats.totalCalls > 0 ? `${Math.round((stats.positive / stats.totalCalls) * 100)}% of all calls` : '—'} trend="up" />
//           <KpiCard title="Missed Calls" value={stats.notAnswered} icon={PhoneMissed} color="red"
//             subtitle={stats.totalCalls > 0 ? `${Math.round((stats.notAnswered / stats.totalCalls) * 100)}% miss rate` : '—'} trend="down" />
//           <KpiCard title="Callbacks Pending" value={stats.callback || 0} icon={Clock} color="amber" subtitle="Awaiting follow-up" />
//         </div>

//         {/* ─── INBOUND vs OUTBOUND BREAKDOWN ─── */}
//         <div>
//           <div className="flex items-center gap-2 mb-3">
//             <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Incoming vs Outgoing Breakdown</h3>
//             <div className="flex-1 h-px bg-border" />
//           </div>
//           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
//             {/* Inbound Card */}
//             <Card className="border-l-4 border-l-green-500 bg-green-50/30">
//               <CardContent className="p-5">
//                 <div className="flex items-center justify-between mb-4">
//                   <div className="flex items-center gap-2">
//                     <div className="p-2 rounded-lg bg-green-100 text-green-700">
//                       <ArrowDownLeft className="h-5 w-5" />
//                     </div>
//                     <div>
//                       <p className="font-bold text-green-800">Incoming Calls</p>
//                       <p className="text-xs text-green-600">Calls received from customers</p>
//                     </div>
//                   </div>
//                   <span className="text-3xl font-bold text-green-700">{inboundTotal}</span>
//                 </div>
//                 <div className="grid grid-cols-3 gap-3">
//                   <div className="bg-white/70 rounded-lg p-3 text-center border border-green-100">
//                     <p className="text-lg font-bold text-green-700">{inboundConnected}</p>
//                     <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Answered</p>
//                     <p className="text-[10px] text-green-600 font-semibold">
//                       {inboundTotal > 0 ? `${Math.round((inboundConnected / inboundTotal) * 100)}%` : '—'}
//                     </p>
//                   </div>
//                   <div className="bg-white/70 rounded-lg p-3 text-center border border-green-100">
//                     <p className="text-lg font-bold text-red-600">{inboundMissed}</p>
//                     <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Missed</p>
//                     <p className="text-[10px] text-red-500 font-semibold">
//                       {inboundTotal > 0 ? `${Math.round((inboundMissed / inboundTotal) * 100)}%` : '—'}
//                     </p>
//                   </div>
//                   <div className="bg-white/70 rounded-lg p-3 text-center border border-green-100">
//                     <p className="text-lg font-bold text-amber-600">
//                       {inboundTotal > 0 ? `${Math.round((inboundConnected / inboundTotal) * 100)}%` : '—'}
//                     </p>
//                     <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Connect Rate</p>
//                     <p className="text-[10px] text-amber-600 font-semibold">efficiency</p>
//                   </div>
//                 </div>
//                 {inboundTotal > 0 && (
//                   <div className="mt-3">
//                     <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
//                       <span>Answer rate</span>
//                       <span>{Math.round((inboundConnected / inboundTotal) * 100)}%</span>
//                     </div>
//                     <div className="h-1.5 rounded-full bg-green-100 overflow-hidden">
//                       <div className="h-full rounded-full bg-green-500 transition-all"
//                         style={{ width: `${Math.round((inboundConnected / inboundTotal) * 100)}%` }} />
//                     </div>
//                   </div>
//                 )}
//               </CardContent>
//             </Card>

//             {/* Outbound Card */}
//             <Card className="border-l-4 border-l-indigo-500 bg-indigo-50/30">
//               <CardContent className="p-5">
//                 <div className="flex items-center justify-between mb-4">
//                   <div className="flex items-center gap-2">
//                     <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
//                       <ArrowUpRight className="h-5 w-5" />
//                     </div>
//                     <div>
//                       <p className="font-bold text-indigo-800">Outgoing Calls</p>
//                       <p className="text-xs text-indigo-600">Calls made to customers</p>
//                     </div>
//                   </div>
//                   <span className="text-3xl font-bold text-indigo-700">{outboundTotal}</span>
//                 </div>
//                 <div className="grid grid-cols-3 gap-3">
//                   <div className="bg-white/70 rounded-lg p-3 text-center border border-indigo-100">
//                     <p className="text-lg font-bold text-indigo-700">{outboundConnected}</p>
//                     <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Answered</p>
//                     <p className="text-[10px] text-indigo-600 font-semibold">
//                       {outboundTotal > 0 ? `${Math.round((outboundConnected / outboundTotal) * 100)}%` : '—'}
//                     </p>
//                   </div>
//                   <div className="bg-white/70 rounded-lg p-3 text-center border border-indigo-100">
//                     <p className="text-lg font-bold text-red-600">{outboundMissed}</p>
//                     <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Not Answered</p>
//                     <p className="text-[10px] text-red-500 font-semibold">
//                       {outboundTotal > 0 ? `${Math.round((outboundMissed / outboundTotal) * 100)}%` : '—'}
//                     </p>
//                   </div>
//                   <div className="bg-white/70 rounded-lg p-3 text-center border border-indigo-100">
//                     <p className="text-lg font-bold text-amber-600">
//                       {outboundTotal > 0 ? `${Math.round((outboundConnected / outboundTotal) * 100)}%` : '—'}
//                     </p>
//                     <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Connect Rate</p>
//                     <p className="text-[10px] text-amber-600 font-semibold">efficiency</p>
//                   </div>
//                 </div>
//                 {outboundTotal > 0 && (
//                   <div className="mt-3">
//                     <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
//                       <span>Answer rate</span>
//                       <span>{Math.round((outboundConnected / outboundTotal) * 100)}%</span>
//                     </div>
//                     <div className="h-1.5 rounded-full bg-indigo-100 overflow-hidden">
//                       <div className="h-full rounded-full bg-indigo-500 transition-all"
//                         style={{ width: `${Math.round((outboundConnected / outboundTotal) * 100)}%` }} />
//                     </div>
//                   </div>
//                 )}
//               </CardContent>
//             </Card>
//           </div>
//         </div>

//         {/* ─── SECONDARY METRICS ─── */}
//         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//           <MetricTile label="Connect Rate" value={`${stats.connectRate}%`} icon={Target}
//             sub={stats.connectRate >= 50 ? 'Above target' : 'Below target'} good={stats.connectRate >= 50} />
//           <MetricTile label="Unqualified" value={stats.negative} icon={ThumbsDown}
//             sub={stats.totalCalls > 0 ? `${Math.round((stats.negative / stats.totalCalls) * 100)}% reject rate` : '—'} good={false} />
//           <MetricTile label="Connected Calls" value={stats.connectedCalls} icon={PhoneCall}
//             sub="Answered by customer" good={true} />
//           <MetricTile label="New Leads" value={stats.newLeads} icon={Zap}
//             sub="In pipeline" good={true} />
//         </div>

//         {/* ─── CHARTS ROW 1: Trend + Direction Ratio ─── */}
//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//           {/* 7-Day Trend with inbound/outbound */}
//           <Card className="lg:col-span-2">
//             <CardHeader className="pb-2">
//               <div className="flex items-center justify-between">
//                 <CardTitle className="text-base font-semibold">7-Day Call Trend</CardTitle>
//                 {isLoadingReports && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
//               </div>
//               <p className="text-xs text-muted-foreground">Total, incoming & outgoing volume over last 7 days</p>
//             </CardHeader>
//             <CardContent>
//               {trend.length > 0 ? (
//                 <ResponsiveContainer width="100%" height={220}>
//                   <AreaChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
//                     <defs>
//                       <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
//                         <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
//                         <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
//                       </linearGradient>
//                       <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
//                         <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
//                         <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
//                       </linearGradient>
//                       <linearGradient id="colorMissed" x1="0" y1="0" x2="0" y2="1">
//                         <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
//                         <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
//                       </linearGradient>
//                     </defs>
//                     <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
//                     <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
//                     <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
//                     <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
//                     <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
//                     <Area type="monotone" dataKey="inbound" name="Incoming" stroke="#22c55e" strokeWidth={2} fill="url(#colorInbound)" dot={{ r: 3 }} />
//                     <Area type="monotone" dataKey="outbound" name="Outgoing" stroke="#6366f1" strokeWidth={2} fill="url(#colorOutbound)" dot={{ r: 3 }} />
//                     <Area type="monotone" dataKey="missed" name="Missed" stroke="#ef4444" strokeWidth={2} fill="url(#colorMissed)" dot={{ r: 3 }} />
//                   </AreaChart>
//                 </ResponsiveContainer>
//               ) : <EmptyChart label="No trend data available" />}
//             </CardContent>
//           </Card>

//           {/* Inbound / Outbound Ratio Pie */}
//           <Card>
//             <CardHeader className="pb-2">
//               <CardTitle className="text-base font-semibold">Call Direction Ratio</CardTitle>
//               <p className="text-xs text-muted-foreground">Incoming vs outgoing split</p>
//             </CardHeader>
//             <CardContent>
//               {directionPieData.length > 0 ? (
//                 <div className="flex flex-col items-center gap-4">
//                   <ResponsiveContainer width="100%" height={160}>
//                     <PieChart>
//                       <Pie data={directionPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
//                         {directionPieData.map((entry, index) => (
//                           <Cell key={index} fill={entry.color} />
//                         ))}
//                       </Pie>
//                       <Tooltip formatter={(v: any, n: string) => [`${v} calls`, n]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
//                     </PieChart>
//                   </ResponsiveContainer>
//                   <div className="w-full space-y-2">
//                     {directionPieData.map(d => (
//                       <div key={d.name} className="flex items-center justify-between text-xs">
//                         <div className="flex items-center gap-2">
//                           <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
//                           <span className="text-muted-foreground">{d.name}</span>
//                         </div>
//                         <div className="flex items-center gap-2">
//                           <span className="font-semibold">{d.value}</span>
//                           <span className="text-muted-foreground w-10 text-right">
//                             {stats.totalCalls > 0 ? `${Math.round((d.value / stats.totalCalls) * 100)}%` : '0%'}
//                           </span>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                   {/* Visual ratio bar */}
//                   {inboundTotal + outboundTotal > 0 && (
//                     <div className="w-full">
//                       <div className="flex rounded-full overflow-hidden h-2.5">
//                         <div className="bg-green-500 transition-all" style={{ width: `${Math.round((inboundTotal / (inboundTotal + outboundTotal)) * 100)}%` }} />
//                         <div className="bg-indigo-500 flex-1" />
//                       </div>
//                       <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
//                         <span className="text-green-600 font-medium">↙ Incoming {Math.round((inboundTotal / (inboundTotal + outboundTotal)) * 100)}%</span>
//                         <span className="text-indigo-600 font-medium">{Math.round((outboundTotal / (inboundTotal + outboundTotal)) * 100)}% Outgoing ↗</span>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               ) : <EmptyChart label="No direction data" />}
//             </CardContent>
//           </Card>
//         </div>

//         {/* ─── CHARTS ROW 2: Status Dist + Agent Performance ─── */}
//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//           {/* Status Distribution Pie */}
//           <Card>
//             <CardHeader className="pb-2">
//               <CardTitle className="text-base font-semibold">Status Distribution</CardTitle>
//               <p className="text-xs text-muted-foreground">Call outcome breakdown</p>
//             </CardHeader>
//             <CardContent>
//               {pieData.length > 0 ? (
//                 <div className="flex flex-col items-center gap-4">
//                   <ResponsiveContainer width="100%" height={160}>
//                     <PieChart>
//                       <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
//                         {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
//                       </Pie>
//                       <Tooltip formatter={(v: any, n: string) => [`${v} calls`, n]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
//                     </PieChart>
//                   </ResponsiveContainer>
//                   <div className="w-full space-y-2">
//                     {pieData.map(d => (
//                       <div key={d.name} className="flex items-center justify-between text-xs">
//                         <div className="flex items-center gap-2">
//                           <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
//                           <span className="text-muted-foreground">{d.name}</span>
//                         </div>
//                         <div className="flex items-center gap-2">
//                           <span className="font-semibold">{d.value}</span>
//                           <span className="text-muted-foreground w-10 text-right">
//                             {stats.totalCalls > 0 ? `${Math.round((d.value / stats.totalCalls) * 100)}%` : '0%'}
//                           </span>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               ) : <EmptyChart label="No status data" />}
//             </CardContent>
//           </Card>

//           {/* Agent Performance */}
//           <Card className="lg:col-span-2">
//             <CardHeader className="pb-2">
//               <div className="flex items-center justify-between">
//                 <div>
//                   <CardTitle className="text-base font-semibold">Agent Performance Breakdown</CardTitle>
//                   <p className="text-xs text-muted-foreground mt-0.5">Calls handled per agent with incoming/outgoing split</p>
//                 </div>
//                 {isLoadingReports && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
//               </div>
//             </CardHeader>
//             <CardContent>
//               {agentPerf.length > 0 ? (
//                 <div className="space-y-2">
//                   {agentPerf.map((agent, idx) => (
//                     <div key={agent.name} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors">
//                       <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-100 text-gray-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-muted text-muted-foreground'}`}>
//                         {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
//                       </div>
//                       <div className="flex-1 min-w-0">
//                         <div className="flex items-center justify-between gap-2">
//                           <span className="text-sm font-medium truncate">{agent.name}</span>
//                           <div className="flex items-center gap-3 text-xs flex-shrink-0">
//                             <span className="flex items-center gap-1 text-green-600 font-semibold">
//                               <ArrowDownLeft className="h-3 w-3" />{agent.inbound}
//                             </span>
//                             <span className="flex items-center gap-1 text-indigo-600 font-semibold">
//                               <ArrowUpRight className="h-3 w-3" />{agent.outbound}
//                             </span>
//                             <span className="text-muted-foreground">{agent.total} total</span>
//                           </div>
//                         </div>
//                         <div className="flex items-center gap-2 mt-1.5">
//                           {/* Inbound/Outbound stacked mini bar */}
//                           {agent.total > 0 && (
//                             <div className="flex rounded-full overflow-hidden h-1.5 flex-1">
//                               <div className="bg-green-400 transition-all" style={{ width: `${Math.round((agent.inbound / agent.total) * 100)}%` }} title={`Incoming: ${agent.inbound}`} />
//                               <div className="bg-indigo-400 transition-all" style={{ width: `${Math.round((agent.outbound / agent.total) * 100)}%` }} title={`Outgoing: ${agent.outbound}`} />
//                               <div className="bg-muted flex-1" />
//                             </div>
//                           )}
//                           <span className={`text-xs font-semibold flex-shrink-0 ${agent.rate >= 60 ? 'text-green-600' : agent.rate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
//                             {agent.rate}%
//                           </span>
//                         </div>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               ) : <EmptyChart label="No agent data for this period" />}
//             </CardContent>
//           </Card>
//         </div>

//         {/* ─── SUMMARY TABLE ─── */}
//         <Card>
//           <CardHeader className="pb-2">
//             <CardTitle className="text-base font-semibold">Summary Report</CardTitle>
//           </CardHeader>
//           <CardContent className="p-0">
//             <Table>
//               <TableHeader className="bg-muted/40">
//                 <TableRow>
//                   <TableHead>Metric</TableHead>
//                   <TableHead className="text-right">Value</TableHead>
//                   <TableHead className="text-right">% of Total</TableHead>
//                   <TableHead className="text-right">Status</TableHead>
//                 </TableRow>
//               </TableHeader>
//               <TableBody>
//                 {[
//                   { label: 'Total Calls Made', value: stats.totalCalls, pct: 100, good: null },
//                   { label: '↙ Incoming Calls', value: inboundTotal, pct: stats.totalCalls > 0 ? Math.round((inboundTotal / stats.totalCalls) * 100) : 0, good: null },
//                   { label: '↗ Outgoing Calls', value: outboundTotal, pct: stats.totalCalls > 0 ? Math.round((outboundTotal / stats.totalCalls) * 100) : 0, good: null },
//                   { label: 'Connected (Answered)', value: stats.connectedCalls, pct: stats.totalCalls > 0 ? Math.round((stats.connectedCalls / stats.totalCalls) * 100) : 0, good: true },
//                   { label: 'Qualified Leads', value: stats.positive, pct: stats.totalCalls > 0 ? Math.round((stats.positive / stats.totalCalls) * 100) : 0, good: true },
//                   { label: 'Callback Scheduled', value: stats.callback || 0, pct: stats.totalCalls > 0 ? Math.round(((stats.callback || 0) / stats.totalCalls) * 100) : 0, good: null },
//                   { label: 'Not Connected (Missed)', value: stats.notAnswered, pct: stats.totalCalls > 0 ? Math.round((stats.notAnswered / stats.totalCalls) * 100) : 0, good: false },
//                   { label: 'Not Interested', value: stats.negative, pct: stats.totalCalls > 0 ? Math.round((stats.negative / stats.totalCalls) * 100) : 0, good: false },
//                   { label: 'Overall Connect Rate', value: `${stats.connectRate}%`, pct: null, good: stats.connectRate >= 50 },
//                   { label: 'New Leads in Pipeline', value: stats.newLeads, pct: null, good: null },
//                 ].map(row => (
//                   <TableRow key={row.label} className="hover:bg-muted/30">
//                     <TableCell className="font-medium text-sm">{row.label}</TableCell>
//                     <TableCell className="text-right font-bold">{row.value}</TableCell>
//                     <TableCell className="text-right text-muted-foreground text-sm">{row.pct !== null ? `${row.pct}%` : '—'}</TableCell>
//                     <TableCell className="text-right">
//                       {row.good === null ? (
//                         <Badge variant="outline" className="text-xs">Neutral</Badge>
//                       ) : row.good ? (
//                         <Badge className="bg-green-100 text-green-700 border-green-200 text-xs hover:bg-green-100">
//                           <TrendingUp className="h-3 w-3 mr-1" /> Good
//                         </Badge>
//                       ) : (
//                         <Badge className="bg-red-100 text-red-700 border-red-200 text-xs hover:bg-red-100">
//                           <TrendingDown className="h-3 w-3 mr-1" /> Needs Attention
//                         </Badge>
//                       )}
//                     </TableCell>
//                   </TableRow>
//                 ))}
//               </TableBody>
//             </Table>
//           </CardContent>
//         </Card>

//       </div>
//     </ScrollArea>
//   );
// }

// // ─────────────────────────────────────────────
// // ANALYTICS VIEW — deep-dive call analysis
// // ─────────────────────────────────────────────
// interface AnalyticsViewProps {
//   token: string | null;
//   filters: FilterState;
//   setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
//   agents: Agent[];
//   onRefresh: () => void;
//   isRefreshing: boolean;
// }

// function AnalyticsView({ token, filters, setFilters, agents, onRefresh, isRefreshing }: AnalyticsViewProps) {
//   const [logs, setLogs] = useState<any[]>([]);
//   const [isLoading, setIsLoading] = useState(false);

//   const fetchLogs = useCallback(async () => {
//     if (!token) return;
//     setIsLoading(true);
//     try {
//       const query = new URLSearchParams({ view: 'all' });
//       if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
//       if (filters.dateTo) query.append('dateTo', filters.dateTo);
//       if (filters.agentId !== 'all') query.append('agentId', filters.agentId);
//       if (filters.direction !== 'all') query.append('direction', filters.direction);

//       const res = await fetch(`${API_URL}/call-logs?${query}&take=1000`, {
//         headers: { Authorization: `Bearer ${token}` }
//       });
//       if (!res.ok) return;
//       setLogs(await res.json());
//     } catch { }
//     finally { setIsLoading(false); }
//   }, [token, filters.dateFrom, filters.dateTo, filters.agentId, filters.direction]);

//   useEffect(() => { fetchLogs(); }, [fetchLogs]);

//   // ── Separate inbound/outbound logs ──
//   const inboundLogs = useMemo(() => logs.filter(l => (l.notes || '').toLowerCase().includes('inbound')), [logs]);
//   const outboundLogs = useMemo(() => logs.filter(l => (l.notes || '').toLowerCase().includes('outbound')), [logs]);

//   // ── Hourly heatmap split by direction ──
//   const hourlyData = useMemo(() => {
//     const counts: Record<number, { hour: string; total: number; connected: number; inbound: number; outbound: number }> = {};
//     for (let h = 0; h < 24; h++) {
//       counts[h] = { hour: `${h.toString().padStart(2, '0')}:00`, total: 0, connected: 0, inbound: 0, outbound: 0 };
//     }
//     logs.forEach(log => {
//       const h = new Date(log.callDate).getHours();
//       counts[h].total++;
//       if (['connected_positive', 'connected_callback'].includes(log.callStatus)) counts[h].connected++;
//       const notes = (log.notes || '').toLowerCase();
//       if (notes.includes('inbound')) counts[h].inbound++;
//       else if (notes.includes('outbound')) counts[h].outbound++;
//     });
//     return Object.values(counts).filter(d => d.total > 0);
//   }, [logs]);

//   // ── Day-of-week split by direction ──
//   const dowData = useMemo(() => {
//     const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
//     const counts: Record<number, { day: string; total: number; connected: number; qualified: number; inbound: number; outbound: number }> = {};
//     days.forEach((d, i) => { counts[i] = { day: d, total: 0, connected: 0, qualified: 0, inbound: 0, outbound: 0 }; });
//     logs.forEach(log => {
//       const dow = new Date(log.callDate).getDay();
//       counts[dow].total++;
//       if (['connected_positive', 'connected_callback'].includes(log.callStatus)) counts[dow].connected++;
//       if (log.callStatus === 'connected_positive') counts[dow].qualified++;
//       const notes = (log.notes || '').toLowerCase();
//       if (notes.includes('inbound')) counts[dow].inbound++;
//       else if (notes.includes('outbound')) counts[dow].outbound++;
//     });
//     return Object.values(counts);
//   }, [logs]);

//   // ── Duration distribution buckets ──
//   const durationBuckets = useMemo(() => {
//     const buckets = [
//       { label: '< 30s', min: 0, max: 30, count: 0 },
//       { label: '30s–1m', min: 30, max: 60, count: 0 },
//       { label: '1–3m', min: 60, max: 180, count: 0 },
//       { label: '3–5m', min: 180, max: 300, count: 0 },
//       { label: '5–10m', min: 300, max: 600, count: 0 },
//       { label: '10m+', min: 600, max: Infinity, count: 0 },
//     ];
//     logs.forEach(log => {
//       if (log.callDuration == null) return;
//       const b = buckets.find(b => log.callDuration >= b.min && log.callDuration < b.max);
//       if (b) b.count++;
//     });
//     return buckets;
//   }, [logs]);

//   // ── Avg duration per outcome ──
//   const avgDurationByStatus = useMemo(() => {
//     const map: Record<string, { label: string; sum: number; count: number; color: string }> = {
//       connected_positive: { label: 'Qualified', sum: 0, count: 0, color: '#22c55e' },
//       connected_callback: { label: 'Callback', sum: 0, count: 0, color: '#3b82f6' },
//       not_connected: { label: 'Missed', sum: 0, count: 0, color: '#ef4444' },
//       not_interested: { label: 'Unqualified', sum: 0, count: 0, color: '#6b7280' },
//     };
//     logs.forEach(log => {
//       if (log.callDuration && map[log.callStatus]) {
//         map[log.callStatus].sum += log.callDuration;
//         map[log.callStatus].count++;
//       }
//     });
//     return Object.values(map).map(d => ({ ...d, avg: d.count > 0 ? Math.round(d.sum / d.count) : 0 }));
//   }, [logs]);

//   // ── Avg duration inbound vs outbound ──
//   const avgDurationByDirection = useMemo(() => {
//     const inboundConnected = inboundLogs.filter(l => l.callDuration && l.callDuration > 0);
//     const outboundConnected = outboundLogs.filter(l => l.callDuration && l.callDuration > 0);
//     return {
//       inbound: inboundConnected.length > 0 ? Math.round(inboundConnected.reduce((s, l) => s + l.callDuration, 0) / inboundConnected.length) : 0,
//       outbound: outboundConnected.length > 0 ? Math.round(outboundConnected.reduce((s, l) => s + l.callDuration, 0) / outboundConnected.length) : 0,
//     };
//   }, [inboundLogs, outboundLogs]);

//   // ── Overall avg duration ──
//   const overallAvgDuration = useMemo(() => {
//     const connected = logs.filter(l => l.callDuration && l.callDuration > 0);
//     if (!connected.length) return 0;
//     return Math.round(connected.reduce((s, l) => s + l.callDuration, 0) / connected.length);
//   }, [logs]);

//   // ── Outcome funnel ──
//   const funnel = useMemo(() => {
//     const total = logs.length;
//     const connected = logs.filter(l => ['connected_positive', 'connected_callback', 'not_interested'].includes(l.callStatus)).length;
//     const qualified = logs.filter(l => l.callStatus === 'connected_positive').length;
//     return [
//       { stage: 'Total Calls', value: total, color: '#6366f1' },
//       { stage: 'Connected', value: connected, color: '#22c55e' },
//       { stage: 'Qualified', value: qualified, color: '#f59e0b' },
//     ];
//   }, [logs]);

//   // ── Inbound vs outbound outcome comparison ──
//   const directionOutcomeData = useMemo(() => {
//     const getOutcomes = (arr: any[]) => ({
//       qualified: arr.filter(l => l.callStatus === 'connected_positive').length,
//       callback: arr.filter(l => l.callStatus === 'connected_callback').length,
//       missed: arr.filter(l => l.callStatus === 'not_connected').length,
//       unqualified: arr.filter(l => l.callStatus === 'not_interested').length,
//     });
//     return [
//       { direction: 'Incoming', ...getOutcomes(inboundLogs) },
//       { direction: 'Outgoing', ...getOutcomes(outboundLogs) },
//     ];
//   }, [inboundLogs, outboundLogs]);

//   const formatDuration = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;

//   if (isLoading) return (
//     <div className="flex-1 flex items-center justify-center">
//       <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
//     </div>
//   );

//   const hasData = logs.length > 0;

//   return (
//     <ScrollArea className="h-full">
//       <div className="space-y-6 p-1 pb-8">

//         {/* Header */}
//         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
//           <div>
//             <h2 className="text-2xl font-bold tracking-tight">Call Analysis</h2>
//             <p className="text-sm text-muted-foreground mt-0.5">
//               {filters.dateFrom && filters.dateTo
//                 ? `${format(new Date(filters.dateFrom), 'MMM dd')} – ${format(new Date(filters.dateTo), 'MMM dd, yyyy')}`
//                 : 'All time · deep-dive insights'}
//             </p>
//           </div>
//           <div className="flex items-center gap-2 flex-wrap">
//             <div className="flex items-center gap-1.5 bg-background border rounded-md px-2 py-0.5 shadow-sm">
//               <span className="text-xs font-semibold text-muted-foreground">From:</span>
//               <Input type="date" className="h-7 w-fit text-xs border-none shadow-none px-0 py-0 bg-transparent focus-visible:ring-0"
//                 value={filters.dateFrom} onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))} />
//               <span className="text-xs font-semibold text-muted-foreground ml-1">To:</span>
//               <Input type="date" className="h-7 w-fit text-xs border-none shadow-none px-0 py-0 bg-transparent focus-visible:ring-0"
//                 value={filters.dateTo} onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))} min={filters.dateFrom} />
//             </div>
//             {[{ label: 'Today', days: 0 }, { label: 'This Week', days: 7 }, { label: 'This Month', days: 30 }].map(p => (
//               <Button key={p.label} variant="outline" size="sm" className="h-8 text-xs"
//                 onClick={() => {
//                   const today = format(new Date(), 'yyyy-MM-dd');
//                   const from = format(subDays(new Date(), p.days), 'yyyy-MM-dd');
//                   setFilters(prev => ({ ...prev, dateFrom: from, dateTo: today }));
//                 }}>
//                 {p.label}
//               </Button>
//             ))}
//             {agents.length > 0 && (
//               <Select value={filters.agentId} onValueChange={v => setFilters(p => ({ ...p, agentId: v }))}>
//                 <SelectTrigger className="h-8 text-xs w-36">
//                   <SelectValue placeholder="All Agents" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="all">All Agents</SelectItem>
//                   {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>)}
//                 </SelectContent>
//               </Select>
//             )}
//             {(filters.dateFrom || filters.agentId !== 'all') && (
//               <Button variant="ghost" size="sm" className="h-8 text-xs gap-1"
//                 onClick={() => setFilters(p => ({ ...p, dateFrom: '', dateTo: '', agentId: 'all' }))}>
//                 <X className="h-3 w-3" /> Clear
//               </Button>
//             )}
//             <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onRefresh} disabled={isRefreshing}>
//               <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
//               Refresh
//             </Button>
//           </div>
//         </div>

//         {/* ── KPI Row ── */}
//         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//           <Card className="bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm">
//             <CardContent className="p-5">
//               <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600 w-fit mb-3"><Phone className="h-5 w-5" /></div>
//               <p className="text-2xl font-bold">{logs.length.toLocaleString()}</p>
//               <p className="text-xs font-semibold mt-0.5 opacity-90">Total Calls Analysed</p>
//             </CardContent>
//           </Card>
//           <Card className="bg-green-50 border-green-200 text-green-700 shadow-sm">
//             <CardContent className="p-5">
//               <div className="p-2.5 rounded-xl bg-green-100 text-green-600 w-fit mb-3"><Clock className="h-5 w-5" /></div>
//               <p className="text-2xl font-bold">{overallAvgDuration > 0 ? formatDuration(overallAvgDuration) : '—'}</p>
//               <p className="text-xs font-semibold mt-0.5 opacity-90">Avg Call Duration</p>
//               <p className="text-xs opacity-70 mt-1">Connected calls only</p>
//             </CardContent>
//           </Card>
//           <Card className="bg-amber-50 border-amber-200 text-amber-700 shadow-sm">
//             <CardContent className="p-5">
//               <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600 w-fit mb-3"><Target className="h-5 w-5" /></div>
//               <p className="text-2xl font-bold">
//                 {logs.length > 0 ? `${Math.round((logs.filter(l => l.callStatus === 'connected_positive').length / logs.length) * 100)}%` : '—'}
//               </p>
//               <p className="text-xs font-semibold mt-0.5 opacity-90">Qualification Rate</p>
//               <p className="text-xs opacity-70 mt-1">Qualified / total calls</p>
//             </CardContent>
//           </Card>
//           <Card className="bg-blue-50 border-blue-200 text-blue-700 shadow-sm">
//             <CardContent className="p-5">
//               <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600 w-fit mb-3"><Award className="h-5 w-5" /></div>
//               <p className="text-2xl font-bold">
//                 {(() => {
//                   const best = hourlyData.reduce((a, b) => b.total > a.total ? b : a, { hour: '—', total: 0, connected: 0, inbound: 0, outbound: 0 });
//                   return best.total > 0 ? best.hour : '—';
//                 })()}
//               </p>
//               <p className="text-xs font-semibold mt-0.5 opacity-90">Peak Calling Hour</p>
//               <p className="text-xs opacity-70 mt-1">Highest volume hour</p>
//             </CardContent>
//           </Card>
//         </div>

//         {/* ── INCOMING VS OUTGOING ANALYSIS ── */}
//         <div>
//           <div className="flex items-center gap-2 mb-3">
//             <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Incoming vs Outgoing Analysis</h3>
//             <div className="flex-1 h-px bg-border" />
//           </div>

//           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
//             {/* Inbound mini stats */}
//             <Card className="border-l-4 border-l-green-500 bg-green-50/20">
//               <CardContent className="p-4">
//                 <div className="flex items-center gap-2 mb-3">
//                   <ArrowDownLeft className="h-4 w-4 text-green-600" />
//                   <span className="font-bold text-green-700 text-sm">Incoming Calls — {inboundLogs.length}</span>
//                 </div>
//                 <div className="grid grid-cols-2 gap-3">
//                   <div className="text-center">
//                     <p className="text-xl font-bold text-green-600">
//                       {inboundLogs.length > 0 ? `${Math.round((inboundLogs.filter(l => ['connected_positive', 'connected_callback'].includes(l.callStatus)).length / inboundLogs.length) * 100)}%` : '—'}
//                     </p>
//                     <p className="text-xs text-muted-foreground">Connect Rate</p>
//                   </div>
//                   <div className="text-center">
//                     <p className="text-xl font-bold text-green-600">
//                       {avgDurationByDirection.inbound > 0 ? formatDuration(avgDurationByDirection.inbound) : '—'}
//                     </p>
//                     <p className="text-xs text-muted-foreground">Avg Duration</p>
//                   </div>
//                   <div className="text-center">
//                     <p className="text-lg font-bold text-green-600">{inboundLogs.filter(l => l.callStatus === 'connected_positive').length}</p>
//                     <p className="text-xs text-muted-foreground">Qualified</p>
//                   </div>
//                   <div className="text-center">
//                     <p className="text-lg font-bold text-red-500">{inboundLogs.filter(l => l.callStatus === 'not_connected').length}</p>
//                     <p className="text-xs text-muted-foreground">Missed</p>
//                   </div>
//                 </div>
//               </CardContent>
//             </Card>

//             {/* Outbound mini stats */}
//             <Card className="border-l-4 border-l-indigo-500 bg-indigo-50/20">
//               <CardContent className="p-4">
//                 <div className="flex items-center gap-2 mb-3">
//                   <ArrowUpRight className="h-4 w-4 text-indigo-600" />
//                   <span className="font-bold text-indigo-700 text-sm">Outgoing Calls — {outboundLogs.length}</span>
//                 </div>
//                 <div className="grid grid-cols-2 gap-3">
//                   <div className="text-center">
//                     <p className="text-xl font-bold text-indigo-600">
//                       {outboundLogs.length > 0 ? `${Math.round((outboundLogs.filter(l => ['connected_positive', 'connected_callback'].includes(l.callStatus)).length / outboundLogs.length) * 100)}%` : '—'}
//                     </p>
//                     <p className="text-xs text-muted-foreground">Connect Rate</p>
//                   </div>
//                   <div className="text-center">
//                     <p className="text-xl font-bold text-indigo-600">
//                       {avgDurationByDirection.outbound > 0 ? formatDuration(avgDurationByDirection.outbound) : '—'}
//                     </p>
//                     <p className="text-xs text-muted-foreground">Avg Duration</p>
//                   </div>
//                   <div className="text-center">
//                     <p className="text-lg font-bold text-indigo-600">{outboundLogs.filter(l => l.callStatus === 'connected_positive').length}</p>
//                     <p className="text-xs text-muted-foreground">Qualified</p>
//                   </div>
//                   <div className="text-center">
//                     <p className="text-lg font-bold text-red-500">{outboundLogs.filter(l => l.callStatus === 'not_connected').length}</p>
//                     <p className="text-xs text-muted-foreground">Not Answered</p>
//                   </div>
//                 </div>
//               </CardContent>
//             </Card>
//           </div>

//           {/* Direction × Outcome Comparison Chart */}
//           <Card>
//             <CardHeader className="pb-2">
//               <CardTitle className="text-base font-semibold">Incoming vs Outgoing — Outcome Comparison</CardTitle>
//               <p className="text-xs text-muted-foreground">How each call direction performs across all outcomes</p>
//             </CardHeader>
//             <CardContent>
//               {hasData ? (
//                 <ResponsiveContainer width="100%" height={200}>
//                   <BarChart data={directionOutcomeData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
//                     <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
//                     <XAxis dataKey="direction" tick={{ fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
//                     <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
//                     <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
//                     <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
//                     <Bar dataKey="qualified" name="Qualified" fill="#22c55e" radius={[3, 3, 0, 0]} />
//                     <Bar dataKey="callback" name="Callback" fill="#3b82f6" radius={[3, 3, 0, 0]} />
//                     <Bar dataKey="missed" name="Missed" fill="#ef4444" radius={[3, 3, 0, 0]} />
//                     <Bar dataKey="unqualified" name="Unqualified" fill="#6b7280" radius={[3, 3, 0, 0]} />
//                   </BarChart>
//                 </ResponsiveContainer>
//               ) : <EmptyChart label="No data for comparison" />}
//             </CardContent>
//           </Card>
//         </div>

//         {/* ── Outcome Funnel + Duration by Status ── */}
//         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//           {/* Outcome Funnel */}
//           <Card>
//             <CardHeader className="pb-2">
//               <CardTitle className="text-base font-semibold">Call Outcome Funnel</CardTitle>
//               <p className="text-xs text-muted-foreground">How calls progress from dialled to qualified</p>
//             </CardHeader>
//             <CardContent>
//               {hasData ? (
//                 <div className="space-y-4 pt-2">
//                   {funnel.map((stage, idx) => {
//                     const pct = funnel[0].value > 0 ? Math.round((stage.value / funnel[0].value) * 100) : 0;
//                     return (
//                       <div key={stage.stage}>
//                         <div className="flex items-center justify-between mb-1.5">
//                           <div className="flex items-center gap-2">
//                             <span className="text-xs text-muted-foreground w-4 font-bold">{idx + 1}</span>
//                             <span className="text-sm font-medium">{stage.stage}</span>
//                           </div>
//                           <div className="flex items-center gap-3">
//                             <span className="text-sm font-bold">{stage.value.toLocaleString()}</span>
//                             <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
//                           </div>
//                         </div>
//                         <div className="h-7 rounded-lg overflow-hidden bg-muted">
//                           <div className="h-full rounded-lg transition-all flex items-center pl-3" style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: stage.color }}>
//                             {pct > 15 && <span className="text-white text-xs font-bold">{pct}%</span>}
//                           </div>
//                         </div>
//                         {idx < funnel.length - 1 && funnel[idx + 1].value > 0 && (
//                           <p className="text-[10px] text-muted-foreground mt-1 pl-6">
//                             Drop-off: {stage.value - funnel[idx + 1].value} calls ({100 - Math.round((funnel[idx + 1].value / stage.value) * 100)}%)
//                           </p>
//                         )}
//                       </div>
//                     );
//                   })}
//                 </div>
//               ) : <EmptyChart label="No data for funnel" />}
//             </CardContent>
//           </Card>

//           {/* Avg Duration by Outcome */}
//           <Card>
//             <CardHeader className="pb-2">
//               <CardTitle className="text-base font-semibold">Avg Duration by Outcome</CardTitle>
//               <p className="text-xs text-muted-foreground">How long each call type lasts on average</p>
//             </CardHeader>
//             <CardContent>
//               {hasData ? (
//                 <div className="space-y-3 pt-2">
//                   {avgDurationByStatus.filter(d => d.count > 0).map(d => (
//                     <div key={d.label}>
//                       <div className="flex items-center justify-between mb-1">
//                         <div className="flex items-center gap-2">
//                           <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
//                           <span className="text-sm font-medium">{d.label}</span>
//                           <span className="text-xs text-muted-foreground">({d.count} calls)</span>
//                         </div>
//                         <span className="text-sm font-bold">{formatDuration(d.avg)}</span>
//                       </div>
//                       <div className="h-2 rounded-full bg-muted overflow-hidden">
//                         <div className="h-full rounded-full"
//                           style={{ width: `${Math.min(100, (d.avg / Math.max(...avgDurationByStatus.map(x => x.avg), 1)) * 100)}%`, backgroundColor: d.color }} />
//                       </div>
//                     </div>
//                   ))}
//                   {/* Inbound vs Outbound avg duration */}
//                   {(avgDurationByDirection.inbound > 0 || avgDurationByDirection.outbound > 0) && (
//                     <div className="pt-3 border-t space-y-3">
//                       <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">By Direction</p>
//                       {[
//                         { label: 'Incoming Avg', value: avgDurationByDirection.inbound, color: '#22c55e' },
//                         { label: 'Outgoing Avg', value: avgDurationByDirection.outbound, color: '#6366f1' },
//                       ].filter(d => d.value > 0).map(d => (
//                         <div key={d.label}>
//                           <div className="flex items-center justify-between mb-1">
//                             <div className="flex items-center gap-2">
//                               <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
//                               <span className="text-sm font-medium">{d.label}</span>
//                             </div>
//                             <span className="text-sm font-bold">{formatDuration(d.value)}</span>
//                           </div>
//                           <div className="h-2 rounded-full bg-muted overflow-hidden">
//                             <div className="h-full rounded-full"
//                               style={{ width: `${Math.min(100, (d.value / Math.max(avgDurationByDirection.inbound, avgDurationByDirection.outbound, 1)) * 100)}%`, backgroundColor: d.color }} />
//                           </div>
//                         </div>
//                       ))}
//                     </div>
//                   )}
//                   {avgDurationByStatus.every(d => d.count === 0) && (
//                     <p className="text-sm text-muted-foreground text-center py-6">No duration data available</p>
//                   )}
//                 </div>
//               ) : <EmptyChart label="No duration data" />}
//             </CardContent>
//           </Card>
//         </div>

//         {/* ── Hourly Heatmap ── */}
//         <Card>
//           <CardHeader className="pb-2">
//             <CardTitle className="text-base font-semibold">Hourly Call Volume</CardTitle>
//             <p className="text-xs text-muted-foreground">Incoming vs outgoing calls throughout the day</p>
//           </CardHeader>
//           <CardContent>
//             {hourlyData.length > 0 ? (
//               <ResponsiveContainer width="100%" height={200}>
//                 <BarChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
//                   <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
//                   <XAxis dataKey="hour" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
//                   <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
//                   <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
//                   <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
//                   <Bar dataKey="inbound" name="Incoming" fill="#22c55e" radius={[3, 3, 0, 0]} stackId="a" />
//                   <Bar dataKey="outbound" name="Outgoing" fill="#6366f1" radius={[3, 3, 0, 0]} stackId="a" />
//                 </BarChart>
//               </ResponsiveContainer>
//             ) : <EmptyChart label="No hourly data for this period" />}
//           </CardContent>
//         </Card>

//         {/* ── Day-of-Week + Duration Buckets ── */}
//         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//           {/* Day of Week */}
//           <Card>
//             <CardHeader className="pb-2">
//               <CardTitle className="text-base font-semibold">Calls by Day of Week</CardTitle>
//               <p className="text-xs text-muted-foreground">Incoming vs outgoing by day</p>
//             </CardHeader>
//             <CardContent>
//               {hasData ? (
//                 <ResponsiveContainer width="100%" height={200}>
//                   <BarChart data={dowData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
//                     <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
//                     <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
//                     <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
//                     <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
//                     <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
//                     <Bar dataKey="inbound" name="Incoming" fill="#22c55e" radius={[3, 3, 0, 0]} />
//                     <Bar dataKey="outbound" name="Outgoing" fill="#6366f1" radius={[3, 3, 0, 0]} />
//                     <Bar dataKey="qualified" name="Qualified" fill="#f59e0b" radius={[3, 3, 0, 0]} />
//                   </BarChart>
//                 </ResponsiveContainer>
//               ) : <EmptyChart label="No day-of-week data" />}
//             </CardContent>
//           </Card>

//           {/* Duration Distribution */}
//           <Card>
//             <CardHeader className="pb-2">
//               <CardTitle className="text-base font-semibold">Call Duration Distribution</CardTitle>
//               <p className="text-xs text-muted-foreground">Breakdown of call lengths across all connected calls</p>
//             </CardHeader>
//             <CardContent>
//               {durationBuckets.some(b => b.count > 0) ? (
//                 <div className="space-y-3 pt-2">
//                   {durationBuckets.filter(b => b.count > 0).map((b, idx) => {
//                     const total = durationBuckets.reduce((s, x) => s + x.count, 0);
//                     const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
//                     const hues = ['#6366f1', '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];
//                     return (
//                       <div key={b.label}>
//                         <div className="flex items-center justify-between mb-1">
//                           <span className="text-sm font-medium">{b.label}</span>
//                           <div className="flex items-center gap-2">
//                             <span className="text-xs text-muted-foreground">{b.count} calls</span>
//                             <span className="text-sm font-bold w-10 text-right">{pct}%</span>
//                           </div>
//                         </div>
//                         <div className="h-2 rounded-full bg-muted overflow-hidden">
//                           <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: hues[idx % hues.length] }} />
//                         </div>
//                       </div>
//                     );
//                   })}
//                 </div>
//               ) : <EmptyChart label="No duration data available" />}
//             </CardContent>
//           </Card>
//         </div>

//       </div>
//     </ScrollArea>
//   );
// }

// // ─────────────────────────────────────────────
// // KPI CARD
// // ─────────────────────────────────────────────
// function KpiCard({ title, value, icon: Icon, color, subtitle, trend }: {
//   title: string; value: number; icon: any; color: string; subtitle?: string; trend?: 'up' | 'down';
// }) {
//   const colors: Record<string, string> = {
//     blue: 'bg-blue-50 border-blue-200 text-blue-700',
//     green: 'bg-green-50 border-green-200 text-green-700',
//     red: 'bg-red-50 border-red-200 text-red-700',
//     amber: 'bg-amber-50 border-amber-200 text-amber-700',
//   };
//   const iconBg: Record<string, string> = {
//     blue: 'bg-blue-100 text-blue-600',
//     green: 'bg-green-100 text-green-600',
//     red: 'bg-red-100 text-red-600',
//     amber: 'bg-amber-100 text-amber-600',
//   };
//   return (
//     <Card className={`${colors[color]} shadow-sm`}>
//       <CardContent className="p-5">
//         <div className="flex items-start justify-between mb-3">
//           <div className={`p-2.5 rounded-xl ${iconBg[color]}`}><Icon className="h-5 w-5" /></div>
//           {trend && (trend === 'up' ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />)}
//         </div>
//         <p className="text-2xl font-bold tracking-tight">{value.toLocaleString()}</p>
//         <p className="text-xs font-semibold mt-0.5 opacity-90">{title}</p>
//         {subtitle && <p className="text-xs opacity-70 mt-1">{subtitle}</p>}
//       </CardContent>
//     </Card>
//   );
// }

// // ─────────────────────────────────────────────
// // METRIC TILE
// // ─────────────────────────────────────────────
// function MetricTile({ label, value, icon: Icon, sub, good }: {
//   label: string; value: number | string; icon: any; sub: string; good: boolean;
// }) {
//   return (
//     <Card className="border bg-card shadow-sm">
//       <CardContent className="p-4 flex items-center gap-3">
//         <div className={`p-2 rounded-lg ${good ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}><Icon className="h-4 w-4" /></div>
//         <div className="min-w-0">
//           <p className="text-lg font-bold leading-none">{typeof value === 'number' ? value.toLocaleString() : value}</p>
//           <p className="text-xs font-medium text-muted-foreground mt-0.5 truncate">{label}</p>
//           <p className="text-[10px] text-muted-foreground/70 truncate">{sub}</p>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }

// // ─────────────────────────────────────────────
// // EMPTY CHART PLACEHOLDER
// // ─────────────────────────────────────────────
// function EmptyChart({ label }: { label: string }) {
//   return (
//     <div className="flex flex-col items-center justify-center h-48 text-muted-foreground rounded-lg border border-dashed bg-muted/10">
//       <BarChart3 className="h-8 w-8 mb-2 opacity-30" />
//       <p className="text-sm">{label}</p>
//     </div>
//   );
// }


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
  PhoneIncoming, // New
  PhoneOutgoing, // New
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
  direction: string; // New
}

const EMPTY_FILTERS: FilterState = {
  search: '',
  dateFrom: '',
  dateTo: '',
  status: 'all',
  agentId: 'all',
  minDuration: 'all',
  source: 'all',
  direction: 'all', // New
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
    if (filters.direction !== 'all') count++; // New
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
        if (filters.direction !== 'all') query.append('direction', filters.direction); // New

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
      if (filters.direction !== 'all') query.append('direction', filters.direction); // New
      
      // Pass the active view so the sidebar counts update based on the view if needed
      if (activeView === 'inbound' || activeView === 'outbound') {
         query.append('direction', activeView);
      }

      const res = await fetch(`${API_URL}/call-logs/stats?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setStats(data);
    } catch {}
  }, [token, filters, activeView]);

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
    { id: 'inbound', label: 'Incoming Calls', icon: PhoneIncoming }, // New
    { id: 'outbound', label: 'Outgoing Calls', icon: PhoneOutgoing }, // New
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
          ) : activeView === 'analytics' ? (
            <AnalyticsView token={token} filters={filters} setFilters={setFilters} agents={agents} onRefresh={handleRefresh} isRefreshing={isRefreshing} />
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

                          {/* Direction Filter */}
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-muted-foreground">Call Direction</label>
                              <Select value={filters.direction} onValueChange={v => setFilters(p => ({ ...p, direction: v }))}>
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="All Directions" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Directions</SelectItem>
                                  <SelectItem value="inbound">Incoming Calls</SelectItem>
                                  <SelectItem value="outbound">Outgoing Calls</SelectItem>
                                </SelectContent>
                              </Select>
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
                                <div className="flex flex-col gap-1.5">
                                  <span className={`font-mono text-sm ${row.callStatus === 'not_connected' ? 'text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100 w-fit' : ''}`}>
                                    {row.lead?.phone}
                                  </span>
                                  {!row.isLeadRow && row.notes?.includes('Inbound') ? (
                                    <span className="flex items-center text-[10px] gap-1 text-green-600 font-medium bg-green-50 w-fit px-1.5 py-0.5 rounded border border-green-200">
                                      <PhoneIncoming className="w-3 h-3"/> Incoming
                                    </span>
                                  ) : !row.isLeadRow && row.notes?.includes('Outbound') ? (
                                    <span className="flex items-center text-[10px] gap-1 text-blue-600 font-medium bg-blue-50 w-fit px-1.5 py-0.5 rounded border border-blue-200">
                                      <PhoneOutgoing className="w-3 h-3"/> Outgoing
                                    </span>
                                  ) : null}
                                </div>
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
      const query = new URLSearchParams({ view: 'all' });
      if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) query.append('dateTo', filters.dateTo);
      if (filters.agentId !== 'all') query.append('agentId', filters.agentId);
      if (filters.direction !== 'all') query.append('direction', filters.direction); // New

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
  }, [token, filters.dateFrom, filters.dateTo, filters.agentId, filters.direction]);

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
            <div className="flex items-center gap-1.5 bg-background border rounded-md px-2 py-0.5 shadow-sm">
              <span className="text-xs font-semibold text-muted-foreground">From:</span>
              <Input type="date" className="h-7 w-fit text-xs border-none shadow-none px-0 py-0 bg-transparent focus-visible:ring-0"
                value={filters.dateFrom} onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))} />
              <span className="text-xs font-semibold text-muted-foreground ml-1">To:</span>
              <Input type="date" className="h-7 w-fit text-xs border-none shadow-none px-0 py-0 bg-transparent focus-visible:ring-0"
                value={filters.dateTo} onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))} min={filters.dateFrom} />
            </div>
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
// ANALYTICS VIEW — deep-dive call analysis
// ─────────────────────────────────────────────
interface AnalyticsViewProps {
  token: string | null;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  agents: Agent[];
  onRefresh: () => void;
  isRefreshing: boolean;
}

function AnalyticsView({ token, filters, setFilters, agents, onRefresh, isRefreshing }: AnalyticsViewProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const query = new URLSearchParams({ view: 'all' });
      if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) query.append('dateTo', filters.dateTo);
      if (filters.agentId !== 'all') query.append('agentId', filters.agentId);
      if (filters.direction !== 'all') query.append('direction', filters.direction); // New
      
      const res = await fetch(`${API_URL}/call-logs?${query}&take=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      setLogs(await res.json());
    } catch { }
    finally { setIsLoading(false); }
  }, [token, filters.dateFrom, filters.dateTo, filters.agentId, filters.direction]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // ── Hourly heatmap (0–23) ──
  const hourlyData = useMemo(() => {
    const counts: Record<number, { hour: string; total: number; connected: number }> = {};
    for (let h = 0; h < 24; h++) {
      counts[h] = { hour: `${h.toString().padStart(2, '0')}:00`, total: 0, connected: 0 };
    }
    logs.forEach(log => {
      const h = new Date(log.callDate).getHours();
      counts[h].total++;
      if (['connected_positive', 'connected_callback'].includes(log.callStatus)) counts[h].connected++;
    });
    return Object.values(counts).filter(d => d.total > 0);
  }, [logs]);

  // ── Day-of-week breakdown ──
  const dowData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts: Record<number, { day: string; total: number; connected: number; qualified: number }> = {};
    days.forEach((d, i) => { counts[i] = { day: d, total: 0, connected: 0, qualified: 0 }; });
    logs.forEach(log => {
      const dow = new Date(log.callDate).getDay();
      counts[dow].total++;
      if (['connected_positive', 'connected_callback'].includes(log.callStatus)) counts[dow].connected++;
      if (log.callStatus === 'connected_positive') counts[dow].qualified++;
    });
    return Object.values(counts);
  }, [logs]);

  // ── Duration distribution buckets ──
  const durationBuckets = useMemo(() => {
    const buckets = [
      { label: '< 30s', min: 0, max: 30, count: 0 },
      { label: '30s–1m', min: 30, max: 60, count: 0 },
      { label: '1–3m', min: 60, max: 180, count: 0 },
      { label: '3–5m', min: 180, max: 300, count: 0 },
      { label: '5–10m', min: 300, max: 600, count: 0 },
      { label: '10m+', min: 600, max: Infinity, count: 0 },
    ];
    logs.forEach(log => {
      if (log.callDuration == null) return;
      const b = buckets.find(b => log.callDuration >= b.min && log.callDuration < b.max);
      if (b) b.count++;
    });
    return buckets;
  }, [logs]);

  // ── Avg duration per outcome ──
  const avgDurationByStatus = useMemo(() => {
    const map: Record<string, { label: string; sum: number; count: number; color: string }> = {
      connected_positive: { label: 'Qualified', sum: 0, count: 0, color: '#22c55e' },
      connected_callback: { label: 'Callback', sum: 0, count: 0, color: '#3b82f6' },
      not_connected: { label: 'Missed', sum: 0, count: 0, color: '#ef4444' },
      not_interested: { label: 'Unqualified', sum: 0, count: 0, color: '#6b7280' },
    };
    logs.forEach(log => {
      if (log.callDuration && map[log.callStatus]) {
        map[log.callStatus].sum += log.callDuration;
        map[log.callStatus].count++;
      }
    });
    return Object.values(map).map(d => ({
      ...d,
      avg: d.count > 0 ? Math.round(d.sum / d.count) : 0,
    }));
  }, [logs]);

  // ── Overall avg duration ──
  const overallAvgDuration = useMemo(() => {
    const connected = logs.filter(l => l.callDuration && l.callDuration > 0);
    if (!connected.length) return 0;
    return Math.round(connected.reduce((s, l) => s + l.callDuration, 0) / connected.length);
  }, [logs]);

  // ── Outcome funnel ──
  const funnel = useMemo(() => {
    const total = logs.length;
    const connected = logs.filter(l => ['connected_positive', 'connected_callback', 'not_interested'].includes(l.callStatus)).length;
    const qualified = logs.filter(l => l.callStatus === 'connected_positive').length;
    return [
      { stage: 'Total Calls', value: total, color: '#6366f1' },
      { stage: 'Connected', value: connected, color: '#22c55e' },
      { stage: 'Qualified', value: qualified, color: '#f59e0b' },
    ];
  }, [logs]);

  const formatDuration = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  const hasData = logs.length > 0;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-1 pb-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Call Analysis</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filters.dateFrom && filters.dateTo
                ? `${format(new Date(filters.dateFrom), 'MMM dd')} – ${format(new Date(filters.dateTo), 'MMM dd, yyyy')}`
                : 'All time · deep-dive insights'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-background border rounded-md px-2 py-0.5 shadow-sm">
              <span className="text-xs font-semibold text-muted-foreground">From:</span>
              <Input type="date" className="h-7 w-fit text-xs border-none shadow-none px-0 py-0 bg-transparent focus-visible:ring-0"
                value={filters.dateFrom} onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))} />
              <span className="text-xs font-semibold text-muted-foreground ml-1">To:</span>
              <Input type="date" className="h-7 w-fit text-xs border-none shadow-none px-0 py-0 bg-transparent focus-visible:ring-0"
                value={filters.dateTo} onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))} min={filters.dateFrom} />
            </div>
            {[{ label: 'Today', days: 0 }, { label: 'This Week', days: 7 }, { label: 'This Month', days: 30 }].map(p => (
              <Button key={p.label} variant="outline" size="sm" className="h-8 text-xs"
                onClick={() => {
                  const today = format(new Date(), 'yyyy-MM-dd');
                  const from = format(subDays(new Date(), p.days), 'yyyy-MM-dd');
                  setFilters(prev => ({ ...prev, dateFrom: from, dateTo: today }));
                }}>
                {p.label}
              </Button>
            ))}
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

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm">
            <CardContent className="p-5">
              <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600 w-fit mb-3">
                <Phone className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold">{logs.length.toLocaleString()}</p>
              <p className="text-xs font-semibold mt-0.5 opacity-90">Total Calls Analysed</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200 text-green-700 shadow-sm">
            <CardContent className="p-5">
              <div className="p-2.5 rounded-xl bg-green-100 text-green-600 w-fit mb-3">
                <Clock className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold">{overallAvgDuration > 0 ? formatDuration(overallAvgDuration) : '—'}</p>
              <p className="text-xs font-semibold mt-0.5 opacity-90">Avg Call Duration</p>
              <p className="text-xs opacity-70 mt-1">Connected calls only</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 border-amber-200 text-amber-700 shadow-sm">
            <CardContent className="p-5">
              <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600 w-fit mb-3">
                <Target className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold">
                {logs.length > 0
                  ? `${Math.round((logs.filter(l => l.callStatus === 'connected_positive').length / logs.length) * 100)}%`
                  : '—'}
              </p>
              <p className="text-xs font-semibold mt-0.5 opacity-90">Qualification Rate</p>
              <p className="text-xs opacity-70 mt-1">Qualified / total calls</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-200 text-blue-700 shadow-sm">
            <CardContent className="p-5">
              <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600 w-fit mb-3">
                <Award className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold">
                {(() => {
                  const best = hourlyData.reduce((a, b) => b.total > a.total ? b : a, { hour: '—', total: 0 });
                  return best.total > 0 ? best.hour : '—';
                })()}
              </p>
              <p className="text-xs font-semibold mt-0.5 opacity-90">Peak Calling Hour</p>
              <p className="text-xs opacity-70 mt-1">Highest volume hour</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Outcome Funnel + Duration by Status ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Outcome Funnel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Call Outcome Funnel</CardTitle>
              <p className="text-xs text-muted-foreground">How calls progress from dialled to qualified</p>
            </CardHeader>
            <CardContent>
              {hasData ? (
                <div className="space-y-4 pt-2">
                  {funnel.map((stage, idx) => {
                    const pct = funnel[0].value > 0 ? Math.round((stage.value / funnel[0].value) * 100) : 0;
                    return (
                      <div key={stage.stage}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-4 font-bold">{idx + 1}</span>
                            <span className="text-sm font-medium">{stage.stage}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold">{stage.value.toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-7 rounded-lg overflow-hidden bg-muted">
                          <div
                            className="h-full rounded-lg transition-all flex items-center pl-3"
                            style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: stage.color }}
                          >
                            {pct > 15 && <span className="text-white text-xs font-bold">{pct}%</span>}
                          </div>
                        </div>
                        {idx < funnel.length - 1 && funnel[idx + 1].value > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-1 pl-6">
                            Drop-off: {stage.value - funnel[idx + 1].value} calls ({100 - Math.round((funnel[idx + 1].value / stage.value) * 100)}%)
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyChart label="No data for funnel" />}
            </CardContent>
          </Card>

          {/* Avg Duration by Outcome */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Avg Duration by Outcome</CardTitle>
              <p className="text-xs text-muted-foreground">How long each call type lasts on average</p>
            </CardHeader>
            <CardContent>
              {hasData ? (
                <div className="space-y-3 pt-2">
                  {avgDurationByStatus.filter(d => d.count > 0).map(d => (
                    <div key={d.label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="text-sm font-medium">{d.label}</span>
                          <span className="text-xs text-muted-foreground">({d.count} calls)</span>
                        </div>
                        <span className="text-sm font-bold">{formatDuration(d.avg)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (d.avg / Math.max(...avgDurationByStatus.map(x => x.avg), 1)) * 100)}%`,
                            backgroundColor: d.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {avgDurationByStatus.every(d => d.count === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-6">No duration data available</p>
                  )}
                </div>
              ) : <EmptyChart label="No duration data" />}
            </CardContent>
          </Card>
        </div>

        {/* ── Hourly Heatmap ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Hourly Call Volume</CardTitle>
            <p className="text-xs text-muted-foreground">When your team makes the most calls throughout the day</p>
          </CardHeader>
          <CardContent>
            {hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="total" name="Total" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="connected" name="Connected" fill="#22c55e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart label="No hourly data for this period" />}
          </CardContent>
        </Card>

        {/* ── Day-of-Week + Duration Buckets ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Day of Week */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Calls by Day of Week</CardTitle>
              <p className="text-xs text-muted-foreground">Which days see the highest calling activity</p>
            </CardHeader>
            <CardContent>
              {hasData ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dowData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="total" name="Total" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="connected" name="Connected" fill="#22c55e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="qualified" name="Qualified" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart label="No day-of-week data" />}
            </CardContent>
          </Card>

          {/* Duration Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Call Duration Distribution</CardTitle>
              <p className="text-xs text-muted-foreground">Breakdown of call lengths across all connected calls</p>
            </CardHeader>
            <CardContent>
              {durationBuckets.some(b => b.count > 0) ? (
                <div className="space-y-3 pt-2">
                  {durationBuckets.filter(b => b.count > 0).map((b, idx) => {
                    const total = durationBuckets.reduce((s, x) => s + x.count, 0);
                    const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
                    const hues = ['#6366f1', '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];
                    return (
                      <div key={b.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{b.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{b.count} calls</span>
                            <span className="text-sm font-bold w-10 text-right">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: hues[idx % hues.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyChart label="No duration data available" />}
            </CardContent>
          </Card>
        </div>

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