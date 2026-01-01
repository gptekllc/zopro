import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInvoices, useCreateInvoice, useUpdateInvoice, useDeleteInvoice } from '@/hooks/useInvoices';
import { useCustomers } from '@/hooks/useCustomers';
import { useAuth } from '@/hooks/useAuth';
import { useEmailDocument, useDownloadDocument } from '@/hooks/useDocumentActions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Receipt, Trash2, Edit, DollarSign, CheckCircle, Loader2, FileDown, Mail } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { InlineCustomerForm } from '@/components/customers/InlineCustomerForm';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

const Invoices = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: customers = [] } = useCustomers();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();
  const emailDocument = useEmailDocument();
  const downloadDocument = useDownloadDocument();
  
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedInvoiceForEmail, setSelectedInvoiceForEmail] = useState<string | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<string | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<typeof invoices[0] | null>(null);
  const [formData, setFormData] = useState<{
    customerId: string;
    items: LineItem[];
    notes: string;
    status: string;
    dueDays: number;
  }>({
    customerId: '',
    items: [{ id: '1', description: '', quantity: 1, unitPrice: 0 }],
    notes: '',
    status: 'draft',
    dueDays: 30,
  });

  // Handle URL param to auto-open invoice detail
  useEffect(() => {
    const viewInvoiceId = searchParams.get('view');
    if (viewInvoiceId && invoices.length > 0) {
      const invoice = invoices.find(i => i.id === viewInvoiceId);
      if (invoice) {
        setViewingInvoice(invoice);
        // Clear the URL param after opening
        searchParams.delete('view');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, invoices, setSearchParams]);

  const filteredInvoices = invoices.filter(inv => {
    const customer = customers.find(c => c.id === inv.customer_id);
    const customerName = customer?.name || '';
    const matchesSearch = customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const resetForm = () => {
    setFormData({
      customerId: '',
      items: [{ id: '1', description: '', quantity: 1, unitPrice: 0 }],
      notes: '',
      status: 'draft',
      dueDays: 30,
    });
    setEditingInvoice(null);
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 }],
    });
  };

  const handleRemoveItem = (id: string) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter(item => item.id !== id),
      });
    }
  };

  const handleItemChange = (id: string, field: keyof LineItem, value: string | number) => {
    setFormData({
      ...formData,
      items: formData.items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  };

  const calculateTotal = (items: LineItem[]) => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerId) {
      toast.error('Please select a customer');
      return;
    }

    const subtotal = calculateTotal(formData.items);
    const invoiceData = {
      customer_id: formData.customerId,
      notes: formData.notes || null,
      status: formData.status,
      due_date: format(addDays(new Date(), formData.dueDays), 'yyyy-MM-dd'),
      subtotal,
      tax: 0,
      total: subtotal,
    };

    try {
      const itemsData = formData.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.quantity * item.unitPrice,
      }));

      if (editingInvoice) {
        await updateInvoice.mutateAsync({
          id: editingInvoice,
          ...invoiceData,
          items: itemsData,
        } as any);
        toast.success('Invoice updated successfully');
      } else {
        await createInvoice.mutateAsync({
          ...invoiceData,
          items: itemsData,
        } as any);
        toast.success('Invoice created successfully');
      }
      
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(editingInvoice ? 'Failed to update invoice' : 'Failed to create invoice');
    }
  };

  const handleEdit = (invoice: typeof invoices[0]) => {
    setFormData({
      customerId: invoice.customer_id,
      items: invoice.items?.map((item: any) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
      })) || [{ id: '1', description: '', quantity: 1, unitPrice: 0 }],
      notes: invoice.notes || '',
      status: invoice.status as any,
      dueDays: 30,
    });
    setEditingInvoice(invoice.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this invoice?')) {
      try {
        await deleteInvoice.mutateAsync(id);
        toast.success('Invoice deleted');
      } catch (error) {
        toast.error('Failed to delete invoice');
      }
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await updateInvoice.mutateAsync({
        id,
        status: 'paid',
        paid_at: new Date().toISOString(),
      });
      toast.success('Invoice marked as paid');
    } catch (error) {
      toast.error('Failed to update invoice');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-success/10 text-success';
      case 'sent': return 'bg-primary/10 text-primary';
      case 'overdue': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getCustomerName = (customerId: string) => {
    return customers.find(c => c.id === customerId)?.name || 'Unknown';
  };

  const getCustomerEmail = (customerId: string) => {
    return customers.find(c => c.id === customerId)?.email || '';
  };

  const handleDownload = (invoiceId: string) => {
    downloadDocument.mutate({ type: 'invoice', documentId: invoiceId });
  };

  const handleOpenEmailDialog = (invoiceId: string, customerId: string) => {
    setSelectedInvoiceForEmail(invoiceId);
    setEmailRecipient(getCustomerEmail(customerId));
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!selectedInvoiceForEmail || !emailRecipient) {
      toast.error('Please enter a recipient email');
      return;
    }
    await emailDocument.mutateAsync({
      type: 'invoice',
      documentId: selectedInvoiceForEmail,
      recipientEmail: emailRecipient,
    });
    setEmailDialogOpen(false);
    setSelectedInvoiceForEmail(null);
    setEmailRecipient('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground mt-1">{invoices.length} total invoices</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-3xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InlineCustomerForm
                  customers={customers}
                  selectedCustomerId={formData.customerId}
                  onCustomerSelect={(value) => setFormData({ ...formData, customerId: value })}
                />
                
                <div className="space-y-2">
                  <Label>Due In (days)</Label>
                  <Input
                    type="number"
                    value={formData.dueDays}
                    onChange={(e) => setFormData({ ...formData, dueDays: parseInt(e.target.value) || 30 })}
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Line Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                    <Plus className="w-4 h-4 mr-1" /> Add Item
                  </Button>
                </div>
                
                {formData.items.map((item) => (
                  <div key={item.id} className="space-y-2 sm:space-y-0">
                    {/* Mobile layout */}
                    <div className="sm:hidden space-y-2 p-3 bg-muted/50 rounded-lg">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                      />
                      <div className="flex gap-2">
                        <div className="w-20">
                          <Label className="text-xs text-muted-foreground">Qty</Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">Price</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={item.unitPrice === 0 ? '' : item.unitPrice}
                            onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={formData.items.length === 1}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-end text-sm font-medium">
                        Total: ${(item.quantity * item.unitPrice).toFixed(2)}
                      </div>
                    </div>
                    {/* Desktop layout */}
                    <div className="hidden sm:flex gap-2 items-start">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-20"
                      />
                      <Input
                        type="number"
                        placeholder="0"
                        value={item.unitPrice === 0 ? '' : item.unitPrice}
                        onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-24"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={formData.items.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="text-right font-semibold text-lg">
                  Total: ${calculateTotal(formData.items).toLocaleString()}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
              
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={createInvoice.isPending || updateInvoice.isPending}>
                  {(createInvoice.isPending || updateInvoice.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingInvoice ? 'Update' : 'Create'} Invoice
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoice List */}
      <div className="space-y-3">
        {filteredInvoices.map((invoice) => (
          <Card key={invoice.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => setViewingInvoice(invoice)}>
            <CardContent className="p-4 sm:p-5">
              {/* Mobile Layout */}
              <div className="flex flex-col gap-2 sm:hidden">
                {/* Row 1: Invoice Info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{invoice.invoice_number}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="truncate">{getCustomerName(invoice.customer_id)}</span>
                      {getCustomerEmail(invoice.customer_id) && (
                        <>
                          <span>•</span>
                          <span className="truncate">{getCustomerEmail(invoice.customer_id)}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      {invoice.due_date && (
                        <span className="flex items-center gap-1 shrink-0">
                          Due: {format(new Date(invoice.due_date), 'MMM d')}
                        </span>
                      )}
                    </div>
                    {invoice.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{invoice.notes}</p>
                    )}
                  </div>
                  <span className="text-sm font-medium text-primary shrink-0">${Number(invoice.total).toLocaleString()}</span>
                </div>
                
                {/* Row 2: Tags + Actions */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(invoice.id)} title="Download PDF">
                      <FileDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEmailDialog(invoice.id, invoice.customer_id)} title="Email Invoice">
                      <Mail className="w-3.5 h-3.5" />
                    </Button>
                    {invoice.status !== 'paid' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => handleMarkPaid(invoice.id)} title="Mark Paid">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(invoice)} title="Edit">
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(invoice.id)} title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Desktop Layout */}
              <div className="hidden sm:flex flex-col gap-2">
                {/* Row 1: Invoice Info + Amount */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{invoice.invoice_number}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5 flex-wrap">
                      <span className="truncate">{getCustomerName(invoice.customer_id)}</span>
                      {getCustomerEmail(invoice.customer_id) && (
                        <>
                          <span>•</span>
                          <span className="truncate">{getCustomerEmail(invoice.customer_id)}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5 flex-wrap">
                      {invoice.due_date && (
                        <span className="flex items-center gap-1 shrink-0">
                          Due {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                    {invoice.notes && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{invoice.notes}</p>
                    )}
                  </div>
                  <span className="text-base font-semibold text-primary shrink-0">${Number(invoice.total).toLocaleString()}</span>
                </div>
                
                {/* Row 2: Tags + Actions */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => handleDownload(invoice.id)} title="Download PDF">
                      <FileDown className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEmailDialog(invoice.id, invoice.customer_id)} title="Email Invoice">
                      <Mail className="w-4 h-4" />
                    </Button>
                    {invoice.status !== 'paid' && (
                      <Button variant="outline" size="sm" onClick={() => handleMarkPaid(invoice.id)} className="text-xs">
                        <CheckCircle className="w-3.5 h-3.5 mr-1 text-success" />
                        Mark Paid
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(invoice)} title="Edit">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(invoice.id)} title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredInvoices.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No invoices found
            </CardContent>
          </Card>
        )}
      </div>


      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Email Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Recipient Email</Label>
              <Input
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setEmailDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleSendEmail}
                disabled={emailDocument.isPending || !emailRecipient}
              >
                {emailDocument.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Send Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog for viewing from URL */}
      {viewingInvoice && (
        <Dialog open={!!viewingInvoice} onOpenChange={(open) => !open && setViewingInvoice(null)}>
          <DialogContent className="max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between pr-8">
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                  <span className="truncate">{viewingInvoice.invoice_number}</span>
                </DialogTitle>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 ${getStatusColor(viewingInvoice.status)}`}>
                  {viewingInvoice.status}
                </span>
              </div>
            </DialogHeader>

            <div className="space-y-4 sm:space-y-6">
              {/* Customer & Dates - responsive grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium text-sm sm:text-base truncate">{getCustomerName(viewingInvoice.customer_id)}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Created</p>
                  <p className="font-medium text-sm sm:text-base">{format(new Date(viewingInvoice.created_at), 'MMM d, yyyy')}</p>
                </div>
                {viewingInvoice.due_date && (
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Due Date</p>
                    <p className="font-medium text-sm sm:text-base">{format(new Date(viewingInvoice.due_date), 'MMM d, yyyy')}</p>
                  </div>
                )}
                {viewingInvoice.paid_at && (
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Paid</p>
                    <p className="font-medium text-green-600 flex items-center gap-1 text-sm sm:text-base">
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                      {format(new Date(viewingInvoice.paid_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div>
                <h4 className="font-medium mb-2 sm:mb-3 text-sm sm:text-base">Line Items</h4>
                <div className="space-y-2">
                  {viewingInvoice.items && viewingInvoice.items.length > 0 ? (
                    <>
                      {/* Desktop header - hidden on mobile */}
                      <div className="hidden sm:grid grid-cols-12 text-xs text-muted-foreground font-medium px-2">
                        <div className="col-span-6">Description</div>
                        <div className="col-span-2 text-right">Qty</div>
                        <div className="col-span-2 text-right">Price</div>
                        <div className="col-span-2 text-right">Total</div>
                      </div>
                      {viewingInvoice.items.map((item: any) => (
                        <div key={item.id} className="py-2 px-2 sm:px-3 bg-muted/50 rounded text-sm">
                          {/* Mobile layout */}
                          <div className="sm:hidden space-y-1">
                            <p className="font-medium">{item.description}</p>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{item.quantity} × ${Number(item.unit_price).toLocaleString()}</span>
                              <span className="font-medium text-foreground">${Number(item.total).toLocaleString()}</span>
                            </div>
                          </div>
                          {/* Desktop layout */}
                          <div className="hidden sm:grid grid-cols-12">
                            <div className="col-span-6">{item.description}</div>
                            <div className="col-span-2 text-right">{item.quantity}</div>
                            <div className="col-span-2 text-right">${Number(item.unit_price).toLocaleString()}</div>
                            <div className="col-span-2 text-right font-medium">${Number(item.total).toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No line items</p>
                  )}
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-full sm:w-48 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${Number(viewingInvoice.subtotal).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>${Number(viewingInvoice.tax).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base sm:text-lg pt-2 border-t">
                    <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" />Total</span>
                    <span>${Number(viewingInvoice.total).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Payment Status */}
              {viewingInvoice.status === 'paid' ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="font-medium text-xs sm:text-sm">Payment received on {format(new Date(viewingInvoice.paid_at!), 'MMM d, yyyy')}</span>
                </div>
              ) : viewingInvoice.due_date && new Date(viewingInvoice.due_date) < new Date() ? (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-400">
                  <span className="font-medium text-xs sm:text-sm">Overdue - was due on {format(new Date(viewingInvoice.due_date), 'MMM d, yyyy')}</span>
                </div>
              ) : null}

              {/* Notes */}
              {viewingInvoice.notes && (
                <div>
                  <h4 className="font-medium mb-2 text-sm sm:text-base">Notes</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">{viewingInvoice.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 sm:pt-4">
                <Button variant="outline" size="sm" onClick={() => handleDownload(viewingInvoice.id)} className="flex-1 sm:flex-none">
                  <FileDown className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleOpenEmailDialog(viewingInvoice.id, viewingInvoice.customer_id)} className="flex-1 sm:flex-none">
                  <Mail className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Email</span>
                </Button>
                {viewingInvoice.status !== 'paid' && (
                  <Button variant="default" size="sm" onClick={() => handleMarkPaid(viewingInvoice.id)} className="flex-1 sm:flex-none">
                    <CheckCircle className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Mark Paid</span>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => { handleEdit(viewingInvoice); setViewingInvoice(null); }} className="w-full sm:w-auto sm:ml-auto mt-2 sm:mt-0">
                  <Edit className="w-4 h-4 mr-1" /> Edit
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Invoices;
