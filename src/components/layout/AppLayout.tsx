import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  Settings,
  LogOut,
  Wrench,
  UserCog,
  Building2,
  Shield,
  User,
  Briefcase,
  Bell,
  Loader2,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import NotificationsBell from '@/components/notifications/NotificationsBell';
import MobileBottomNav from '@/components/layout/MobileBottomNav';

interface AppLayoutProps {
  children: ReactNode;
}

import { BookTemplate, Package } from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['admin', 'technician', 'super_admin'] },
  { icon: Users, label: 'Customers', path: '/customers', roles: ['admin', 'technician'] },
  { icon: Briefcase, label: 'Jobs', path: '/jobs', roles: ['admin', 'technician'] },
  { icon: FileText, label: 'Quotes', path: '/quotes', roles: ['admin', 'technician'] },
  { icon: Receipt, label: 'Invoices', path: '/invoices', roles: ['admin', 'technician', 'customer'] },
  { icon: BarChart3, label: 'Reports', path: '/reports', roles: ['admin', 'manager'] },
  { icon: BookTemplate, label: 'Templates', path: '/templates', roles: ['admin', 'technician'] },
  { icon: Package, label: 'Items', path: '/items', roles: ['admin', 'technician'] },
  { icon: Bell, label: 'Notifications', path: '/notifications', roles: ['admin', 'manager'] },
  { icon: UserCog, label: 'Technicians', path: '/technicians', roles: ['admin', 'technician'] },
  { icon: Building2, label: 'Company', path: '/company', roles: ['admin'] },
  { icon: Shield, label: 'Super Admin', path: '/super-admin', roles: ['super_admin'] },
];

const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, roles, signOut, refreshProfile } = useAuth();
  const { data: company } = useCompany();
  const [isOnLeave, setIsOnLeave] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const displayName = profile?.full_name || profile?.email || 'User';
  const primaryRole = roles[0]?.role || 'user';

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-6 h-6 text-primary" />
          <span className="font-semibold">Service App</span>
        </div>

        <div className="flex items-center gap-1">
          <NotificationsBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="w-8 h-8">
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Sidebar - Desktop only */}
      <aside className="hidden lg:block fixed top-0 left-0 h-full w-64 bg-sidebar text-sidebar-foreground z-50"
      >
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
              <Wrench className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Service App</h1>
              <p className="text-xs text-sidebar-foreground/60">{company?.name || 'No Company'}</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                      : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User section with dropdown */}
          <div className="p-4 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent hover:bg-sidebar-accent/80 transition-colors">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
                      {getInitials(profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium truncate">{displayName}</p>
                    <p className="text-xs text-sidebar-foreground/60 capitalize">{primaryRole}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56 bg-popover">
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
      <main className="lg:ml-64 pt-16 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div className="w-full max-w-7xl mx-auto lg:mx-0 p-3 lg:p-6">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <MobileBottomNav />
    </div>
  );
};

export default AppLayout;
