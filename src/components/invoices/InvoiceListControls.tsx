import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Filter, Archive } from 'lucide-react';
import { getInvoiceStatusLabel } from '@/hooks/useInvoices';
import { cn } from '@/lib/utils';

const INVOICE_STATUSES = ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'voided'] as const;

interface InvoiceListControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string[];
  onStatusFilterChange: (statuses: string[]) => void;
  showSearch?: boolean;
  showFilters?: boolean;
}

export function InvoiceListControls({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  showSearch = true,
  showFilters = true,
}: InvoiceListControlsProps) {
  const isAllSelected = statusFilter.length === 0 || statusFilter.includes('all');
  const hasActiveFilters = !isAllSelected;

  const toggleStatus = (status: string) => {
    if (status === 'all') {
      onStatusFilterChange(['all']);
      return;
    }
    
    // Remove 'all' if present and toggle the specific status
    let newFilters = statusFilter.filter(s => s !== 'all');
    
    if (newFilters.includes(status)) {
      newFilters = newFilters.filter(s => s !== status);
    } else {
      newFilters = [...newFilters, status];
    }
    
    // If nothing selected, revert to 'all'
    if (newFilters.length === 0) {
      onStatusFilterChange(['all']);
    } else {
      onStatusFilterChange(newFilters);
    }
  };

  const isStatusSelected = (status: string) => {
    if (status === 'all') return isAllSelected;
    return statusFilter.includes(status);
  };

  const getFilterLabel = () => {
    if (isAllSelected) return 'All Status';
    if (statusFilter.length === 1) return getInvoiceStatusLabel(statusFilter[0]);
    return `${statusFilter.length} selected`;
  };

  return (
    <div className="flex items-center gap-2">
      {showSearch && (
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      )}
      {showFilters && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={hasActiveFilters ? 'secondary' : 'outline'} size="sm" className="h-9 gap-1.5">
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">{getFilterLabel()}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover w-48">
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm",
                isAllSelected && "bg-accent"
              )}
              onClick={() => toggleStatus('all')}
            >
              <Checkbox checked={isAllSelected} className="pointer-events-none" />
              <span className="text-sm">All Status</span>
            </div>
            <DropdownMenuSeparator />
            {INVOICE_STATUSES.map(status => (
              <div
                key={status}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm",
                  isStatusSelected(status) && "bg-accent"
                )}
                onClick={() => toggleStatus(status)}
              >
                <Checkbox checked={isStatusSelected(status)} className="pointer-events-none" />
                <span className="text-sm">{getInvoiceStatusLabel(status)}</span>
              </div>
            ))}
            <DropdownMenuSeparator />
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm",
                isStatusSelected('archived') && "bg-accent"
              )}
              onClick={() => toggleStatus('archived')}
            >
              <Checkbox checked={isStatusSelected('archived')} className="pointer-events-none" />
              <Archive className="w-4 h-4" />
              <span className="text-sm">Archived</span>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}