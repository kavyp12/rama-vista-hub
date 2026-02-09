// Documents.tsx

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, Search, Plus, Download, Edit, Trash2, 
  FileSignature, CheckCircle, Clock, Send, XCircle,
  FileUp, Receipt, FileCheck, Pencil
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList 
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Document {
  id: string;
  name: string;
  type: string;
  fileUrl: string | null;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  signedAt: string | null;
  lead?: { id: string; name: string; phone: string };
  property?: { id: string; title: string };
  project?: { id: string; name: string };
  deal?: { id: string; dealValue: number };
  creator?: { fullName: string };
  signatures?: Array<{
    id: string;
    signerName: string;
    signedAt: string;
  }>;
}

const documentTypes = [
  { value: 'quotation', label: 'Quotation', icon: FileText },
  { value: 'proposal', label: 'Proposal', icon: FileCheck },
  { value: 'booking_form', label: 'Booking Form', icon: FileUp },
  { value: 'agreement', label: 'Agreement', icon: FileSignature },
  { value: 'receipt', label: 'Receipt', icon: Receipt },
  { value: 'invoice', label: 'Invoice', icon: FileText },
];

const statusConfig = {
  draft: { color: 'bg-gray-500', icon: Edit, label: 'Draft' },
  sent: { color: 'bg-blue-500', icon: Send, label: 'Sent' },
  pending_signature: { color: 'bg-yellow-500', icon: Clock, label: 'Pending Signature' },
  signed: { color: 'bg-green-500', icon: CheckCircle, label: 'Signed' },
  expired: { color: 'bg-red-500', icon: XCircle, label: 'Expired' },
};

