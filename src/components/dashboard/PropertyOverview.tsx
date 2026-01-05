import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, MapPin, Bed, Bath, Square } from 'lucide-react';

interface Property {
  id: string;
  title: string;
  property_type: string;
  location: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqft: number | null;
  price: number;
  status: string;
}

export function PropertyOverview() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProperties() {
      const { data, error } = await supabase
        .from('properties')
        .select('id, title, property_type, location, bedrooms, bathrooms, area_sqft, price, status')
        .order('created_at', { ascending: false })
        .limit(4);

      if (!error && data) {
        setProperties(data);
      }
      setLoading(false);
    }

    fetchProperties();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-success/10 text-success border-success/20">Available</Badge>;
      case 'booked':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Booked</Badge>;
      case 'sold':
        return <Badge variant="secondary">Sold</Badge>;
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

  const formatPropertyType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Property Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-4 rounded-lg border animate-pulse">
                <div className="h-4 w-2/3 rounded bg-muted mb-2" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Property Inventory</CardTitle>
          <CardDescription>Latest properties in inventory</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/properties">
            View all <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {properties.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No properties in inventory</p>
            <Button variant="outline" className="mt-4" asChild>
              <Link to="/properties">Add property</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {properties.map((property) => (
              <Link
                key={property.id}
                to={`/properties/${property.id}`}
                className="block p-4 rounded-lg border hover:border-primary/50 hover:shadow-soft transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold truncate">{property.title}</h4>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {property.location}
                    </p>
                  </div>
                  {getStatusBadge(property.status)}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
                  <span className="flex items-center gap-1">
                    <Badge variant="outline" className="font-normal">
                      {formatPropertyType(property.property_type)}
                    </Badge>
                  </span>
                  {property.bedrooms && (
                    <span className="flex items-center gap-1">
                      <Bed className="h-3.5 w-3.5" />
                      {property.bedrooms}
                    </span>
                  )}
                  {property.bathrooms && (
                    <span className="flex items-center gap-1">
                      <Bath className="h-3.5 w-3.5" />
                      {property.bathrooms}
                    </span>
                  )}
                  {property.area_sqft && (
                    <span className="flex items-center gap-1">
                      <Square className="h-3.5 w-3.5" />
                      {property.area_sqft} sqft
                    </span>
                  )}
                </div>
                <p className="text-lg font-bold mt-3">{formatPrice(property.price)}</p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
