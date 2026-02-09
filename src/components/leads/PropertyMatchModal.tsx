import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Home, Send, Building } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Lead {
  id: string;
  name: string;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredLocation: string | null;
}

interface Property {
  id: string;
  title: string;
  location: string;
  city: string | null;
  price: number;
  propertyType: string;
  bedrooms: number | null;
  areaSqft: number | null;
  status: string;
  project?: {
    name: string;
    location: string;
  };
}

interface PropertyMatchModalProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PropertyMatchModal({ lead, open, onOpenChange, onSuccess }: PropertyMatchModalProps) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showAll, setShowAll] = useState(false); // Toggle for Strict vs All

  useEffect(() => {
    if (open && token) fetchMatchingProperties();
  }, [open, lead, token, showAll]);

  async function fetchMatchingProperties() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/properties?status=available`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch properties');
      const data: Property[] = await res.json();

      if (showAll) {
        setProperties(data);
      } else {
        const matched = data.filter(property => {
          let matches = true;

          // 1. Price matching (±20% tolerance if budget exists)
          if (lead.budgetMin || lead.budgetMax) {
            const minWithTolerance = (lead.budgetMin || 0) * 0.8;
            const maxWithTolerance = (lead.budgetMax || Infinity) * 1.2;
            
            // If property price is 0 (Price on Request), include it
            if (property.price > 0) {
               matches = property.price >= minWithTolerance && property.price <= maxWithTolerance;
            }
          }

          // 2. Location/Project matching (Fuzzy Search)
          if (lead.preferredLocation && matches) {
            const search = lead.preferredLocation.toLowerCase().trim();
            const pLoc = (property.location || '').toLowerCase();
            const pCity = (property.city || '').toLowerCase();
            const projName = (property.project?.name || '').toLowerCase();
            const projLoc = (property.project?.location || '').toLowerCase();
            
            const isLocationMatch = 
                pLoc.includes(search) || 
                pCity.includes(search) || 
                projName.includes(search) || // ✅ Match Project Name
                projLoc.includes(search) || 
                search.includes(pLoc) ||     // Reverse check
                search.includes(projName);

            matches = isLocationMatch;
          }

          return matches;
        });
        setProperties(matched);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load properties', variant: 'destructive' });
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
      if (!res.ok) throw new Error('Failed to send recommendations');

      toast({ title: 'Success', description: `${selectedProperties.length} properties recommended!` });
      setSelectedProperties([]);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to send recommendations', variant: 'destructive' });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Match Properties for {lead.name}</DialogTitle>
          <div className="text-sm text-muted-foreground flex flex-col gap-1 mt-1">
             <div>
                <span className="font-medium">Preference:</span>{' '}
                {lead.preferredLocation || 'Any Location'} • {' '}
                {lead.budgetMin ? formatPrice(lead.budgetMin) : '0'} - {lead.budgetMax ? formatPrice(lead.budgetMax) : 'Any'}
             </div>
             <div className="flex items-center space-x-2 mt-2">
                <Switch id="show-all" checked={showAll} onCheckedChange={setShowAll} />
                <Label htmlFor="show-all">Show all properties (Ignore preferences)</Label>
             </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-12">
              <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No matching properties found</p>
              <Button variant="link" onClick={() => setShowAll(true)}>Show all inventory</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {properties.map((property) => (
                <div 
                  key={property.id} 
                  className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${selectedProperties.includes(property.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'}`}
                  onClick={() => toggleProperty(property.id)}
                >
                  <Checkbox checked={selectedProperties.includes(property.id)} onCheckedChange={() => toggleProperty(property.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{property.title}</h4>
                      <Badge variant="outline" className="capitalize">{property.propertyType}</Badge>
                    </div>
                    {property.project && (
                         <div className="text-xs text-blue-600 flex items-center gap-1 mb-1">
                            <Building className="h-3 w-3" /> {property.project.name}
                         </div>
                    )}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {property.location}{property.city && `, ${property.city}`}
                      </span>
                      {property.bedrooms && <span>{property.bedrooms} BHK</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatPrice(property.price)}</p>
                    <Badge className="bg-green-100 text-green-700 border-0">Available</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSendRecommendations} disabled={selectedProperties.length === 0 || sending} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send {selectedProperties.length > 0 && `(${selectedProperties.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}