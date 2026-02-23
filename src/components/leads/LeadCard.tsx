import { useState } from 'react';
import { useAuth, usePermissions } from '@/lib/auth-context';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { 
  Phone, Flame, Thermometer, Snowflake, 
  Home, CalendarPlus, UserCheck, MapPin, Calendar, Building2, Pencil, Wallet, FileText,
  CheckCircle2, MessageCircle, Pin, PinOff
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { PropertyMatchModal } from './PropertyMatchModal';
import { ScheduleVisitDialog } from './ScheduleVisitDialog';
import { QuickCallDialog } from './QuickCallDialog';

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

export function LeadCard({ lead, profiles = [], onUpdate, onEdit }: any) {
  const { token } = useAuth();
  const { canAssignLeads } = usePermissions();
  const { toast } = useToast();
  
  const [isReassigning, setIsReassigning] = useState(false);
  const [showPropertyMatch, setShowPropertyMatch] = useState(false);
  const [showScheduleVisit, setShowScheduleVisit] = useState(false);
  const [showQuickCall, setShowQuickCall] = useState(false);
  
  const [isLostReasonOpen, setIsLostReasonOpen] = useState(false);
  const [lostReasonInput, setLostReasonInput] = useState('');

  const assignedId = lead.assignedTo?.id || lead.assignedToId;
  
  let assignedProfile: DisplayProfile | undefined;
  if (lead.assignedTo) {
    assignedProfile = { id: lead.assignedTo.id, fullName: lead.assignedTo.fullName, avatarUrl: lead.assignedTo.avatarUrl };
  } else if (assignedId && profiles.length > 0) {
    const found = profiles.find((p:any) => p.id === assignedId);
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

  const formatBudget = (val: number) => {
    if (val >= 10000000) return `${(val / 10000000).toFixed(1)} Cr`;
    if (val >= 100000) return `${(val / 100000).toFixed(1)} L`;
    return `${(val / 1000).toFixed(0)} K`;
  };

  const budgetDisplay = () => {
    if (lead.budgetMin && lead.budgetMax) return `${formatBudget(lead.budgetMin)} - ${formatBudget(lead.budgetMax)}`;
    if (lead.budgetMin) return `Min ${formatBudget(lead.budgetMin)}`;
    if (lead.budgetMax) return `Max ${formatBudget(lead.budgetMax)}`;
    return 'Budget unset';
  };

  const handlePriorityToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
        await fetch(`${API_URL}/leads/${lead.id}/priority`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        onUpdate();
    } catch (e) { toast({ title: "Failed", variant: "destructive" }); }
  };

  const handleStageChange = async (newStage: string) => {
    if (newStage === 'lost') {
        setIsLostReasonOpen(true);
        return;
    }
    updateStage(newStage);
  };

  const updateStage = async (stage: string, reason?: string) => {
    try {
      const res = await fetch(`${API_URL}/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ stage, lostReason: reason })
      });
      if (!res.ok) throw new Error('Failed to update stage');
      
      toast({ title: 'Updated', description: `Stage changed to ${stage}` });
      setIsLostReasonOpen(false);
      onUpdate();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update stage', variant: 'destructive' });
    }
  };

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

  const openWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanPhone = lead.phone.replace(/\D/g, ''); 
    window.open(`https://wa.me/${cleanPhone}?text=Hello ${lead.name}, I am contacting you regarding your property inquiry.`, '_blank');
  };

  const createdDate = lead.createdAt ? new Date(lead.createdAt) : new Date();
  const daysOld = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 3600 * 24));
  const nextVisit = lead.siteVisits && lead.siteVisits.length > 0 ? lead.siteVisits[0] : null;
  const visitLocationName = nextVisit?.project?.name || nextVisit?.property?.title || "Site Visit";
  
  // Get last call log
  const lastCall = lead.callLogs && lead.callLogs.length > 0 ? lead.callLogs[0] : null;

  return (
    <>
      <Card className={`flex flex-col h-full hover:shadow-lg transition-all duration-200 border-slate-200 group relative overflow-hidden bg-white ${lead.isPriority ? 'bg-amber-50/20' : ''}`}>
        <div className={`h-1 w-full ${lead.temperature === 'hot' ? 'bg-red-500' : lead.temperature === 'warm' ? 'bg-amber-500' : 'bg-blue-400'}`} />
        
        {/* Priority Pin */}
        <button onClick={handlePriorityToggle} className="absolute top-2 right-8 p-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            {lead.isPriority ? <Pin className="h-4 w-4 text-amber-600 fill-amber-100" /> : <PinOff className="h-4 w-4 text-slate-300 hover:text-slate-500" />}
        </button>

        {onEdit && (
            <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
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
                {lead.isPriority && <Pin className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                 <Badge variant="outline" className="text-[9px] h-4 px-1">{daysOld}d old</Badge>
                 <span>• {lead.source}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-1.5 py-2 border-t border-slate-100 my-1">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <Wallet className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  <span>{budgetDisplay()}</span>
                </div>
             </div>

             {lead.preferredLocation && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="truncate" title={lead.preferredLocation}>{lead.preferredLocation}</span>
              </div>
            )}

            {lastCall && (
                <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100">
                    {lastCall.callStatus === 'connected_positive' ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Phone className="h-3 w-3 text-blue-500" />}
                    <span className="truncate">Last call: {lastCall.callStatus.replace('_', ' ')}</span>
                </div>
             )}
          </div>

          {lead.notes && (
             <div className="bg-amber-50 rounded-md p-2 border border-amber-100">
               <div className="flex items-start gap-2">
                 <FileText className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
                 <p className="text-[10px] text-amber-800 line-clamp-2 leading-tight" title={lead.notes}>
                   {lead.notes}
                 </p>
               </div>
             </div>
          )}
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Phone className="h-3 w-3 shrink-0" />{lead.phone}
            </div>
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

          <div className="mt-auto flex items-center justify-between pt-2 border-t border-slate-50 relative">
            
            {/* Lost Reason Popover */}
            <Popover open={isLostReasonOpen} onOpenChange={setIsLostReasonOpen}>
                <PopoverTrigger asChild><div className="absolute top-0 left-0 w-0 h-0" /></PopoverTrigger>
                <PopoverContent className="w-64 p-3 z-50 mb-8" side="top">
                    <h4 className="font-medium text-sm mb-2">Why was this lead lost?</h4>
                    <Input 
                        placeholder="Reason (e.g. Budget issue)" 
                        value={lostReasonInput} 
                        onChange={(e) => setLostReasonInput(e.target.value)} 
                        className="h-8 text-xs mb-2"
                    />
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="w-full h-8" onClick={() => { setIsLostReasonOpen(false); }}>Cancel</Button>
                        <Button size="sm" className="w-full h-8" onClick={() => updateStage('lost', lostReasonInput)}>Confirm</Button>
                    </div>
                </PopoverContent>
            </Popover>

            <div onClick={(e) => e.stopPropagation()}>
              <Select value={lead.stage} onValueChange={handleStageChange}>
                <SelectTrigger className="h-6 w-auto border-0 p-0 text-[10px] font-medium bg-transparent shadow-none gap-1 focus:ring-0">
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 capitalize font-normal bg-slate-100 text-slate-700 hover:bg-slate-200">
                    {lead.stage.replace('_', ' ')}
                  </Badge>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="site_visit">Site Visit</SelectItem>
                    <SelectItem value="negotiation">Negotiation</SelectItem>
                    <SelectItem value="token">Token</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="closed" className="text-red-600">Closed</SelectItem>
                    <SelectItem value="lost" className="text-slate-500">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
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
                       </div>
                    ) : (
                      <div className="flex items-center gap-1 text-muted-foreground"><UserCheck className="h-4 w-4" /><span>Assign</span></div>
                    )}
                  </SelectTrigger>
                  <SelectContent align="end">{profiles.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.fullName}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                assignedProfile && (
                  <div className="flex items-center gap-1">
                     <span className="text-[10px] text-muted-foreground mr-1">Owner:</span>
                     <Avatar className="h-5 w-5 border border-slate-200">
                        <AvatarFallback className="text-[9px] bg-slate-100 text-slate-600">{getInitials(assignedProfile.fullName)}</AvatarFallback>
                     </Avatar>
                  </div>
                )
              )}
            </div>
          </div>
        </CardContent>

        {/* 4-Grid Footer */}
        <CardFooter className="p-0 border-t bg-slate-50/50 grid grid-cols-4 divide-x divide-slate-200">
           <Button variant="ghost" className="h-9 rounded-none text-slate-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => setShowQuickCall(true)}>
             <Phone className="h-3.5 w-3.5" />
           </Button>
           <Button variant="ghost" className="h-9 rounded-none text-slate-500 hover:text-green-600 hover:bg-green-50" onClick={openWhatsApp}>
             <MessageCircle className="h-3.5 w-3.5" />
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