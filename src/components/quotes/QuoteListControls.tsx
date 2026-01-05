import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Search, Filter, Archive } from 'lucide-react';

interface QuoteListControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  showSearch?: boolean;
  showFilters?: boolean;
}

export function QuoteListControls({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  showSearch = true,
  showFilters = true,
}: QuoteListControlsProps) {
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
            <Button variant={statusFilter !== 'all' ? 'secondary' : 'outline'} size="icon" className="h-9 w-9">
              <Filter className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem onClick={() => onStatusFilterChange('all')} className={statusFilter === 'all' ? 'bg-accent' : ''}>
              All Status
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusFilterChange('draft')} className={statusFilter === 'draft' ? 'bg-accent' : ''}>
              Draft
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusFilterChange('sent')} className={statusFilter === 'sent' ? 'bg-accent' : ''}>
              Sent
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusFilterChange('approved')} className={statusFilter === 'approved' ? 'bg-accent' : ''}>
              Approved
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusFilterChange('rejected')} className={statusFilter === 'rejected' ? 'bg-accent' : ''}>
              Rejected
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onStatusFilterChange('archived')} className={statusFilter === 'archived' ? 'bg-accent' : ''}>
              <Archive className="w-4 h-4 mr-2" />
              Archived
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
