import { useState } from 'react';
import { useAuth, usePermissions } from '@/lib/auth-context';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Phone, Mail, Flame, Thermometer, Snowflake, 
  Home, CalendarPlus, UserCheck, MapPin, Calendar, Building2, Pencil
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { PropertyMatchModal } from './PropertyMatchModal';
import { ScheduleVisitDialog } from './ScheduleVisitDialog';
import { QuickCallDialog } from './QuickCallDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Lead } from '@/pages/Leads';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Profile {
  id: string;
  fullName: string;
  email: string;
}

interface DisplayProfile {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
}

interface LeadCardProps {
  lead: Lead;
  profiles?: Profile[];
  onUpdate: () => void;
  onEdit?: (lead: Lead) => void; // ✅ NEW PROP
}

export function LeadCard({ lead, profiles = [], onUpdate, onEdit }: LeadCardProps) {
  const { token } = useAuth();
  const { canAssignLeads } = usePermissions();
  const { toast } = useToast();
  const [isReassigning, setIsReassigning] = useState(false);
  const [showPropertyMatch, setShowPropertyMatch] = useState(false);
  const [showScheduleVisit, setShowScheduleVisit] = useState(false);
  const [showQuickCall, setShowQuickCall] = useState(false);

  const assignedId = lead.assignedTo?.id || lead.assignedToId;
  
  let assignedProfile: DisplayProfile | undefined;
  if (lead.assignedTo) {
    assignedProfile = { id: lead.assignedTo.id, fullName: lead.assignedTo.fullName, avatarUrl: lead.assignedTo.avatarUrl };
  } else if (assignedId && profiles.length > 0) {
    const found = profiles.find(p => p.id === assignedId);
    if (found) assignedProfile = { id: found.id, fullName: found.fullName, avatarUrl: null };
  }

  const getInitials = (name: string) => name ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '??';

  const getTemperatureIcon = (temp: string) => {
    switch (temp) {
      case 'hot': return <Flame className="h-3 w-3 text-red-500" />;
      case 'warm': return <Thermometer className="h-3 w-3 text-amber-500" />;
      case 'cold': return <Snowflake className="h-3 w-3 text-blue-500" />;
      default: return null;
    }
  };

  const getStageBadge = (stage: string) => <Badge variant="secondary" className="text-[10px] h-5 px-1.5 capitalize font-normal bg-slate-100 text-slate-700">{stage.replace('_', ' ')}</Badge>;

  const handleReassign = async (newAgentId: string) => {
    setIsReassigning(true);
    try {
      const res = await fetch(`${API_URL}/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ assignedToId: newAgentId })
      });
      if (!res.ok) throw new Error('Failed to reassign');
      toast({ title: 'Success', description: 'Lead reassigned successfully' });
      onUpdate();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to reassign lead', variant: 'destructive' });
    } finally {
      setIsReassigning(false);
    }
  };

  const createdDate = lead.createdAt ? new Date(lead.createdAt) : new Date();
  const nextVisit = lead.siteVisits && lead.siteVisits.length > 0 ? lead.siteVisits[0] : null;
  const visitLocationName = nextVisit?.project?.name || nextVisit?.property?.title || "Site Visit";

  return (
    <>
      <Card className="flex flex-col h-full hover:shadow-lg transition-all duration-200 border-slate-200 group relative overflow-hidden bg-white">
        <div className={`h-1 w-full ${lead.temperature === 'hot' ? 'bg-red-500' : lead.temperature === 'warm' ? 'bg-amber-500' : 'bg-blue-400'}`} />
        
        {/* ✅ EDIT BUTTON ABSOLUTE POSITIONED */}
        {onEdit && (
            <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); onEdit(lead); }}
            >
                <Pencil className="h-3 w-3 text-slate-400 hover:text-blue-600" />
            </Button>
        )}
        
        <CardContent className="p-4 flex-1 flex flex-col gap-3">
          <div className="flex justify-between items-start gap-3">
            <Avatar className="h-10 w-10 border bg-slate-50">
              <AvatarFallback className="text-xs font-bold text-slate-600">{getInitials(lead.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm truncate text-slate-900 pr-4" title={lead.name}>{lead.name}</h3>
                {getTemperatureIcon(lead.temperature)}
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                 {lead.source} • {!isNaN(createdDate.getTime()) ? formatDistanceToNow(createdDate) : 'New'}
              </p>
            </div>
          </div>

          <div className="grid gap-1.5 py-1 border-t border-b border-slate-50 my-1">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Phone className="h-3 w-3 text-slate-400 shrink-0" /><span className="truncate">{lead.phone}</span>
            </div>
            {lead.email && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Mail className="h-3 w-3 text-slate-400 shrink-0" /><span className="truncate">{lead.email}</span>
              </div>
            )}
             {lead.preferredLocation && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <MapPin className="h-3 w-3 text-slate-400 shrink-0" /><span className="truncate">{lead.preferredLocation}</span>
              </div>
            )}
          </div>
          
          {nextVisit && (
            <div className="bg-blue-50 rounded-md p-2 mt-1 border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-3 w-3 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">{format(new Date(nextVisit.scheduledAt), 'MMM d, h:mm a')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-3 w-3 text-blue-500" />
                <span className="text-xs text-blue-600 truncate font-medium" title={visitLocationName}>{visitLocationName}</span>
              </div>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between pt-1">
            {getStageBadge(lead.stage)}
            <div className="flex items-center">
              {canAssignLeads ? (
                 <Select value={assignedId || ''} onValueChange={handleReassign} disabled={isReassigning}>
                  <SelectTrigger className="h-6 w-auto border-0 p-0 text-xs bg-transparent focus:ring-0 gap-1 text-muted-foreground hover:text-foreground shadow-none">
                    {assignedProfile ? (
                       <div className="flex items-center gap-1">
                         <Avatar className="h-5 w-5 border border-slate-200">
                           <AvatarImage src={assignedProfile.avatarUrl || undefined} />
                           <AvatarFallback className="text-[9px] bg-white">{getInitials(assignedProfile.fullName)}</AvatarFallback>
                         </Avatar>
                         <span className="max-w-[80px] truncate">{assignedProfile.fullName.split(' ')[0]}</span>
                       </div>
                    ) : (
                      <div className="flex items-center gap-1 text-muted-foreground"><UserCheck className="h-4 w-4" /><span>Assign</span></div>
                    )}
                  </SelectTrigger>
                  <SelectContent align="end">{profiles.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.fullName}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                assignedProfile && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex items-center gap-1">
                          <Avatar className="h-5 w-5 cursor-help border border-slate-200">
                            <AvatarImage src={assignedProfile.avatarUrl || undefined} />
                            <AvatarFallback className="text-[9px] bg-white">{getInitials(assignedProfile.fullName)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground max-w-[80px] truncate">{assignedProfile.fullName.split(' ')[0]}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent><p>Assigned to {assignedProfile.fullName}</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="p-0 border-t bg-slate-50/50 grid grid-cols-3 divide-x divide-slate-200">
           <Button variant="ghost" className="h-9 rounded-none text-slate-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => setShowQuickCall(true)}>
             <Phone className="h-3.5 w-3.5" />
           </Button>
           <Button variant="ghost" className="h-9 rounded-none text-slate-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => setShowPropertyMatch(true)}>
             <Home className="h-3.5 w-3.5" />
           </Button>
           <Button variant="ghost" className="h-9 rounded-none text-slate-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => setShowScheduleVisit(true)}>
             <CalendarPlus className="h-3.5 w-3.5" />
           </Button>
        </CardFooter>
      </Card>
      <PropertyMatchModal lead={lead} open={showPropertyMatch} onOpenChange={setShowPropertyMatch} onSuccess={onUpdate} />
      <ScheduleVisitDialog lead={lead} open={showScheduleVisit} onOpenChange={setShowScheduleVisit} onSuccess={onUpdate} />
      <QuickCallDialog lead={lead} open={showQuickCall} onOpenChange={setShowQuickCall} onSuccess={onUpdate} />
    </>
  );
}