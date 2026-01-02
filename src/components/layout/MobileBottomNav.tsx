import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Receipt,
  Users,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const MobileBottomNav = () => {
  const location = useLocation();
  const { roles } = useAuth();
  
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
    { icon: Users, label: 'Customers', path: '/customers' },
  ];

  const isActive = (path: string) => location.pathname === path;
  const isMoreActive = moreNavItems.some(item => location.pathname === item.path);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-40 safe-area-pb">
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
          <DropdownMenuContent align="end" side="top" className="mb-2 w-48">
            {moreNavItems.map((item) => (
              <DropdownMenuItem key={item.path} asChild>
                <Link to={item.path} className="flex items-center gap-2">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
