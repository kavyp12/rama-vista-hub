import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/lib/auth-context';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, Search, MapPin, Building, Filter, Eye, 
  Waves, Dumbbell, Car, Trees, Shield, ArrowUp, Zap, 
  RefreshCw, LandPlot, Building2, Warehouse, Trash2 
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// --- INTERFACES ---
interface Project {
  id: string;
  name: string;
  category: 'residential' | 'commercial' | 'land';
  location: string;
  city: string | null;
  state: string | null;
  status: string;
  description: string | null;
  amenities: string[] | null;
  imageUrls: string[] | null;
  priceDisplay: string | null;
  
  // Residential/Commercial Common
  developer: string | null;
  totalUnits: number | null;
  availableUnits: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  
  // Land Specific
  village: string | null;
  taluka: string | null;
  district: string | null;
  plotArea: number | null;
  surveyNumber: string | null;

  // Commercial Specific
  propertyType: string | null;
  transactionType: string | null;

  propertyCount?: number;
}

const projectStatuses = [
  { value: 'active', label: 'Active' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
];

// --- HELPER FUNCTIONS ---
const formatPrice = (price: number | null | undefined): string => {
  if (!price || price === 0) return 'On Request';
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
  return `₹${price.toLocaleString('en-IN')}`;
};

const formatProjectPrice = (project: Project): string => {
  if (project.priceDisplay && 
      project.priceDisplay.trim() !== '' && 
      project.priceDisplay !== 'Price on Request' &&
      project.priceDisplay !== 'On Request') {
    return project.priceDisplay;
  }

  if (project.category === 'residential') {
    if (project.minPrice && project.maxPrice && project.minPrice !== project.maxPrice) {
      return `${formatPrice(project.minPrice)} - ${formatPrice(project.maxPrice)}`;
    } else if (project.minPrice) {
      return formatPrice(project.minPrice);
    }
  } else {
    if (project.minPrice && project.minPrice > 0) {
      return formatPrice(project.minPrice);
    }
  }

  return 'On Request';
};

export default function Projects() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
    const { canCreateProjects, canDeleteRecords } = usePermissions(); // ✅ ADD THIS

  const { toast } = useToast();
  
  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Form State
  const [newProject, setNewProject] = useState({
    category: 'residential',
    name: '',
    location: '',
    city: '',
    state: '',
    developer: '',
    status: 'active',
    // Res/Comm
    totalUnits: '',
    availableUnits: '',
    minPrice: '',
    maxPrice: '',
    // Land
    village: '',
    taluka: '',
    district: '',
    plotArea: '',
    surveyNumber: '',
    // Commercial
    propertyType: '',
    transactionType: '',
    
    description: '',
    amenities: [] as string[],
  });

  useEffect(() => {
    if (token) fetchProjects();
  }, [token, statusFilter]);

  async function fetchProjects() {
    setLoading(true);
    try {
      let url = `${API_URL}/projects`;
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const res = await fetch(`${url}?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (Array.isArray(data)) {
        const mappedProjects = data.map((p: any) => ({
          ...p,
          propertyCount: p._count?.properties || 0
        }));
        setProjects(mappedProjects);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast({ title: 'Error', description: 'Failed to load projects', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  // Inside the Projects component:
const handleImport = async () => {
    setIsImporting(true);
    try {
      // UPDATED ENDPOINT: /sync/projects
      const res = await fetch(`${API_URL}/sync/projects`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: "Sync Successful",
          description: data.message,
          className: "bg-green-50 border-green-200 text-green-800"
        });
        fetchProjects(); 
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: "Could not fetch projects. Check Site Backend connection.",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!window.confirm("Are you sure you want to delete this project? This cannot be undone.")) return;

    try {
      const res = await fetch(`${API_URL}/projects/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      toast({ title: "Deleted", description: "Project removed successfully." });
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const basePayload = {
        category: newProject.category,
        name: newProject.name,
        location: newProject.location || newProject.village || 'Unknown',
        city: newProject.city || newProject.district || null,
        state: newProject.state || null,
        status: newProject.status,
        description: newProject.description || null,
        amenities: newProject.amenities.length > 0 ? newProject.amenities : [],
        minPrice: newProject.minPrice ? parseFloat(newProject.minPrice) : null,
        maxPrice: newProject.maxPrice ? parseFloat(newProject.maxPrice) : null,
      };

      let categoryPayload = {};

      if (newProject.category === 'land') {
        categoryPayload = {
          village: newProject.village || null,
          taluka: newProject.taluka || null,
          district: newProject.district || null,
          plotArea: newProject.plotArea ? parseFloat(newProject.plotArea) : null,
          surveyNumber: newProject.surveyNumber || null,
        };
      } else {
        categoryPayload = {
          developer: newProject.developer || null,
          totalUnits: newProject.totalUnits ? parseInt(newProject.totalUnits) : null,
          availableUnits: newProject.availableUnits ? parseInt(newProject.availableUnits) : null,
          propertyType: newProject.propertyType || null,
          transactionType: newProject.transactionType || null,
        };
      }

      const payload = { ...basePayload, ...categoryPayload };

      const res = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create project');
      }

      toast({ title: 'Project Created', description: `${newProject.name} has been added.` });
      setIsDialogOpen(false);
      fetchProjects();
      
      setNewProject({
        category: 'residential', name: '', location: '', city: '', state: '', developer: '',
        status: 'active', totalUnits: '', availableUnits: '', minPrice: '', maxPrice: '',
        village: '', taluka: '', district: '', plotArea: '', surveyNumber: '',
        propertyType: '', transactionType: '', description: '', amenities: [],
      });

    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: any = {
      'active': 'bg-green-100 text-green-700 hover:bg-green-200',
      'upcoming': 'bg-blue-100 text-blue-700 hover:bg-blue-200',
      'completed': 'bg-slate-100 text-slate-700 hover:bg-slate-200',
      'on_hold': 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
    };
    return <Badge className={`${styles[status] || styles['active']} border-0`}>{status || 'Active'}</Badge>;
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'land': return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50"><LandPlot className="w-3 h-3 mr-1" /> Land</Badge>;
      case 'commercial': return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50"><Building2 className="w-3 h-3 mr-1" /> Commercial</Badge>;
      default: return <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50"><Building className="w-3 h-3 mr-1" /> Residential</Badge>;
    }
  };

  const filteredProjects = projects.filter((project) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      project.name?.toLowerCase().includes(searchLower) ||
      project.location?.toLowerCase().includes(searchLower) ||
      project.city?.toLowerCase().includes(searchLower) ||
      project.village?.toLowerCase().includes(searchLower);
    
    const matchesCategory = categoryFilter === 'all' || project.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  return (
    <DashboardLayout title="Projects" description="Manage your real estate portfolio">
      <div className="space-y-6">
        
        {/* --- HEADER CONTROLS --- */}
        <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, location, village..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {projectStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px]">
                  <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="land">Land / Plot</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 w-full xl:w-auto">
            {/* --- VISIBLE TO ALL: SYNC BUTTON --- */}
            {canCreateProjects && (
              <Button 
                variant="outline" 
                onClick={handleImport} 
                disabled={isImporting}
                className="flex-1 xl:flex-none border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isImporting ? 'animate-spin' : ''}`} />
                {isImporting ? 'Syncing...' : 'Sync from Site'}
              </Button>
            )}

            {/* --- VISIBLE TO ALL: ADD BUTTON --- */}
            {canCreateProjects && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex-1 xl:flex-none">
                    <Plus className="h-4 w-4 mr-2" /> Add Project
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Project</DialogTitle>
                  <DialogDescription>Select a category to see relevant fields.</DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleCreateProject} className="space-y-6 mt-4">
                  {/* Category Selector */}
                  <div className="grid grid-cols-3 gap-3 p-1 bg-muted rounded-lg">
                    {['residential', 'commercial', 'land'].map((cat) => (
                      <div 
                        key={cat}
                        onClick={() => setNewProject({ ...newProject, category: cat as any })}
                        className={`text-center py-2 text-sm font-medium rounded-md cursor-pointer transition-all capitalize ${
                          newProject.category === cat 
                          ? 'bg-white shadow text-primary' 
                          : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {cat}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <Label>Project Name *</Label>
                        <Input 
                            value={newProject.name} 
                            onChange={e => setNewProject({...newProject, name: e.target.value})} 
                            placeholder={newProject.category === 'land' ? "e.g. Plot at Shilaj" : "e.g. Royal Heights"}
                            required 
                        />
                    </div>

                    {/* --- LAND SPECIFIC FIELDS --- */}
                    {newProject.category === 'land' ? (
                        <>
                            <div>
                                <Label>Village *</Label>
                                <Input value={newProject.village} onChange={e => setNewProject({...newProject, village: e.target.value})} required />
                            </div>
                            <div>
                                <Label>Survey Number</Label>
                                <Input value={newProject.surveyNumber} onChange={e => setNewProject({...newProject, surveyNumber: e.target.value})} />
                            </div>
                            <div>
                                <Label>Taluka</Label>
                                <Input value={newProject.taluka} onChange={e => setNewProject({...newProject, taluka: e.target.value})} />
                            </div>
                            <div>
                                <Label>District</Label>
                                <Input value={newProject.district} onChange={e => setNewProject({...newProject, district: e.target.value})} />
                            </div>
                            <div>
                                <Label>Plot Area (Sq.Ft/Guntha)</Label>
                                <Input type="number" value={newProject.plotArea} onChange={e => setNewProject({...newProject, plotArea: e.target.value})} />
                            </div>
                        </>
                    ) : (
                    /* --- RESIDENTIAL / COMMERCIAL FIELDS --- */
                        <>
                            <div className="col-span-2">
                                <Label>Location (Area) *</Label>
                                <Input value={newProject.location} onChange={e => setNewProject({...newProject, location: e.target.value})} required />
                            </div>
                            <div>
                                <Label>City</Label>
                                <Input value={newProject.city} onChange={e => setNewProject({...newProject, city: e.target.value})} />
                            </div>
                            <div>
                                <Label>Developer / Builder</Label>
                                <Input value={newProject.developer} onChange={e => setNewProject({...newProject, developer: e.target.value})} />
                            </div>
                            
                            {newProject.category === 'commercial' && (
                                <div>
                                    <Label>Property Type</Label>
                                    <Select value={newProject.propertyType} onValueChange={v => setNewProject({...newProject, propertyType: v})}>
                                        <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Office">Office Space</SelectItem>
                                            <SelectItem value="Shop">Shop / Retail</SelectItem>
                                            <SelectItem value="Showroom">Showroom</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {newProject.category === 'residential' && (
                                <>
                                    <div>
                                        <Label>Total Units</Label>
                                        <Input type="number" value={newProject.totalUnits} onChange={e => setNewProject({...newProject, totalUnits: e.target.value})} />
                                    </div>
                                    <div>
                                        <Label>Available Units</Label>
                                        <Input type="number" value={newProject.availableUnits} onChange={e => setNewProject({...newProject, availableUnits: e.target.value})} />
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* Common Price Fields */}
                    <div>
                        <Label>Min Price (₹)</Label>
                        <Input type="number" value={newProject.minPrice} onChange={e => setNewProject({...newProject, minPrice: e.target.value})} />
                    </div>
                    {newProject.category !== 'land' && (
                        <div>
                            <Label>Max Price (₹)</Label>
                            <Input type="number" value={newProject.maxPrice} onChange={e => setNewProject({...newProject, maxPrice: e.target.value})} />
                        </div>
                    )}
                    
                    <div className="col-span-2">
                        <Label>State</Label>
                        <Input value={newProject.state} onChange={e => setNewProject({...newProject, state: e.target.value})} placeholder="e.g. Gujarat" />
                    </div>

                    <div className="col-span-2">
                        <Label>Status</Label>
                        <Select value={newProject.status} onValueChange={v => setNewProject({...newProject, status: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {projectStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Project'}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>

        {/* --- GRID VIEW --- */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-xl border" />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Building className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No projects found</h3>
              <p className="text-muted-foreground max-w-sm mt-2 mb-6">
                Try adjusting your search or sync projects from your website.
              </p>
              {/* --- VISIBLE TO ALL: FALLBACK SYNC BUTTON --- */}
              <Button onClick={handleImport} variant="outline"><RefreshCw className="mr-2 h-4 w-4" /> Sync from Website</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProjects.map((project) => (
              <Card key={project.id} className="group hover:shadow-lg transition-all duration-300 overflow-hidden border-slate-200">
                
                <div className="relative h-40 bg-slate-100 overflow-hidden">
                    {project.imageUrls && project.imageUrls.length > 0 ? (
                        <img src={project.imageUrls[0]} alt={project.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                            {project.category === 'land' ? <LandPlot size={48} /> : <Building size={48} />}
                        </div>
                    )}
                    <div className="absolute top-3 right-3 flex gap-2">
                        {getStatusBadge(project.status)}
                        
                        {/* --- VISIBLE TO ALL: DELETE BUTTON --- */}
{canDeleteRecords && (
            <Button 
              size="icon" 
              variant="destructive" 
              className="h-6 w-6 rounded-full opacity-90 hover:opacity-100 shadow-sm"
              onClick={(e) => handleDeleteProject(project.id, e)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>

                    <div className="absolute bottom-3 left-3">
                        {getCategoryBadge(project.category)}
                    </div>
                </div>

                <CardContent className="p-4 space-y-3">
                    {/* TITLE & LOCATION */}
                    <div>
                        <h3 className="font-bold text-lg text-slate-900 truncate" title={project.name}>{project.name}</h3>
                        <p className="text-sm text-slate-500 flex items-center gap-1 truncate">
                            <MapPin size={14} className="shrink-0" />
                            {project.category === 'land' 
                                ? `${project.village || ''}, ${project.district || ''}` 
                                : `${project.location}, ${project.city || ''}`
                            }
                        </p>
                    </div>

                    <div className="h-px bg-slate-100" />

                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                        
                        {/* LAND DETAILS */}
                        {project.category === 'land' && (
                            <>
                                <div className="col-span-2 flex justify-between">
                                    <span className="text-slate-500">Plot Area</span>
                                    <span className="font-medium">{project.plotArea ? `${project.plotArea} Sq.Ft` : 'N/A'}</span>
                                </div>
                                <div className="col-span-2 flex justify-between">
                                    <span className="text-slate-500">Survey No.</span>
                                    <span className="font-medium truncate max-w-[120px]">{project.surveyNumber || 'N/A'}</span>
                                </div>
                            </>
                        )}

                        {/* RESIDENTIAL / COMMERCIAL DETAILS */}
                        {project.category !== 'land' && (
                            <>
                                <div className="col-span-2 flex justify-between">
                                    <span className="text-slate-500">Developer</span>
                                    <span className="font-medium truncate max-w-[140px]" title={project.developer || 'Unknown'}>
                                        {project.developer || 'Unknown Developer'}
                                    </span>
                                </div>
                                {project.category === 'commercial' && (
                                    <div className="col-span-2 flex justify-between">
                                        <span className="text-slate-500">Type</span>
                                        <span className="font-medium">{project.propertyType || 'Commercial'}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {project.category === 'residential' && (project.totalUnits || 0) > 0 && (
                        <div className="space-y-1.5 pt-1">
                            <div className="flex justify-between text-xs text-slate-500">
                                <span>Sales Progress</span>
                                <span>{Math.round(((project.totalUnits! - (project.availableUnits || 0)) / project.totalUnits!) * 100)}%</span>
                            </div>
                            <Progress value={((project.totalUnits! - (project.availableUnits || 0)) / project.totalUnits!) * 100} className="h-1.5" />
                        </div>
                    )}

                    <div className="pt-2 mt-2 border-t border-dashed border-slate-200 flex justify-between items-center">
                        <div>
                            <p className="text-xs text-slate-400 font-medium uppercase">
                                {project.category === 'commercial' && project.transactionType === 'lease' 
                                    ? 'Lease Amount' 
                                    : 'Starting From'}
                            </p>
                            <p className="text-lg font-bold text-slate-800">
                                {formatProjectPrice(project)}
                            </p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-slate-100">
                            <Eye size={16} className="text-slate-600" />
                        </Button>
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