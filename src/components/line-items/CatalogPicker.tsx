import { useState } from 'react';
import { useActiveCatalogItems, CatalogItem } from '@/hooks/useCatalog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Package, Wrench, BookOpen } from 'lucide-react';
import { formatAmount } from '@/lib/formatAmount';

interface CatalogPickerProps {
  type: 'product' | 'service';
  onSelect: (item: CatalogItem) => void;
}

export const CatalogPicker = ({ type, onSelect }: CatalogPickerProps) => {
  const [open, setOpen] = useState(false);
  const { data: items = [] } = useActiveCatalogItems();

  const filteredItems = items.filter(item => item.type === type);

  if (filteredItems.length === 0) {
    return null;
  }

  const handleSelect = (item: CatalogItem) => {
    onSelect(item);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 text-xs">
          <BookOpen className="w-3 h-3 mr-1" />
          Catalog
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command>
          <CommandInput placeholder={`Search ${type}s...`} />
          <CommandList>
            <CommandEmpty>No {type}s found in catalog.</CommandEmpty>
            <CommandGroup heading={type === 'product' ? 'Products' : 'Services'}>
              {filteredItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.name}
                  onSelect={() => handleSelect(item)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {type === 'product' ? (
                      <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Wrench className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-primary shrink-0 ml-2">
                    ${formatAmount(item.unit_price)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
