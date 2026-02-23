import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import {
  Users, UserPlus, Search, Mail, Phone, Calendar, TrendingUp, Target, Shield,
  UserCheck, Eye, Edit, Trash2, RefreshCw, MapPin, Building2, Home, Clock,
  BarChart3, PhoneCall, AlertCircle, CheckCircle2, Flame, Snowflake, ThermometerSun,
  Activity, Filter, X, ArrowUpRight, Star
} from 'lucide-react';
import { format, isPast, formatDistanceToNow } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// --- Interfaces ---
interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'sales_manager' | 'sales_agent';
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { assignedLeads: number; callLogs: number; assignedDeals: number; };
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  stage: string;
  temperature: 'hot' | 'warm' | 'cold';
  source: string;
  createdAt: string;
  lastContactedAt: string | null;
  nextFollowupAt: string | null;
}

interface SiteVisit {
  id: string;
  scheduledAt: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  feedback: string | null;
  lead: { name: string; phone: string; };
  property?: { title: string; location: string; } | null;
  project?: { name: string; location: string; } | null;
}

interface CallLog {
  id: string;
  callStatus: 'connected_positive' | 'connected_callback' | 'not_connected' | 'not_interested';
  callDate: string;
  callDuration: number | null;
  notes: string | null;
  lead: { name: string; phone: string; };
}

interface UserStats {
  leadsByStage: { stage: string; count: number }[];
  leadsByTemperature: { temperature: string; count: number }[];
  callStats: { total: number; connected: number; connectRate: number };
  dealStats: { total: number; closed: number; winRate: number; totalRevenue: number };
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
}

interface AgentDetails {
  leads: Lead[];
  siteVisits: SiteVisit[];
  callLogs: CallLog[];
  stats: UserStats;
  missedFollowups: number;
  missedVisits: number;
  stagnantLeads: number;
}

// --- Config ---
const roleConfig = {
  admin: { label: 'Admin', color: 'bg-purple-100 text-purple-700 border-purple-200', bar: 'bg-gradient-to-r from-purple-500 to-violet-600', icon: Shield, ring: 'ring-purple-400' },
  sales_manager: { label: 'Manager', color: 'bg-blue-100 text-blue-700 border-blue-200', bar: 'bg-gradient-to-r from-blue-500 to-cyan-500', icon: UserCheck, ring: 'ring-blue-400' },
  sales_agent: { label: 'Sales Agent', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', bar: 'bg-gradient-to-r from-emerald-500 to-teal-500', icon: Users, ring: 'ring-emerald-400' }
};

const stageColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-purple-100 text-purple-700',
  site_visit: 'bg-orange-100 text-orange-700',
  negotiation: 'bg-yellow-100 text-yellow-700',
  token: 'bg-teal-100 text-teal-700',
  closed: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700'
};

const temperatureIcons = {
  hot: { icon: Flame, color: 'text-red-500' },
  warm: { icon: ThermometerSun, color: 'text-orange-500' },
  cold: { icon: Snowflake, color: 'text-blue-500' }
};

