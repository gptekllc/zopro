import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, X } from 'lucide-react';
import { useCreateCustomer, Customer } from '@/hooks/useCustomers';

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
      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">New Customer</Label>
          <Button type="button" variant="ghost" size="sm" onClick={handleCancelNew}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input
            value={newCustomer.name}
            onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
            placeholder="Customer name"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              placeholder="Phone number"
            />
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
        </div>

        <div className="space-y-2">
          <Label>Address</Label>
          <Input
            value={newCustomer.address}
            onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
            placeholder="Street address"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>City</Label>
            <Input
              value={newCustomer.city}
              onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
              placeholder="City"
            />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Input
              value={newCustomer.state}
              onChange={(e) => setNewCustomer({ ...newCustomer, state: e.target.value })}
              placeholder="State"
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
        <Select value={selectedCustomerId} onValueChange={onCustomerSelect}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select customer" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
