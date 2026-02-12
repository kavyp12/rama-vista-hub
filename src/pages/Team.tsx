import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import {
  Users, UserPlus, Search, Mail, Phone, Calendar, TrendingUp, Target, Shield,
  UserCheck, Eye, Edit, Trash2, RefreshCw, MapPin, Building2, Home, Clock,
  BarChart3, PhoneCall, AlertCircle, CheckCircle2, Flame, Snowflake, ThermometerSun
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
  _count?: {
    assignedLeads: number;
    callLogs: number;
    assignedDeals: number;
  };
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  stage: string;
  temperature: 'hot' | 'warm' | 'cold';
  source: string;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredLocation: string | null;
  nextFollowupAt: string | null;
  lastContactedAt: string | null;
  createdAt: string;
  notes: string | null;
  project?: { name: string; location: string } | null;
}

interface SiteVisit {
  id: string;
  scheduledAt: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  rating: number | null;
  feedback: string | null;
  lead: {
    id: string;
    name: string;
    phone: string;
    temperature: string;
  };
  property?: {
    title: string;
    location: string;
    city: string | null;
    bedrooms: number | null;
    propertyType: string;
  } | null;
  project?: {
    name: string;
    location: string;
    city: string | null;
  } | null;
}

interface CallLog {
  id: string;
  callStatus: 'connected_positive' | 'connected_callback' | 'not_connected' | 'not_interested';
  callDate: string;
  callDuration: number | null;
  notes: string | null;
  lead: {
    name: string;
    phone: string;
  };
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
  admin: { label: 'Admin', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Shield },
  sales_manager: { label: 'Manager', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: UserCheck },
  sales_agent: { label: 'Sales Agent', color: 'bg-green-100 text-green-700 border-green-200', icon: Users }
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

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
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

