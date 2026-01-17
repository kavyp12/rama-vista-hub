import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, MapPin, Building, Home, Filter, Users, Eye, Waves, Dumbbell, Car, Trees, Shield, ArrowUp, Zap } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  location: string;
  city: string | null;
  developer: string | null;
  status: string;
  total_units: number | null;
  available_units: number | null;
  min_price: number | null;
  max_price: number | null;
  description: string | null;
  amenities: string[] | null;
  propertyCount?: number;
}

const projectStatuses = [
  { value: 'active', label: 'Active' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
];

const amenitiesList = [
  { value: 'swimming_pool', label: 'Swimming Pool', icon: Waves },
  { value: 'gym', label: 'Gym', icon: Dumbbell },
  { value: 'parking', label: 'Parking', icon: Car },
  { value: 'garden', label: 'Garden', icon: Trees },
  { value: 'security', label: '24/7 Security', icon: Shield },
  { value: 'elevator', label: 'Elevator', icon: ArrowUp },
  { value: 'power_backup', label: 'Power Backup', icon: Zap },
];

export default function Projects() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newProject, setNewProject] = useState({
    name: '',
    location: '',
    city: '',
    developer: '',
    status: 'active',
    total_units: '',
    available_units: '',
    min_price: '',
    max_price: '',
    description: '',
    amenities: [] as string[],
  });

  useEffect(() => {
    fetchProjects();
  }, [statusFilter]);

  async function fetchProjects() {
    let query = supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (!error && data) {
      // Get property counts for each project
      const { data: properties } = await supabase
        .from('properties')
        .select('project_id');
      
      const projectsWithCounts = data.map(project => ({
        ...project,
        propertyCount: properties?.filter(p => p.project_id === project.id).length || 0,
      }));
      
      setProjects(projectsWithCounts);
    }
    setLoading(false);
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await supabase.from('projects').insert([{
      name: newProject.name,
      location: newProject.location,
      city: newProject.city || null,
      developer: newProject.developer || null,
      status: newProject.status,
      total_units: newProject.total_units ? parseInt(newProject.total_units) : null,
      available_units: newProject.available_units ? parseInt(newProject.available_units) : null,
      min_price: newProject.min_price ? parseFloat(newProject.min_price) : null,
      max_price: newProject.max_price ? parseFloat(newProject.max_price) : null,
      description: newProject.description || null,
      amenities: newProject.amenities.length > 0 ? newProject.amenities : null,
    }]);

    setIsSubmitting(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to create project. Please try again.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Project Created',
        description: `${newProject.name} has been added.`,
      });
      setIsDialogOpen(false);
      setNewProject({
        name: '',
        location: '',
        city: '',
        developer: '',
        status: 'active',
        total_units: '',
        available_units: '',
        min_price: '',
        max_price: '',
        description: '',
        amenities: [],
      });
      fetchProjects();
    }
  };

  const toggleAmenity = (amenity: string) => {
    setNewProject(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const getAmenityIcon = (amenity: string) => {
    const item = amenitiesList.find(a => a.value === amenity);
    if (!item) return null;
    const Icon = item.icon;
    return <Icon className="h-3 w-3" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>;
      case 'upcoming':
        return <Badge className="bg-info/10 text-info border-info/20">Upcoming</Badge>;
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>;
      case 'on_hold':
        return <Badge className="bg-warning/10 text-warning border-warning/20">On Hold</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 10000000) {
      return `₹${(price / 10000000).toFixed(2)} Cr`;
    } else if (price >= 100000) {
      return `₹${(price / 100000).toFixed(2)} L`;
    }
    return `₹${price.toLocaleString()}`;
  };

  const filteredProjects = projects.filter((project) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      project.name.toLowerCase().includes(searchLower) ||
      project.location.toLowerCase().includes(searchLower) ||
      (project.city && project.city.toLowerCase().includes(searchLower)) ||
      (project.developer && project.developer.toLowerCase().includes(searchLower))
    );
  });

  return (
    <DashboardLayout title="Projects" description="Manage your real estate projects">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex flex-1 gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {projectStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Project</DialogTitle>
                <DialogDescription>Enter the project details to add it to your portfolio.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="name">Project Name *</Label>
                    <Input
                      id="name"
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                      placeholder="e.g., Skyline Towers"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location *</Label>
                    <Input
                      id="location"
                      value={newProject.location}
                      onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                      placeholder="e.g., Bandra West"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={newProject.city}
                      onChange={(e) => setNewProject({ ...newProject, city: e.target.value })}
                      placeholder="e.g., Mumbai"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="developer">Developer</Label>
                    <Input
                      id="developer"
                      value={newProject.developer}
                      onChange={(e) => setNewProject({ ...newProject, developer: e.target.value })}
                      placeholder="e.g., Rama Developers"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={newProject.status}
                      onValueChange={(value) => setNewProject({ ...newProject, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {projectStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="total_units">Total Units</Label>
                    <Input
                      id="total_units"
                      type="number"
                      value={newProject.total_units}
                      onChange={(e) => setNewProject({ ...newProject, total_units: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="available_units">Available Units</Label>
                    <Input
                      id="available_units"
                      type="number"
                      value={newProject.available_units}
                      onChange={(e) => setNewProject({ ...newProject, available_units: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min_price">Min Price (₹)</Label>
                    <Input
                      id="min_price"
                      type="number"
                      value={newProject.min_price}
                      onChange={(e) => setNewProject({ ...newProject, min_price: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_price">Max Price (₹)</Label>
                    <Input
                      id="max_price"
                      type="number"
                      value={newProject.max_price}
                      onChange={(e) => setNewProject({ ...newProject, max_price: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Amenities</Label>
                    <div className="flex flex-wrap gap-2">
                      {amenitiesList.map((amenity) => (
                        <Badge
                          key={amenity.value}
                          variant={newProject.amenities.includes(amenity.value) ? 'default' : 'outline'}
                          className="cursor-pointer gap-1"
                          onClick={() => toggleAmenity(amenity.value)}
                        >
                          <amenity.icon className="h-3 w-3" />
                          {amenity.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Project'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-5 w-2/3 rounded bg-muted" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-4 w-1/2 rounded bg-muted" />
                    <div className="h-4 w-3/4 rounded bg-muted" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search criteria' : 'Get started by adding your first project'}
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Card key={project.id} className="hover-lift cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {project.location}
                        {project.city && `, ${project.city}`}
                      </p>
                    </div>
                    {getStatusBadge(project.status || 'active')}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {project.developer && (
                    <p className="text-sm text-muted-foreground">
                      By <span className="font-medium text-foreground">{project.developer}</span>
                    </p>
                  )}
                  
                  {/* Units Progress Bar */}
                  {project.total_units && project.total_units > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Units Sold</span>
                        <span>{((project.total_units - (project.available_units || 0)) / project.total_units * 100).toFixed(0)}%</span>
                      </div>
                      <Progress 
                        value={(project.total_units - (project.available_units || 0)) / project.total_units * 100} 
                        className="h-2"
                      />
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Home className="h-4 w-4 text-muted-foreground" />
                      <span>{project.total_units || 0} Units</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-success">{project.available_units || 0} Available</span>
                    </div>
                  </div>

                  {/* Amenities */}
                  {project.amenities && project.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {project.amenities.slice(0, 4).map((amenity) => (
                        <Badge key={amenity} variant="outline" className="text-xs gap-1">
                          {getAmenityIcon(amenity)}
                          {amenitiesList.find(a => a.value === amenity)?.label || amenity}
                        </Badge>
                      ))}
                      {project.amenities.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{project.amenities.length - 4} more
                        </Badge>
                      )}
                    </div>
                  )}

                  {(project.min_price || project.max_price) && (
                    <div className="pt-3 border-t flex items-center justify-between">
                      <p className="text-lg font-bold">
                        {project.min_price && project.max_price
                          ? `${formatPrice(project.min_price)} - ${formatPrice(project.max_price)}`
                          : project.min_price
                          ? `From ${formatPrice(project.min_price)}`
                          : `Up to ${formatPrice(project.max_price!)}`}
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate(`/properties?project=${project.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {project.propertyCount || 0} Properties
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}