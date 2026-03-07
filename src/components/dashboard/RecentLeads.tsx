import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowRight, Phone, Mail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  stage: string;
  temperature: string;
  source: string;
  createdAt: string;
}

export function RecentLeads() {
  const { token } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeads() {
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/leads`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          // API returns sorted correctly, we just need to slice
          setLeads(data.slice(0, 5));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchLeads();
  }, [token]);

  const getTemperatureBadge = (temp: string) => {
    switch (temp) {
      case 'hot':
        return <Badge variant="destructive">Hot</Badge>;
      case 'warm':
        return <Badge className="bg-warning text-warning-foreground">Warm</Badge>;
      case 'cold':
        return <Badge variant="secondary">Cold</Badge>;
      default:
        return <Badge variant="outline">{temp}</Badge>;
    }
  };

  const getStageBadge = (stage: string) => {
    const stageLabels: Record<string, string> = {
      new: 'New',
      contacted: 'Contacted',
      site_visit: 'Site Visit',
      negotiation: 'Negotiation',
      token: 'Token',
      closed: 'Closed',
    };
    return <Badge variant="outline">{stageLabels[stage] || stage}</Badge>;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-muted" />
                  <div className="h-3 w-1/4 rounded bg-muted" />
                </div>
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
          <CardTitle>Recent Leads</CardTitle>
          <CardDescription>Latest leads from all sources</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/leads">
            View all <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {leads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No leads yet</p>
            <Button variant="outline" className="mt-4" asChild>
              <Link to="/leads">Add your first lead</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {leads.map((lead) => (
              <Link
                key={lead.id}
                to={`/leads/${lead.id}`}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Avatar className="h-10 w-10 border">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {getInitials(lead.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{lead.name}</p>
                    {getTemperatureBadge(lead.temperature)}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {lead.phone}
                    </span>
                    {lead.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3" />
                        {lead.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  {getStageBadge(lead.stage)}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
