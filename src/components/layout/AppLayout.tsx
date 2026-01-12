import { ReactNode, useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { useLastVisitedPage } from '@/hooks/useLastVisitedPage';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  LogOut,
  UserCog,
  Building2,
  Shield,
  User,
  Briefcase,
  Bell,
  Loader2,
  BarChart3,
  ArrowRightLeft,
  PanelLeftClose,
  PanelLeft,
  HelpCircle,
} from 'lucide-react';
import zoproLogo from '@/assets/zopro-logo.png';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import NotificationsBell from '@/components/notifications/NotificationsBell';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import MobileFAB from '@/components/layout/MobileFAB';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AppLayoutProps {
  children: ReactNode;
  /**
   * Controls the maximum width of the page content area (inside the sidebar layout).
   * - contained: centered content with a max width
   * - full: content spans the available width
   */
  contentWidth?: 'contained' | 'full';
}

import { Package, Clock } from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['admin', 'technician', 'super_admin'] },
  { icon: Users, label: 'Customers', path: '/customers', roles: ['admin', 'technician'] },
  { icon: Briefcase, label: 'Jobs', path: '/jobs', roles: ['admin', 'technician'] },
  { icon: FileText, label: 'Quotes', path: '/quotes', roles: ['admin', 'technician'] },
  { icon: Receipt, label: 'Invoices', path: '/invoices', roles: ['admin', 'technician', 'customer'] },
  { icon: BarChart3, label: 'Reports', path: '/reports', roles: ['admin', 'manager'] },
  { icon: Package, label: 'Items', path: '/items', roles: ['admin', 'technician'] },
  { icon: Clock, label: 'Time Clock', path: '/timeclock', roles: ['admin', 'technician'] },
  { icon: Bell, label: 'Notifications', path: '/notifications', roles: ['admin', 'manager'] },
  { icon: UserCog, label: 'Technicians', path: '/technicians', roles: ['admin', 'technician'] },
  { icon: Building2, label: 'Company', path: '/company', roles: ['admin'] },
  { icon: Shield, label: 'Super Admin', path: '/super-admin', roles: ['super_admin'] },
];

