import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Bed, Bath, Square, ArrowUpRight, Tag, MapPin 
} from 'lucide-react';

interface Property {
  id: string;
  title: string; // e.g., "5 BHK Penthouse"
  propertyType: string;
  location: string;
  city: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  price: number;
  status: string;
}

interface PropertyCardProps {
  property: Property;
}

export function PropertyCard({ property }: PropertyCardProps) {
  
  const formatPrice = (price: number) => {
    if (!price || price <= 1) return 'On Request';
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2).replace(/\.00$/, '')} L`;
    return `₹${price.toLocaleString('en-IN')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'sold': return 'bg-red-500';
      case 'booked': return 'bg-amber-500';
      default: return 'bg-slate-400';
    }
  };

  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-all duration-200 border-slate-200 group relative overflow-hidden bg-white">
      {/* Top Color Strip */}
      <div className={`h-1 w-full ${getStatusColor(property.status)}`} />

      <CardContent className="p-3 flex-1 flex flex-col gap-2">
        {/* Header: Title & Status */}
        <div className="flex justify-between items-start gap-2">
          <h4 className="font-semibold text-sm text-slate-900 line-clamp-2" title={property.title}>
            {property.title}
          </h4>
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 capitalize shrink-0 bg-slate-50">
             {property.status}
          </Badge>
        </div>

        {/* Price */}
        <div>
           <h4 className="text-lg font-bold text-slate-900 tracking-tight">
             {formatPrice(property.price)}
           </h4>
        </div>

        {/* Specs Grid (Compact) */}
        <div className="grid grid-cols-3 gap-1 py-2 border-t border-dashed border-slate-100">
           <div className="flex flex-col items-center justify-center p-1 bg-slate-50 rounded">
              <span className="flex items-center gap-1 text-[10px] text-slate-500"><Bed className="h-3 w-3" /> Beds</span>
              <span className="text-xs font-medium text-slate-900">{property.bedrooms || '-'}</span>
           </div>
           
           <div className="flex flex-col items-center justify-center p-1 bg-slate-50 rounded">
              <span className="flex items-center gap-1 text-[10px] text-slate-500"><Bath className="h-3 w-3" /> Bath</span>
              <span className="text-xs font-medium text-slate-900">{property.bathrooms || '-'}</span>
           </div>

           <div className="flex flex-col items-center justify-center p-1 bg-slate-50 rounded">
              <span className="flex items-center gap-1 text-[10px] text-slate-500"><Square className="h-3 w-3" /> Sqft</span>
              <span className="text-xs font-medium text-slate-900">{property.areaSqft || '-'}</span>
           </div>
        </div>
      </CardContent>

      {/* Footer Actions */}
      <CardFooter className="p-0 border-t bg-slate-50/50 flex divide-x divide-slate-200">
         <button className="flex-1 flex items-center justify-center h-8 text-[11px] font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50">
            <Tag className="h-3 w-3 mr-1.5" /> Details
         </button>
         <button className="flex-1 flex items-center justify-center h-8 text-[11px] font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50">
            <ArrowUpRight className="h-3 w-3 mr-1.5" /> Share
         </button>
      </CardFooter>
    </Card>
  );
}