import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Lead {
  id: string;
  name: string;
}

interface ScheduleVisitDialogProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Helper: Custom Searchable Select
function SearchableSelect({ options, value, onChange, placeholder = "Select...", disabled = false }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt:any) => 
    (opt.label || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const selectedLabel = options.find((opt:any) => opt.value === value)?.label;

  return (
    <div className="relative" ref={wrapperRef}>
      <div
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={selectedLabel ? "" : "text-muted-foreground"}>{selectedLabel || placeholder}</span>
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 bg-white max-h-[300px] flex flex-col">
          <div className="flex items-center border-b px-3 py-2 bg-white sticky top-0 z-10">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Type to search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto p-1 max-h-[200px]">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No options found.</div>
            ) : (
              filteredOptions.map((option:any) => (
                <div
                  key={option.value}
                  className={cn(
                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 cursor-pointer",
                    value === option.value && "bg-slate-100 font-medium"
                  )}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ScheduleVisitDialog({ lead, open, onOpenChange, onSuccess }: ScheduleVisitDialogProps) {
  const { user, token } = useAuth();
  const { toast } = useToast();
  
  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([]);
  const [agents, setAgents] = useState<{ value: string; label: string }[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedProperty, setSelectedProperty] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [visitTime, setVisitTime] = useState('');
  const [notes, setNotes] = useState('');

  const [propertyOptions, setPropertyOptions] = useState<{ value: string; label: string }[]>([]);

  // Check if current user can assign to others
  const canAssignToOthers = user?.role === 'admin' || user?.role === 'sales_manager';

  useEffect(() => {
    if (open && token) {
      fetchData();
      // Set current user as default agent
      if (user?.id) {
        setSelectedAgent(user.id);
      }
    }
  }, [open, token, user]);

  const formatPropertyLabel = (p: any) => {
    const parts = [];
    if (p.bedrooms) parts.push(`${p.bedrooms} BHK`);
    if (p.propertyType) parts.push(p.propertyType.charAt(0).toUpperCase() + p.propertyType.slice(1));
    else parts.push(p.title);

    if (p.areaSqft) parts.push(`(${p.areaSqft} sqft)`);
    if (parts.length === 0) return p.title || "Untitled Unit";
    
    return parts.join(' ');
  };

  useEffect(() => {
    let filtered = allProperties;
    if (selectedProject) {
      filtered = allProperties.filter(p => p.projectId === selectedProject);
    }

    const formatted = filtered.map(p => ({
      value: p.id,
      label: formatPropertyLabel(p)
    }));

    setPropertyOptions(formatted);

    if (selectedProperty) {
      const prop = allProperties.find(p => p.id === selectedProperty);
      if (prop && selectedProject && prop.projectId !== selectedProject) {
        setSelectedProperty('');
      }
    }
  }, [selectedProject, allProperties]);

  async function fetchData() {
    setLoading(true);
    try {
      const requests = [
        fetch(`${API_URL}/properties`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/projects?status=active`, { headers: { 'Authorization': `Bearer ${token}` } })
      ];

      // Only fetch agents if user can assign to others
      if (canAssignToOthers) {
        requests.push(
          fetch(`${API_URL}/users?role=sales_agent`, { headers: { 'Authorization': `Bearer ${token}` } })
        );
      }

      const responses = await Promise.all(requests);
      const [propsData, projsData, agentsData] = await Promise.all(
        responses.map(r => r.json())
      );

      if (Array.isArray(propsData)) setAllProperties(propsData);
      
      if (Array.isArray(projsData)) {
        setProjects(projsData.map((p: any) => ({ 
          value: p.id, 
          label: p.name 
        })));
      }

      if (canAssignToOthers && Array.isArray(agentsData)) {
        setAgents(agentsData.map((agent: any) => ({
          value: agent.id,
          label: agent.fullName
        })));
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }
async function handleSubmit() {
    if (!visitDate || !visitTime || !selectedAgent || !user) return;
    
    setSubmitting(true);
    try {
      const scheduledAt = new Date(`${visitDate}T${visitTime}`).toISOString();

      // 1. Create the Site Visit
      const visitRes = await fetch(`${API_URL}/site-visits`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          leadId: lead.id,
          propertyId: selectedProperty || null,
          projectId: selectedProject || null,
          scheduledAt: scheduledAt,
          conductedBy: selectedAgent, // This records who does the visit
          status: 'scheduled',
          feedback: notes || null,
        })
      });

      if (!visitRes.ok) {
        const error = await visitRes.json();
        throw new Error(error.error || 'Failed to schedule visit');
      }

      // ✅ 2. FIX: Also Update the Lead Assignment
      // We explicitly update the lead to be assigned to the selected agent
      const leadRes = await fetch(`${API_URL}/leads/${lead.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ assignedToId: selectedAgent })
      });

      if (!leadRes.ok) {
        console.warn("Site visit created, but failed to assign lead.");
      }

      const agentName = agents.find(a => a.value === selectedAgent)?.label || 'agent';
      toast({ 
        title: 'Success', 
        description: `Site visit scheduled and lead assigned to ${agentName}` 
      });
      
      resetForm();
      onOpenChange(false);
      onSuccess(); // This triggers the parent to refresh the list
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to schedule visit', 
        variant: 'destructive' 
      });
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSelectedProperty('');
    setSelectedProject('');
    setSelectedAgent(user?.id || '');
    setVisitDate('');
    setVisitTime('');
    setNotes('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-visible">
        <DialogHeader>
          <DialogTitle>Schedule Site Visit - {lead.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input 
                type="date" 
                value={visitDate} 
                onChange={(e) => setVisitDate(e.target.value)} 
                min={new Date().toISOString().split('T')[0]} 
              />
            </div>
            <div className="space-y-2">
              <Label>Time *</Label>
              <Input 
                type="time" 
                value={visitTime} 
                onChange={(e) => setVisitTime(e.target.value)} 
              />
            </div>
          </div>

          {/* Agent Assignment Field */}
          <div className="space-y-2">
            <Label>Assign To *</Label>
            {canAssignToOthers ? (
              <SearchableSelect 
                options={agents} 
                value={selectedAgent} 
                onChange={setSelectedAgent} 
                placeholder="Select agent..." 
                disabled={loading}
              />
            ) : (
              <Input 
                value={user?.fullName || 'You'} 
                disabled 
                className="bg-muted"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Project (Search among {projects.length})</Label>
            <SearchableSelect 
              options={projects} 
              value={selectedProject} 
              onChange={setSelectedProject} 
              placeholder="Type to search projects..." 
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Property ({propertyOptions.length} available)</Label>
            <SearchableSelect 
              options={propertyOptions} 
              value={selectedProperty} 
              onChange={setSelectedProperty} 
              placeholder={selectedProject ? "Select a unit..." : "Select project first (recommended)"} 
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea 
              placeholder="Instructions..." 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              rows={3} 
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!visitDate || !visitTime || !selectedAgent || submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Schedule Visit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}