const AppLayout = ({ children, contentWidth = 'contained' }: AppLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, roles, signOut, refreshProfile } = useAuth();
  const { data: company } = useCompany();
  const unreadNotifications = useUnreadNotifications();
  const [isOnLeave, setIsOnLeave] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    return stored === 'true';
  });

  // Track last visited page for "return to last page" feature
  useLastVisitedPage(!!user);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (profile?.employment_status) {
      setIsOnLeave(profile.employment_status === 'on_leave');
    }
  }, [profile?.employment_status]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleOnLeaveToggle = async (checked: boolean) => {
    if (!user || !profile) return;

    setIsUpdatingStatus(true);
    try {
      const newStatus = checked ? 'on_leave' : 'active';
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ employment_status: newStatus })
        .eq('id', user.id);

      if (error) throw error;

      // If going on leave, notify managers in the same company
      if (checked && profile.company_id) {
        const { data: managers } = await (supabase as any)
          .from('profiles')
          .select('id, full_name, email')
          .eq('company_id', profile.company_id)
          .in('role', ['admin', 'manager'])
          .neq('id', user.id);

        if (managers && managers.length > 0) {
          const notifications = managers.map((manager: any) => ({
            user_id: manager.id,
            type: 'member_on_leave',
            title: 'Team Member On Leave',
            message: `${profile.full_name || profile.email} has set themselves as on leave.`,
            data: {
              member_id: user.id,
              member_name: profile.full_name,
              member_email: profile.email,
            },
          }));

          await (supabase as any)
            .from('notifications')
            .insert(notifications);
        }
      }

      setIsOnLeave(checked);
      await refreshProfile();
      toast.success(checked ? 'You are now marked as on leave' : 'You are now marked as active');
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status: ' + error.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const userRoles = roles.map(r => r.role);
  const filteredNavItems = navItems.filter(item => 
    item.roles.some(role => userRoles.includes(role as any)) || userRoles.length === 0
  );

  // Company portal access (based on roles)
  const hasCompanyRole = userRoles.some(role => ['admin', 'technician', 'manager'].includes(role));

  // Customer portal access is determined by whether this authenticated email exists in customers.
  const [hasCustomerPortalAccess, setHasCustomerPortalAccess] = useState(false);
  const [isCheckingCustomerPortalAccess, setIsCheckingCustomerPortalAccess] = useState(false);

  const checkCustomerPortalAccess = useCallback(async () => {
    if (!user || !hasCompanyRole) {
      setHasCustomerPortalAccess(false);
      return;
    }

    setIsCheckingCustomerPortalAccess(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: { action: 'check-auth-user-access' },
      });

      if (error) throw error;
      setHasCustomerPortalAccess(!!data?.hasCustomer);
    } catch {
      setHasCustomerPortalAccess(false);
    } finally {
      setIsCheckingCustomerPortalAccess(false);
    }
  }, [user, hasCompanyRole]);

  useEffect(() => {
    checkCustomerPortalAccess();
  }, [checkCustomerPortalAccess]);

  const canSwitchPortals = hasCompanyRole && hasCustomerPortalAccess;

  const handleSwitchToCustomerPortal = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: { action: 'create-link-for-auth-user' },
      });

      if (error) throw error;
      if (!data?.url) {
        toast.error('No customer portal access found for this account.');
        return;
      }

      // Go through the magic link URL so the portal can authenticate immediately.
      window.location.href = data.url;
    } catch (e: any) {
      toast.error(e?.message || 'Unable to open customer portal');
    }
  };

  const handleSwitchToCompanyPortal = () => {
    navigate('/dashboard');
  };

  const isInCustomerPortal = location.pathname.startsWith('/customer-portal');

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const displayName = profile?.full_name || profile?.email || 'User';
  const primaryRole = roles[0]?.role || 'user';

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header with safe area */}
      <header 
        className="lg:hidden fixed left-0 right-0 bg-card border-b z-50 px-4"
        style={{ 
          paddingTop: 'var(--safe-area-top)',
        }}
      >
        <div className="h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={zoproLogo} alt="ZoPro Logo" className="w-8 h-8 object-contain" />
            <div className="flex flex-col">
              <span className="font-semibold leading-tight">ZoPro</span>
              {company?.name && (
                <span className="text-xs text-muted-foreground leading-tight line-clamp-2 max-w-[160px]">
                  {company.name}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <NotificationsBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'User'} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getInitials(profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-sm">On Leave</span>
                  <div className="flex items-center gap-1">
                    {isUpdatingStatus && <Loader2 className="w-3 h-3 animate-spin" />}
                    <Switch
                      checked={isOnLeave}
                      onCheckedChange={handleOnLeaveToggle}
                      disabled={isUpdatingStatus}
                    />
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="w-4 h-4 mr-2" /> Edit Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/security-settings')}>
                  <Shield className="w-4 h-4 mr-2" /> Security
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="https://zopro.app/contact" target="_blank" rel="noopener noreferrer">
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Software Support
                  </a>
                </DropdownMenuItem>
                {canSwitchPortals && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={isCheckingCustomerPortalAccess}
                      onClick={isInCustomerPortal ? handleSwitchToCompanyPortal : handleSwitchToCustomerPortal}
                    >
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                      {isInCustomerPortal ? 'Switch to Company Portal' : 'Switch to Customer Portal'}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Sidebar - Desktop only */}
      <aside 
        className={cn(
          "hidden lg:block fixed top-0 left-0 h-full bg-sidebar text-sidebar-foreground z-50 transition-all duration-300",
          sidebarCollapsed ? "w-[72px]" : "w-64"
        )}
      >
        <div className="flex flex-col h-full relative">
          {/* Floating toggle button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleSidebar}
                className="absolute top-4 -right-3 z-10 h-6 w-6 rounded-full border bg-background shadow-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {sidebarCollapsed ? (
                  <PanelLeft className="w-3 h-3" />
                ) : (
                  <PanelLeftClose className="w-3 h-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </TooltipContent>
          </Tooltip>

          {/* Sidebar header */}
          <div className={cn(
            "flex items-center gap-3 shrink-0",
            sidebarCollapsed ? "p-3 justify-center" : "p-6"
          )}>
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0">
              <img src={zoproLogo} alt="ZoPro Logo" className="w-8 h-8 object-contain" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <h1 className="font-bold text-lg">ZoPro</h1>
                <p className="text-xs text-sidebar-foreground/60 line-clamp-2">{company?.name || 'No Company'}</p>
              </div>
            )}
          </div>

          {/* Navigation - scrollable */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              const showBadge = item.path === '/notifications' && unreadNotifications > 0;
              
              const linkContent = (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                    sidebarCollapsed && "justify-center px-2",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                      : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground"
                  )}
                >
                  <div className="relative shrink-0">
                    <item.icon className="w-5 h-5" />
                    {showBadge && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center font-medium">
                        {unreadNotifications > 9 ? '9+' : unreadNotifications}
                      </span>
                    )}
                  </div>
                  {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
                </Link>
              );

              if (sidebarCollapsed) {
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return linkContent;
            })}
          </nav>

          {/* User section with dropdown - always visible */}
          <div className="p-3 border-t border-sidebar-border shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent hover:bg-sidebar-accent/80 transition-colors",
                  sidebarCollapsed && "justify-center p-2"
                )}>
                  <Avatar className={cn("shrink-0", sidebarCollapsed ? "w-8 h-8" : "w-10 h-10")}>
                    <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'User'} />
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
                      {getInitials(profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  {!sidebarCollapsed && (
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-medium truncate">{displayName}</p>
                      <p className="text-xs text-sidebar-foreground/60 capitalize">{primaryRole}</p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align={sidebarCollapsed ? "center" : "start"} className="w-56 bg-popover">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-sm">On Leave</span>
                  <div className="flex items-center gap-1">
                    {isUpdatingStatus && <Loader2 className="w-3 h-3 animate-spin" />}
                    <Switch
                      checked={isOnLeave}
                      onCheckedChange={handleOnLeaveToggle}
                      disabled={isUpdatingStatus}
                    />
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="w-4 h-4 mr-2" />
                  Edit Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/security-settings')}>
                  <Shield className="w-4 h-4 mr-2" />
                  Security
                </DropdownMenuItem>
                {canSwitchPortals && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={isCheckingCustomerPortalAccess}
                      onClick={isInCustomerPortal ? handleSwitchToCompanyPortal : handleSwitchToCustomerPortal}
                    >
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                      {isInCustomerPortal ? 'Switch to Company Portal' : 'Switch to Customer Portal'}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem asChild>
                  <a href="https://zopro.app/contact" target="_blank" rel="noopener noreferrer">
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Software Support
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main 
        className={cn(
          "lg:pt-0 pb-20 lg:pb-0 min-h-screen transition-all duration-300",
          sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-64"
        )}
        style={{ 
          paddingTop: 'calc(var(--safe-area-top) + 4rem)' // 4rem = h-16 header on mobile
        }}
      >
        <div
          className={cn(
            'w-full p-3 lg:py-6 lg:px-6',
            contentWidth === 'contained' && 'mx-auto max-w-7xl'
          )}
        >
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <MobileBottomNav />
      
      {/* Mobile FAB for quick create */}
      <MobileFAB />
    </div>
  );
};

export default AppLayout;