export default function Documents() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Dropdown Data States
  const [leads, setLeads] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);

  // Popover open states
  const [leadOpen, setLeadOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState(false);

  // Generate Dialog
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [generateData, setGenerateData] = useState({
    templateType: 'quotation',
    leadId: '',
    dealId: '',
    propertyId: '',
    projectId: '',
    customerName: '',
    amount: '',
    discount: '',
    tax: '',
    paymentTerms: '',
    validUntil: ''
  });

  // Edit Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [editData, setEditData] = useState({
    name: '',
    type: '',
    status: '',
    leadId: '',
    propertyId: '',
    projectId: ''
  });

  // Sign Dialog
  const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);
  const [documentToSign, setDocumentToSign] = useState<Document | null>(null);
  const [signatureCanvas, setSignatureCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (token) {
      fetchDocuments();
      fetchDropdownOptions();
    }
  }, [token, filterType, filterStatus]);

  async function fetchDocuments() {
    setLoading(true);
    try {
      let url = `${API_URL}/documents`;
      const params = new URLSearchParams();
      
      if (filterType !== 'all') params.append('type', filterType);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setDocuments(data);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      toast({ title: 'Error', description: 'Failed to load documents', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function fetchDropdownOptions() {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch leads, properties, and projects
      const [leadsRes, propsRes, projsRes] = await Promise.all([
        fetch(`${API_URL}/leads`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/properties`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/projects`, { headers }).then(r => r.json()),
      ]);

      if (Array.isArray(leadsRes)) {
        setLeads(leadsRes);
        
        // Extract deals from leads
        const extractedDeals = leadsRes.flatMap((lead: any) => 
          (lead.deals || []).map((deal: any) => ({
            id: deal.id,
            dealValue: deal.dealValue,
            stage: deal.stage,
            leadId: lead.id,
            leadName: lead.name,
            leadPhone: lead.phone
          }))
        );
        setDeals(extractedDeals);
      }

      if (Array.isArray(propsRes)) setProperties(propsRes);
      if (Array.isArray(projsRes)) setProjects(projsRes);
      
    } catch (error) {
      console.error('Failed to fetch options', error);
    }
  }

  // Filter properties based on selected project
  const filteredProperties = useMemo(() => {
    // If in generate mode
    if (isGenerateDialogOpen && generateData.projectId) {
      return properties.filter(prop => prop.projectId === generateData.projectId);
    }
    // If in edit mode
    if (isEditDialogOpen && editData.projectId) {
      return properties.filter(prop => prop.projectId === editData.projectId);
    }
    return properties;
  }, [properties, generateData.projectId, editData.projectId, isGenerateDialogOpen, isEditDialogOpen]);

  async function handleGenerateDocument(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        templateType: generateData.templateType,
        leadId: generateData.leadId || undefined,
        dealId: generateData.dealId || undefined,
        propertyId: generateData.propertyId || undefined,
        projectId: generateData.projectId || undefined,
        data: {
          customerName: generateData.customerName,
          amount: generateData.amount ? Number(generateData.amount) : undefined,
          discount: generateData.discount ? Number(generateData.discount) : undefined,
          tax: generateData.tax ? Number(generateData.tax) : undefined,
          paymentTerms: generateData.paymentTerms,
          validUntil: generateData.validUntil
        }
      };

      const res = await fetch(`${API_URL}/documents/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to generate document');

      toast({ 
        title: 'Success', 
        description: 'Document generated successfully' 
      });

      setIsGenerateDialogOpen(false);
      setGenerateData({
        templateType: 'quotation',
        leadId: '',
        dealId: '',
        propertyId: '',
        projectId: '',
        customerName: '',
        amount: '',
        discount: '',
        tax: '',
        paymentTerms: '',
        validUntil: ''
      });
      fetchDocuments();
      
    } catch (error) {
      console.error('Generate Document Error:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to generate document', 
        variant: 'destructive' 
      });
    }
  }

  // Handle opening edit dialog
  const openEditDialog = (doc: Document) => {
    setEditingDocument(doc);
    setEditData({
      name: doc.name,
      type: doc.type,
      status: doc.status,
      leadId: doc.lead?.id || '',
      propertyId: doc.property?.id || '',
      projectId: doc.project?.id || ''
    });
    setIsEditDialogOpen(true);
  };

  async function handleUpdateDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDocument) return;

    try {
      const res = await fetch(`${API_URL}/documents/${editingDocument.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editData.name,
          type: editData.type,
          status: editData.status,
          leadId: editData.leadId || null,
          propertyId: editData.propertyId || null,
          projectId: editData.projectId || null
        })
      });

      if (!res.ok) throw new Error('Failed to update document');

      toast({ title: 'Success', description: 'Document updated successfully' });
      setIsEditDialogOpen(false);
      setEditingDocument(null);
      fetchDocuments();
    } catch (error) {
      console.error('Update Document Error:', error);
      toast({ title: 'Error', description: 'Failed to update document', variant: 'destructive' });
    }
  }

  async function handleSignDocument() {
    if (!documentToSign || !signatureCanvas) return;

    try {
      const signatureData = signatureCanvas.toDataURL();

      const res = await fetch(`${API_URL}/documents/${documentToSign.id}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ signatureData })
      });

      if (!res.ok) throw new Error('Failed to sign document');

      toast({ 
        title: 'Success', 
        description: 'Document signed successfully' 
      });

      setIsSignDialogOpen(false);
      setDocumentToSign(null);
      fetchDocuments();
      
    } catch (error) {
      console.error('Sign Document Error:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to sign document', 
        variant: 'destructive' 
      });
    }
  }

  async function handleDownload(documentId: string, documentName: string) {
    try {
      const res = await fetch(`${API_URL}/documents/${documentId}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = documentName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('Download Error:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to download document', 
        variant: 'destructive' 
      });
    }
  }

  // Auto-populate customer name when lead or deal is selected
  useEffect(() => {
    if (generateData.leadId) {
      const selectedLead = leads.find(l => l.id === generateData.leadId);
      if (selectedLead && !generateData.customerName) {
        setGenerateData(prev => ({ ...prev, customerName: selectedLead.name }));
      }
    } else if (generateData.dealId) {
      const selectedDeal = deals.find(d => d.id === generateData.dealId);
      if (selectedDeal && !generateData.customerName) {
        setGenerateData(prev => ({ ...prev, customerName: selectedDeal.leadName }));
      }
    }
  }, [generateData.leadId, generateData.dealId, leads, deals]);

  // Clear property when project changes (Generate Mode)
  useEffect(() => {
    if (generateData.projectId) {
      setGenerateData(prev => ({ ...prev, propertyId: '' }));
    }
  }, [generateData.projectId]);

  // Clear property when project changes (Edit Mode)
  useEffect(() => {
    if (editData.projectId) {
       // Only clear if the current property doesn't match the project
       const currentProp = properties.find(p => p.id === editData.propertyId);
       if (currentProp && currentProp.projectId !== editData.projectId) {
         setEditData(prev => ({ ...prev, propertyId: '' }));
       }
    }
  }, [editData.projectId]);


  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.lead?.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Reusable Dropdown Render Function to avoid code duplication
  // Key fix: CommandList gets the overflow class, not CommandGroup
  const renderDropdown = (
    label: string, 
    value: string, 
    onChange: (val: string) => void, 
    options: any[], 
    displayKey: string,
    subDisplayKey: string | null = null,
    searchPlaceholder: string,
    open: boolean,
    setOpen: (v: boolean) => void,
    icon: any = Search
  ) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between"
          >
            {value
              ? options.find((opt) => opt.id === value)?.[displayKey]
              : searchPlaceholder}
            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-[300px] overflow-y-auto">
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={`${option[displayKey]} ${subDisplayKey ? option[subDisplayKey] : ''}`}
                    onSelect={() => {
                      onChange(option.id);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{option[displayKey]}</span>
                      {subDisplayKey && (
                         <span className="text-xs text-muted-foreground">{option[subDisplayKey]}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <DashboardLayout title="Documents" description="Manage contracts, agreements, and documents">
      <div className="space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search documents..." 
              className="pl-10" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {documentTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(statusConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Generate Document
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Generate New Document</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleGenerateDocument} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Document Type *</Label>
                    <Select 
                      value={generateData.templateType} 
                      onValueChange={(val) => setGenerateData({...generateData, templateType: val})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     {renderDropdown(
                        "Select Customer (Lead)", 
                        generateData.leadId, 
                        (val) => setGenerateData({...generateData, leadId: val}),
                        leads, "name", "phone", "Search customer...", 
                        leadOpen, setLeadOpen
                     )}
                     
                     {/* Deals need custom handling due to different data structure or mapping */}
                     <div className="space-y-2">
                      <Label>Link to Deal (Optional)</Label>
                      <Popover open={dealOpen} onOpenChange={setDealOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" className="w-full justify-between">
                            {generateData.dealId
                              ? `${deals.find((d) => d.id === generateData.dealId)?.leadName} - ₹${deals.find((d) => d.id === generateData.dealId)?.dealValue?.toLocaleString('en-IN')}`
                              : "Search deal..."}
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput placeholder="Search deal..." />
                            <CommandList className="max-h-[300px] overflow-y-auto">
                              <CommandEmpty>No deal found.</CommandEmpty>
                              <CommandGroup>
                                {deals.map((deal) => (
                                  <CommandItem
                                    key={deal.id}
                                    value={`${deal.leadName} ${deal.dealValue}`}
                                    onSelect={() => {
                                      setGenerateData({...generateData, dealId: deal.id});
                                      setDealOpen(false);
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">{deal.leadName}</span>
                                      <span className="text-xs text-muted-foreground">₹{deal.dealValue}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {renderDropdown(
                        "Link to Project", 
                        generateData.projectId, 
                        (val) => setGenerateData({...generateData, projectId: val}),
                        projects, "name", "location", "Search project...", 
                        projectOpen, setProjectOpen
                     )}

                    {renderDropdown(
                        "Link to Property", 
                        generateData.propertyId, 
                        (val) => setGenerateData({...generateData, propertyId: val}),
                        filteredProperties, "title", "location", "Search property...", 
                        propertyOpen, setPropertyOpen
                     )}
                  </div>

                  <div className="space-y-2">
                    <Label>Customer Name (Manual)</Label>
                    <Input 
                      value={generateData.customerName}
                      onChange={(e) => setGenerateData({...generateData, customerName: e.target.value})}
                      placeholder="Auto-filled from lead/deal or enter manually"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input 
                        type="number"
                        value={generateData.amount}
                        onChange={(e) => setGenerateData({...generateData, amount: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Discount</Label>
                      <Input 
                        type="number"
                        value={generateData.discount}
                        onChange={(e) => setGenerateData({...generateData, discount: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Tax/GST</Label>
                      <Input 
                        type="number"
                        value={generateData.tax}
                        onChange={(e) => setGenerateData({...generateData, tax: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Payment Terms</Label>
                    <Textarea 
                      value={generateData.paymentTerms}
                      onChange={(e) => setGenerateData({...generateData, paymentTerms: e.target.value})}
                      placeholder="E.g., 20% booking, 80% on possession"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Valid Until</Label>
                    <Input 
                      type="date"
                      value={generateData.validUntil}
                      onChange={(e) => setGenerateData({...generateData, validUntil: e.target.value})}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsGenerateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Generate</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            [...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-20 bg-muted/20" />
                <CardContent className="h-32 bg-muted/10" />
              </Card>
            ))
          ) : filteredDocuments.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No documents found</h3>
                <p className="text-sm text-muted-foreground">Generate your first document to get started</p>
              </CardContent>
            </Card>
          ) : (
            filteredDocuments.map((doc) => {
              const StatusIcon = statusConfig[doc.status as keyof typeof statusConfig]?.icon || FileText;
              const TypeIcon = documentTypes.find(t => t.value === doc.type)?.icon || FileText;
              
              return (
                <Card key={doc.id} className="hover:shadow-md transition-shadow relative group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-5 w-5 text-blue-600" />
                        <CardTitle className="text-sm font-medium line-clamp-1">
                          {doc.name}
                        </CardTitle>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => openEditDialog(doc)}
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <Badge 
                          className={`${statusConfig[doc.status as keyof typeof statusConfig]?.color} text-white`}
                        >
                          {statusConfig[doc.status as keyof typeof statusConfig]?.label}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {doc.lead && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Customer: </span>
                        <span className="font-medium">{doc.lead.name}</span>
                      </div>
                    )}
                    
                    {doc.property && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Property: </span>
                        <span className="font-medium">{doc.property.title}</span>
                      </div>
                    )}

                    {doc.project && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Project: </span>
                        <span className="font-medium">{doc.project.name}</span>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      Created {format(new Date(doc.createdAt), 'MMM dd, yyyy')}
                    </div>

                    {doc.signatures && doc.signatures.length > 0 && (
                      <div className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Signed by {doc.signatures[0].signerName}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => handleDownload(doc.id, doc.name)}
                      >
                        <Download className="h-3 w-3 mr-1" /> Download
                      </Button>
                      
                      {doc.status !== 'signed' && (
                        <Button 
                          size="sm" 
                          variant="default"
                          className="flex-1"
                          onClick={() => {
                            setDocumentToSign(doc);
                            setIsSignDialogOpen(true);
                          }}
                        >
                          <FileSignature className="h-3 w-3 mr-1" /> Sign
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Edit Document Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Document Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateDocument} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Input 
                value={editData.name} 
                onChange={(e) => setEditData({...editData, name: e.target.value})} 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Type</Label>
              <Select 
                value={editData.type} 
                onValueChange={(val) => setEditData({...editData, type: val})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={editData.status} 
                onValueChange={(val) => setEditData({...editData, status: val})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
             <div className="space-y-2">
                 <Label>Project</Label>
                 <Select 
                    value={editData.projectId} 
                    onValueChange={(val) => setEditData({...editData, projectId: val})}
                  >
                  <SelectTrigger><SelectValue placeholder="Select Project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                 </Select>
             </div>

             <div className="space-y-2">
                 <Label>Property</Label>
                 <Select 
                    value={editData.propertyId} 
                    onValueChange={(val) => setEditData({...editData, propertyId: val})}
                  >
                  <SelectTrigger><SelectValue placeholder="Select Property" /></SelectTrigger>
                  <SelectContent>
                    {filteredProperties.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                  </SelectContent>
                 </Select>
             </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Document</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sign Document Dialog */}
      <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Sign Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Draw Your Signature</Label>
              <div className="border-2 border-dashed rounded-lg p-4 bg-gray-50">
                <canvas
                  ref={setSignatureCanvas}
                  width={400}
                  height={150}
                  className="w-full cursor-crosshair bg-white"
                  onMouseDown={(e) => {
                    const canvas = e.currentTarget;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.beginPath();
                      ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                    }
                  }}
                  onMouseMove={(e) => {
                    if (e.buttons !== 1) return;
                    const canvas = e.currentTarget;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                      ctx.stroke();
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    if (signatureCanvas) {
                      const ctx = signatureCanvas.getContext('2d');
                      if (ctx) ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
                    }
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsSignDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSignDocument}>
                <FileSignature className="h-4 w-4 mr-2" />
                Sign Document
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}