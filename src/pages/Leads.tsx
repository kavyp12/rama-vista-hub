import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { LeadCard } from '@/components/leads/LeadCard';
import { Plus, Search, Filter, Flame, Thermometer, Snowflake, Users, UserCheck, TrendingUp } from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  source: string;
  stage: string;
  temperature: string;
  budget_min: number | null;
  budget_max: number | null;
  preferred_location: string | null;
  notes: string | null;
  next_followup_at: string | null;
  created_at: string;
  assigned_to: string | null;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

const stages = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'site_visit', label: 'Site Visit' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'token', label: 'Token' },
  { value: 'closed', label: 'Closed' },
];

const temperatures = [
  { value: 'hot', label: 'Hot', icon: Flame },
  { value: 'warm', label: 'Warm', icon: Thermometer },
  { value: 'cold', label: 'Cold', icon: Snowflake },
];

const sources = ['Website', 'Referral', 'Social Media', 'Walk-in', 'Campaign', 'Other'];

export default function Leads() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [temperatureFilter, setTemperatureFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New lead form state
  const [newLead, setNewLead] = useState({
    name: '',
    email: '',
    phone: '',
    source: 'Website',
    temperature: 'warm',
    budget_min: '',
    budget_max: '',
    preferred_location: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, [stageFilter, temperatureFilter, sourceFilter, agentFilter]);

  async function fetchData() {
    setLoading(true);
    
    // Fetch profiles first
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url');
    
    if (profilesData) setProfiles(profilesData);

    // Fetch leads with filters
    let query = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (stageFilter !== 'all') {
      query = query.eq('stage', stageFilter as 'new' | 'contacted' | 'site_visit' | 'negotiation' | 'token' | 'closed');
    }
    if (temperatureFilter !== 'all') {
      query = query.eq('temperature', temperatureFilter as 'hot' | 'warm' | 'cold');
    }
    if (sourceFilter !== 'all') {
      query = query.eq('source', sourceFilter);
    }
    if (agentFilter !== 'all') {
      query = query.eq('assigned_to', agentFilter);
    }

    const { data, error } = await query;

    if (!error && data) {
      setLeads(data);
    }
    setLoading(false);
  }

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await supabase.from('leads').insert([{
      name: newLead.name,
      email: newLead.email || null,
      phone: newLead.phone,
      source: newLead.source,
      temperature: newLead.temperature as 'hot' | 'warm' | 'cold',
      budget_min: newLead.budget_min ? parseFloat(newLead.budget_min) : null,
      budget_max: newLead.budget_max ? parseFloat(newLead.budget_max) : null,
      preferred_location: newLead.preferred_location || null,
      notes: newLead.notes || null,
      assigned_to: user?.id, // Auto-assign to current user
    }]);

    setIsSubmitting(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to create lead. Please try again.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Lead Created',
        description: `${newLead.name} has been added to your leads.`,
      });
      setIsDialogOpen(false);
      setNewLead({
        name: '',
        email: '',
        phone: '',
        source: 'Website',
        temperature: 'warm',
        budget_min: '',
        budget_max: '',
        preferred_location: '',
        notes: '',
      });
      fetchData();
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      lead.name.toLowerCase().includes(searchLower) ||
      lead.phone.includes(searchQuery) ||
      (lead.email && lead.email.toLowerCase().includes(searchLower))
    );
  });

  // Quick stats
  const hotLeads = leads.filter(l => l.temperature === 'hot').length;
  const warmLeads = leads.filter(l => l.temperature === 'warm').length;
  const coldLeads = leads.filter(l => l.temperature === 'cold').length;
  const todayLeads = leads.filter(l => {
    const today = new Date().toISOString().split('T')[0];
    return l.created_at.startsWith(today);
  }).length;

  return (
    <DashboardLayout title="Leads" description="Manage and track your leads">
      <div className="space-y-6">
        {/* Quick Stats Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1 py-1 px-3 bg-red-500/10 text-red-500 border-red-500/20">
            <Flame className="h-3.5 w-3.5" />
            {hotLeads} Hot
          </Badge>
          <Badge variant="outline" className="gap-1 py-1 px-3 bg-amber-500/10 text-amber-500 border-amber-500/20">
            <Thermometer className="h-3.5 w-3.5" />
            {warmLeads} Warm
          </Badge>
          <Badge variant="outline" className="gap-1 py-1 px-3 bg-blue-500/10 text-blue-500 border-blue-500/20">
            <Snowflake className="h-3.5 w-3.5" />
            {coldLeads} Cold
          </Badge>
          <Badge variant="outline" className="gap-1 py-1 px-3 bg-success/10 text-success border-success/20">
            <TrendingUp className="h-3.5 w-3.5" />
            {todayLeads} Today
          </Badge>
        </div>

        {/* Header Actions */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          <div className="flex flex-1 flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[130px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {stages.map((stage) => (
                  <SelectItem key={stage.value} value={stage.value}>
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={temperatureFilter} onValueChange={setTemperatureFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Temp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Temps</SelectItem>
                {temperatures.map((temp) => (
                  <SelectItem key={temp.value} value={temp.value}>
                    {temp.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-[150px]">
                <UserCheck className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
                <DialogDescription>Enter the lead details to add them to your pipeline.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateLead} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={newLead.name}
                      onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      value={newLead.phone}
                      onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newLead.email}
                      onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source">Source</Label>
                    <Select value={newLead.source} onValueChange={(value) => setNewLead({ ...newLead, source: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sources.map((source) => (
                          <SelectItem key={source} value={source}>
                            {source}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temperature">Temperature</Label>
                    <Select
                      value={newLead.temperature}
                      onValueChange={(value) => setNewLead({ ...newLead, temperature: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {temperatures.map((temp) => (
                          <SelectItem key={temp.value} value={temp.value}>
                            <span className="flex items-center gap-2">
                              <temp.icon className="h-4 w-4" />
                              {temp.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget_min">Min Budget (₹)</Label>
                    <Input
                      id="budget_min"
                      type="number"
                      value={newLead.budget_min}
                      onChange={(e) => setNewLead({ ...newLead, budget_min: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget_max">Max Budget (₹)</Label>
                    <Input
                      id="budget_max"
                      type="number"
                      value={newLead.budget_max}
                      onChange={(e) => setNewLead({ ...newLead, budget_max: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="location">Preferred Location</Label>
                    <Input
                      id="location"
                      value={newLead.preferred_location}
                      onChange={(e) => setNewLead({ ...newLead, preferred_location: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={newLead.notes}
                      onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Lead'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Leads List */}
        {loading ? (
          <div className="grid gap-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 rounded bg-muted" />
                      <div className="h-3 w-1/4 rounded bg-muted" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredLeads.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No leads found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search criteria' : 'Get started by adding your first lead'}
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredLeads.map((lead) => (
              <LeadCard 
                key={lead.id} 
                lead={lead} 
                profiles={profiles}
                onUpdate={fetchData}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
