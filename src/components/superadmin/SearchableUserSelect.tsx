import { useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company_id: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface SearchableUserSelectProps {
  profiles: Profile[];
  companies: Company[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  valueType?: 'id' | 'email';
}

export function SearchableUserSelect({
  profiles,
  companies,
  value,
  onValueChange,
  placeholder = "Select user",
  valueType = 'id',
}: SearchableUserSelectProps) {
  const [open, setOpen] = useState(false);

  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return 'No company';
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Unknown company';
  };

  const selectedProfile = profiles.find(p => 
    valueType === 'id' ? p.id === value : p.email === value
  );

  const getDisplayValue = () => {
    if (!selectedProfile) return placeholder;
    return selectedProfile.full_name || selectedProfile.email;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{getDisplayValue()}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name, email, or company..." />
          <CommandList>
            <CommandEmpty>No user found.</CommandEmpty>
            <CommandGroup>
              {profiles.map((profile) => {
                const companyName = getCompanyName(profile.company_id);
                const currentValue = valueType === 'id' ? profile.id : profile.email;
                const isSelected = value === currentValue;
                
                return (
                  <CommandItem
                    key={profile.id}
                    value={`${profile.full_name || ''} ${profile.email} ${companyName}`}
                    onSelect={() => {
                      onValueChange(currentValue);
                      setOpen(false);
                    }}
                    className="flex flex-col items-start py-3"
                  >
                    <div className="flex w-full items-center gap-2">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {profile.full_name || 'No name'}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {profile.email}
                        </div>
                        <div className="text-xs text-muted-foreground/70 truncate">
                          {companyName}
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
