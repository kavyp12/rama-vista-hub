import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PropertyCard } from '@/components/Properties/PropertyCard';
import { 
  Plus, Search, RefreshCw, Home, Briefcase, LandPlot, Filter, 
  ChevronDown, ChevronRight, MapPin
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Property {
  id: string;
  title: string;
  propertyType: string;
  location: string;
  city: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  price: number;
  status: string;
  description: string | null;
  features: string[] | null;
  project?: {
    id: string;
    name: string;
    location: string;
    city: string;
  };
}

const propertyTypes = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'villa', label: 'Villa' },
  { value: 'plot', label: 'Plot / Land' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'penthouse', label: 'Penthouse' },
];

export default function Properties() {
  const { token } = useAuth();
  const { canCreateProjects } = usePermissions();

  const { toast } = useToast();
  
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Added 'land' to the activeTab state type
  const [activeTab, setActiveTab] = useState<'all' | 'residential' | 'commercial' | 'land'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  
  const [formData, setFormData] = useState({
    title: '', propertyType: 'apartment', location: '', city: '',
    price: '', bedrooms: '', bathrooms: '', areaSqft: '',
    description: '', status: 'available'
  });

  useEffect(() => {
    if (token) fetchProperties();
  }, [token]);

  async function fetchProperties() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/properties`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setProperties(data);
        if (data.length > 0) {
           const firstProjId = data[0].project?.id || 'independent';
           setExpandedProjects(new Set([firstProjId]));
        }
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to load properties', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const handleSync = async () => {
    if (!token) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_URL}/sync/properties`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Sync Successful", description: data.message, className: "bg-green-50 border-green-200 text-green-800" });
        fetchProperties(); 
      } else {
        throw new Error(data.error || "Sync failed");
      }
    } catch (error: any) {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  async function handleCreateProperty(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        price: Number(formData.price),
        bedrooms: formData.bedrooms ? Number(formData.bedrooms) : null,
        bathrooms: formData.bathrooms ? Number(formData.bathrooms) : null,
        areaSqft: formData.areaSqft ? Number(formData.areaSqft) : null,
        features: [] 
      };

      const res = await fetch(`${API_URL}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to create property');
      toast({ title: 'Success', description: 'Property created successfully' });
      setIsDialogOpen(false);
      fetchProperties();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create property', variant: 'destructive' });
    }
  }

  // --- Grouping Logic ---
  const filteredProperties = properties.filter(p => {
    const t = p.propertyType.toLowerCase();
    let category = 'residential';
    
    // Logic to detect Land category
    if (t.includes('plot') || t.includes('land')) category = 'land';
    else if (t.includes('commercial') || t.includes('office')) category = 'commercial';
    
    const matchesTab = activeTab === 'all' || category === activeTab;
    const matchesSearch = 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.project?.name || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTab && matchesSearch;
  });

  const groupedByProject = filteredProperties.reduce((acc, property) => {
    const projectId = property.project?.id || 'independent';
    if (!acc[projectId]) {
      acc[projectId] = {
        project: property.project || { id: 'independent', name: 'Independent Properties', location: '-', city: '' },
        properties: []
      };
    }
    acc[projectId].properties.push(property);
    return acc;
  }, {} as Record<string, { project: any; properties: Property[] }>);

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) newExpanded.delete(projectId);
    else newExpanded.add(projectId);
    setExpandedProjects(newExpanded);
  };

  return (
    <DashboardLayout title="Inventory" description="Manage properties and listings">
      <div className="space-y-6 flex flex-col h-full">
        
        {/* Controls */}
        <div className="flex flex-col gap-4 shrink-0">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search projects or properties..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            
            <div className="flex gap-2">
              {canCreateProjects && (
                <Button 
                  variant="outline" 
                  onClick={handleSync} 
                  disabled={isSyncing} 
                  className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing' : 'Sync'}
                </Button>
              )}
              {canCreateProjects && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" /> Add Property
                    </Button>
                  </DialogTrigger>

                <DialogContent className="sm:max-w-[600px]"><DialogHeader><DialogTitle>Add Property</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateProperty} className="space-y-4 py-4">
                     <div className="space-y-2"><Label>Title</Label><Input required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} /></div>
                     <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2"><Label>Price</Label><Input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} /></div>
                       <div className="space-y-2"><Label>Type</Label>
                          <Select value={formData.propertyType} onValueChange={(v) => setFormData({...formData, propertyType: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{propertyTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                          </Select>
                       </div>
                     </div>
                     <Button type="submit" className="w-full">Create</Button>
                  </form>
                </DialogContent>
              </Dialog>
              )}
            </div>
          </div>

          <div className="flex space-x-1 border-b">
            {/* ADDED 'Land' TAB HERE */}
            {[ 
              { id: 'all', label: 'All', icon: Filter }, 
              { id: 'residential', label: 'Residential', icon: Home }, 
              { id: 'commercial', label: 'Commercial', icon: Briefcase },
              { id: 'land', label: 'Land', icon: LandPlot }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  <Icon className="h-4 w-4" /> {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* --- TOGGLE LIST VIEW --- */}
        <div className="flex-1 overflow-y-auto pb-8 space-y-2">
          {loading ? (
             <div className="space-y-2">
               {[1,2,3,4].map(i => <div key={i} className="h-12 w-full bg-slate-100 animate-pulse rounded" />)}
             </div>
          ) : Object.values(groupedByProject).length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No properties found.</CardContent></Card>
          ) : (
            Object.values(groupedByProject).map((group) => {
              const isExpanded = expandedProjects.has(group.project.id);
              const isIndependent = group.project.id === 'independent';

              return (
                <div key={group.project.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  
                  {/* THE TOGGLE HEADER */}
                  <div 
                    onClick={() => toggleProject(group.project.id)}
                    className={`
                      flex items-center justify-between p-3 cursor-pointer transition-colors select-none
                      ${isExpanded ? 'bg-slate-50 border-b border-slate-200' : 'hover:bg-slate-50'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-md ${isExpanded ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                      
                      <div className="flex flex-col">
                         <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-800">
                                {group.project.name}
                            </h3>
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 rounded-full">
                               {group.properties.length} Units
                            </Badge>
                         </div>
                         {!isIndependent && (
                           <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {group.project.location}, {group.project.city}
                           </span>
                         )}
                      </div>
                    </div>

                    <div className="flex -space-x-1 mr-2">
                       {group.properties.slice(0,3).map((p, i) => (
                          <div key={i} className={`h-2 w-2 rounded-full ring-2 ring-white ${p.status === 'available' ? 'bg-green-500' : 'bg-slate-300'}`} />
                       ))}
                       {group.properties.length > 3 && <div className="h-2 w-2 rounded-full ring-2 ring-white bg-slate-200" />}
                    </div>
                  </div>

                  {/* THE INNER GRID */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-50/50 inner-shadow">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {group.properties.map((property) => (
                          <PropertyCard key={property.id} property={property} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}