import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { IndianRupee, TrendingUp, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface Deal {
  id: string;
  deal_value: number;
  probability: number | null;
  stage: string;
  expected_close_date: string | null;
  notes: string | null;
  created_at: string;
  lead?: {
    name: string;
    phone: string;
  };
  property?: {
    title: string;
    location: string;
  };
  project?: {
    name: string;
  };
}

const pipelineStages = [
  { value: 'negotiation', label: 'Negotiation', color: 'bg-amber-500' },
  { value: 'token', label: 'Token Received', color: 'bg-blue-500' },
  { value: 'documentation', label: 'Documentation', color: 'bg-purple-500' },
  { value: 'closed', label: 'Closed Won', color: 'bg-green-500' },
  { value: 'lost', label: 'Lost', color: 'bg-red-500' },
];

export default function Pipeline() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeals();
  }, []);

  async function fetchDeals() {
    const { data, error } = await supabase
      .from('deals')
      .select(`
        *,
        lead:leads(name, phone),
        property:properties(title, location),
        project:projects(name)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDeals(data as Deal[]);
    }
    setLoading(false);
  }

  const formatPrice = (price: number) => {
    if (price >= 10000000) {
      return `₹${(price / 10000000).toFixed(2)} Cr`;
    } else if (price >= 100000) {
      return `₹${(price / 100000).toFixed(2)} L`;
    }
    return `₹${price.toLocaleString()}`;
  };

  const getStageColor = (stage: string) => {
    const found = pipelineStages.find(s => s.value === stage);
    return found?.color || 'bg-muted';
  };

  const getStageLabel = (stage: string) => {
    const found = pipelineStages.find(s => s.value === stage);
    return found?.label || stage;
  };

  // Calculate pipeline metrics
  const totalPipelineValue = deals.reduce((sum, d) => sum + Number(d.deal_value), 0);
  const weightedPipelineValue = deals.reduce((sum, d) => sum + (Number(d.deal_value) * (d.probability || 50) / 100), 0);
  const closedDeals = deals.filter(d => d.stage === 'closed');
  const closedValue = closedDeals.reduce((sum, d) => sum + Number(d.deal_value), 0);
  const avgDealSize = deals.length > 0 ? totalPipelineValue / deals.length : 0;

  // Group deals by stage
  const dealsByStage = pipelineStages.reduce((acc, stage) => {
    acc[stage.value] = deals.filter(d => d.stage === stage.value);
    return acc;
  }, {} as Record<string, Deal[]>);

  return (
    <DashboardLayout title="Sales Pipeline" description="Track deals and revenue forecasting">
      <div className="space-y-6">
        {/* Pipeline Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Pipeline</p>
                  <p className="text-2xl font-bold">{formatPrice(totalPipelineValue)}</p>
                </div>
                <IndianRupee className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Weighted Value</p>
                  <p className="text-2xl font-bold">{formatPrice(weightedPipelineValue)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-info" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Closed Won</p>
                  <p className="text-2xl font-bold">{formatPrice(closedValue)}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Deal Size</p>
                  <p className="text-2xl font-bold">{formatPrice(avgDealSize)}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Board */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-5 w-2/3 rounded bg-muted" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[...Array(2)].map((_, j) => (
                      <div key={j} className="h-24 rounded bg-muted" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {pipelineStages.filter(s => s.value !== 'lost').map((stage) => (
              <Card key={stage.value} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
                      <CardTitle className="text-sm font-medium">{stage.label}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {dealsByStage[stage.value]?.length || 0}
                    </Badge>
                  </div>
                  <p className="text-lg font-bold">
                    {formatPrice(dealsByStage[stage.value]?.reduce((sum, d) => sum + Number(d.deal_value), 0) || 0)}
                  </p>
                </CardHeader>
                <CardContent className="flex-1 space-y-3 overflow-y-auto max-h-[400px]">
                  {dealsByStage[stage.value]?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No deals</p>
                  ) : (
                    dealsByStage[stage.value]?.map((deal) => (
                      <Card key={deal.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <p className="font-medium text-sm truncate">
                                {deal.lead?.name || 'Unknown'}
                              </p>
                              <p className="text-sm font-bold text-nowrap">
                                {formatPrice(Number(deal.deal_value))}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {deal.property?.title || deal.project?.name || 'No property'}
                            </p>
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(parseISO(deal.created_at), { addSuffix: true })}
                              </div>
                              {deal.probability && (
                                <span className="text-muted-foreground">{deal.probability}%</span>
                              )}
                            </div>
                            {deal.probability && (
                              <Progress value={deal.probability} className="h-1" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}