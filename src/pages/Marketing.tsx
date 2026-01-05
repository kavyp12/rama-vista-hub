import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Megaphone, 
  Mail, 
  MessageSquare, 
  Send,
  Plus,
  Users,
  Eye,
  MousePointer,
  TrendingUp,
  Calendar,
  Play,
  Pause,
  BarChart3
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  target_audience: string | null;
  message_template: string | null;
  scheduled_at: string | null;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  converted_count: number;
  created_at: string;
}

const campaignTypes = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'sms', label: 'SMS', icon: MessageSquare },
  { value: 'whatsapp', label: 'WhatsApp', icon: Send },
];

const campaignStatuses = [
  { value: 'draft', label: 'Draft', color: 'bg-muted text-muted-foreground' },
  { value: 'scheduled', label: 'Scheduled', color: 'bg-info text-info-foreground' },
  { value: 'active', label: 'Active', color: 'bg-success text-success-foreground' },
  { value: 'completed', label: 'Completed', color: 'bg-primary text-primary-foreground' },
  { value: 'paused', label: 'Paused', color: 'bg-warning text-warning-foreground' },
];

export default function Marketing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  
  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState('email');
  const [targetAudience, setTargetAudience] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  useEffect(() => {
    fetchCampaigns();
  }, []);

  async function fetchCampaigns() {
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCampaigns(data as Campaign[]);
    }
    setLoading(false);
  }

  async function handleCreateCampaign() {
    if (!name || !user) return;
    
    setIsSubmitting(true);
    
    const { error } = await supabase.from('marketing_campaigns').insert({
      name,
      type,
      target_audience: targetAudience || null,
      message_template: messageTemplate || null,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      created_by: user.id,
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to create campaign', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Campaign created successfully' });
      resetForm();
      fetchCampaigns();
    }
    
    setIsSubmitting(false);
  }

  function resetForm() {
    setName('');
    setType('email');
    setTargetAudience('');
    setMessageTemplate('');
    setScheduledAt('');
    setIsDialogOpen(false);
  }

  function getTypeIcon(type: string) {
    const found = campaignTypes.find(t => t.value === type);
    if (!found) return <Megaphone className="h-4 w-4" />;
    const Icon = found.icon;
    return <Icon className="h-4 w-4" />;
  }

  function getStatusBadge(status: string) {
    const found = campaignStatuses.find(s => s.value === status);
    if (!found) return <Badge variant="secondary">{status}</Badge>;
    return <Badge className={found.color}>{found.label}</Badge>;
  }

  // Calculate stats
  const totalSent = campaigns.reduce((sum, c) => sum + c.sent_count, 0);
  const totalOpened = campaigns.reduce((sum, c) => sum + c.opened_count, 0);
  const totalClicked = campaigns.reduce((sum, c) => sum + c.clicked_count, 0);
  const totalConverted = campaigns.reduce((sum, c) => sum + c.converted_count, 0);
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const clickRate = totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 100) : 0;

  const filteredCampaigns = activeTab === 'all' 
    ? campaigns 
    : campaigns.filter(c => c.status === activeTab);

  return (
    <DashboardLayout title="Marketing" description="Campaign management and automation">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Sent</p>
                  <p className="text-2xl font-bold">{totalSent.toLocaleString()}</p>
                </div>
                <Send className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Open Rate</p>
                  <p className="text-2xl font-bold">{openRate}%</p>
                </div>
                <Eye className="h-8 w-8 text-info" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Click Rate</p>
                  <p className="text-2xl font-bold">{clickRate}%</p>
                </div>
                <MousePointer className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Conversions</p>
                  <p className="text-2xl font-bold">{totalConverted}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Campaigns List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Campaigns</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create New Campaign</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Campaign Name *</Label>
                    <Input 
                      placeholder="e.g. New Project Launch"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Campaign Type</Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {campaignTypes.map((t) => (
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
                    <Label>Target Audience</Label>
                    <Select value={targetAudience} onValueChange={setTargetAudience}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select audience" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_leads">All Leads</SelectItem>
                        <SelectItem value="hot_leads">Hot Leads</SelectItem>
                        <SelectItem value="warm_leads">Warm Leads</SelectItem>
                        <SelectItem value="new_leads">New Leads</SelectItem>
                        <SelectItem value="contacted">Contacted Leads</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Schedule (Optional)</Label>
                    <Input 
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Message Template</Label>
                    <Textarea 
                      placeholder="Hi {name}, we have exciting news about..."
                      value={messageTemplate}
                      onChange={(e) => setMessageTemplate(e.target.value)}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {'{name}'}, {'{property}'}, {'{project}'} for personalization
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={resetForm}>Cancel</Button>
                  <Button onClick={handleCreateCampaign} disabled={!name || isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Campaign'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="draft">Drafts</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse h-24 rounded-lg bg-muted/30" />
                    ))}
                  </div>
                ) : filteredCampaigns.length === 0 ? (
                  <div className="text-center py-12">
                    <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No campaigns found</p>
                    <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                      Create Your First Campaign
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredCampaigns.map((campaign) => (
                      <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                {getTypeIcon(campaign.type)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold">{campaign.name}</h3>
                                  {getStatusBadge(campaign.status)}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {campaign.target_audience || 'All leads'} • Created {format(parseISO(campaign.created_at), 'MMM d, yyyy')}
                                </p>
                                {campaign.scheduled_at && (
                                  <p className="text-sm text-info mt-1 flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Scheduled: {format(parseISO(campaign.scheduled_at), 'MMM d, yyyy h:mm a')}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-center">
                                <p className="text-lg font-bold">{campaign.sent_count}</p>
                                <p className="text-xs text-muted-foreground">Sent</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold">{campaign.opened_count}</p>
                                <p className="text-xs text-muted-foreground">Opened</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold">{campaign.clicked_count}</p>
                                <p className="text-xs text-muted-foreground">Clicked</p>
                              </div>
                              <div className="flex gap-2">
                                {campaign.status === 'draft' && (
                                  <Button size="sm" className="gap-1">
                                    <Play className="h-3 w-3" />
                                    Launch
                                  </Button>
                                )}
                                {campaign.status === 'active' && (
                                  <Button size="sm" variant="outline" className="gap-1">
                                    <Pause className="h-3 w-3" />
                                    Pause
                                  </Button>
                                )}
                                <Button size="sm" variant="outline">
                                  <BarChart3 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          {campaign.sent_count > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <div className="flex items-center gap-4">
                                <div className="flex-1">
                                  <div className="flex justify-between text-xs mb-1">
                                    <span>Open Rate</span>
                                    <span>{campaign.sent_count > 0 ? Math.round((campaign.opened_count / campaign.sent_count) * 100) : 0}%</span>
                                  </div>
                                  <Progress value={campaign.sent_count > 0 ? (campaign.opened_count / campaign.sent_count) * 100 : 0} className="h-2" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex justify-between text-xs mb-1">
                                    <span>Click Rate</span>
                                    <span>{campaign.opened_count > 0 ? Math.round((campaign.clicked_count / campaign.opened_count) * 100) : 0}%</span>
                                  </div>
                                  <Progress value={campaign.opened_count > 0 ? (campaign.clicked_count / campaign.opened_count) * 100 : 0} className="h-2" />
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
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