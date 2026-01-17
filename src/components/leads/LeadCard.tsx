import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Phone, Mail, Calendar, Flame, Thermometer, Snowflake, Home, CalendarPlus, UserCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { PropertyMatchModal } from './PropertyMatchModal';
import { ScheduleVisitDialog } from './ScheduleVisitDialog';
import { QuickCallDialog } from './QuickCallDialog';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  source: string;
  stage: string;
  temperature: string;
  budget_min: number | null;
  budget_max: number | null;
  preferred_location: string | null;
  notes: string | null;
  next_followup_at: string | null;
  created_at: string;
  assigned_to: string | null;
}

interface LeadCardProps {
  lead: Lead;
  profiles: Profile[];
  onUpdate: () => void;
}

const stages = [
  { value: 'new', label: 'New', color: 'stage-new' },
  { value: 'contacted', label: 'Contacted', color: 'stage-contacted' },
  { value: 'site_visit', label: 'Site Visit', color: 'stage-site-visit' },
  { value: 'negotiation', label: 'Negotiation', color: 'stage-negotiation' },
  { value: 'token', label: 'Token', color: 'stage-token' },
  { value: 'closed', label: 'Closed', color: 'stage-closed' },
];

export function LeadCard({ lead, profiles, onUpdate }: LeadCardProps) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [isReassigning, setIsReassigning] = useState(false);
  const [showPropertyMatch, setShowPropertyMatch] = useState(false);
  const [showScheduleVisit, setShowScheduleVisit] = useState(false);
  const [showQuickCall, setShowQuickCall] = useState(false);

  const assignedProfile = profiles.find(p => p.id === lead.assigned_to);
  const isAdminOrManager = role === 'admin' || role === 'sales_manager';

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getTemperatureIcon = (temp: string) => {
    switch (temp) {
      case 'hot':
        return <Flame className="h-4 w-4 text-red-500" />;
      case 'warm':
        return <Thermometer className="h-4 w-4 text-amber-500" />;
      case 'cold':
        return <Snowflake className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getStageBadge = (stage: string) => {
    const stageConfig = stages.find(s => s.value === stage);
    return (
      <Badge variant="outline" className={stageConfig?.color || ''}>
        {stageConfig?.label || stage}
      </Badge>
    );
  };

  const handleReassign = async (newAgentId: string) => {
    setIsReassigning(true);
    const { error } = await supabase
      .from('leads')
      .update({ assigned_to: newAgentId })
      .eq('id', lead.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to reassign lead', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Lead reassigned successfully' });
      onUpdate();
    }
    setIsReassigning(false);
  };

  return (
    <>
      <Card className="hover-lift">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            {/* Lead Avatar */}
            <Avatar className="h-12 w-12 border">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {getInitials(lead.name)}
              </AvatarFallback>
            </Avatar>

            {/* Lead Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold truncate">{lead.name}</h3>
                {getTemperatureIcon(lead.temperature)}
                {getStageBadge(lead.stage)}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {lead.phone}
                </span>
                {lead.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {lead.email}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                </span>
              </div>

              {/* Assigned Agent */}
              {assignedProfile && (
                <div className="flex items-center gap-2 mt-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={assignedProfile.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-secondary">
                      {getInitials(assignedProfile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">
                    Assigned to <span className="font-medium text-foreground">{assignedProfile.full_name}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Right Side Actions */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-1">
                <Badge variant="outline">{lead.source}</Badge>
              </div>
              {lead.preferred_location && (
                <p className="text-xs text-muted-foreground">{lead.preferred_location}</p>
              )}
              
              {/* Action Buttons */}
              <div className="flex items-center gap-1 mt-2">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0"
                  onClick={() => setShowQuickCall(true)}
                  title="Quick Call"
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0"
                  onClick={() => setShowPropertyMatch(true)}
                  title="Match Properties"
                >
                  <Home className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0"
                  onClick={() => setShowScheduleVisit(true)}
                  title="Schedule Visit"
                >
                  <CalendarPlus className="h-4 w-4" />
                </Button>
                
                {/* Reassign Dropdown - Admin/Manager only */}
                {isAdminOrManager && (
                  <Select
                    value={lead.assigned_to || ''}
                    onValueChange={handleReassign}
                    disabled={isReassigning}
                  >
                    <SelectTrigger className="h-8 w-8 p-0 border-0" title="Reassign">
                      <UserCheck className="h-4 w-4" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-xs">
                                {getInitials(profile.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            {profile.full_name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <PropertyMatchModal 
        lead={lead} 
        open={showPropertyMatch} 
        onOpenChange={setShowPropertyMatch}
        onSuccess={onUpdate}
      />
      <ScheduleVisitDialog 
        lead={lead} 
        open={showScheduleVisit} 
        onOpenChange={setShowScheduleVisit}
        onSuccess={onUpdate}
      />
      <QuickCallDialog 
        lead={lead} 
        open={showQuickCall} 
        onOpenChange={setShowQuickCall}
        onSuccess={onUpdate}
      />
    </>
  );
}
