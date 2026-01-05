import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  Plus,
  Download,
  Eye,
  Trash2,
  FileSignature,
  FilePlus,
  FileCheck,
  Clock,
  Search
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Document {
  id: string;
  name: string;
  type: string;
  file_url: string | null;
  lead_id: string | null;
  property_id: string | null;
  project_id: string | null;
  status: string;
  signed_at: string | null;
  expires_at: string | null;
  created_at: string;
  lead?: { name: string };
  property?: { title: string };
  project?: { name: string };
}

const documentTypes = [
  { value: 'quotation', label: 'Quotation', icon: FileText },
  { value: 'booking_form', label: 'Booking Form', icon: FilePlus },
  { value: 'agreement', label: 'Agreement', icon: FileSignature },
  { value: 'brochure', label: 'Brochure', icon: FileText },
  { value: 'other', label: 'Other', icon: FileText },
];

const documentStatuses = [
  { value: 'draft', label: 'Draft', color: 'bg-muted text-muted-foreground' },
  { value: 'pending_signature', label: 'Pending Signature', color: 'bg-warning text-warning-foreground' },
  { value: 'signed', label: 'Signed', color: 'bg-success text-success-foreground' },
  { value: 'expired', label: 'Expired', color: 'bg-destructive text-destructive-foreground' },
];

export default function Documents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [leads, setLeads] = useState<{ id: string; name: string }[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState('quotation');
  const [selectedLead, setSelectedLead] = useState('');
  const [selectedProperty, setSelectedProperty] = useState('');
  const [selectedProject, setSelectedProject] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [docsRes, leadsRes, propsRes, projsRes] = await Promise.all([
      supabase
        .from('documents')
        .select('*, lead:leads(name), property:properties(title), project:projects(name)')
        .order('created_at', { ascending: false }),
      supabase.from('leads').select('id, name'),
      supabase.from('properties').select('id, title'),
      supabase.from('projects').select('id, name'),
    ]);

    if (docsRes.data) setDocuments(docsRes.data as Document[]);
    if (leadsRes.data) setLeads(leadsRes.data);
    if (propsRes.data) setProperties(propsRes.data);
    if (projsRes.data) setProjects(projsRes.data);
    
    setLoading(false);
  }

  async function handleCreateDocument() {
    if (!name || !user) return;
    
    setIsSubmitting(true);
    
    const { error } = await supabase.from('documents').insert({
      name,
      type,
      lead_id: selectedLead || null,
      property_id: selectedProperty || null,
      project_id: selectedProject || null,
      created_by: user.id,
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to create document', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Document created successfully' });
      resetForm();
      fetchData();
    }
    
    setIsSubmitting(false);
  }

  function resetForm() {
    setName('');
    setType('quotation');
    setSelectedLead('');
    setSelectedProperty('');
    setSelectedProject('');
    setIsDialogOpen(false);
  }

  function getTypeIcon(type: string) {
    const found = documentTypes.find(t => t.value === type);
    if (!found) return <FileText className="h-4 w-4" />;
    const Icon = found.icon;
    return <Icon className="h-4 w-4" />;
  }

  function getStatusBadge(status: string) {
    const found = documentStatuses.find(s => s.value === status);
    if (!found) return <Badge variant="secondary">{status}</Badge>;
    return <Badge className={found.color}>{found.label}</Badge>;
  }

  // Stats
  const totalDocs = documents.length;
  const pendingSignature = documents.filter(d => d.status === 'pending_signature').length;
  const signedDocs = documents.filter(d => d.status === 'signed').length;
  const draftDocs = documents.filter(d => d.status === 'draft').length;

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || doc.type === activeTab || doc.status === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <DashboardLayout title="Documents" description="Manage quotations, agreements, and forms">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Documents</p>
                  <p className="text-2xl font-bold">{totalDocs}</p>
                </div>
                <FileText className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Signature</p>
                  <p className="text-2xl font-bold">{pendingSignature}</p>
                </div>
                <Clock className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Signed</p>
                  <p className="text-2xl font-bold">{signedDocs}</p>
                </div>
                <FileCheck className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Drafts</p>
                  <p className="text-2xl font-bold">{draftDocs}</p>
                </div>
                <FilePlus className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documents List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">All Documents</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search documents..."
                  className="pl-9 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Document
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Document</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Document Name *</Label>
                      <Input 
                        placeholder="e.g. Quotation - Unit 304"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Document Type</Label>
                      <Select value={type} onValueChange={setType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {documentTypes.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              <div className="flex items-center gap-2">
                                <t.icon className="h-4 w-4" />
                                {t.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Link to Lead</Label>
                      <Select value={selectedLead} onValueChange={setSelectedLead}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select lead (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {leads.map((lead) => (
                            <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Link to Property</Label>
                      <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select property (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {properties.map((prop) => (
                            <SelectItem key={prop.id} value={prop.id}>{prop.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Link to Project</Label>
                      <Select value={selectedProject} onValueChange={setSelectedProject}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((proj) => (
                            <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={resetForm}>Cancel</Button>
                    <Button onClick={handleCreateDocument} disabled={!name || isSubmitting}>
                      {isSubmitting ? 'Creating...' : 'Create Document'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="quotation">Quotations</TabsTrigger>
                <TabsTrigger value="agreement">Agreements</TabsTrigger>
                <TabsTrigger value="booking_form">Booking Forms</TabsTrigger>
                <TabsTrigger value="pending_signature">Pending</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse h-16 rounded-lg bg-muted/30" />
                    ))}
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No documents found</p>
                    <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                      Create Your First Document
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            {getTypeIcon(doc.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{doc.name}</p>
                              {getStatusBadge(doc.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {doc.lead?.name && `Lead: ${doc.lead.name}`}
                              {doc.property?.title && ` • Property: ${doc.property.title}`}
                              {doc.project?.name && ` • Project: ${doc.project.name}`}
                              {!doc.lead && !doc.property && !doc.project && `Created ${format(parseISO(doc.created_at), 'MMM d, yyyy')}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4" />
                          </Button>
                          {doc.status === 'draft' && (
                            <Button size="sm" className="gap-1">
                              <FileSignature className="h-4 w-4" />
                              Send for Signature
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}