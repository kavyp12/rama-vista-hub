import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/lib/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { LeadCard } from '@/components/leads/LeadCard'; 
import { EditLeadDialog } from '@/components/leads/EditLeadDialog'; // ✅ IMPORT THIS
import { Plus, Search, Users, RefreshCw, MapPin } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const UNITS = {
  'L': 100000,
  'Cr': 10000000,
  'K': 1000
};

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  source: string;
  stage: string;
  temperature: string;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredLocation: string | null;
  notes: string | null;
  assignedToId: string | null;
  createdAt: string;
  nextFollowupAt: string | null;
  assignedTo?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  siteVisits?: {
    id: string;
    scheduledAt: string;
    status: string;
    property?: { title: string; location: string } | null;
    project?: { name: string; location: string } | null;
  }[];
}

interface Agent {
  id: string;
  fullName: string;
  email: string;
}

export default function Leads() {
  const { user, token } = useAuth();
  const { canAssignLeads } = usePermissions();
  const { toast } = useToast();
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add Lead Dialog State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  // Edit Lead Dialog State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [budgetUnit, setBudgetUnit] = useState<'L' | 'Cr' | 'K'>('L');

  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', source: 'Website',
    temperature: 'warm', budgetMin: '', budgetMax: '',
    preferredLocation: '', notes: '', assignedToId: ''
  });

  useEffect(() => {
    if (token) {
      fetchData();
      if (canAssignLeads) fetchAgents();
    }
  }, [token, canAssignLeads]); 

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/leads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setLeads(data);
    } catch (error) {
      console.error("Error fetching leads:", error);
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
async function handleCreateLead(e: React.FormEvent) {
    e.preventDefault();
    try {
      const multiplier = UNITS[budgetUnit];
      
      // LOGIC CHANGE: 
      // explicitly check if an agent was selected. 
      // If yes, use that ID. If no, default to user.id (or null if you prefer unassigned).
      const finalAssignedId = formData.assignedToId && formData.assignedToId.trim() !== '' 
        ? formData.assignedToId 
        : user?.id; // Or set to null if you want it unassigned by default

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
        assignedToId: finalAssignedId // Use the calculated ID
      };

      console.log("Sending Payload:", payload); // Debugging: Check console to see what is sent

      const res = await fetch(`${API_URL}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to create lead');

      toast({ title: 'Success', description: 'Lead created successfully' });
      setIsAddDialogOpen(false);
      
      // Reset form correctly
      setFormData({
        name: '', phone: '', email: '', source: 'Website',
        temperature: 'warm', budgetMin: '', budgetMax: '',
        preferredLocation: '', notes: '', assignedToId: '' 
      });
      fetchData();
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to create lead', variant: 'destructive' });
    }
  }

  // ✅ HANDLER FOR EDITING
  const handleEditClick = (lead: Lead) => {
    setLeadToEdit(lead);
    setIsEditDialogOpen(true);
  };

  const filteredLeads = leads.filter(lead =>
    lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.phone.includes(searchQuery) ||
    (lead.email && lead.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <DashboardLayout title="Leads" description="Manage and track your potential customers">
      <div className="space-y-6 h-full flex flex-col">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between shrink-0">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search leads..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={handleSync} disabled={isSyncing} className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50">
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} /> Sync
            </Button>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" /> Add Lead</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Lead</DialogTitle>
                  <DialogDescription>Enter the details of the potential customer.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateLead} className="space-y-4 py-4">
                  {/* Name & Phone */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Full Name *</Label><Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Phone Number *</Label><Input required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                  </div>
                  {/* Email & Source */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                    <div className="space-y-2">
                      <Label>Source</Label>
                      <Select value={formData.source} onValueChange={(val) => setFormData({ ...formData, source: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['Website','Referral','Social Media','Walk-in','Other'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Budget */}
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
                  {/* Location & Notes */}
                  <div className="space-y-2">
                    <Label>Preferred Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" placeholder="e.g. Gota, Satellite" value={formData.preferredLocation} onChange={(e) => setFormData({ ...formData, preferredLocation: e.target.value })} />
                    </div>
                  </div>

                  {/* Assign To Section in Leads.tsx Dialog */}
{canAssignLeads && ( 
  <div className="space-y-2">
    <Label>Assign To</Label>
    <Select 
      value={formData.assignedToId} 
      onValueChange={(val) => {
        console.log("Selected Agent ID:", val); // Debug: Ensure this logs the Agent ID when clicked
        setFormData({ ...formData, assignedToId: val });
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select Agent (Optional)" />
      </SelectTrigger>
      <SelectContent>
        {agents.map((agent) => (
          <SelectItem key={agent.id} value={agent.id}>
            {agent.fullName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}
                  <div className="space-y-2"><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Lead</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Lead List */}
        <div className="flex-1 overflow-y-auto pb-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <Card key={i} className="animate-pulse h-48 bg-muted/20" />)}
            </div>
          ) : filteredLeads.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center justify-center py-12"><Users className="h-12 w-12 text-muted-foreground mb-4" /><h3 className="text-lg font-semibold">No leads found</h3></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredLeads.map((lead) => (
                <LeadCard 
                  key={lead.id} 
                  lead={lead} 
                  profiles={agents} 
                  onUpdate={fetchData} 
                  onEdit={handleEditClick} // ✅ PASS THE EDIT HANDLER
                />
              ))}
            </div>
          )}
        </div>

        {/* ✅ EDIT DIALOG COMPONENT */}
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