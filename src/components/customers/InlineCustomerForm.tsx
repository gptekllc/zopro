import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { UserPlus, X, Check, ChevronsUpDown, Search } from 'lucide-react';
import { useCreateCustomer, Customer } from '@/hooks/useCustomers';
import { cn } from '@/lib/utils';

interface InlineCustomerFormProps {
  customers: Customer[];
  selectedCustomerId: string;
  onCustomerSelect: (customerId: string) => void;
  onNewCustomerCreated?: (customerId: string) => void;
}

interface NewCustomerData {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export function InlineCustomerForm({
  customers,
  selectedCustomerId,
  onCustomerSelect,
  onNewCustomerCreated,
}: InlineCustomerFormProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [open, setOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomerData>({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip: '',
  });

  const createCustomer = useCreateCustomer();

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  const resetNewCustomerForm = () => {
    setNewCustomer({
      name: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      zip: '',
    });
  };

  const handleAddNewCustomer = async () => {
    if (!newCustomer.name.trim()) {
      return;
    }

    try {
      const result = await createCustomer.mutateAsync({
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim() || null,
        email: newCustomer.email.trim() || null,
        address: newCustomer.address.trim() || null,
        city: newCustomer.city.trim() || null,
        state: newCustomer.state.trim() || null,
        zip: newCustomer.zip.trim() || null,
        notes: null,
      });
      
      // Select the newly created customer
      if (result?.id) {
        onCustomerSelect(result.id);
        onNewCustomerCreated?.(result.id);
      }
      
      resetNewCustomerForm();
      setIsAddingNew(false);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleCancelNew = () => {
    resetNewCustomerForm();
    setIsAddingNew(false);
  };

  if (isAddingNew) {
    return (
      <div className="space-y-3 p-4 border rounded-lg bg-muted/30 col-span-full">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">New Customer</Label>
          <Button type="button" variant="ghost" size="sm" onClick={handleCancelNew}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={newCustomer.name}
              onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              placeholder="Customer name"
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              placeholder="Phone number"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={newCustomer.email}
            onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
            placeholder="Email address"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-2 md:col-span-2">
            <Label>Address</Label>
            <Input
              value={newCustomer.address}
              onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
              placeholder="Street address"
            />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input
              value={newCustomer.city}
              onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
              placeholder="City"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>State</Label>
              <Input
                value={newCustomer.state}
                onChange={(e) => setNewCustomer({ ...newCustomer, state: e.target.value })}
                placeholder="ST"
              />
            </div>
            <div className="space-y-2">
              <Label>ZIP</Label>
              <Input
                value={newCustomer.zip}
                onChange={(e) => setNewCustomer({ ...newCustomer, zip: e.target.value })}
                placeholder="ZIP"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleCancelNew}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1"
            onClick={handleAddNewCustomer}
            disabled={!newCustomer.name.trim() || createCustomer.isPending}
          >
            {createCustomer.isPending ? 'Adding...' : 'Add Customer'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Customer *</Label>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-between font-normal"
            >
              {selectedCustomer ? selectedCustomer.name : "Select customer..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0 bg-popover z-50" align="start">
            <Command>
              <CommandInput placeholder="Search customers..." />
              <CommandList>
                <CommandEmpty>No customer found.</CommandEmpty>
                <CommandGroup>
                  {customers.map((customer) => (
                    <CommandItem
                      key={customer.id}
                      value={customer.name}
                      onSelect={() => {
                        onCustomerSelect(customer.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{customer.name}</span>
                        {customer.email && (
                          <span className="text-xs text-muted-foreground">{customer.email}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setIsAddingNew(true)}
          title="Add new customer"
        >
          <UserPlus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}