import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TableHead } from '@/components/ui/table';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortDirection = 'asc' | 'desc';

interface SortableTableHeaderProps<T extends string> {
  column: T;
  label: string;
  currentSortColumn: T | null;
  currentSortDirection: SortDirection;
  onSort: (column: T) => void;
  className?: string;
  align?: 'left' | 'right';
}

export function SortableTableHeader<T extends string>({
  column,
  label,
  currentSortColumn,
  currentSortDirection,
  onSort,
  className,
  align = 'left',
}: SortableTableHeaderProps<T>) {
  const isActive = currentSortColumn === column;

  const getSortIcon = () => {
    if (!isActive) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    return currentSortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  return (
    <TableHead className={cn(align === 'right' && 'text-right', className)}>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-8 font-medium',
          align === 'left' ? '-ml-3' : '-mr-3'
        )}
        onClick={() => onSort(column)}
      >
        {label}
        {getSortIcon()}
      </Button>
    </TableHead>
  );
}

// Hook to manage sorting state
export function useSorting<T extends string>(defaultColumn: T, defaultDirection: SortDirection = 'desc') {
  const [sortColumn, setSortColumn] = useState<T | null>(defaultColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);

  const handleSort = (column: T) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  return {
    sortColumn,
    sortDirection,
    handleSort,
    setSortColumn,
    setSortDirection,
  };
}