      const res = await fetch(`${API_URL}/users?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch users');

      const data = await res.json();
      setUsers(data);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function fetchAgentDetails(userId: string) {
    setLoadingDetails(true);
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
        leads,
        siteVisits: agentVisits,
        callLogs,
        stats,
        missedFollowups: dashboardStats.missedFollowups || 0,
        missedVisits: dashboardStats.missedVisits || 0,
        stagnantLeads: dashboardStats.stagnantLeads || 0
      });
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to load agent details', variant: 'destructive' });
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
    setFormData({
      email: user.email,
      password: '',
      fullName: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl || ''
    });
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
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create user');
      toast({ title: 'Success', description: 'User created successfully' });
      setIsAddDialogOpen(false);
      setFormData({ email: '', password: '', fullName: '', role: 'sales_agent', avatarUrl: '' });
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateUser() {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const updateData = {
        email: formData.email,
        fullName: formData.fullName,
        role: formData.role,
        avatarUrl: formData.avatarUrl || null
      };
      const res = await fetch(`${API_URL}/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updateData)
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update user');
      toast({ title: 'Success', description: 'User updated successfully' });
      setIsEditDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`${API_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete user');
      toast({ title: 'Success', description: 'User deleted successfully' });
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
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

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  }

  return (
    <DashboardLayout title="Team Management" description="Manage your sales team and view performance">
      <div className="space-y-6">

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm border-l-4 border-l-blue-500">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Members</p>
                <h3 className="text-2xl font-bold text-slate-900">{globalStats.totalMembers}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {users.filter(u => u.role === 'sales_agent').length} agents • {users.filter(u => u.role !== 'sales_agent').length} managers
                </p>
              </div>
              <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                <Users className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-green-500">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
                <h3 className="text-2xl font-bold text-slate-900">{globalStats.totalLeads}</h3>
                <p className="text-xs text-muted-foreground mt-1">Across all team members</p>
              </div>
              <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <Target className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-purple-500">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Deals</p>
                <h3 className="text-2xl font-bold text-slate-900">{globalStats.totalDeals}</h3>
                <p className="text-xs text-muted-foreground mt-1">In pipeline</p>
              </div>
              <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-orange-500">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Calls</p>
                <h3 className="text-2xl font-bold text-slate-900">{globalStats.totalCalls}</h3>
                <p className="text-xs text-muted-foreground mt-1">Call activity logged</p>
              </div>
              <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                <PhoneCall className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40 bg-white">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="sales_agent">Sales Agent</SelectItem>
                <SelectItem value="sales_manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {currentUser?.role === 'admin' && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto gap-2 bg-slate-900 text-white hover:bg-slate-800">
                  <UserPlus className="h-4 w-4" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Team Member</DialogTitle>
                  <DialogDescription>Create a new user account for your team</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Full Name</Label>
                    <Input value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} placeholder="John Doe" />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="john@example.com" />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Min. 6 characters" />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sales_agent">Sales Agent</SelectItem>
                        <SelectItem value="sales_manager">Sales Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Avatar URL (Optional)</Label>
                    <Input value={formData.avatarUrl} onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })} placeholder="https://..." />
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

        {/* Compact Team Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Card key={i} className="animate-pulse h-64 bg-muted/50" />)}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No team members found matching your search.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredUsers.map(user => (
              <Card key={user.id} className="hover:shadow-md transition-all duration-200 overflow-hidden group">
                <CardContent className="p-0">
                  {/* Top Section */}
                  <div className="p-5 flex items-start gap-4">
                    <Avatar className="h-12 w-12 border border-slate-200">
                      <AvatarImage src={user.avatarUrl || undefined} />
                      <AvatarFallback className="bg-slate-100 text-slate-700 font-semibold">
                        {getInitials(user.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{user.fullName}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className={`${roleConfig[user.role].color} text-[10px] px-2 py-0 h-5 font-normal`}>
                          {roleConfig[user.role].label}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Compact Stats Box */}
                  <div className="grid grid-cols-3 border-y border-slate-100 bg-slate-50/50">
                    <div className="p-3 text-center border-r border-slate-100">
                      <p className="text-lg font-bold text-blue-600">{user._count?.assignedLeads || 0}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Leads</p>
                    </div>
                    <div className="p-3 text-center border-r border-slate-100">
                      <p className="text-lg font-bold text-green-600">{user._count?.assignedDeals || 0}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Deals</p>
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-lg font-bold text-orange-600">{user._count?.callLogs || 0}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Calls</p>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="p-4 space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{user.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Joined {format(new Date(user.createdAt), 'MMM yyyy')}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                        onClick={() => handleViewUser(user)}
                      >
                        <Eye className="h-3 w-3 mr-1.5" />
                        View
                      </Button>

                      {currentUser?.role === 'admin' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={user.id === currentUser.id}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* View Details Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-primary">
                  <AvatarImage src={selectedUser?.avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xl">
                    {selectedUser ? getInitials(selectedUser.fullName) : ''}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-2xl">{selectedUser?.fullName}</DialogTitle>
                  <DialogDescription className="flex items-center gap-4 mt-1">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {selectedUser?.email}
                    </span>
                    <Badge className={roleConfig[selectedUser?.role || 'sales_agent'].color}>
                      {roleConfig[selectedUser?.role || 'sales_agent'].label}
                    </Badge>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {loadingDetails ? (
              <div className="py-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Loading agent details...</p>
              </div>
            ) : agentDetails ? (
              <div className="space-y-6">
                {/* Agent Performance KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="border-blue-200 bg-blue-50/30">
                    <CardContent className="p-4 text-center">
                      <Target className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                      <p className="text-2xl font-bold text-blue-600">{agentDetails.stats.totalLeads}</p>
                      <p className="text-xs text-muted-foreground">Total Leads</p>
                    </CardContent>
                  </Card>
                  <Card className="border-green-200 bg-green-50/30">
                    <CardContent className="p-4 text-center">
                      <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-600" />
                      <p className="text-2xl font-bold text-green-600">{agentDetails.stats.conversionRate}%</p>
                      <p className="text-xs text-muted-foreground">Conversion</p>
                    </CardContent>
                  </Card>
                  <Card className="border-orange-200 bg-orange-50/30">
                    <CardContent className="p-4 text-center">
                      <PhoneCall className="h-6 w-6 mx-auto mb-2 text-orange-600" />
                      <p className="text-2xl font-bold text-orange-600">{agentDetails.stats.callStats.total}</p>
                      <p className="text-xs text-muted-foreground">Total Calls</p>
                    </CardContent>
                  </Card>
                  <Card className="border-purple-200 bg-purple-50/30">
                    <CardContent className="p-4 text-center">
                      <TrendingUp className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                      <p className="text-xl font-bold text-purple-600">{formatCurrency(agentDetails.stats.dealStats.totalRevenue)}</p>
                      <p className="text-xs text-muted-foreground">Revenue</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Alerts Section */}
                {(agentDetails.missedFollowups > 0 || agentDetails.missedVisits > 0 || agentDetails.stagnantLeads > 0) && (
                  <Card className="border-red-200 bg-red-50/30">
                    <CardHeader>
                      <CardTitle className="text-red-700 flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        Attention Required
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        {agentDetails.missedFollowups > 0 && (
                          <div className="text-center p-3 bg-white rounded border border-red-200">
                            <p className="text-xl font-bold text-red-600">{agentDetails.missedFollowups}</p>
                            <p className="text-xs text-muted-foreground">Missed Follow-ups</p>
                          </div>
                        )}
                        {agentDetails.missedVisits > 0 && (
                          <div className="text-center p-3 bg-white rounded border border-red-200">
                            <p className="text-xl font-bold text-red-600">{agentDetails.missedVisits}</p>
                            <p className="text-xs text-muted-foreground">Missed Visits</p>
                          </div>
                        )}
                        {agentDetails.stagnantLeads > 0 && (
                          <div className="text-center p-3 bg-white rounded border border-red-200">
                            <p className="text-xl font-bold text-red-600">{agentDetails.stagnantLeads}</p>
                            <p className="text-xs text-muted-foreground">Stagnant Leads</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Main Content Tabs */}
                <Tabs defaultValue="leads" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 bg-slate-100 p-1">
                    <TabsTrigger value="leads" className="gap-2">
                      <Target className="h-4 w-4" />
                      Leads ({agentDetails.leads.length})
                    </TabsTrigger>
                    <TabsTrigger value="visits" className="gap-2">
                      <MapPin className="h-4 w-4" />
                      Visits ({agentDetails.siteVisits.length})
                    </TabsTrigger>
                    <TabsTrigger value="calls" className="gap-2">
                      <PhoneCall className="h-4 w-4" />
                      Calls ({agentDetails.callLogs.length})
                    </TabsTrigger>
                    <TabsTrigger value="stats" className="gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Stats
                    </TabsTrigger>
                  </TabsList>

                  {/* LEADS TAB */}
                  <TabsContent value="leads" className="space-y-4 mt-4">
                    <div className="grid gap-3 max-h-96 overflow-y-auto pr-2">
                      {agentDetails.leads.length === 0 ? (
                        <Card className="border-dashed">
                          <CardContent className="p-8 text-center">
                            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">No leads assigned</p>
                          </CardContent>
                        </Card>
                      ) : (
                        agentDetails.leads.map(lead => {
                          const TempIcon = temperatureIcons[lead.temperature].icon;
                          const isOverdue = lead.nextFollowupAt && isPast(new Date(lead.nextFollowupAt));

                          return (
                            <Card key={lead.id} className={`hover:shadow-md transition-shadow ${isOverdue ? 'border-red-300 bg-red-50/20' : ''}`}>
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h4 className="font-semibold">{lead.name}</h4>
                                      <TempIcon className={`h-4 w-4 ${temperatureIcons[lead.temperature].color}`} />
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                      <Badge className={stageColors[lead.stage] || 'bg-gray-100 text-gray-700'}>
                                        {lead.stage.replace('_', ' ')}
                                      </Badge>
                                      <Badge variant="outline" className="text-xs">
                                        {lead.source}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {lead.phone}
                                      </span>
                                      {lead.email && (
                                        <span className="flex items-center gap-1">
                                          <Mail className="h-3 w-3" />
                                          {lead.email}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </TabsContent>

                  {/* SITE VISITS TAB */}
                  <TabsContent value="visits" className="space-y-4 mt-4">
                    <div className="grid gap-3 max-h-96 overflow-y-auto pr-2">
                      {agentDetails.siteVisits.length === 0 ? (
                        <Card className="border-dashed">
                          <CardContent className="p-8 text-center">
                            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">No site visits scheduled</p>
                          </CardContent>
                        </Card>
                      ) : (
                        agentDetails.siteVisits.map(visit => {
                          const visitDate = new Date(visit.scheduledAt);
                          const isPastVisit = isPast(visitDate);
                          const statusColors = {
                            scheduled: 'bg-blue-100 text-blue-700',
                            completed: 'bg-green-100 text-green-700',
                            cancelled: 'bg-red-100 text-red-700',
                            rescheduled: 'bg-orange-100 text-orange-700'
                          };

                          return (
                            <Card key={visit.id} className={`hover:shadow-md transition-shadow ${isPastVisit && visit.status === 'scheduled' ? 'border-red-300 bg-red-50/20' : ''}`}>
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <Calendar className="h-4 w-4 text-primary" />
                                      <span className="font-semibold text-sm">
                                        {format(visitDate, 'MMM dd, yyyy')} at {format(visitDate, 'hh:mm a')}
                                      </span>
                                    </div>
                                    <Badge className={`${statusColors[visit.status]} text-xs`}>
                                      {visit.status}
                                    </Badge>
                                  </div>
                                  {isPastVisit && visit.status === 'scheduled' && (
                                    <Badge variant="destructive" className="gap-1 text-xs">
                                      <AlertCircle className="h-3 w-3" />
                                      Overdue
                                    </Badge>
                                  )}
                                </div>

                                <div className="space-y-2 text-sm">
                                  <div className="flex items-center gap-2">
                                    {visit.property ? <Home className="h-4 w-4 text-muted-foreground" /> : <Building2 className="h-4 w-4 text-muted-foreground" />}
                                    <div>
                                      <p className="font-medium">
                                        {visit.property?.title || visit.project?.name}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {visit.property?.location || visit.project?.location}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="pt-2 border-t">
                                    <p className="text-xs font-medium mb-1">Client: {visit.lead.name}</p>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {visit.lead.phone}
                                    </p>
                                  </div>
                                  {visit.feedback && (
                                    <div className="pt-2 border-t text-xs">
                                      <span className="font-semibold">Feedback:</span> {visit.feedback}
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </TabsContent>

                  {/* CALL LOGS TAB */}
                  <TabsContent value="calls" className="space-y-4 mt-4">
                    <div className="grid gap-3 max-h-96 overflow-y-auto pr-2">
                      {agentDetails.callLogs.length === 0 ? (
                        <Card className="border-dashed">
                          <CardContent className="p-8 text-center">
                            <PhoneCall className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">No call logs recorded</p>
                          </CardContent>
                        </Card>
                      ) : (
                        agentDetails.callLogs.slice(0, 50).map(call => {
                          const callStatusColors = {
                            connected_positive: 'bg-green-100 text-green-700',
                            connected_callback: 'bg-yellow-100 text-yellow-700',
                            not_connected: 'bg-orange-100 text-orange-700',
                            not_interested: 'bg-red-100 text-red-700'
                          };

                          return (
                            <Card key={call.id} className="hover:shadow-sm transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <PhoneCall className="h-4 w-4 text-primary" />
                                      <span className="font-semibold text-sm">{call.lead.name}</span>
                                      <Badge className={`${callStatusColors[call.callStatus]} text-[10px]`}>
                                        {call.callStatus.replace(/_/g, ' ')}
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground space-y-1">
                                      <p className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {call.lead.phone}
                                      </p>
                                      <p className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {format(new Date(call.callDate), 'MMM dd, hh:mm a')}
                                      </p>
                                      {call.callDuration && (
                                        <p>Duration: {Math.floor(call.callDuration / 60)}m {call.callDuration % 60}s</p>
                                      )}
                                    </div>
                                    {call.notes && (
                                      <div className="mt-2 text-xs bg-slate-50 p-2 rounded border">
                                        <span className="font-semibold">Notes:</span> {call.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </TabsContent>

                  {/* STATISTICS TAB */}
                  <TabsContent value="stats" className="space-y-4 mt-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Leads by Stage */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Leads by Stage</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {agentDetails.stats.leadsByStage.map((item) => (
                              <div key={item.stage} className="flex justify-between items-center p-2 rounded-md bg-slate-50 text-sm">
                                <span className="capitalize">{item.stage.replace('_', ' ')}</span>
                                <Badge variant="secondary" className="bg-white border shadow-sm">{item.count}</Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Leads by Temp */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Leads by Temperature</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {agentDetails.stats.leadsByTemperature.map((item) => {
                              const TempIcon = temperatureIcons[item.temperature as 'hot' | 'warm' | 'cold'].icon;
                              const tempColor = item.temperature === 'hot' ? 'bg-red-100 text-red-700' :
                                item.temperature === 'warm' ? 'bg-orange-100 text-orange-700' :
                                  'bg-blue-100 text-blue-700';
                              return (
                                <div key={item.temperature} className="flex justify-between items-center p-2 rounded-md bg-slate-50 text-sm">
                                  <span className="capitalize flex items-center gap-2">
                                    <TempIcon className="h-3.5 w-3.5" />
                                    {item.temperature}
                                  </span>
                                  <Badge className={tempColor}>{item.count}</Badge>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Call Stats */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Call Performance</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span>Connect Rate</span>
                                <span className="font-semibold">{agentDetails.stats.callStats.connectRate}%</span>
                              </div>
                              <Progress value={agentDetails.stats.callStats.connectRate} className="h-1.5" />
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center">
                              <div className="p-2 bg-slate-50 rounded">
                                <p className="text-xl font-bold text-slate-700">{agentDetails.stats.callStats.total}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                              </div>
                              <div className="p-2 bg-green-50 rounded">
                                <p className="text-xl font-bold text-green-600">{agentDetails.stats.callStats.connected}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">Connected</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Deal Stats */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Deal Performance</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span>Win Rate</span>
                                <span className="font-semibold">{agentDetails.stats.dealStats.winRate}%</span>
                              </div>
                              <Progress value={agentDetails.stats.dealStats.winRate} className="h-1.5" />
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center">
                              <div className="p-2 bg-slate-50 rounded">
                                <p className="text-xl font-bold text-slate-700">{agentDetails.stats.dealStats.total}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">Deals</p>
                              </div>
                              <div className="p-2 bg-green-50 rounded">
                                <p className="text-xl font-bold text-green-600">{agentDetails.stats.dealStats.closed}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">Closed</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Unable to load agent details</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Team Member</DialogTitle>
              <DialogDescription>Update user information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales_agent">Sales Agent</SelectItem>
                    <SelectItem value="sales_manager">Sales Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Avatar URL</Label>
                <Input value={formData.avatarUrl} onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })} />
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