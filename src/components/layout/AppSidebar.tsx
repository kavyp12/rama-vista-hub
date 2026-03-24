import { useLocation, Link } from 'react-router-dom';
import { useAuth, usePermissions } from '@/lib/auth-context';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Building2,
  LayoutDashboard,
  Users,
  Home,
  CalendarDays,
  TrendingUp,
  FileText,
  Settings,
  LogOut,
  ChevronUp,
  Megaphone,
  Handshake,
  CreditCard,
  BarChart3,
  Phone,
  UserCog,
  PhoneMissed,
  Gift,
} from 'lucide-react';

interface AppSidebarProps {
  missedCallCount?: number;
}

export function AppSidebar({ missedCallCount = 0 }: AppSidebarProps) {
  const location = useLocation();
  const { user, role, logout } = useAuth();
  const permissions = usePermissions();

  const getMenuItems = () => {
    const baseItems = {
      group: 'Overview',
      items: [
        { title: 'Dashboard', icon: LayoutDashboard, url: '/dashboard', badge: 0 },
      ],
    };

    // ✅ AGENT: "My Leads" instead of Telecalling + Missed Calls with live count
    const agentSalesItems = {
      group: 'My Work',
      items: [
        { title: 'My Leads', icon: Users, url: '/leads', badge: 0 },
        { title: 'Telecalling', icon: Phone, url: '/telecalling', badge: 0 },
        { title: 'Missed Calls', icon: PhoneMissed, url: '/missed-calls', badge: missedCallCount },
        { title: 'Site Visits', icon: CalendarDays, url: '/site-visits', badge: 0 },
        { title: 'Properties', icon: Home, url: '/properties', badge: 0 },
        { title: 'Payments', icon: CreditCard, url: '/payments', badge: 0 },
      ],
    };

    // ✅ MANAGER/ADMIN: Full sales pipeline
    const advancedSalesItems = {
      group: 'Sales',
      items: [
        { title: 'Leads', icon: Users, url: '/leads', badge: 0 },
        { title: 'Telecalling', icon: Phone, url: '/telecalling', badge: 0 },
        { title: 'Site Visits', icon: CalendarDays, url: '/site-visits', badge: 0 },
        { title: 'Pipeline', icon: TrendingUp, url: '/pipeline', badge: 0 },
        { title: 'Payments', icon: CreditCard, url: '/payments', badge: 0 },
      ],
    };

    const inventoryItems = {
      group: 'Inventory',
      items: [
        { title: 'Projects', icon: Building2, url: '/projects', badge: 0 },
        { title: 'Properties', icon: Home, url: '/properties', badge: 0 },
      ],
    };

    const managerOperations = {
      group: 'Operations',
      items: [
        { title: 'Channel Partners', icon: Handshake, url: '/brokers', badge: 0 },
        { title: 'Incentives', icon: Gift, url: '/incentives', badge: 0 },
        { title: 'Reports', icon: BarChart3, url: '/reports', badge: 0 },
      ],
    };

    const adminOperations = {
      group: 'Operations',
      items: [
        { title: 'Team', icon: UserCog, url: '/team', badge: 0 },
        { title: 'Channel Partners', icon: Handshake, url: '/brokers', badge: 0 },
        { title: 'Incentives', icon: Gift, url: '/incentives', badge: 0 },
        { title: 'Marketing', icon: Megaphone, url: '/marketing', badge: 0 },
        { title: 'Documents', icon: FileText, url: '/documents', badge: 0 },
        { title: 'Payments', icon: CreditCard, url: '/payments', badge: 0 },
        { title: 'Reports', icon: BarChart3, url: '/reports', badge: 0 },
      ],
    };

    if (permissions.isAdmin) {
      return [baseItems, advancedSalesItems, inventoryItems, adminOperations];
    } else if (permissions.isManager) {
      return [baseItems, advancedSalesItems, inventoryItems, managerOperations];
    } else {
      // ✅ Return Agent menu with Missed Calls
      return [baseItems, agentSalesItems];
    }
  };

  const menuItems = getMenuItems();

  const getInitials = (email: string) => {
    return email.slice(0, 2).toUpperCase();
  };

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'sales_manager':
        return 'Sales Manager';
      case 'sales_agent':
        return 'Sales Agent';
      default:
        return 'User';
    }
  };

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border px-6 py-5">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-foreground">
            <Building2 className="h-5 w-5 text-sidebar-background" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-sidebar-foreground">Rama Realty</span>
            <span className="text-xs text-sidebar-muted">CRM System</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        {menuItems.map((group) => (
          <SidebarGroup key={group.group}>
            <SidebarGroupLabel className="px-3 text-xs font-medium uppercase tracking-wider text-sidebar-muted">
              {group.group}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isMissedCalls = item.title === 'Missed Calls';
                  const isActive = location.pathname === item.url;
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={`gap-3 px-3 py-2.5 text-sm font-medium transition-colors ${isMissedCalls && item.badge > 0 ? 'text-rose-500 hover:text-rose-600 hover:bg-rose-50/30' : ''}`}
                      >
                        <Link to={item.url} className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <item.icon className={`h-4 w-4 ${isMissedCalls && item.badge > 0 ? 'text-rose-500' : ''}`} />
                            <span>{item.title}</span>
                          </div>
                          {/* Badge for missed calls count */}
                          {item.badge > 0 && (
                            <span className="ml-auto h-5 min-w-[20px] px-1.5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none animate-pulse">
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="w-full gap-3 px-3 py-3 hover:bg-sidebar-accent/50">
                  <Avatar className="h-8 w-8 border border-sidebar-border">
                    <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-medium">
                      {user?.email ? getInitials(user.email) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col items-start text-left overflow-hidden">
                    <span className="text-sm font-medium text-sidebar-foreground truncate w-full">
                      {user?.email}
                    </span>
                    <span className="text-xs text-sidebar-muted">{getRoleLabel(role)}</span>
                  </div>
                  <ChevronUp className="h-4 w-4 text-sidebar-muted" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-[200px]">
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}