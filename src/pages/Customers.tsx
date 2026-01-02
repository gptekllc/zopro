import { useState, useCallback } from 'react';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { useNavigate } from 'react-router-dom';
import { useCustomers, useCreateCustomer, useUpdateCustomer, useSoftDeleteCustomer, useRestoreCustomer, useDeletedCustomers, Customer } from '@/hooks/useCustomers';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput, formatPhoneNumber, getPhoneDigits } from '@/components/ui/phone-input';
import { EmailInput } from '@/components/ui/email-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Mail, Phone, MapPin, Edit, Trash2, User, Loader2, ExternalLink, RotateCcw, Eye } from 'lucide-react';
import { toast } from 'sonner';

const Customers = () => {
  const navigate = useNavigate();
  const { data: customers = [], isLoading } = useCustomers();
  const { data: deletedCustomers = [] } = useDeletedCustomers();
  const { isAdmin } = useAuth();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const softDeleteCustomer = useSoftDeleteCustomer();
  const restoreCustomer = useRestoreCustomer();
  const { saveScrollPosition, restoreScrollPosition } = useScrollRestoration();
  
  const [activeSearch, setActiveSearch] = useState('');
  const [deletedSearch, setDeletedSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<string | null>(null);

  const openEditDialog = useCallback((open: boolean) => {
    if (open) saveScrollPosition();
    setIsDialogOpen(open);
    if (!open) restoreScrollPosition();
  }, [saveScrollPosition, restoreScrollPosition]);
  const [sendingPortalLink, setSendingPortalLink] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    notes: '',
  });

  const filteredActiveCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(activeSearch.toLowerCase()) ||
    (c.email?.toLowerCase() || '').includes(activeSearch.toLowerCase()) ||
    (c.phone || '').includes(activeSearch)
  );

  const filteredDeletedCustomers = deletedCustomers.filter(c =>
    c.name.toLowerCase().includes(deletedSearch.toLowerCase()) ||
    (c.email?.toLowerCase() || '').includes(deletedSearch.toLowerCase()) ||
    (c.phone || '').includes(deletedSearch)
  );

  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '', address: '', city: '', state: '', zip: '', notes: '' });
    setEditingCustomer(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      phone: getPhoneDigits(formData.phone) || null,
    };
    
    if (editingCustomer) {
      await updateCustomer.mutateAsync({ id: editingCustomer, ...submitData });
    } else {
      await createCustomer.mutateAsync(submitData as any);
    }
    
    openEditDialog(false);
    resetForm();
  };

  const handleEdit = (customer: Customer) => {
    setFormData({
      name: customer.name,
      email: customer.email || '',
      phone: formatPhoneNumber(customer.phone || ''),
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      zip: customer.zip || '',
      notes: customer.notes || '',
    });
    setEditingCustomer(customer.id);
    openEditDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      softDeleteCustomer.mutate(id);
    }
  };

  const handleSendPortalLink = async (customer: Customer) => {
    if (!customer.email) {
      toast.error('Customer must have an email address to send portal link');
      return;
    }

    setSendingPortalLink(customer.id);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: { action: 'send-link', email: customer.email },
      });

      if (error) throw error;
      
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`Portal link sent to ${customer.email}`);
      }
    } catch (err: any) {
      toast.error('Failed to send portal link');
    } finally {
      setSendingPortalLink(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Tabs defaultValue="active" className="w-full">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Customers</h1>
              <p className="text-muted-foreground mt-1">{customers.length} total customers</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <TabsList>
                <TabsTrigger value="active">Active</TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="deleted">
                    Deleted
                    {deletedCustomers.length > 0 && (
                      <Badge variant="secondary" className="ml-2">{deletedCustomers.length}</Badge>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>
              
              <Dialog open={isDialogOpen} onOpenChange={(open) => { openEditDialog(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="gap-2 hidden sm:flex"><Plus className="w-4 h-4" />Add Customer</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <EmailInput id="email" value={formData.email} onChange={(value) => setFormData({ ...formData, email: value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <PhoneInput id="phone" value={formData.phone} onChange={(value) => setFormData({ ...formData, phone: value })} />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="address">Street Address</Label>
                      <Input id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="123 Main St" />
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-2 col-span-2 sm:col-span-2">
                        <Label htmlFor="city">City</Label>
                        <Input id="city" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input id="state" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} placeholder="CA" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zip">ZIP</Label>
                        <Input id="zip" value={formData.zip} onChange={(e) => setFormData({ ...formData, zip: e.target.value })} placeholder="12345" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => openEditDialog(false)}>Cancel</Button>
                      <Button type="submit" className="flex-1" disabled={createCustomer.isPending || updateCustomer.isPending}>
                        {editingCustomer ? 'Update' : 'Add'} Customer
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <TabsContent value="active" className="mt-4 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search active customers..." 
              value={activeSearch} 
              onChange={(e) => setActiveSearch(e.target.value)} 
              className="pl-9" 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredActiveCustomers.map((customer) => (
              <Card 
                key={customer.id} 
                className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => navigate(`/customers/${customer.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold group-hover:text-primary transition-colors">{customer.name}</h3>
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(customer)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(customer.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {customer.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-4 h-4" /><span className="truncate">{customer.email}</span></div>}
                    {customer.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4" /><span>{customer.phone}</span></div>}
                    {(customer.address || customer.city || customer.state || customer.zip) && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>
                          {customer.address && <span className="block">{customer.address}</span>}
                          {(customer.city || customer.state || customer.zip) && (
                            <span className="block">{[customer.city, customer.state].filter(Boolean).join(', ')}{customer.zip && ` ${customer.zip}`}</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredActiveCustomers.length === 0 && (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No customers found</h3>
              <p className="text-muted-foreground mt-1">{activeSearch ? 'Try a different search term' : 'Add your first customer to get started'}</p>
            </div>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="deleted" className="mt-4 space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search deleted customers..." 
                value={deletedSearch} 
                onChange={(e) => setDeletedSearch(e.target.value)} 
                className="pl-9" 
              />
            </div>

            {filteredDeletedCustomers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDeletedCustomers.map((customer) => (
                  <Card key={customer.id} className="overflow-hidden opacity-60 hover:opacity-100 transition-opacity">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <h3 className="font-semibold">{customer.name}</h3>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => restoreCustomer.mutate(customer.id)}
                          disabled={restoreCustomer.isPending}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Restore
                        </Button>
                      </div>
                      <div className="space-y-2 text-sm">
                        {customer.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-4 h-4" /><span className="truncate">{customer.email}</span></div>}
                        {customer.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4" /><span>{customer.phone}</span></div>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">{deletedSearch ? 'No deleted customers found' : 'No deleted customers'}</h3>
                <p className="text-muted-foreground mt-1">{deletedSearch ? 'Try a different search term' : 'Deleted customers will appear here for restoration'}</p>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Mobile Floating Action Button */}
      <Button
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg sm:hidden z-50"
        onClick={() => openEditDialog(true)}
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  );
};

export default Customers;