export default function Team() {
  const { user: currentUser, token } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [agentDetails, setAgentDetails] = useState<AgentDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Per-tab search states
  const [leadSearch, setLeadSearch] = useState('');
  const [leadStageFilter, setLeadStageFilter] = useState('all');
  const [visitSearch, setVisitSearch] = useState('');
  const [callSearch, setCallSearch] = useState('');

  const [formData, setFormData] = useState({
    email: '', password: '', fullName: '',
    role: 'sales_agent' as 'admin' | 'sales_manager' | 'sales_agent',
    avatarUrl: ''
  });

  useEffect(() => {
    if (token) fetchUsers();
  }, [token, roleFilter]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== 'all') params.append('role', roleFilter);
      const res = await fetch(`${API_URL}/users?${params.toString()}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch users');
      setUsers(await res.json());
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function fetchAgentDetails(userId: string) {
    setLoadingDetails(true);
    setLeadSearch(''); setLeadStageFilter('all'); setVisitSearch(''); setCallSearch('');
    try {
      const [statsRes, leadsRes, visitsRes, callLogsRes, dashboardRes] = await Promise.all([
        fetch(`${API_URL}/users/${userId}/stats`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/leads?assignedTo=${userId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/site-visits`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/users/${userId}/call-logs`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/leads/dashboard/stats`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!statsRes.ok || !leadsRes.ok || !visitsRes.ok || !callLogsRes.ok) throw new Error('Failed to fetch details');

      const stats = await statsRes.json();
      const leads = await leadsRes.json();
      const allVisits = await visitsRes.json();
      const callLogs = await callLogsRes.json();
      const dashboardStats = dashboardRes.ok ? await dashboardRes.json() : { missedFollowups: 0, missedVisits: 0, stagnantLeads: 0 };
      const agentVisits = allVisits.filter((v: any) => v.conductedBy === userId || v.lead?.assignedToId === userId);

      setAgentDetails({
        leads, siteVisits: agentVisits, callLogs, stats,
        missedFollowups: dashboardStats.missedFollowups || 0,
        missedVisits: dashboardStats.missedVisits || 0,
        stagnantLeads: dashboardStats.stagnantLeads || 0
      });
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to load details', variant: 'destructive' });
      setAgentDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  }

  function handleViewUser(user: User) {
    setSelectedUser(user);
    setIsViewDialogOpen(true);
    fetchAgentDetails(user.id);
  }

  function handleEditUser(user: User) {
    setSelectedUser(user);
    setFormData({ email: user.email, password: '', fullName: user.fullName, role: user.role, avatarUrl: user.avatarUrl || '' });
    setIsEditDialogOpen(true);
  }

  async function handleCreateUser() {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create');
      toast({ title: 'Success', description: 'Created successfully' });
      setIsAddDialogOpen(false);
      setFormData({ email: '', password: '', fullName: '', role: 'sales_agent', avatarUrl: '' });
      fetchUsers();
    } catch (error: any) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    finally { setIsSubmitting(false); }
  }

  async function handleUpdateUser() {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const updateData = { email: formData.email, fullName: formData.fullName, role: formData.role, avatarUrl: formData.avatarUrl || null };
      const res = await fetch(`${API_URL}/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updateData)
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update');
      toast({ title: 'Success', description: 'Updated successfully' });
      setIsEditDialogOpen(false);
      fetchUsers();
    } catch (error: any) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    finally { setIsSubmitting(false); }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`${API_URL}/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to delete');
      toast({ title: 'Success', description: 'Deleted successfully' });
      fetchUsers();
    } catch (error: any) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
  }

  const filteredUsers = users.filter(user =>
    user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const globalStats = useMemo(() => {
    return users.reduce((acc, user) => {
      acc.totalMembers += 1;
      acc.totalLeads += user._count?.assignedLeads || 0;
      acc.totalDeals += user._count?.assignedDeals || 0;
      acc.totalCalls += user._count?.callLogs || 0;
      return acc;
    }, { totalMembers: 0, totalLeads: 0, totalDeals: 0, totalCalls: 0 });
  }, [users]);

  // Filtered data inside the view dialog
  const filteredLeads = useMemo(() => {
    if (!agentDetails) return [];
    return agentDetails.leads.filter(l => {
      const matchesSearch = l.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
        l.phone.includes(leadSearch) || (l.email || '').toLowerCase().includes(leadSearch.toLowerCase());
      const matchesStage = leadStageFilter === 'all' || l.stage === leadStageFilter;
      return matchesSearch && matchesStage;
    });
  }, [agentDetails, leadSearch, leadStageFilter]);

  const filteredVisits = useMemo(() => {
    if (!agentDetails) return [];
    return agentDetails.siteVisits.filter(v =>
      v.lead.name.toLowerCase().includes(visitSearch.toLowerCase()) ||
      (v.property?.title || v.project?.name || '').toLowerCase().includes(visitSearch.toLowerCase())
    );
  }, [agentDetails, visitSearch]);

  const filteredCalls = useMemo(() => {
    if (!agentDetails) return [];
    return agentDetails.callLogs.filter(c =>
      c.lead.name.toLowerCase().includes(callSearch.toLowerCase()) ||
      c.lead.phone.includes(callSearch)
    );
  }, [agentDetails, callSearch]);

  function getInitials(name: string) { return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2); }
  function formatCurrency(amount: number) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount); }

  return (
    <DashboardLayout title="Team Management" description="Manage your sales team and view performance">
      <div className="space-y-6">

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Members', value: globalStats.totalMembers, sub: `${users.filter(u => u.role === 'sales_agent').length} agents • ${users.filter(u => u.role !== 'sales_agent').length} managers`, color: 'border-l-blue-500', bg: 'bg-blue-100', iconColor: 'text-blue-600', Icon: Users },
            { label: 'Total Leads', value: globalStats.totalLeads, sub: 'Across all agents', color: 'border-l-emerald-500', bg: 'bg-emerald-100', iconColor: 'text-emerald-600', Icon: Target },
            { label: 'Active Deals', value: globalStats.totalDeals, sub: 'In pipeline', color: 'border-l-purple-500', bg: 'bg-purple-100', iconColor: 'text-purple-600', Icon: TrendingUp },
            { label: 'Total Calls', value: globalStats.totalCalls, sub: 'Logged calls', color: 'border-l-orange-500', bg: 'bg-orange-100', iconColor: 'text-orange-600', Icon: PhoneCall },
          ].map(({ label, value, sub, color, bg, iconColor, Icon }) => (
            <Card key={label} className={`shadow-sm border-l-4 ${color}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{label}</p>
                  <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                </div>
                <div className={`h-10 w-10 ${bg} rounded-full flex items-center justify-center ${iconColor}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search team members..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-slate-50 border-slate-200" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40 bg-slate-50 border-slate-200"><SelectValue placeholder="All Roles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="sales_agent">Sales Agent</SelectItem>
                <SelectItem value="sales_manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] font-normal text-slate-500">
              {filteredUsers.length} member{filteredUsers.length !== 1 ? 's' : ''}
            </Badge>
            {currentUser?.role === 'admin' && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-slate-900 text-white hover:bg-slate-800">
                    <UserPlus className="h-4 w-4" /> Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add New Team Member</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Full Name</Label><Input value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} /></div>
                    <div><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                    <div><Label>Password</Label><Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} /></div>
                    <div>
                      <Label>Role</Label>
                      <Select value={formData.role} onValueChange={(val: any) => setFormData({ ...formData, role: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sales_agent">Sales Agent</SelectItem>
                          <SelectItem value="sales_manager">Sales Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateUser} disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create User'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Team Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Card key={i} className="animate-pulse h-64 bg-muted/50" />)}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No team members found.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredUsers.map(user => {
              const cfg = roleConfig[user.role];
              const RoleIcon = cfg.icon;
              return (
                <Card key={user.id} className="hover:shadow-lg transition-all duration-200 overflow-hidden group flex flex-col border-slate-200 bg-white">
                  {/* Colored top accent bar */}
                  <div className={`h-1.5 w-full ${cfg.bar}`} />

                  <CardContent className="p-5 flex-1 flex flex-col gap-4">
                    {/* Header: Avatar + Name */}
                    <div className="flex items-start gap-3">
                      <Avatar className={`h-12 w-12 border-2 border-white ring-2 ${cfg.ring} shadow-sm`}>
                        <AvatarImage src={user.avatarUrl || undefined} />
                        <AvatarFallback className="bg-slate-100 text-slate-700 font-bold text-sm">{getInitials(user.fullName)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate leading-tight">{user.fullName}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <RoleIcon className="h-3 w-3 text-slate-400" />
                          <Badge variant="secondary" className={`${cfg.color} text-[10px] px-2 py-0 h-4 font-normal border`}>{cfg.label}</Badge>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 shrink-0" />{user.email}
                        </p>
                      </div>
                    </div>

                    {/* Stats Strip */}
                    <div className="grid grid-cols-3 rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                      <div className="p-2.5 text-center hover:bg-white transition-colors">
                        <p className="text-base font-bold text-blue-600">{user._count?.assignedLeads || 0}</p>
                        <p className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">Leads</p>
                      </div>
                      <div className="p-2.5 text-center border-x border-slate-100 hover:bg-white transition-colors">
                        <p className="text-base font-bold text-emerald-600">{user._count?.assignedDeals || 0}</p>
                        <p className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">Deals</p>
                      </div>
                      <div className="p-2.5 text-center hover:bg-white transition-colors">
                        <p className="text-base font-bold text-orange-500">{user._count?.callLogs || 0}</p>
                        <p className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">Calls</p>
                      </div>
                    </div>

                    {/* Joined date */}
                    <p className="text-[11px] text-slate-400 flex items-center gap-1 -mt-1">
                      <Clock className="h-3 w-3" />
                      Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                    </p>
                  </CardContent>

                  {/* Footer quick actions — LeadCard style */}
                  <CardFooter className="p-0 border-t border-slate-100 bg-slate-50/70 grid divide-x divide-slate-100"
                    style={{ gridTemplateColumns: currentUser?.role === 'admin' ? '1fr 1fr 1fr' : '1fr' }}>
                    <Button variant="ghost" className="h-9 rounded-none text-slate-500 hover:text-blue-600 hover:bg-blue-50 text-[11px]" onClick={() => handleViewUser(user)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                    {currentUser?.role === 'admin' && (
                      <>
                        <Button variant="ghost" className="h-9 rounded-none text-slate-500 hover:text-amber-600 hover:bg-amber-50 text-[11px]" onClick={() => handleEditUser(user)}>
                          <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button variant="ghost" className="h-9 rounded-none text-slate-500 hover:text-red-600 hover:bg-red-50 text-[11px]" onClick={() => handleDeleteUser(user.id)} disabled={user.id === currentUser.id}>
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                        </Button>
                      </>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* === PREMIUM AGENT DETAILS DIALOG === */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[92vh] p-0 overflow-hidden flex flex-col gap-0 bg-slate-50">

            {/* Dark Gradient Header */}
            <div className={`${selectedUser ? roleConfig[selectedUser.role].bar : 'bg-gradient-to-r from-slate-900 to-slate-700'} p-6 text-white shrink-0`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {/* Avatar */}
                <Avatar className={`h-16 w-16 border-2 border-white/30 ring-4 ring-white/20 shadow-xl shrink-0`}>
                  <AvatarImage src={selectedUser?.avatarUrl || undefined} />
                  <AvatarFallback className="bg-white/20 text-white text-xl font-bold">
                    {selectedUser ? getInitials(selectedUser.fullName) : ''}
                  </AvatarFallback>
                </Avatar>

                {/* Name + info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <DialogTitle className="text-2xl font-bold text-white">{selectedUser?.fullName}</DialogTitle>
                    {selectedUser && (
                      <Badge className="bg-white/20 text-white border-white/30 text-[10px] h-5 font-normal">
                        {roleConfig[selectedUser.role].label}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-white/70 text-sm flex-wrap">
                    <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{selectedUser?.email}</span>
                    {selectedUser?.createdAt && (
                      <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />
                        Joined {format(new Date(selectedUser.createdAt), 'MMM yyyy')}
                      </span>
                    )}
                  </div>
                </div>

                {/* KPI Pills */}
                {agentDetails && !loadingDetails && (
                  <div className="flex gap-3 shrink-0 flex-wrap">
                    {[
                      { label: 'Leads', value: agentDetails.stats.totalLeads, color: 'bg-white/15' },
                      { label: 'Conv.', value: `${agentDetails.stats.conversionRate}%`, color: 'bg-white/15' },
                      { label: 'Calls', value: agentDetails.stats.callStats.total, color: 'bg-white/15' },
                      { label: 'Win%', value: `${agentDetails.stats.dealStats.winRate}%`, color: 'bg-white/15' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className={`${color} backdrop-blur-sm rounded-xl px-4 py-2.5 text-center border border-white/20 min-w-[64px]`}>
                        <p className="text-lg font-bold text-white leading-none">{value}</p>
                        <p className="text-[10px] text-white/60 mt-0.5 font-medium uppercase tracking-wide">{label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {loadingDetails ? (
                <div className="py-24 text-center">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                  <p className="text-muted-foreground font-medium">Loading agent data...</p>
                </div>
              ) : agentDetails ? (
                <>
                  {/* Alerts */}
                  {(agentDetails.missedFollowups > 0 || agentDetails.missedVisits > 0 || agentDetails.stagnantLeads > 0) && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-center gap-4 shadow-sm flex-wrap">
                      <div className="flex items-center gap-2 text-red-700 font-bold text-sm shrink-0">
                        <AlertCircle className="h-4 w-4" /> Needs Attention
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        {agentDetails.missedFollowups > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-xs bg-white text-red-700 px-3 py-1 rounded-full border border-red-200 font-medium shadow-sm">
                            <span className="font-bold text-red-600">{agentDetails.missedFollowups}</span> Missed Follow-ups
                          </span>
                        )}
                        {agentDetails.missedVisits > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-xs bg-white text-red-700 px-3 py-1 rounded-full border border-red-200 font-medium shadow-sm">
                            <span className="font-bold text-red-600">{agentDetails.missedVisits}</span> Missed Visits
                          </span>
                        )}
                        {agentDetails.stagnantLeads > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-xs bg-white text-red-700 px-3 py-1 rounded-full border border-red-200 font-medium shadow-sm">
                            <span className="font-bold text-red-600">{agentDetails.stagnantLeads}</span> Stagnant Leads
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tabbed Data */}
                  <Tabs defaultValue="leads" className="w-full">
                    <TabsList className="bg-white border shadow-sm p-1 rounded-xl grid grid-cols-4 mb-4 h-auto">
                      <TabsTrigger value="leads" className="gap-2 py-2 text-xs data-[state=active]:shadow-sm">
                        <Target className="h-3.5 w-3.5" /> Leads
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 ml-0.5">{agentDetails.leads.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="visits" className="gap-2 py-2 text-xs data-[state=active]:shadow-sm">
                        <MapPin className="h-3.5 w-3.5" /> Visits
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 ml-0.5">{agentDetails.siteVisits.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="calls" className="gap-2 py-2 text-xs data-[state=active]:shadow-sm">
                        <PhoneCall className="h-3.5 w-3.5" /> Calls
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 ml-0.5">{agentDetails.callLogs.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="stats" className="gap-2 py-2 text-xs data-[state=active]:shadow-sm">
                        <BarChart3 className="h-3.5 w-3.5" /> Stats
                      </TabsTrigger>
                    </TabsList>

                    {/* ---- LEADS TAB ---- */}
                    <TabsContent value="leads">
                      <Card className="border-0 shadow-sm overflow-hidden">
                        {/* Search + Filter bar */}
                        <div className="p-3 border-b bg-white flex gap-2 items-center">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input placeholder="Search leads by name, phone, email…" value={leadSearch}
                              onChange={e => setLeadSearch(e.target.value)}
                              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200" />
                          </div>
                          <Select value={leadStageFilter} onValueChange={setLeadStageFilter}>
                            <SelectTrigger className="w-36 h-8 text-xs bg-slate-50 border-slate-200"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Stages</SelectItem>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="contacted">Contacted</SelectItem>
                              <SelectItem value="site_visit">Site Visit</SelectItem>
                              <SelectItem value="negotiation">Negotiation</SelectItem>
                              <SelectItem value="token">Token</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                              <SelectItem value="lost">Lost</SelectItem>
                            </SelectContent>
                          </Select>
                          {(leadSearch || leadStageFilter !== 'all') && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => { setLeadSearch(''); setLeadStageFilter('all'); }}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <span className="text-[10px] text-slate-400 shrink-0">{filteredLeads.length} result{filteredLeads.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="max-h-[420px] overflow-y-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="text-[10px] text-slate-400 bg-slate-50 uppercase tracking-wider sticky top-0 z-10 border-b">
                              <tr>
                                <th className="px-4 py-2.5 font-semibold">Lead</th>
                                <th className="px-4 py-2.5 font-semibold">Contact</th>
                                <th className="px-4 py-2.5 font-semibold">Stage</th>
                                <th className="px-4 py-2.5 font-semibold">Added</th>
                                <th className="px-4 py-2.5 font-semibold">Last Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {filteredLeads.length === 0 ? (
                                <tr><td colSpan={5} className="py-10 text-center text-slate-400 text-xs">No leads match your filters.</td></tr>
                              ) : filteredLeads.map(lead => {
                                const TempIcon = temperatureIcons[lead.temperature].icon;
                                const isOverdue = lead.nextFollowupAt && isPast(new Date(lead.nextFollowupAt));
                                return (
                                  <tr key={lead.id} className={`hover:bg-slate-50 transition-colors ${isOverdue ? 'bg-red-50/40' : ''}`}>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2.5">
                                        <Avatar className="h-7 w-7 shrink-0">
                                          <AvatarFallback className="text-[10px] bg-slate-100 text-slate-600 font-semibold">{getInitials(lead.name)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                          <p className="font-semibold text-slate-900 text-xs flex items-center gap-1">
                                            {lead.name}
                                            <TempIcon className={`h-3 w-3 ${temperatureIcons[lead.temperature].color}`} />
                                          </p>
                                          <p className="text-[10px] text-slate-400 capitalize">{lead.source}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-600 space-y-0.5">
                                      <div className="flex items-center gap-1"><Phone className="h-3 w-3 text-slate-300" />{lead.phone}</div>
                                      {lead.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3 text-slate-300" />{lead.email}</div>}
                                    </td>
                                    <td className="px-4 py-3">
                                      <Badge className={`${stageColors[lead.stage] || 'bg-slate-100 text-slate-700'} text-[10px] font-medium capitalize border-0`}>{lead.stage.replace('_', ' ')}</Badge>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500">{format(new Date(lead.createdAt), 'MMM dd, yyyy')}</td>
                                    <td className="px-4 py-3 text-xs">
                                      {lead.lastContactedAt
                                        ? <span className="text-slate-600">{format(new Date(lead.lastContactedAt), 'MMM dd, yyyy')}</span>
                                        : <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] font-medium border border-amber-100">Pending</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </TabsContent>

                    {/* ---- VISITS TAB ---- */}
                    <TabsContent value="visits">
                      <Card className="border-0 shadow-sm overflow-hidden">
                        <div className="p-3 border-b bg-white flex gap-2 items-center">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input placeholder="Search by lead name or property…" value={visitSearch}
                              onChange={e => setVisitSearch(e.target.value)}
                              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200" />
                          </div>
                          {visitSearch && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => setVisitSearch('')}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <span className="text-[10px] text-slate-400 shrink-0">{filteredVisits.length} result{filteredVisits.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="max-h-[420px] overflow-y-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="text-[10px] text-slate-400 bg-slate-50 uppercase tracking-wider sticky top-0 z-10 border-b">
                              <tr>
                                <th className="px-4 py-2.5 font-semibold">Date & Time</th>
                                <th className="px-4 py-2.5 font-semibold">Lead</th>
                                <th className="px-4 py-2.5 font-semibold">Property / Project</th>
                                <th className="px-4 py-2.5 font-semibold">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {filteredVisits.length === 0 ? (
                                <tr><td colSpan={4} className="py-10 text-center text-slate-400 text-xs">No visits match your search.</td></tr>
                              ) : filteredVisits.map(visit => {
                                const visitDate = new Date(visit.scheduledAt);
                                const statusColors = { scheduled: 'bg-blue-100 text-blue-700', completed: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-red-100 text-red-700', rescheduled: 'bg-orange-100 text-orange-700' };
                                return (
                                  <tr key={visit.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                      <p className="font-semibold text-slate-900 text-xs">{format(visitDate, 'MMM dd, yyyy')}</p>
                                      <p className="text-[10px] text-slate-400">{format(visitDate, 'hh:mm a')}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                      <p className="font-medium text-slate-900 text-xs">{visit.lead.name}</p>
                                      <p className="text-[10px] text-slate-400">{visit.lead.phone}</p>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 text-xs">
                                      <div className="flex items-center gap-1.5">
                                        {visit.property ? <Home className="h-3.5 w-3.5 text-slate-300 shrink-0" /> : <Building2 className="h-3.5 w-3.5 text-slate-300 shrink-0" />}
                                        <span className="truncate max-w-[160px]">{visit.property?.title || visit.project?.name || '—'}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <Badge className={`${statusColors[visit.status]} text-[10px] capitalize border-0`}>{visit.status}</Badge>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </TabsContent>

                    {/* ---- CALLS TAB ---- */}
                    <TabsContent value="calls">
                      <Card className="border-0 shadow-sm overflow-hidden">
                        <div className="p-3 border-b bg-white flex gap-2 items-center">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input placeholder="Search by lead name or phone…" value={callSearch}
                              onChange={e => setCallSearch(e.target.value)}
                              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200" />
                          </div>
                          {callSearch && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => setCallSearch('')}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <span className="text-[10px] text-slate-400 shrink-0">{filteredCalls.length} result{filteredCalls.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="max-h-[420px] overflow-y-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="text-[10px] text-slate-400 bg-slate-50 uppercase tracking-wider sticky top-0 z-10 border-b">
                              <tr>
                                <th className="px-4 py-2.5 font-semibold">Time</th>
                                <th className="px-4 py-2.5 font-semibold">Lead</th>
                                <th className="px-4 py-2.5 font-semibold">Outcome</th>
                                <th className="px-4 py-2.5 font-semibold">Duration & Notes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {filteredCalls.length === 0 ? (
                                <tr><td colSpan={4} className="py-10 text-center text-slate-400 text-xs">No calls match your search.</td></tr>
                              ) : filteredCalls.map(call => {
                                const callStatusColors = { connected_positive: 'bg-emerald-100 text-emerald-700', connected_callback: 'bg-yellow-100 text-yellow-700', not_connected: 'bg-orange-100 text-orange-700', not_interested: 'bg-red-100 text-red-700' };
                                return (
                                  <tr key={call.id} className="hover:bg-slate-50 align-top transition-colors">
                                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{format(new Date(call.callDate), 'MMM dd, hh:mm a')}</td>
                                    <td className="px-4 py-3">
                                      <p className="font-medium text-slate-900 text-xs">{call.lead.name}</p>
                                      <p className="text-[10px] text-slate-400">{call.lead.phone}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                      <Badge className={`${callStatusColors[call.callStatus]} text-[10px] capitalize border-0`}>{call.callStatus.replace(/_/g, ' ')}</Badge>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-600">
                                      {call.callDuration && (
                                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full text-[10px] mr-2">
                                          <Clock className="h-2.5 w-2.5" />{Math.floor(call.callDuration / 60)}m {call.callDuration % 60}s
                                        </span>
                                      )}
                                      {call.notes || <span className="italic text-slate-300">No notes</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </TabsContent>

                    {/* ---- STATS TAB ---- */}
                    <TabsContent value="stats">
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Pipeline */}
                        <Card className="border-0 shadow-sm">
                          <CardHeader className="p-5 pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-blue-500" />Pipeline Overview</CardTitle></CardHeader>
                          <CardContent className="p-5 pt-0">
                            <div className="space-y-2">
                              {agentDetails.stats.leadsByStage.map((item) => (
                                <div key={item.stage} className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-sm">
                                  <span className="capitalize text-slate-700 font-medium text-xs">{item.stage.replace('_', ' ')}</span>
                                  <Badge variant="outline" className="bg-white font-bold text-slate-800 px-3">{item.count}</Badge>
                                </div>
                              ))}
                              {agentDetails.stats.leadsByStage.length === 0 && (
                                <p className="text-xs text-slate-400 text-center py-4">No pipeline data.</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        <div className="space-y-4">
                          {/* Temperature */}
                          <Card className="border-0 shadow-sm">
                            <CardHeader className="p-5 pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Flame className="h-4 w-4 text-orange-500" />Lead Temperature</CardTitle></CardHeader>
                            <CardContent className="p-5 pt-0">
                              <div className="flex gap-3">
                                {agentDetails.stats.leadsByTemperature.map((item) => {
                                  const TempIcon = temperatureIcons[item.temperature as 'hot' | 'warm' | 'cold'].icon;
                                  const tempStyle = item.temperature === 'hot'
                                    ? 'bg-gradient-to-b from-red-50 to-red-100 text-red-700 border-red-200'
                                    : item.temperature === 'warm'
                                      ? 'bg-gradient-to-b from-orange-50 to-orange-100 text-orange-700 border-orange-200'
                                      : 'bg-gradient-to-b from-blue-50 to-blue-100 text-blue-700 border-blue-200';
                                  return (
                                    <div key={item.temperature} className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border ${tempStyle}`}>
                                      <TempIcon className="h-6 w-6 mb-2 opacity-80" />
                                      <span className="text-2xl font-bold">{item.count}</span>
                                      <span className="text-[10px] uppercase font-semibold opacity-60 tracking-wider mt-1">{item.temperature}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </Card>

                          {/* Win Rate */}
                          <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-900 to-slate-700 text-white overflow-hidden">
                            <CardContent className="p-5">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Closing Win Rate</p>
                                  <p className="text-4xl font-bold mt-0.5">{agentDetails.stats.dealStats.winRate}%</p>
                                </div>
                                <div className="h-12 w-12 bg-white/10 rounded-full flex items-center justify-center">
                                  <Star className="h-6 w-6 text-yellow-400" />
                                </div>
                              </div>
                              <Progress value={agentDetails.stats.dealStats.winRate} className="h-2 bg-slate-700 [&>div]:bg-gradient-to-r [&>div]:from-green-400 [&>div]:to-emerald-500" />
                              <div className="flex justify-between mt-2 text-[10px] text-slate-500">
                                <span>{agentDetails.stats.dealStats.closed} deals closed</span>
                                <span className="text-emerald-400 font-semibold">{formatCurrency(agentDetails.stats.dealStats.totalRevenue)}</span>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Call Stats */}
                          <Card className="border-0 shadow-sm">
                            <CardContent className="p-5 flex items-center justify-between">
                              <div>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Call Connect Rate</p>
                                <p className="text-3xl font-bold text-slate-900 mt-0.5">{agentDetails.stats.callStats.connectRate}%</p>
                                <p className="text-[10px] text-slate-400 mt-1">{agentDetails.stats.callStats.connected} of {agentDetails.stats.callStats.total} connected</p>
                              </div>
                              <div className="h-12 w-12 bg-orange-50 rounded-full flex items-center justify-center">
                                <PhoneCall className="h-6 w-6 text-orange-500" />
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Team Member</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Full Name</Label><Input value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
              <div>
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={(val: any) => setFormData({ ...formData, role: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales_agent">Sales Agent</SelectItem>
                    <SelectItem value="sales_manager">Sales Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateUser} disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update User'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}