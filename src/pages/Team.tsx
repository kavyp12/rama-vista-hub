import { useEffect, useState } from 'react';
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
import { 
  Users, UserPlus, Search, Mail, Phone, Calendar, TrendingUp, Target, Award, 
  Settings, Shield, UserCheck, UserX, Eye, Edit, Trash2, RefreshCw, 
  MapPin, Building2, Home, Clock, BarChart3, PhoneCall, AlertCircle, CheckCircle2
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isPast, isThisWeek, isThisMonth } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

interface UserStats {
  leadsByStage: { stage: string; count: number }[];
  leadsByTemperature: { temperature: string; count: number }[];
  callStats: { total: number; connected: number; connectRate: number };
  dealStats: { total: number; closed: number; winRate: number; totalRevenue: number };
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  recentActivity?: {
    newLeadsThisWeek: number;
    newLeadsThisMonth: number;
    callsThisWeek: number;
    visitsThisWeek: number;
  };
}

interface SiteVisit {
  feedback: any;
  id: string;
  scheduledAt: string;
  status: string;
  lead: {
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

const roleConfig = {
  admin: { label: 'Admin', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Shield },
  sales_manager: { label: 'Sales Manager', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: UserCheck },
  sales_agent: { label: 'Sales Agent', color: 'bg-green-100 text-green-700 border-green-200', icon: Users }
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
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [agentVisits, setAgentVisits] = useState<SiteVisit[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
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
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to load team members',
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchUserStats(userId: string) {
    setLoadingStats(true);
    try {
      const res = await fetch(`${API_URL}/users/${userId}/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to fetch stats');
      
      const data = await res.json();
      setUserStats(data);
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: 'Failed to load user statistics',
        variant: 'destructive' 
      });
    } finally {
      setLoadingStats(false);
    }
  }

  async function fetchAgentVisits(userId: string) {
    setLoadingVisits(true);
    try {
      const res = await fetch(`${API_URL}/site-visits`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to fetch visits');
      
      const data = await res.json();
      
      const filtered = data.filter((v: any) => 
        v.conductedBy === userId && (v.status === 'scheduled' || v.status === 'rescheduled')
      );
      
      filtered.sort((a: any, b: any) => 
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
      
      setAgentVisits(filtered);
    } catch (error) {
      console.error(error);
      toast({ 
        title: 'Error', 
        description: 'Failed to load agent visits',
        variant: 'destructive' 
      });
    } finally {
      setLoadingVisits(false);
    }
  }

  async function handleCreateUser() {
    if (!formData.email || !formData.password || !formData.fullName) {
      toast({ title: 'Validation Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create user');
      }

      toast({ title: 'Success', description: 'Team member added successfully' });
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
      const res = await fetch(`${API_URL}/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          role: formData.role,
          avatarUrl: formData.avatarUrl || null
        })
      });

      if (!res.ok) throw new Error('Failed to update user');

      toast({ title: 'Success', description: 'Team member updated successfully' });
      setIsEditDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm('Are you sure you want to remove this team member? This action cannot be undone.')) return;

    try {
      const res = await fetch(`${API_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to delete user');

      toast({ title: 'Success', description: 'Team member removed successfully' });
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  }

  function handleViewUser(user: User) {
    setSelectedUser(user);
    setIsViewDialogOpen(true);
    fetchUserStats(user.id);
    if (user.role === 'sales_agent') {
      fetchAgentVisits(user.id);
    }
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

  function formatCurrency(amount: number) {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
    return `₹${amount.toLocaleString()}`;
  }

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  function getDateBadge(dateStr: string) {
    const date = parseISO(dateStr);
    if (isToday(date)) return { text: 'Today', class: 'bg-green-100 text-green-700 border-green-200' };
    if (isTomorrow(date)) return { text: 'Tomorrow', class: 'bg-blue-100 text-blue-700 border-blue-200' };
    if (isPast(date)) return { text: 'Past', class: 'bg-red-100 text-red-700 border-red-200' };
    return { text: format(date, 'MMM dd'), class: 'bg-slate-100 text-slate-700 border-slate-200' };
  }

  function getLocationName(visit: SiteVisit) {
    if (visit.property) {
      return visit.property.title;
    }
    return visit.project?.name || 'Unknown Location';
  }

  function getLocationAddress(visit: SiteVisit) {
    if (visit.property) {
      return `${visit.property.location}${visit.property.city ? ', ' + visit.property.city : ''}`;
    }
    return `${visit.project?.location || ''}${visit.project?.city ? ', ' + visit.project.city : ''}`;
  }

  const filteredUsers = users.filter(user => 
    user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const teamStats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    managers: users.filter(u => u.role === 'sales_manager').length,
    agents: users.filter(u => u.role === 'sales_agent').length,
    totalLeads: users.reduce((sum, u) => sum + (u._count?.assignedLeads || 0), 0),
    totalDeals: users.reduce((sum, u) => sum + (u._count?.assignedDeals || 0), 0),
    totalCalls: users.reduce((sum, u) => sum + (u._count?.callLogs || 0), 0)
  };

  return (
    <DashboardLayout title="Team Management" description="Manage your sales team members">
      <div className="space-y-6">
        
        {/* Team Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Members</p>
                  <p className="text-2xl font-bold">{teamStats.total}</p>
                </div>
                <div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {teamStats.agents} agents • {teamStats.managers} managers
              </p>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
                  <p className="text-2xl font-bold">{teamStats.totalLeads}</p>
                </div>
                <div className="h-12 w-12 bg-green-50 rounded-full flex items-center justify-center">
                  <Target className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Across all team members
              </p>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Deals</p>
                  <p className="text-2xl font-bold">{teamStats.totalDeals}</p>
                </div>
                <div className="h-12 w-12 bg-purple-50 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                In pipeline
              </p>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Calls</p>
                  <p className="text-2xl font-bold">{teamStats.totalCalls}</p>
                </div>
                <div className="h-12 w-12 bg-orange-50 rounded-full flex items-center justify-center">
                  <PhoneCall className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Call activity logged
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search team members..." 
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="sales_manager">Sales Manager</SelectItem>
                <SelectItem value="sales_agent">Sales Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <UserPlus className="h-4 w-4" /> Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>Create a new user account for your team</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input 
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input 
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <Input 
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select 
                    value={formData.role} 
                    onValueChange={(val: any) => setFormData({...formData, role: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="sales_manager">Sales Manager</SelectItem>
                      <SelectItem value="sales_agent">Sales Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateUser} disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Member'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Team Members Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? (
            [...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 bg-muted rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredUsers.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <UserX className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No team members found</h3>
                <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
              </CardContent>
            </Card>
          ) : (
            filteredUsers.map((user) => {
              const RoleIcon = roleConfig[user.role].icon;
              const isCurrentUser = user.id === currentUser?.id;
              
              return (
                <Card key={user.id} className="hover-lift group">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12 border-2 border-primary/10">
                            <AvatarImage src={user.avatarUrl || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {getInitials(user.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold flex items-center gap-2">
                              {user.fullName}
                              {isCurrentUser && (
                                <Badge variant="outline" className="text-[10px] px-1">You</Badge>
                              )}
                            </h3>
                            <Badge variant="outline" className={`text-[10px] mt-1 ${roleConfig[user.role].color}`}>
                              <RoleIcon className="h-3 w-3 mr-1" />
                              {roleConfig[user.role].label}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 pt-3 border-t">
                        <div className="text-center">
                          <p className="text-lg font-bold text-primary">{user._count?.assignedLeads || 0}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Leads</p>
                        </div>
                        <div className="text-center border-x">
                          <p className="text-lg font-bold text-purple-600">{user._count?.assignedDeals || 0}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Deals</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-orange-600">{user._count?.callLogs || 0}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Calls</p>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="space-y-1.5 text-sm pt-2 border-t">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate">{user.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-xs">Joined {format(parseISO(user.createdAt), 'MMM yyyy')}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 gap-1"
                          onClick={() => handleViewUser(user)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-1"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        {!isCurrentUser && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-1 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Team Member</DialogTitle>
              <DialogDescription>Update team member information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input 
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(val: any) => setFormData({...formData, role: val})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="sales_manager">Sales Manager</SelectItem>
                    <SelectItem value="sales_agent">Sales Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateUser} disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Member'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-primary">
                  <AvatarImage src={selectedUser?.avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                    {selectedUser && getInitials(selectedUser.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-2xl">{selectedUser?.fullName}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={selectedUser ? roleConfig[selectedUser.role].color : ''}>
                      {selectedUser && roleConfig[selectedUser.role].label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{selectedUser?.email}</span>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {loadingStats ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : userStats ? (
                <>
                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="border-blue-200 bg-blue-50/30">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Target className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-blue-600">{userStats.totalLeads}</p>
                            <p className="text-xs text-muted-foreground">Total Leads</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-green-200 bg-green-50/30">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-green-600">{userStats.conversionRate}%</p>
                            <p className="text-xs text-muted-foreground">Conversion</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-purple-200 bg-purple-50/30">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-purple-600">{formatCurrency(userStats.dealStats.totalRevenue)}</p>
                            <p className="text-xs text-muted-foreground">Revenue</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-orange-200 bg-orange-50/30">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <PhoneCall className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-orange-600">{userStats.callStats.connectRate}%</p>
                            <p className="text-xs text-muted-foreground">Connect Rate</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Agent Visits */}
                  {selectedUser?.role === 'sales_agent' && (
                    <Card className="border-blue-200 bg-blue-50/30">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-blue-600" />
                          Scheduled Site Visits ({agentVisits.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {loadingVisits ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : agentVisits.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No scheduled visits</p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {agentVisits.map((visit) => {
                              const dateBadge = getDateBadge(visit.scheduledAt);
                              const getStatusColor = (s: string) => {
                                if (s === 'completed') return 'bg-green-100 text-green-700 border-green-200';
                                if (s === 'rescheduled') return 'bg-purple-100 text-purple-700 border-purple-200';
                                if (s === 'cancelled') return 'bg-gray-100 text-gray-700 border-gray-200';
                                return 'bg-blue-100 text-blue-700 border-blue-200';
                              };

                              return (
                                <Card key={visit.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
                                  <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1 space-y-2">
                                        
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Badge className={dateBadge.class}>
                                            {dateBadge.text}
                                          </Badge>
                                          <Badge variant="outline" className={getStatusColor(visit.status)}>
                                            {visit.status}
                                          </Badge>
                                          <span className="text-sm font-medium">
                                            {format(parseISO(visit.scheduledAt), 'h:mm a')}
                                          </span>
                                        </div>
                                        
                                        <div className="flex items-start gap-2">
                                          {visit.property ? (
                                            <Home className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                                          ) : (
                                            <Building2 className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
                                          )}
                                          <div>
                                            <p className="font-semibold text-sm">
                                              {getLocationName(visit)}
                                            </p>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                              <MapPin className="h-3 w-3" />
                                              {getLocationAddress(visit)}
                                            </p>
                                          </div>
                                        </div>

                                        {visit.feedback && (
                                          <div className="mt-2 text-xs bg-muted/50 p-2 rounded text-muted-foreground border-l-2 border-gray-300">
                                            <span className="font-semibold text-gray-700">Latest Note: </span>
                                            {visit.feedback.split('\n').pop()?.replace(/\[.*?\]: /, '')}
                                          </div>
                                        )}

                                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t mt-2">
                                          <span className="font-medium">Client: {visit.lead.name}</span>
                                          <span className="flex items-center gap-1">
                                            <Phone className="h-3 w-3" />
                                            {visit.lead.phone}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Detailed Stats Tabs */}
                  <Tabs defaultValue="leads" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="leads" className="gap-2">
                        <Target className="h-4 w-4" />
                        Leads
                      </TabsTrigger>
                      <TabsTrigger value="calls" className="gap-2">
                        <PhoneCall className="h-4 w-4" />
                        Calls
                      </TabsTrigger>
                      <TabsTrigger value="deals" className="gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Deals
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="leads" className="space-y-4 mt-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">By Stage</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {userStats.leadsByStage.map((item) => (
                                <div key={item.stage} className="flex justify-between items-center p-3 rounded-lg border hover:bg-slate-50 transition-colors">
                                  <span className="capitalize font-medium text-sm">{item.stage}</span>
                                  <Badge variant="secondary" className="bg-primary/10 text-primary">{item.count}</Badge>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">By Temperature</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {userStats.leadsByTemperature.map((item) => {
                                const tempColor = item.temperature === 'hot' ? 'bg-red-100 text-red-700' :
                                                  item.temperature === 'warm' ? 'bg-orange-100 text-orange-700' :
                                                  'bg-blue-100 text-blue-700';
                                return (
                                  <div key={item.temperature} className="flex justify-between items-center p-3 rounded-lg border hover:bg-slate-50 transition-colors">
                                    <span className="capitalize font-medium text-sm">{item.temperature}</span>
                                    <Badge className={tempColor}>{item.count}</Badge>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="calls" className="space-y-4 mt-4">
                      <div className="grid grid-cols-3 gap-4">
                        <Card className="border-orange-200 bg-orange-50/30">
                          <CardContent className="p-6 text-center">
                            <p className="text-3xl font-bold text-orange-600">{userStats.callStats.total}</p>
                            <p className="text-sm text-muted-foreground mt-1">Total Calls</p>
                          </CardContent>
                        </Card>
                        <Card className="border-green-200 bg-green-50/30">
                          <CardContent className="p-6 text-center">
                            <p className="text-3xl font-bold text-green-600">{userStats.callStats.connected}</p>
                            <p className="text-sm text-muted-foreground mt-1">Connected</p>
                          </CardContent>
                        </Card>
                        <Card className="border-blue-200 bg-blue-50/30">
                          <CardContent className="p-6 text-center">
                            <p className="text-3xl font-bold text-blue-600">{userStats.callStats.connectRate}%</p>
                            <p className="text-sm text-muted-foreground mt-1">Connect Rate</p>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="deals" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="border-purple-200 bg-purple-50/30">
                          <CardContent className="p-6 text-center">
                            <p className="text-3xl font-bold text-purple-600">{userStats.dealStats.total}</p>
                            <p className="text-sm text-muted-foreground mt-1">Total Deals</p>
                          </CardContent>
                        </Card>
                        <Card className="border-green-200 bg-green-50/30">
                          <CardContent className="p-6 text-center">
                            <p className="text-3xl font-bold text-green-600">{userStats.dealStats.closed}</p>
                            <p className="text-sm text-muted-foreground mt-1">Closed</p>
                          </CardContent>
                        </Card>
                        <Card className="border-blue-200 bg-blue-50/30">
                          <CardContent className="p-6 text-center">
                            <p className="text-3xl font-bold text-blue-600">{userStats.dealStats.winRate}%</p>
                            <p className="text-sm text-muted-foreground mt-1">Win Rate</p>
                          </CardContent>
                        </Card>
                        <Card className="border-indigo-200 bg-indigo-50/30">
                          <CardContent className="p-6 text-center">
                            <p className="text-2xl font-bold text-indigo-600">{formatCurrency(userStats.dealStats.totalRevenue)}</p>
                            <p className="text-sm text-muted-foreground mt-1">Revenue</p>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>
                  </Tabs>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Unable to load statistics</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}





























