import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Home, Send, Building, MessageCircle, ArrowRightLeft } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export function PropertyMatchModal({ lead, open, onOpenChange, onSuccess }: any) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Filters
  const [showAll, setShowAll] = useState(false);
  const [filterBhk, setFilterBhk] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  
  // Compare UI
  const [isComparing, setIsComparing] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // Previously recommended tracking
  const [recommendedIds, setRecommendedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && token) {
      fetchMatchingProperties();
      if (lead.propertyRecommendations) {
         setRecommendedIds(new Set(lead.propertyRecommendations.map((r:any) => r.propertyId || r.property?.id)));
      }
    }
  }, [open, lead, token, showAll, filterBhk, filterType]);

  async function fetchMatchingProperties() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/properties?status=available`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch properties');
      const data: any[] = await res.json();

      let matched = data;

      // 1. Apply UI Filters (BHK & Type)
      if (filterBhk !== 'all') matched = matched.filter(p => p.bedrooms === parseInt(filterBhk));
      if (filterType !== 'all') matched = matched.filter(p => p.propertyType === filterType);

      if (!showAll) {
        // 2. Strict Matching
        matched = matched.filter(property => {
          let matches = true;
          if (lead.budgetMin || lead.budgetMax) {
            const minWithTolerance = (lead.budgetMin || 0) * 0.8;
            const maxWithTolerance = (lead.budgetMax || Infinity) * 1.2;
            if (property.price > 0) matches = property.price >= minWithTolerance && property.price <= maxWithTolerance;
          }
          if (lead.preferredLocation && matches) {
            const search = lead.preferredLocation.toLowerCase().trim();
            const str = `${property.location} ${property.city} ${property.project?.name} ${property.project?.location}`.toLowerCase();
            matches = str.includes(search) || search.includes(property.location?.toLowerCase() || 'null');
          }
          return matches;
        });
      }

      // 3. Smart Sort (Closest Price Match First)
      if (lead.budgetMax) {
          const targetPrice = lead.budgetMax;
          matched.sort((a, b) => Math.abs(a.price - targetPrice) - Math.abs(b.price - targetPrice));
      }

      setProperties(matched);
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSendRecommendations() {
    if (!token || selectedProperties.length === 0) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/leads/${lead.id}/recommendations`, {
         method: 'POST',
         headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({ propertyIds: selectedProperties })
      });
      if (!res.ok) throw new Error('Failed');

      toast({ title: 'Success', description: `${selectedProperties.length} properties marked as shown.` });
      setSelectedProperties([]);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }
  
  function formatPrice(price: number) {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
    return `₹${price.toLocaleString()}`;
  }

  function toggleProperty(id: string) {
    setSelectedProperties(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  function toggleCompare(id: string) {
      setCompareIds(prev => {
          if (prev.includes(id)) return prev.filter(p => p !== id);
          if (prev.length >= 2) return [prev[1], id]; // Keep max 2
          return [...prev, id];
      });
  }

  const handleShareWA = (prop: any) => {
      const msg = `Hi ${lead.name}, check out this property: ${prop.title} in ${prop.location}. It perfectly matches your requirements! Price: ${formatPrice(prop.price)}. Let me know if you want to visit.`;
      const cleanPhone = lead.phone.replace(/\D/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Compare View Render
  if (isComparing && compareIds.length > 0) {
      const p1 = properties.find(p => p.id === compareIds[0]);
      const p2 = properties.find(p => p.id === compareIds[1]);
      return (
        <Dialog open={open} onOpenChange={(val) => { setIsComparing(false); onOpenChange(val); }}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
               <DialogHeader><DialogTitle>Property Comparison</DialogTitle></DialogHeader>
               <div className="grid grid-cols-2 gap-6 pt-4">
                  {[p1, p2].map((p, idx) => p ? (
                      <div key={p.id} className="border rounded-lg p-4 space-y-4">
                          <h3 className="font-bold text-lg">{p.title}</h3>
                          <Badge variant="outline">{p.propertyType}</Badge>
                          <div className="grid grid-cols-2 gap-y-2 text-sm">
                             <span className="text-muted-foreground">Price:</span> <span className="font-bold">{formatPrice(p.price)}</span>
                             <span className="text-muted-foreground">Location:</span> <span>{p.location}</span>
                             <span className="text-muted-foreground">Area:</span> <span>{p.areaSqft ? `${p.areaSqft} sqft` : 'N/A'}</span>
                             <span className="text-muted-foreground">BHK:</span> <span>{p.bedrooms || 'N/A'}</span>
                             <span className="text-muted-foreground">Project:</span> <span>{p.project?.name || 'N/A'}</span>
                          </div>
                          <Button className="w-full mt-4 bg-green-600 hover:bg-green-700" onClick={() => handleShareWA(p)}>
                             <MessageCircle className="h-4 w-4 mr-2" /> Share via WhatsApp
                          </Button>
                      </div>
                  ) : (
                      <div key={idx} className="border rounded-lg p-4 flex items-center justify-center text-muted-foreground bg-slate-50 border-dashed">
                          Select a second property to compare
                      </div>
                  ))}
               </div>
               <DialogFooter>
                   <Button variant="outline" onClick={() => setIsComparing(false)}>Back to List</Button>
               </DialogFooter>
            </DialogContent>
        </Dialog>
      )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex justify-between items-start">
              <div>
                  <DialogTitle>Match Properties for {lead.name}</DialogTitle>
                  <div className="text-sm text-muted-foreground mt-1">
                     Prefers: {lead.preferredLocation || 'Any Location'} • {lead.budgetMin ? formatPrice(lead.budgetMin) : '0'} - {lead.budgetMax ? formatPrice(lead.budgetMax) : 'Any'}
                  </div>
              </div>
              <Button variant="secondary" onClick={() => setIsComparing(true)} disabled={compareIds.length === 0} className="gap-2">
                 <ArrowRightLeft className="h-4 w-4" /> Compare ({compareIds.length}/2)
              </Button>
          </div>
          
          {/* Filter Bar */}
          <div className="flex items-center gap-4 mt-4 bg-slate-50 p-2 rounded border border-slate-100">
             <div className="flex items-center space-x-2">
                <Switch id="show-all" checked={showAll} onCheckedChange={setShowAll} />
                <Label htmlFor="show-all" className="text-xs">Ignore Preferences</Label>
             </div>
             <div className="w-[120px]">
                <Select value={filterBhk} onValueChange={setFilterBhk}>
                    <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="BHK" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All BHK</SelectItem>
                        <SelectItem value="1">1 BHK</SelectItem>
                        <SelectItem value="2">2 BHK</SelectItem>
                        <SelectItem value="3">3 BHK</SelectItem>
                        <SelectItem value="4">4+ BHK</SelectItem>
                    </SelectContent>
                </Select>
             </div>
             <div className="w-[120px]">
                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="apartment">Apartment</SelectItem>
                        <SelectItem value="villa">Villa</SelectItem>
                        <SelectItem value="plot">Plot</SelectItem>
                    </SelectContent>
                </Select>
             </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : properties.length === 0 ? (
            <div className="text-center py-12">
              <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No matching properties found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {properties.map((property) => {
                const isSelected = selectedProperties.includes(property.id);
                const isCompared = compareIds.includes(property.id);
                const isShown = recommendedIds.has(property.id);

                return (
                <div key={property.id} className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${isSelected ? 'border-blue-500 bg-blue-50/30' : 'hover:bg-slate-50'} ${isShown ? 'opacity-70' : ''}`}>
                  
                  {/* Selection for Mass Action */}
                  <div className="flex flex-col gap-4 items-center justify-center h-full">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleProperty(property.id)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{property.title}</h4>
                      <Badge variant="outline" className="capitalize text-[10px] h-5">{property.propertyType}</Badge>
                      {isShown && <Badge variant="secondary" className="text-[10px] h-5 bg-green-100 text-green-700">Shown</Badge>}
                    </div>
                    {property.project && (
                         <div className="text-xs text-blue-600 flex items-center gap-1 mb-1">
                            <Building className="h-3 w-3" /> {property.project.name}
                         </div>
                    )}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{property.location}</span>
                      {property.bedrooms && <span>{property.bedrooms} BHK</span>}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className="font-bold">{formatPrice(property.price)}</p>
                    <div className="flex gap-2">
                        <Button size="sm" variant={isCompared ? "secondary" : "outline"} className="h-7 text-xs" onClick={() => toggleCompare(property.id)}>
                            {isCompared ? 'Added to Compare' : 'Compare'}
                        </Button>
                        <Button size="icon" variant="outline" className="h-7 w-7 text-green-600 hover:bg-green-50 hover:text-green-700" onClick={() => handleShareWA(property)}>
                            <MessageCircle className="h-4 w-4" />
                        </Button>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSendRecommendations} disabled={selectedProperties.length === 0 || sending} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Mark {selectedProperties.length} as Shown
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}