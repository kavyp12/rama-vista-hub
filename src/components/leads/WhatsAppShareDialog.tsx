import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper: Custom Searchable Select (Updated to support Multi-Select)
function SearchableSelect({ options, value, onChange, placeholder = "Select...", disabled = false, multiple = false }: any) {
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

  const filteredOptions = options.filter((opt: any) =>
    (opt.label || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayLabel = multiple 
    ? (Array.isArray(value) && value.length > 0 ? `${value.length} selected` : placeholder)
    : (options.find((opt: any) => opt.value === value)?.label || placeholder);

  const handleSelect = (val: string) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.includes(val)) {
        onChange(currentValues.filter((v: string) => v !== val)); // Remove
      } else {
        onChange([...currentValues, val]); // Add
      }
    } else {
      onChange(val);
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={displayLabel === placeholder ? "text-muted-foreground" : "font-medium"}>{displayLabel}</span>
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </div>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-md max-h-[300px] flex flex-col">
          <div className="flex items-center border-b px-3 py-2 sticky top-0 z-10 bg-white">
            <Search className="mr-2 h-4 w-4 opacity-50" />
            <input
              className="flex h-9 w-full bg-transparent text-sm outline-none"
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
              filteredOptions.map((option: any) => {
                const isSelected = multiple ? (Array.isArray(value) && value.includes(option.value)) : value === option.value;
                return (
                  <div
                    key={option.value}
                    className={cn("flex items-center px-2 py-1.5 text-sm hover:bg-slate-100 cursor-pointer", isSelected && "bg-slate-100 font-medium")}
                    onClick={() => handleSelect(option.value)}
                  >
                    <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100 text-blue-600" : "opacity-0")} />
                    {option.label}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function WhatsAppShareDialog({ lead, open, onOpenChange }: any) {
  const { token } = useAuth();
  const { toast } = useToast();

  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const [isManualEntry, setIsManualEntry] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]); // Array for multi-select
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]); // Array for multi-select
  const [manualDetails, setManualDetails] = useState('');
  const [propertyOptions, setPropertyOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (open && token) fetchData();
  }, [open, token]);

  // Clear selections when switching modes
  useEffect(() => {
     if (isManualEntry) {
         setSelectedProjects([]);
         setSelectedProperties([]);
     } else {
         setManualDetails('');
     }
  }, [isManualEntry]);

  async function fetchData() {
    setLoading(true);
    try {
      const [propsRes, projsRes] = await Promise.all([
        fetch(`${API_URL}/properties`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/projects?status=active`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const propsData = await propsRes.json();
      const projsData = await projsRes.json();

      if (Array.isArray(propsData)) setAllProperties(propsData);
      if (Array.isArray(projsData)) setProjects(projsData.map((p: any) => ({ value: p.id, label: p.name })));
    } catch (error) {
      toast({ title: 'Error loading data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const formatPrice = (price: number) => {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
    return `₹${price.toLocaleString()}`;
  };

  // Format label for the dropdown
  const formatPropertyDetails = (p: any) => {
    const parts = [];
    if (p.bedrooms) parts.push(`${p.bedrooms} BHK`);
    if (p.propertyType) parts.push(p.propertyType);
    if (p.areaSqft) parts.push(`(${p.areaSqft} sqft)`);
    if (p.price) parts.push(formatPrice(p.price));
    return parts.join(' • ') || p.title;
  };

  // Filter properties when projects change
  useEffect(() => {
    let filtered = allProperties;
    // If they selected projects, only show properties from those projects
    if (selectedProjects.length > 0) {
        filtered = allProperties.filter(p => selectedProjects.includes(p.projectId));
    }
    setPropertyOptions(filtered.map(p => ({ value: p.id, label: formatPropertyDetails(p) })));
    
    // Auto-remove any selected properties that don't belong to the newly filtered list
    setSelectedProperties(prev => prev.filter(id => filtered.some(fp => fp.id === id)));
  }, [selectedProjects, allProperties]);

  const handleSendWA = () => {
    let msg = '';
    
    if (isManualEntry) {
        if (!manualDetails) return toast({ title: 'Please enter details', variant: 'destructive' });
        msg = `Hi ${lead.name}, check out these property details: ${manualDetails}. Let me know if you are interested!`;
    } else {
        if (selectedProperties.length === 0) return toast({ title: 'Please select properties', variant: 'destructive' });
        
        // Loop through all selected properties to generate a clean list without project names
        const propertyDescriptions = selectedProperties.map(propId => {
            const prop = allProperties.find(p => p.id === propId);
            if (!prop) return '';
            
            const details = [];
            if (prop.bedrooms) details.push(`${prop.bedrooms} BHK`);
            if (prop.propertyType) details.push(prop.propertyType);
            if (prop.areaSqft) details.push(`(${prop.areaSqft} sqft)`);
            
            const specsString = details.length > 0 ? details.join(' ') : 'Property';
            const locationStr = prop.location || 'your preferred location';
            
        return `• ${specsString} in ${locationStr}\n• Price: ${formatPrice(prop.price)}`;
        
        }).join('\n\n');

        msg = `Hi ${lead.name}, check out these properties that perfectly match your requirements:\n\n${propertyDescriptions}\n\nLet me know if you would like to schedule a visit.`;
    }

    const cleanPhone = lead.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    onOpenChange(false);
  };

  // Disable send button if nothing is selected
  const isSendDisabled = isManualEntry ? !manualDetails.trim() : selectedProperties.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-visible">
        <DialogHeader>
          <DialogTitle>Share via WhatsApp</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2 py-2">
            <input 
              type="checkbox" 
              id="wa-manual-mode" 
              checked={isManualEntry} 
              onChange={(e) => setIsManualEntry(e.target.checked)} 
              className="h-4 w-4 rounded border-gray-300 text-green-600"
            />
            <Label htmlFor="wa-manual-mode" className="cursor-pointer text-green-700 font-medium">
              Property/Project not in list? Type details manually
            </Label>
          </div>

          {!isManualEntry ? (
            <>
              <div className="space-y-2">
                <Label>1. Select Projects (Optional)</Label>
                <SearchableSelect 
                   options={projects} 
                   value={selectedProjects} 
                   onChange={setSelectedProjects} 
                   placeholder="Search and select projects..." 
                   disabled={loading} 
                   multiple={true}
                />
              </div>
              <div className="space-y-2">
                <Label>2. Select Property Details *</Label>
                <SearchableSelect 
                  options={propertyOptions} 
                  value={selectedProperties} 
                  onChange={setSelectedProperties} 
                  placeholder={selectedProjects.length > 0 ? "Select properties..." : "Search properties..."} 
                  disabled={loading} 
                  multiple={true}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2 bg-green-50/50 p-3 rounded-md border border-green-100">
              <Label>Manual Property Details</Label>
              <Textarea 
                placeholder="Type the details you want to send..." 
                value={manualDetails} 
                onChange={(e) => setManualDetails(e.target.value)} 
                rows={4}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSendWA} disabled={isSendDisabled} className="bg-green-600 hover:bg-green-700 gap-2">
            <MessageCircle className="h-4 w-4" /> Open WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}