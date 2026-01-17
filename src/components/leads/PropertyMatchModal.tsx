import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, IndianRupee, Home, Send } from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  budget_min: number | null;
  budget_max: number | null;
  preferred_location: string | null;
}

interface Property {
  id: string;
  title: string;
  location: string;
  city: string | null;
  price: number;
  property_type: string;
  bedrooms: number | null;
  status: string;
}

interface PropertyMatchModalProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PropertyMatchModal({ lead, open, onOpenChange, onSuccess }: PropertyMatchModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      fetchMatchingProperties();
    }
  }, [open, lead]);

  async function fetchMatchingProperties() {
    setLoading(true);
    
    // Get available properties
    let query = supabase
      .from('properties')
      .select('*')
      .eq('status', 'available');

    const { data, error } = await query;

    if (!error && data) {
      // Filter properties based on lead criteria with ±20% tolerance
      const matched = data.filter(property => {
        let matches = true;

        // Price matching with ±20% tolerance
        if (lead.budget_min && lead.budget_max) {
          const minWithTolerance = lead.budget_min * 0.8;
          const maxWithTolerance = lead.budget_max * 1.2;
          matches = property.price >= minWithTolerance && property.price <= maxWithTolerance;
        }

        // Location matching (case-insensitive partial match)
        if (lead.preferred_location && matches) {
          const leadLocation = lead.preferred_location.toLowerCase();
          const propertyLocation = property.location.toLowerCase();
          const propertyCity = property.city?.toLowerCase() || '';
          matches = propertyLocation.includes(leadLocation) || 
                    propertyCity.includes(leadLocation) ||
                    leadLocation.includes(propertyLocation);
        }

        return matches;
      });

      setProperties(matched);
    }
    setLoading(false);
  }

  async function handleSendRecommendations() {
    if (!user || selectedProperties.length === 0) return;
    
    setSending(true);

    const recommendations = selectedProperties.map(propertyId => ({
      lead_id: lead.id,
      property_id: propertyId,
      recommended_by: user.id,
      status: 'pending'
    }));

    const { error } = await supabase
      .from('property_recommendations')
      .upsert(recommendations, { onConflict: 'lead_id,property_id' });

    if (error) {
      toast({ title: 'Error', description: 'Failed to send recommendations', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `${selectedProperties.length} properties recommended to ${lead.name}` });
      setSelectedProperties([]);
      onOpenChange(false);
      onSuccess();
    }
    setSending(false);
  }

  function formatPrice(price: number) {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
    return `₹${price.toLocaleString()}`;
  }

  function toggleProperty(id: string) {
    setSelectedProperties(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Match Properties for {lead.name}</DialogTitle>
          <div className="text-sm text-muted-foreground">
            Budget: {lead.budget_min && lead.budget_max 
              ? `${formatPrice(lead.budget_min)} - ${formatPrice(lead.budget_max)}`
              : 'Not specified'
            }
            {lead.preferred_location && ` • Location: ${lead.preferred_location}`}
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
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting the lead's budget or location preferences
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {properties.map((property) => (
                <div 
                  key={property.id} 
                  className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedProperties.includes(property.id) 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:bg-muted/30'
                  }`}
                  onClick={() => toggleProperty(property.id)}
                >
                  <Checkbox 
                    checked={selectedProperties.includes(property.id)}
                    onCheckedChange={() => toggleProperty(property.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{property.title}</h4>
                      <Badge variant="outline" className="capitalize">
                        {property.property_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {property.location}{property.city && `, ${property.city}`}
                      </span>
                      {property.bedrooms && (
                        <span>{property.bedrooms} BHK</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatPrice(property.price)}</p>
                    <Badge className="bg-success/10 text-success border-success/20">Available</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSendRecommendations} 
            disabled={selectedProperties.length === 0 || sending}
            className="gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send {selectedProperties.length > 0 && `(${selectedProperties.length})`} to Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
