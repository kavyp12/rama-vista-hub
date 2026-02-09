import { useEffect, useState, useCallback } from 'react';
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
import { useToast } from '@/hooks/use-toast';
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
  AlertCircle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
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

// --- TYPES ---
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
    connectRate: number;
}

export default function Telecalling() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State for Data
  const [activeView, setActiveView] = useState(searchParams.get('view') || 'reports');
  const [searchQuery, setSearchQuery] = useState('');
  const [tableData, setTableData] = useState<TableRowData[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // State for Modals
  const [selectedItem, setSelectedItem] = useState<TableRowData | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Sync state to URL
  useEffect(() => {
    setSearchParams({ view: activeView });
  }, [activeView, setSearchParams]);

  // --- FETCH DATA STRATEGY ---
  const fetchData = useCallback(async () => {
    if (activeView === 'reports') return;
    
    setIsLoading(true);
    setTableData([]); 

    try {
        if (activeView === 'new_leads') {
            // --- FETCH NEW LEADS ---
            const query = new URLSearchParams({ stage: 'new' });
            if (searchQuery) query.append('phone', searchQuery);

            const res = await fetch(`${API_URL}/leads?${query.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const leads: Lead[] = await res.json();
            
            const rows: TableRowData[] = leads.map(lead => ({
                id: lead.id,
                isLeadRow: true,
                leadId: lead.id,
                callStatus: 'pending',
                displayDate: lead.createdAt || new Date().toISOString(),
                duration: null,
                notes: 'New lead awaiting connection',
                lead: lead
            }));
            setTableData(rows);

        } else {
            // --- FETCH CALL LOGS ---
            const query = new URLSearchParams({
                view: activeView,
                search: searchQuery
            });

            const res = await fetch(`${API_URL}/call-logs?${query.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!res.ok) throw new Error("Failed to fetch logs");
            
            const logs = await res.json();
            
            const rows: TableRowData[] = logs.map((log: any) => ({
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
                deletedAt: log.deletedAt
            }));
            setTableData(rows);
        }
    } catch (error) {
        console.error(error);
        toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }, [activeView, searchQuery, token, toast]);

  const fetchStats = useCallback(async () => {
      try {
          const res = await fetch(`${API_URL}/call-logs/stats`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          setStats(data);
      } catch (error) {
          console.error("Failed to fetch stats", error);
      }
  }, [token]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchData(); }, [fetchData]);

  // --- MENU CONFIGURATION ---
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

  // --- ACTION HANDLERS ---
  const handleViewDetails = (item: TableRowData) => {
    setSelectedItem(item);
    setIsEditOpen(true);
  };

  const handleCallAction = (item: TableRowData) => {
      toast({ title: "Dialing...", description: `Calling ${item.lead.name} (${item.lead.phone})` });
  };

  // ✅ ARCHIVE FUNCTION
  const handleArchive = async (id: string) => {
    try {
        const res = await fetch(`${API_URL}/call-logs/${id}`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ isArchived: true })
        });

        if (!res.ok) throw new Error('Failed to archive');

        toast({ title: "Archived", description: "Call log moved to archive." });
        
        // Remove from current view locally to avoid reload
        setTableData(prev => prev.filter(row => row.id !== id));
        fetchStats(); // Update counts
    } catch (error) {
        toast({ title: "Error", description: "Could not archive call log.", variant: "destructive" });
    }
  };

  // ✅ DELETE FUNCTION
  const confirmDelete = (id: string) => {
      setItemToDelete(id);
      setIsDeleteAlertOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
        const res = await fetch(`${API_URL}/call-logs/${itemToDelete}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to delete');

        toast({ title: "Deleted", description: "Call log moved to trash." });
        
        // Remove from current view locally
        setTableData(prev => prev.filter(row => row.id !== itemToDelete));
        setIsDeleteAlertOpen(false);
        fetchStats();
    } catch (error) {
        toast({ title: "Error", description: "Could not delete call log.", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout title="Telecalling Center" description="Manage your call operations">
      <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-4 lg:gap-6">
        
        {/* --- SIDEBAR NAVIGATION --- */}
        <Card className="w-full lg:w-64 flex-shrink-0 h-auto lg:h-full overflow-hidden flex flex-col border-r bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm uppercase text-muted-foreground font-bold tracking-wider">Filters</CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {menuItems.map((item, idx) => (
                item.type === 'separator' ? (
                  <Separator key={idx} className="my-2" />
                ) : (
                  <Button
                    key={item.id}
                    variant={activeView === item.id ? "secondary" : "ghost"}
                    className={`w-full justify-start gap-3 h-10 ${item.className || ''} ${activeView === item.id ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                    onClick={() => setActiveView(item.id || 'reports')}
                  >
                    {item.icon && <item.icon className="h-4 w-4" />}
                    <span className="truncate">{item.label}</span>
                    
                    {item.id === 'missed' && stats?.notAnswered ? (
                        <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{stats.notAnswered}</span>
                    ) : null}
                  </Button>
                )
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* --- MAIN CONTENT AREA --- */}
        <div className="flex-1 h-full flex flex-col min-w-0">
          
          {activeView === 'reports' ? (
             <ReportsView stats={stats} />
          ) : (
             <Card className="h-full flex flex-col border shadow-sm">
               {/* Header Toolbar */}
               <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/50">
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
                  </div>

                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search name or phone..." 
                      className="pl-10 bg-background"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
               </div>

               {/* Table Content */}
               <div className="flex-1 overflow-hidden relative">
                 <ScrollArea className="h-full w-full">
                   <div className="min-w-[800px]">
                   <Table>
                     <TableHeader className="bg-muted/50 sticky top-0 z-10">
                       <TableRow>
                         <TableHead className="w-[180px]">Date & Time</TableHead>
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
                             <div className="flex flex-col items-center justify-center text-muted-foreground">
                                <Search className="h-10 w-10 mb-2 opacity-20" />
                                <p>No records found in this view.</p>
                             </div>
                           </TableCell>
                         </TableRow>
                       ) : (
                         tableData.map((row) => (
                           <TableRow key={row.id} className="hover:bg-muted/50 transition-colors group">
                             <TableCell className="font-medium text-xs text-muted-foreground whitespace-nowrap">
                               <div className="flex flex-col">
                                   <span className="text-foreground">{format(parseISO(row.displayDate), 'MMM dd, yyyy')}</span>
                                   <span className="text-[10px]">{format(parseISO(row.displayDate), 'hh:mm a')}</span>
                               </div>
                             </TableCell>
                             <TableCell>
                               <div className="flex items-center gap-2">
                                 <Avatar className="h-8 w-8 border bg-background">
                                   <AvatarFallback className="text-[10px] bg-primary/5 text-primary">
                                     {row.lead?.name?.substring(0,2).toUpperCase() || 'NA'}
                                   </AvatarFallback>
                                 </Avatar>
                                 <div>
                                    <span className="font-semibold text-sm block">{row.lead?.name || 'Unknown Lead'}</span>
                                    {row.isLeadRow ? (
                                        <span className="text-[10px] text-blue-600 font-medium">New Website Lead</span>
                                    ) : (
                                        <span className="text-[10px] text-muted-foreground uppercase">{row.lead?.stage}</span>
                                    )}
                                 </div>
                               </div>
                             </TableCell>
                             <TableCell>
                               <div className="flex items-center gap-1">
                                    <span className={`font-mono text-sm ${row.callStatus === 'not_connected' ? 'text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100' : ''}`}>
                                        {row.lead?.phone}
                                    </span>
                               </div>
                             </TableCell>
                             <TableCell className="text-sm">
                                {row.agent?.fullName || <span className="text-muted-foreground italic">Unassigned</span>}
                             </TableCell>
                             <TableCell>
                               <StatusBadge status={row.callStatus} />
                             </TableCell>
                             <TableCell className="text-xs font-mono">
                               {row.duration ? `${Math.floor(row.duration / 60)}m ${row.duration % 60}s` : '--'}
                             </TableCell>
                             <TableCell className="text-right pr-4">
                               <DropdownMenu>
                                 <DropdownMenuTrigger asChild>
                                   <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <MoreVertical className="h-4 w-4" />
                                   </Button>
                                 </DropdownMenuTrigger>
                                 <DropdownMenuContent align="end" className="w-48">
                                   {row.isLeadRow ? (
                                       <DropdownMenuItem onClick={() => handleCallAction(row)} className="text-blue-600 font-medium">
                                          <Phone className="h-4 w-4 mr-2" />
                                          Call Now
                                       </DropdownMenuItem>
                                   ) : null}
                                   
                                   <DropdownMenuItem onClick={() => handleViewDetails(row)}>
                                     View Details
                                   </DropdownMenuItem>
                                   
                                   {!row.isLeadRow && (
                                       <>
                                       <DropdownMenuItem onClick={() => handleArchive(row.id)}>
                                         <Archive className="h-4 w-4 mr-2" />
                                         Archive
                                       </DropdownMenuItem>
                                       <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => confirmDelete(row.id)}>
                                         <Trash2 className="h-4 w-4 mr-2" />
                                         Delete
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

      {/* VIEW DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedItem?.isLeadRow ? 'Lead Details' : 'Call Log Details'}</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client Name</label>
                  <Input defaultValue={selectedItem.lead?.name} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input defaultValue={selectedItem.lead?.phone} readOnly className="bg-muted" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Input defaultValue={selectedItem.notes || ''} readOnly className="bg-muted" />
              </div>
              
              {selectedItem.isLeadRow && (
                  <Button className="w-full gap-2 mt-4" onClick={() => handleCallAction(selectedItem)}>
                      <Phone className="h-4 w-4" />
                      Initiate Call
                  </Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DELETE DIALOG */}
      <Dialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-5 w-5" />
                    Confirm Deletion
                </DialogTitle>
            </DialogHeader>
            <div className="py-2">
                <p className="text-sm text-muted-foreground">
                    Are you sure you want to move this call log to trash? 
                    It will be hidden from active views.
                </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" onClick={() => setIsDeleteAlertOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}

// --- SUB-COMPONENTS ---

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string; icon: any }> = {
    pending: { label: 'To Call', className: 'bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200', icon: ArrowRightCircle },
    connected_positive: { label: 'Qualified', className: 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200', icon: ThumbsUp },
    connected_callback: { label: 'Callback', className: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200', icon: Clock },
    not_connected: { label: 'Missed', className: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200', icon: PhoneMissed },
    not_interested: { label: 'Unqualified', className: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200', icon: ThumbsDown },
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

function ReportsView({ stats }: { stats: CallStats | null }) {
  if (!stats) return <div className="p-8 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <ScrollArea className="h-full">
    <div className="space-y-6 p-1">
       <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Dashboard Overview</h2>
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Refresh Stats
          </Button>
       </div>
       
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <StatsCard title="Total Calls" value={stats.totalCalls} icon={Phone} className="bg-blue-50 border-blue-200" />
         <StatsCard title="Qualified" value={stats.positive} icon={ThumbsUp} className="bg-green-50 border-green-200" textClass="text-green-700" />
         <StatsCard title="Missed" value={stats.notAnswered} icon={PhoneMissed} className="bg-red-50 border-red-200" textClass="text-red-700" />
         <StatsCard title="Unqualified" value={stats.negative} icon={ThumbsDown} className="bg-gray-50 border-gray-200" />
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <Card className="h-[400px]">
           <CardHeader>
             <CardTitle>Missed Call Analysis</CardTitle>
           </CardHeader>
           <CardContent className="h-[320px] flex items-center justify-center">
             <div className="flex flex-col items-center justify-center text-center p-8 bg-muted/20 rounded-lg border border-dashed w-full h-full">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-medium">Analytics Visualization</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-2">
                  Call connect rate: <span className="font-bold text-foreground">{stats.connectRate}%</span>.
                </p>
             </div>
           </CardContent>
         </Card>
       </div>
    </div>
    </ScrollArea>
  );
}

function StatsCard({ title, value, icon: Icon, className, textClass }: any) {
  return (
    <Card className={`${className} shadow-sm`}>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={`text-3xl font-bold ${textClass} mt-1`}>{value}</p>
        </div>
        <div className="p-3 bg-white/60 rounded-xl shadow-sm">
          <Icon className={`h-6 w-6 ${textClass}`} />
        </div>
      </CardContent>
    </Card>
  );
}