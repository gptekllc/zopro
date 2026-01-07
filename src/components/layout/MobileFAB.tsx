import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, X, Briefcase, FileText, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface FABItem {
  icon: React.ElementType;
  label: string;
  path: string;
  param: string;
}

const MobileFAB = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Only show on mobile and on Jobs, Quotes, Invoices pages
  const relevantPaths = ['/jobs', '/quotes', '/invoices'];
  const isRelevantPage = relevantPaths.some(path => location.pathname.startsWith(path));

  if (!isMobile || !isRelevantPage) return null;

  const fabItems: FABItem[] = [
    { icon: Receipt, label: 'Invoice', path: '/invoices', param: 'create=true' },
    { icon: FileText, label: 'Quote', path: '/quotes', param: 'create=true' },
    { icon: Briefcase, label: 'Job', path: '/jobs', param: 'create=true' },
  ];

  const handleItemClick = (item: FABItem) => {
    setIsOpen(false);
    navigate(`${item.path}?${item.param}`);
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* FAB Container */}
      <div className="fixed right-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-end gap-3 lg:hidden">
        {/* Action Items */}
        {fabItems.map((item, index) => (
          <button
            key={item.path}
            onClick={() => handleItemClick(item)}
            className={cn(
              "flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-full bg-secondary text-secondary-foreground shadow-lg transition-all duration-200",
              isOpen
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4 pointer-events-none"
            )}
            style={{
              transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
            }}
          >
            <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <item.icon className="w-4 h-4 text-primary-foreground" />
            </div>
          </button>
        ))}

        {/* Main FAB Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-transform duration-200 active:scale-95",
            isOpen && "rotate-45"
          )}
          aria-label={isOpen ? "Close menu" : "Create new"}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </>
  );
};

export default MobileFAB;
