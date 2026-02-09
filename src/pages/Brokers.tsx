import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Handshake, Plus, Search, MapPin, Phone, Mail, Building, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Broker {
  id: string;
  name: string;
  agencyName?: string;
  phone: string;
  email?: string;
  location?: string;
  reraId?: string;
  commissionRate?: number;
  _count?: { leads: number };
}

export default function Brokers() {
  const { token, role } = useAuth();
  const { toast } = useToast();
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '', agencyName: '', phone: '', email: '', location: '', reraId: '', commissionRate: ''
  });

  useEffect(() => {
    if (token) fetchBrokers();
  }, [token]);

  async function fetchBrokers() {
    try {
      const res = await fetch(`${API_URL}/brokers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setBrokers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        commissionRate: formData.commissionRate ? parseFloat(formData.commissionRate) : undefined
      };
      
      const res = await fetch(`${API_URL}/brokers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to create broker');
      
      toast({ title: 'Success', description: 'Broker added successfully' });
      setIsDialogOpen(false);
      setFormData({ name: '', agencyName: '', phone: '', email: '', location: '', reraId: '', commissionRate: '' });
      fetchBrokers();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add broker', variant: 'destructive' });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_URL}/brokers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast({ title: 'Deleted', description: 'Broker removed' });
        setBrokers(prev => prev.filter(b => b.id !== id));
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  }

  const filteredBrokers = brokers.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.phone.includes(searchQuery) ||
    b.agencyName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout title="Channel Partners" description="Manage brokers and agencies">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search brokers..." 
              className="pl-10"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Add Broker</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader><DialogTitle>Add Channel Partner</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Full Name *</Label><Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Agency Name</Label><Input value={formData.agencyName} onChange={e => setFormData({...formData, agencyName: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Phone *</Label><Input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>RERA ID</Label><Input value={formData.reraId} onChange={e => setFormData({...formData, reraId: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Commission (%)</Label><Input type="number" value={formData.commissionRate} onChange={e => setFormData({...formData, commissionRate: e.target.value})} /></div>
                </div>
                <div className="space-y-2"><Label>Location/City</Label><Input value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} /></div>
                <DialogFooter>
                  <Button type="submit">Create Partner</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBrokers.map(broker => (
            <Card key={broker.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                      <Handshake className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{broker.name}</h3>
                      <p className="text-xs text-muted-foreground">{broker.agencyName || 'Independent'}</p>
                    </div>
                  </div>
                  {role === 'admin' && (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600" onClick={() => handleDelete(broker.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="space-y-2 text-sm text-slate-600 mt-4">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" /> {broker.phone}
                  </div>
                  {broker.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" /> {broker.email}
                    </div>
                  )}
                  {broker.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" /> {broker.location}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                   <div className="flex flex-col">
                     <span className="text-[10px] text-muted-foreground uppercase font-bold">Leads</span>
                     <span className="font-bold">{broker._count?.leads || 0}</span>
                   </div>
                   {broker.reraId && <Badge variant="outline" className="text-[10px]">RERA: {broker.reraId}</Badge>}
                   {broker.commissionRate && <Badge variant="secondary" className="text-[10px]">{broker.commissionRate}% Comm.</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}