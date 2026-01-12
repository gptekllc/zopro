import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Receipt,
  Users,
  MoreHorizontal,
  UserCog,
  Building2,
  Bell,
  Package,
  BarChart3,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const MobileBottomNav = () => {
  const location = useLocation();
  const { roles, isSuperAdmin } = useAuth();
  
  const userRoles = roles.map(r => r.role);
  const isAdmin = userRoles.includes('admin');
  const isTechnician = userRoles.includes('technician');
  const hasAccess = isAdmin || isTechnician || userRoles.length === 0;

  if (!hasAccess) return null;

  const mainNavItems = [
    { icon: LayoutDashboard, label: 'Home', path: '/dashboard' },
    { icon: Briefcase, label: 'Jobs', path: '/jobs' },
    { icon: FileText, label: 'Quotes', path: '/quotes' },
    { icon: Receipt, label: 'Invoices', path: '/invoices' },
  ];

  const moreNavItems = [
    { icon: Users, label: 'Customers', path: '/customers', showFor: 'all' },
    { icon: Package, label: 'Items', path: '/items', showFor: 'all' },
    { icon: Clock, label: 'Time Clock', path: '/timeclock', showFor: 'all' },
    { icon: BarChart3, label: 'Reports', path: '/reports', showFor: 'admin' },
    { icon: Bell, label: 'Notifications', path: '/notifications', showFor: 'admin' },
    { icon: UserCog, label: 'Technicians', path: '/technicians', showFor: 'admin' },
    { icon: Building2, label: 'Company', path: '/company', showFor: 'admin' },
    { icon: ShieldAlert, label: 'Super Admin', path: '/super-admin', showFor: 'super_admin' },
  ];

  const filteredMoreItems = moreNavItems.filter(item => 
    item.showFor === 'all' || 
    (item.showFor === 'admin' && isAdmin) ||
    (item.showFor === 'super_admin' && isSuperAdmin)
  );

  const isActive = (path: string) => location.pathname === path;
  const isMoreActive = filteredMoreItems.some(item => location.pathname === item.path);

  return (
    <nav 
      className="lg:hidden fixed left-0 right-0 bg-card border-t z-[60]"
      style={{ 
        bottom: 0,
        paddingBottom: 'max(0.25rem, calc(var(--safe-area-bottom) * 0.5))'
      }}
    >
      <div className="flex items-center justify-around h-16">
        {mainNavItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
              isActive(item.path)
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                isMoreActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-xs font-medium">More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="mb-2 w-56 p-2">
            {filteredMoreItems.map((item, index) => (
              <div key={item.path}>
                {index === 1 && isAdmin && <DropdownMenuSeparator className="my-2" />}
                {index === 4 && <DropdownMenuSeparator className="my-2" />}
                <DropdownMenuItem asChild className="py-3 px-3 min-h-[44px]">
                  <Link to={item.path} className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" />
                    <span className="text-base">{item.label}</span>
                  </Link>
                </DropdownMenuItem>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
