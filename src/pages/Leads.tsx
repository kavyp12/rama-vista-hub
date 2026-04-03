import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth, usePermissions } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { LeadCard } from '@/components/leads/LeadCard';
import { EditLeadDialog } from '@/components/leads/EditLeadDialog';
import { Plus, Search, Users, RefreshCw, MapPin, Filter, X, Upload, CheckSquare, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';


const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const UNITS = { 'L': 100000, 'Cr': 10000000, 'K': 1000 };

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  source: string;
  stage: string;
  temperature: string;
  isPriority: boolean;
  leadScore: number;
  lostReason?: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredLocation: string | null;
  notes: string | null;
  assignedToId: string | null;
  createdAt: string;
  nextFollowupAt: string | null;
  lastContactedAt?: string | null;
  assignedTo?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  siteVisits?: any[];
  callLogs?: any[];
}

interface Agent { id: string; fullName: string; email: string; }

export default function Leads() {
  const { user, token } = useAuth();
  const { canAssignLeads } = usePermissions();
  const { toast } = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('active_open');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [temperatureFilter, setTemperatureFilter] = useState('all');
  const [assignedAgentFilter, setAssignedAgentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // New UI State for Filter Dropdown
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [bulkAgentId, setBulkAgentId] = useState('');

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [budgetUnit, setBudgetUnit] = useState<'L' | 'Cr' | 'K'>('L');
  const [visibleCount, setVisibleCount] = useState(50);
  const observerTarget = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', source: 'Website',
    temperature: 'warm', budgetMin: '', budgetMax: '',
    preferredLocation: '', notes: '', assignedToId: ''
  });

  // Calculate active filters to show on the badge
  const activeFiltersCount = [
    stageFilter !== 'active_open',
    sourceFilter !== 'all',
    temperatureFilter !== 'all',
    assignedAgentFilter !== 'all',
    dateFilter !== 'all'
  ].filter(Boolean).length;

  useEffect(() => {
    if (token) {
      fetchData();
      if (canAssignLeads) fetchAgents();
    }
  }, [token, canAssignLeads]);

  // CACHE CONSTANTS
 // CACHE CONSTANTS
  const CACHE_KEY = 'crm_leads_data';
  const CACHE_TIME_KEY = 'crm_leads_timestamp';
  const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

  async function fetchData() {
    console.log('[Leads Manager] 🔍 Checking local cache...');
    
    // 1. INSTANT LOAD FROM CACHE
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cacheTimestamp = localStorage.getItem(CACHE_TIME_KEY);
    
    if (cachedData && cacheTimestamp) {
      const isCacheValid = (Date.now() - parseInt(cacheTimestamp)) < CACHE_DURATION_MS;
      if (isCacheValid) {
        console.log('[Leads Manager] ✅ Valid cache found! Instantly rendering leads from memory.');
        setLeads(JSON.parse(cachedData));
        setLoading(false); // Instantly remove loader
      } else {
        console.log('[Leads Manager] ⏳ Cache exists but is expired (>24 hours). Waiting for network...');
        setLoading(true);
      }
    } else {
      console.log('[Leads Manager] ❌ No cache found (First visit). Waiting for network...');
      setLoading(true); 
    }

    // 2. BACKGROUND REVALIDATION
    console.log('[Leads Manager] 🔄 Starting silent background sync with server...');
    try {
      const res = await fetch(`${API_URL}/leads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (Array.isArray(data)) {
        console.log(`[Leads Manager] 📥 Downloaded ${data.length} fresh leads from database.`);
        setLeads(data); // Silently update UI 
        
        // Save new data to cache
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
        console.log('[Leads Manager] 💾 Cache updated successfully.');
      }
    } catch (error) {
      console.error('[Leads Manager] 🚨 Background sync failed:', error);
      if (!cachedData) {
        toast({ title: 'Error', description: 'Failed to fetch leads', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  }
  
  async function fetchAgents() {
    try {
      const res = await fetch(`${API_URL}/users?role=sales_agent`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setAgents(data);
    } catch (error) { console.error("Failed to load agents"); }
  }

  async function handleSync() {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_URL}/sync/leads`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Sync Complete', description: data.message });
        fetchData();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({ title: 'Sync Failed', description: 'Could not connect.', variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').slice(1);

      const parsedLeads = rows.filter(row => row.trim() !== '').map(row => {
        const [name, phone, email, budget, source] = row.split(',');
        return {
          name: name?.trim(),
          phone: phone?.trim(),
          email: email?.trim() || undefined,
          budgetMin: budget ? parseFloat(budget) : undefined,
          source: source?.trim() || 'Imported'
        };
      });

      if (parsedLeads.length === 0) return;

      try {
        const res = await fetch(`${API_URL}/leads/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ leads: parsedLeads })
        });
        const data = await res.json();
        if (data.success) {
          toast({ title: 'Import Successful', description: `${data.count} leads added.` });
          fetchData();
        }
      } catch (err) {
        toast({ title: 'Import Failed', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedLeads);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedLeads(newSet);
  };

  const selectAll = () => {
    if (selectedLeads.size === filteredLeads.length) setSelectedLeads(new Set());
    else setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
  };

  const handleBulkAssign = async () => {
    if (!bulkAgentId) return;
    try {
      await fetch(`${API_URL}/leads/bulk-assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ leadIds: Array.from(selectedLeads), agentId: bulkAgentId })
      });
      toast({ title: 'Bulk Assign', description: 'Leads reassigned successfully.' });
      setSelectedLeads(new Set());
      setIsBulkAssignOpen(false);
      fetchData();
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  async function handleCreateLead(e: React.FormEvent) {
    e.preventDefault();
    try {
      const multiplier = UNITS[budgetUnit];
      const finalAssignedId = formData.assignedToId && formData.assignedToId.trim() !== '' ? formData.assignedToId : user?.id;

      const payload = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email || null,
        source: formData.source,
        temperature: formData.temperature,
        budgetMin: formData.budgetMin ? Number(formData.budgetMin) * multiplier : null,
        budgetMax: formData.budgetMax ? Number(formData.budgetMax) * multiplier : null,
        preferredLocation: formData.preferredLocation || null,
        notes: formData.notes || null,
        assignedToId: finalAssignedId
      };

      const res = await fetch(`${API_URL}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to create lead');

      toast({ title: 'Success', description: 'Lead created successfully' });
      setIsAddDialogOpen(false);
      setFormData({
        name: '', phone: '', email: '', source: 'Website',
        temperature: 'warm', budgetMin: '', budgetMax: '',
        preferredLocation: '', notes: '', assignedToId: ''
      });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create lead', variant: 'destructive' });
    }
  }

  const filteredLeads = leads
    .filter(lead => {
      // 👇 Hide unverified leads from the main leads dashboard
      if (lead.stage === 'unverified') return false;

      const matchesSearch = lead.name.toLowerCase().includes(searchQuery.toLowerCase()) || lead.phone.includes(searchQuery) || (lead.email && lead.email.toLowerCase().includes(searchQuery.toLowerCase()));
      
      let matchesStage = true;
      // 👇 Updated to explicitly exclude 'unverified' when viewing active_open
      if (stageFilter === 'active_open') {
        matchesStage = !['closed', 'lost', 'completed', 'unverified'].includes(lead.stage);
      } else if (stageFilter !== 'all') {
        matchesStage = lead.stage === stageFilter;
      }
      
      const matchesSource = sourceFilter === 'all' ? true : lead.source === sourceFilter;
      const matchesTemperature = temperatureFilter === 'all' ? true : lead.temperature === temperatureFilter;

      let matchesAgent = true;
      if (assignedAgentFilter === 'unassigned') matchesAgent = !lead.assignedToId;
      else if (assignedAgentFilter !== 'all') matchesAgent = lead.assignedToId === assignedAgentFilter;

      let matchesDate = true;
      if (dateFilter !== 'all') {
        const leadDate = new Date(lead.createdAt);
        const now = new Date();
        if (dateFilter === 'today') {
          matchesDate = leadDate.toDateString() === now.toDateString();
        } else if (dateFilter === 'yesterday') {
          const yesterday = new Date();
          yesterday.setDate(now.getDate() - 1);
          matchesDate = leadDate.toDateString() === yesterday.toDateString();
        } else if (dateFilter === 'last_7_days') {
          const msInWeek = 7 * 24 * 60 * 60 * 1000;
          matchesDate = (now.getTime() - leadDate.getTime()) <= msInWeek;
        } else if (dateFilter === 'last_30_days') {
          const msIn30Days = 30 * 24 * 60 * 60 * 1000;
          matchesDate = (now.getTime() - leadDate.getTime()) <= msIn30Days;
        } else if (dateFilter === 'this_month') {
          matchesDate = leadDate.getMonth() === now.getMonth() && leadDate.getFullYear() === now.getFullYear();
        } else if (dateFilter === 'custom') {
          if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            matchesDate = matchesDate && leadDate >= start;
          }
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            matchesDate = matchesDate && leadDate <= end;
          }
        }
      }

      return matchesSearch && matchesStage && matchesSource && matchesTemperature && matchesAgent && matchesDate;
    })
    .sort((a, b) => {
      if (a.isPriority && !b.isPriority) return -1;
      if (!a.isPriority && b.isPriority) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // 1. Reset visible count back to 50 whenever you type a search or change a filter
  useEffect(() => {
    setVisibleCount(50);
  }, [searchQuery, stageFilter, sourceFilter, temperatureFilter, assignedAgentFilter, dateFilter, startDate, endDate]);

  // 2. Intersection Observer to load 50 more when scrolling to the bottom
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && visibleCount < filteredLeads.length) {
          setVisibleCount(prev => prev + 50);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [visibleCount, filteredLeads.length]);


  return (
    <DashboardLayout title="Leads" description={canAssignLeads ? "Manage and track your potential customers" : "My Assigned Leads & Action Items"}>
      <div className="space-y-4 h-full flex flex-col relative">

        <div className="flex flex-col gap-4 shrink-0 bg-white p-4 rounded-lg border border-slate-200 shadow-sm relative z-20">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            
            {/* Left Side: Search & Filter Trigger */}
            <div className="flex flex-1 items-center gap-2 w-full">
              <div className="relative flex-1 sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search leads..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>

              <div className="relative">
                <Button 
                  variant={activeFiltersCount > 0 ? "secondary" : "outline"} 
                  onClick={() => setIsFilterOpen(!isFilterOpen)} 
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">Filters</span>
                  {activeFiltersCount > 0 && (
                    <Badge variant="default" className="ml-1 px-1.5 h-5 rounded-full text-xs">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>

                {/* The Consolidated Filter Box */}
                {isFilterOpen && (
                  <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-[320px] bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-50 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
                    
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-semibold text-sm">Filter Leads</h4>
                      {activeFiltersCount > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setStageFilter('active_open');
                            setSourceFilter('all');
                            setDateFilter('all');
                            setTemperatureFilter('all');
                            setAssignedAgentFilter('all');
                            setStartDate('');
                            setEndDate('');
                          }} 
                          className="h-8 px-2 text-xs text-muted-foreground hover:text-red-600"
                        >
                          <X className="h-3 w-3 mr-1" /> Clear All
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <Select value={stageFilter} onValueChange={setStageFilter}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active_open">Active (Open)</SelectItem>
                            <SelectItem value="all">All Leads</SelectItem>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="site_visit">Site Visit</SelectItem>
                            <SelectItem value="negotiation">Negotiation</SelectItem>
                            <SelectItem value="token">Token</SelectItem>
                            <SelectItem value="closed" className="text-red-600">Closed</SelectItem>
                            <SelectItem value="lost" className="text-slate-500">Lost</SelectItem>
                            <SelectItem value="completed" className="text-green-600">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Source</Label>
                          <Select value={sourceFilter} onValueChange={setSourceFilter}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Sources</SelectItem>
                              <SelectItem value="Website">Website</SelectItem>
                              <SelectItem value="Referral">Referral</SelectItem>
                              <SelectItem value="Social Media">Social Media</SelectItem>
                              <SelectItem value="Walk-in">Walk-in</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Temperature</Label>
                          <Select value={temperatureFilter} onValueChange={setTemperatureFilter}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Temps</SelectItem>
                              <SelectItem value="hot">Hot</SelectItem>
                              <SelectItem value="warm">Warm</SelectItem>
                              <SelectItem value="cold">Cold</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {canAssignLeads && (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Assigned Agent</Label>
                          <Select value={assignedAgentFilter} onValueChange={setAssignedAgentFilter}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Agents</SelectItem>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Date Created</Label>
                        <Select value={dateFilter} onValueChange={setDateFilter}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Time</SelectItem>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="yesterday">Yesterday</SelectItem>
                            <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                            <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                            <SelectItem value="this_month">This Month</SelectItem>
                            <SelectItem value="custom">Custom Range</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {dateFilter === 'custom' && (
                        <div className="flex items-center gap-2 pt-1">
                          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-xs" />
                          <span className="text-xs text-muted-foreground">to</span>
                          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-xs" />
                        </div>
                      )}

                      <div className="pt-2">
                        <Button className="w-full" onClick={() => setIsFilterOpen(false)}>Apply Filters</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side Actions: Sync, Import, Add Lead */}
            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 shrink-0">
              <Button variant="outline" onClick={handleSync} disabled={isSyncing} className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 hidden xl:flex">
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} /> Sync
              </Button>

              {canAssignLeads && (
                <>
                  <Button variant="outline" className="gap-2 shrink-0" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Import CSV</span>
                  </Button>
                  <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                </>
              )}

              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild><Button className="gap-2 shrink-0"><Plus className="h-4 w-4" /> Add Lead</Button></DialogTrigger>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Lead</DialogTitle>
                    <DialogDescription>Enter the details of the potential customer.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateLead} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Full Name *</Label><Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Phone Number *</Label><Input required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                      <div className="space-y-2">
                        <Label>Source</Label>
                        <Select value={formData.source} onValueChange={(val) => setFormData({ ...formData, source: val })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['Website', 'Referral', 'Social Media', 'Walk-in', 'Other'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Budget Range</Label>
                      <div className="flex gap-2">
                        <Input type="number" placeholder="Min" value={formData.budgetMin} onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value })} />
                        <Input type="number" placeholder="Max" value={formData.budgetMax} onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value })} />
                        <Select value={budgetUnit} onValueChange={(val: any) => setBudgetUnit(val)}>
                          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="L">Lakhs</SelectItem>
                            <SelectItem value="Cr">Crores</SelectItem>
                            <SelectItem value="K">Thousands</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Preferred Location</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-9" placeholder="e.g. Gota, Satellite" value={formData.preferredLocation} onChange={(e) => setFormData({ ...formData, preferredLocation: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Assign To</Label>
                      <Select value={formData.assignedToId} onValueChange={(val) => setFormData({ ...formData, assignedToId: val })}>
                        <SelectTrigger><SelectValue placeholder="Select Agent (Optional)" /></SelectTrigger>
                        <SelectContent>
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>{agent.fullName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Notes & Requirements</Label><Textarea placeholder="What does the agent need to know?" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                      <Button type="submit">Create Lead</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Clean row for Select All (Only shows for admins who can assign leads) */}
          {canAssignLeads && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={selectAll} className="gap-2 text-muted-foreground hover:text-slate-900 -ml-2">
                <CheckSquare className={`h-4 w-4 ${selectedLeads.size > 0 ? 'text-blue-600' : 'text-slate-400'}`} />
                {selectedLeads.size === filteredLeads.length && filteredLeads.length > 0 ? 'Deselect All' : 'Select All Visible'}
              </Button>
              {selectedLeads.size > 0 && (
                <span className="text-xs text-muted-foreground font-medium">{selectedLeads.size} selected</span>
              )}
            </div>
          )}
        </div>

        {/* Bulk Assign Floating Action Bar */}
        {selectedLeads.size > 0 && canAssignLeads && (
          <div className="bg-blue-600 text-white p-3 rounded-lg flex items-center justify-between shadow-lg animate-in slide-in-from-bottom-2 z-10 sticky top-2">
            <span className="font-semibold text-sm ml-2">{selectedLeads.size} leads selected for reassignment</span>
            <div className="flex gap-2">
              <Dialog open={isBulkAssignOpen} onOpenChange={setIsBulkAssignOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary" className="gap-2"><UserCheck className="h-4 w-4" /> Assign Agent</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Bulk Assign</DialogTitle></DialogHeader>
                  <Select value={bulkAgentId} onValueChange={setBulkAgentId}>
                    <SelectTrigger><SelectValue placeholder="Select Agent" /></SelectTrigger>
                    <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button onClick={handleBulkAssign} className="w-full mt-4">Confirm Assignment</Button>
                </DialogContent>
              </Dialog>
              <Button size="sm" variant="ghost" className="text-white hover:bg-blue-700" onClick={() => setSelectedLeads(new Set())}><X className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

      <div className="flex-1 overflow-y-auto pb-6 relative">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <Card key={i} className="animate-pulse h-48 bg-muted/20" />)}
            </div>
          ) : filteredLeads.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700">No leads found</h3>
                <p className="text-sm text-muted-foreground mb-4">You do not have any leads matching these filters.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* CRITICAL: We slice the array here so we only render 50 at a time */}
                {filteredLeads.slice(0, visibleCount).map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    profiles={agents}
                    onUpdate={fetchData} // This will trigger the silent background sync
                    onEdit={(l) => { setLeadToEdit(l); setIsEditDialogOpen(true); }}
                    selected={selectedLeads.has(lead.id)}
                    onSelect={canAssignLeads ? () => toggleSelect(lead.id) : undefined}
                  />
                ))}
              </div>
              
              {/* Invisible div that triggers the "Load More" when scrolled into view */}
              <div ref={observerTarget} className="h-10 w-full mt-4 flex items-center justify-center">
                {visibleCount < filteredLeads.length && (
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
              </div>
            </>
          )}
        </div>

        <EditLeadDialog
          lead={leadToEdit}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={fetchData}
        />
      </div>
    </DashboardLayout>
  );
}