import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
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
} from 'lucide-react';

const menuItems = [
  {
    group: 'Overview',
    items: [
      { title: 'Dashboard', icon: LayoutDashboard, url: '/dashboard' },
    ],
  },
  {
    group: 'Sales',
    items: [
      { title: 'Leads', icon: Users, url: '/leads' },
      { title: 'Site Visits', icon: CalendarDays, url: '/site-visits' },
      { title: 'Pipeline', icon: TrendingUp, url: '/pipeline' },
      { title: 'Deals', icon: Handshake, url: '/deals' },
    ],
  },
  {
    group: 'Inventory',
    items: [
      { title: 'Projects', icon: Building2, url: '/projects' },
      { title: 'Properties', icon: Home, url: '/properties' },
    ],
  },
  {
    group: 'Operations',
    items: [
      { title: 'Marketing', icon: Megaphone, url: '/marketing' },
      { title: 'Documents', icon: FileText, url: '/documents' },
      { title: 'Payments', icon: CreditCard, url: '/payments' },
      { title: 'Reports', icon: BarChart3, url: '/reports' },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { user, role, signOut } = useAuth();

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
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.url}
                      className="gap-3 px-3 py-2.5 text-sm font-medium transition-colors"
                    >
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
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
                <SidebarMenuButton className="w-full gap-3 px-3 py-3">
                  <Avatar className="h-8 w-8 border border-sidebar-border">
                    <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-medium">
                      {user?.email ? getInitials(user.email) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col items-start text-left">
                    <span className="text-sm font-medium text-sidebar-foreground truncate max-w-[140px]">
                      {user?.email}
                    </span>
                    <span className="text-xs text-sidebar-muted">{getRoleLabel(role)}</span>
                  </div>
                  <ChevronUp className="h-4 w-4 text-sidebar-muted" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-[--radix-dropdown-menu-trigger-width]">
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
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
