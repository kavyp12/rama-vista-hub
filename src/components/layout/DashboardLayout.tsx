import { ReactNode, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, usePermissions } from '@/lib/auth-context';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bell, X, AlertTriangle, Calendar, Users,
  Clock, TrendingDown, UserX, ChevronRight, RefreshCw
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface NotificationItem {
  id: string;
  title: string;
  subtitle: string;
  count: number;
  color: string;
  bg: string;
  icon: React.ElementType;
  href: string;
}

interface AgentStats {
  missedFollowups: number;
  missedVisits: number;
  stagnantLeads: number;
}

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  const { user, token, loading } = useAuth();
  const { isAgent } = usePermissions();
  const navigate = useNavigate();

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (token && user) fetchNotifications();
  }, [token, user]);

  // Poll every 2 minutes
  useEffect(() => {
    if (!token || !user) return;
    const interval = setInterval(fetchNotifications, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token, user]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function fetchNotifications() {
    if (!token || !user) return;
    setFetching(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const items: NotificationItem[] = [];

      if (isAgent) {
        // ---- AGENT: use dedicated stats endpoint ----
        const [statsRes, visitsRes] = await Promise.all([
          fetch(`${API_URL}/leads/dashboard/stats`, { headers }),
          fetch(`${API_URL}/site-visits?status=scheduled`, { headers }),
        ]);

        if (statsRes.ok) {
          const data: AgentStats = await statsRes.json();

          if (data.missedFollowups > 0) {
            items.push({
              id: 'overdue_followup',
              title: 'Overdue Follow-ups',
              subtitle: 'Leads past their follow-up date',
              count: data.missedFollowups,
              color: 'text-red-600',
              bg: 'bg-red-50',
              icon: AlertTriangle,
              href: '/leads',
            });
          }
          if (data.missedVisits > 0) {
            items.push({
              id: 'missed_visit',
              title: 'Missed Site Visits',
              subtitle: 'Scheduled visits that already passed',
              count: data.missedVisits,
              color: 'text-orange-600',
              bg: 'bg-orange-50',
              icon: Calendar,
              href: '/site-visits',
            });
          }
          if (data.stagnantLeads > 0) {
            items.push({
              id: 'stagnant_lead',
              title: 'Inactive Leads',
              subtitle: 'No activity in 7+ days',
              count: data.stagnantLeads,
              color: 'text-amber-600',
              bg: 'bg-amber-50',
              icon: TrendingDown,
              href: '/leads',
            });
          }
        }

        if (visitsRes.ok) {
          const visits = await visitsRes.json();
          if (Array.isArray(visits)) {
            const today = new Date().toISOString().split('T')[0];
            const todayCount = visits.filter((v: any) => v.scheduledAt?.startsWith(today)).length;
            if (todayCount > 0) {
              items.push({
                id: 'today_visit',
                title: "Today's Site Visits",
                subtitle: 'Visits scheduled for today',
                count: todayCount,
                color: 'text-indigo-600',
                bg: 'bg-indigo-50',
                icon: Clock,
                href: '/site-visits',
              });
            }
          }
        }

      } else {
        // ---- ADMIN / MANAGER: fetch leads + visits ----
        const [leadsRes, visitsRes] = await Promise.all([
          fetch(`${API_URL}/leads`, { headers }),
          fetch(`${API_URL}/site-visits?status=scheduled`, { headers }),
        ]);

        const leads = leadsRes.ok ? await leadsRes.json() : [];
        const visits = visitsRes.ok ? await visitsRes.json() : [];

        if (Array.isArray(leads)) {
          const now = new Date();
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const today = now.toISOString().split('T')[0];
          const activeStages = ['new', 'contacted', 'site_visit', 'negotiation', 'token'];

          const unassigned = leads.filter((l: any) => !l.assignedToId);
          if (unassigned.length > 0) {
            items.push({
              id: 'unassigned_lead',
              title: 'Unassigned Leads',
              subtitle: 'Leads with no agent assigned',
              count: unassigned.length,
              color: 'text-rose-600',
              bg: 'bg-rose-50',
              icon: UserX,
              href: '/leads',
            });
          }

          const overdueFollowups = leads.filter((l: any) => {
            if (!l.nextFollowupAt) return false;
            return new Date(l.nextFollowupAt) < now && activeStages.includes(l.stage);
          });
          if (overdueFollowups.length > 0) {
            items.push({
              id: 'overdue_followup',
              title: 'Overdue Follow-ups',
              subtitle: 'Across all agents',
              count: overdueFollowups.length,
              color: 'text-red-600',
              bg: 'bg-red-50',
              icon: AlertTriangle,
              href: '/leads',
            });
          }

          const stagnant = leads.filter((l: any) => {
            if (!activeStages.includes(l.stage)) return false;
            return new Date(l.updatedAt) < sevenDaysAgo;
          });
          if (stagnant.length > 0) {
            items.push({
              id: 'stagnant_lead',
              title: 'Stagnant Leads',
              subtitle: 'No activity in 7+ days',
              count: stagnant.length,
              color: 'text-amber-600',
              bg: 'bg-amber-50',
              icon: TrendingDown,
              href: '/leads',
            });
          }

          const newToday = leads.filter((l: any) => l.createdAt?.startsWith(today));
          if (newToday.length > 0) {
            items.push({
              id: 'new_leads_today',
              title: 'New Leads Today',
              subtitle: 'Leads added today',
              count: newToday.length,
              color: 'text-blue-600',
              bg: 'bg-blue-50',
              icon: Users,
              href: '/leads',
            });
          }
        }

        if (Array.isArray(visits)) {
          const now = new Date();
          const today = now.toISOString().split('T')[0];

          const todayCount = visits.filter((v: any) => v.scheduledAt?.startsWith(today)).length;
          if (todayCount > 0) {
            items.push({
              id: 'today_visit',
              title: "Today's Site Visits",
              subtitle: 'Across all agents',
              count: todayCount,
              color: 'text-indigo-600',
              bg: 'bg-indigo-50',
              icon: Clock,
              href: '/site-visits',
            });
          }

          const missedVisits = visits.filter((v: any) => new Date(v.scheduledAt) < now);
          if (missedVisits.length > 0) {
            items.push({
              id: 'missed_visit',
              title: 'Uncompleted Visits',
              subtitle: 'Past visits still marked as scheduled',
              count: missedVisits.length,
              color: 'text-orange-600',
              bg: 'bg-orange-50',
              icon: Calendar,
              href: '/site-visits',
            });
          }
        }
      }

      // Sort highest count first, critical items first
      const priority: Record<string, number> = {
        unassigned_lead: 0,
        overdue_followup: 1,
        missed_visit: 2,
        stagnant_lead: 3,
        today_visit: 4,
        new_leads_today: 5,
      };
      items.sort((a, b) => (priority[a.id] ?? 9) - (priority[b.id] ?? 9));

      setNotifications(items);
      setTotalCount(items.reduce((sum, n) => sum + n.count, 0));
      setLastFetched(new Date());
    } catch (err) {
      console.error('Notification fetch failed:', err);
    } finally {
      setFetching(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse-soft text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-6">
          <SidebarTrigger className="-ml-2" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {description && (
            <span className="hidden md:inline text-sm text-muted-foreground ml-2">
              — {description}
            </span>
          )}

          {/* ===== NOTIFICATION BELL ===== */}
          <div className="ml-auto relative" ref={dropdownRef}>
            <Button
              variant="ghost"
              size="sm"
              className="relative h-9 w-9 p-0 rounded-full hover:bg-slate-100"
              onClick={() => setNotifOpen(prev => !prev)}
            >
              <Bell
                className={`h-5 w-5 transition-colors ${
                  totalCount > 0 ? 'text-slate-800' : 'text-slate-400'
                }`}
              />
              {totalCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none shadow-sm">
                  {totalCount > 99 ? '99+' : totalCount}
                </span>
              )}
            </Button>

            {/* ===== DROPDOWN PANEL ===== */}
            {notifOpen && (
              <div className="absolute right-0 top-12 w-[370px] bg-white rounded-xl border border-slate-200 shadow-2xl z-[100] overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-slate-600" />
                    <span className="text-sm font-bold text-slate-800">Notifications</span>
                    {totalCount > 0 && (
                      <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                        {totalCount} pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-slate-200 rounded-full"
                      onClick={fetchNotifications}
                      disabled={fetching}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${fetching ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-slate-200 rounded-full"
                      onClick={() => setNotifOpen(false)}
                    >
                      <X className="h-3.5 w-3.5 text-slate-500" />
                    </Button>
                  </div>
                </div>

                {/* Notification List */}
                <div className="max-h-[440px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 gap-3 text-slate-400">
                      <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center">
                        <Bell className="h-7 w-7 text-slate-300" />
                      </div>
                      <p className="font-semibold text-sm text-slate-500">All clear!</p>
                      <p className="text-xs text-slate-400">No pending items right now.</p>
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {notifications.map((notif) => {
                        const Icon = notif.icon;
                        return (
                          <button
                            key={notif.id}
                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 active:bg-slate-100 transition-colors text-left group cursor-pointer"
                            onClick={() => {
                              navigate(notif.href);
                              setNotifOpen(false);
                            }}
                          >
                            {/* Icon */}
                            <div className={`h-10 w-10 rounded-full ${notif.bg} flex items-center justify-center shrink-0`}>
                              <Icon className={`h-5 w-5 ${notif.color}`} />
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-slate-800 leading-tight">{notif.title}</p>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${notif.bg} ${notif.color} shrink-0`}>
                                  {notif.count}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5 leading-snug">{notif.subtitle}</p>
                            </div>

                            {/* Arrow */}
                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 px-4 py-2.5 bg-slate-50 flex items-center justify-between">
                  <p className="text-[10px] text-slate-400">
                    {lastFetched
                      ? `Updated at ${lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Fetching...'}
                  </p>
                  <button
                    className="text-[11px] text-indigo-600 font-semibold hover:underline"
                    onClick={() => {
                      navigate(isAgent ? '/agent-dashboard' : '/dashboard');
                      setNotifOpen(false);
                    }}
                  >
                    Go to Dashboard →
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* ===== END NOTIFICATION BELL ===== */}
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}