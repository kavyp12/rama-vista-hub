import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Search, Phone, Mail, Calendar, Filter, Flame, Thermometer, Snowflake } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [temperatureFilter, setTemperatureFilter] = useState<string>('all');
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
    fetchLeads();
  }, [stageFilter, temperatureFilter]);

  async function fetchLeads() {
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
      assigned_to: user?.id,
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
      fetchLeads();
    }
  };

  const getTemperatureIcon = (temp: string) => {
    switch (temp) {
      case 'hot':
        return <Flame className="h-4 w-4 text-red-500" />;
      case 'warm':
        return <Thermometer className="h-4 w-4 text-amber-500" />;
      case 'cold':
        return <Snowflake className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getStageBadge = (stage: string) => {
    const stageConfig: Record<string, string> = {
      new: 'stage-new',
      contacted: 'stage-contacted',
      site_visit: 'stage-site-visit',
      negotiation: 'stage-negotiation',
      token: 'stage-token',
      closed: 'stage-closed',
    };
    const stageLabels: Record<string, string> = {
      new: 'New',
      contacted: 'Contacted',
      site_visit: 'Site Visit',
      negotiation: 'Negotiation',
      token: 'Token',
      closed: 'Closed',
    };
    return (
      <Badge variant="outline" className={stageConfig[stage]}>
        {stageLabels[stage] || stage}
      </Badge>
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredLeads = leads.filter((lead) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      lead.name.toLowerCase().includes(searchLower) ||
      lead.phone.includes(searchQuery) ||
      (lead.email && lead.email.toLowerCase().includes(searchLower))
    );
  });

  return (
    <DashboardLayout title="Leads" description="Manage and track your leads">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex flex-1 gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[140px]">
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
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Temperature" />
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
              <Card key={lead.id} className="hover-lift cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {getInitials(lead.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{lead.name}</h3>
                        {getTemperatureIcon(lead.temperature)}
                        {getStageBadge(lead.stage)}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {lead.phone}
                        </span>
                        {lead.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {lead.email}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <div className="hidden sm:block text-right">
                      <Badge variant="outline">{lead.source}</Badge>
                      {lead.preferred_location && (
                        <p className="text-xs text-muted-foreground mt-1">{lead.preferred_location}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// Add Users icon import
import { Users } from 'lucide-react';
