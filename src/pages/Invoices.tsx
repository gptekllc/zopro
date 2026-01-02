import { useState, useEffect, useCallback, useMemo } from 'react';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { useSearchParams } from 'react-router-dom';
import { useInvoices, useCreateInvoice, useUpdateInvoice, useDeleteInvoice, useApplyLateFee, useArchiveInvoice, useUnarchiveInvoice, isInvoiceOverdue, getTotalWithLateFee, Invoice } from '@/hooks/useInvoices';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { useCustomers } from '@/hooks/useCustomers';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useEmailDocument, useDownloadDocument } from '@/hooks/useDocumentActions';
import { useUndoableDelete } from '@/hooks/useUndoableDelete';
import { useSignInvoice } from '@/hooks/useSignatures';
import { useSendSignatureRequest } from '@/hooks/useSendSignatureRequest';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Receipt, Trash2, Edit, DollarSign, CheckCircle, Loader2, FileDown, Mail, FileText, AlertCircle, MoreVertical, Copy, Filter, Archive, ArchiveRestore, PenTool, Eye, Send } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { SignatureDialog } from '@/components/signatures/SignatureDialog';
import { ViewSignatureDialog } from '@/components/signatures/ViewSignatureDialog';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { InlineCustomerForm } from '@/components/customers/InlineCustomerForm';
import { SignatureSection } from '@/components/signatures/SignatureSection';
import { ConstrainedPanel } from '@/components/ui/constrained-panel';
import { formatAmount } from '@/lib/formatAmount';
import { InvoiceListCard } from '@/components/invoices/InvoiceListCard';
interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}
const normalizeMoneyInput = (value: number | string | null | undefined) => {
  if (typeof value !== 'string') return value;
  // Supabase numeric fields can come back as strings like "24.2400".
  // Trim only *trailing* zeros so we don't end up displaying ".00" everywhere.
  const trimmed = value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return trimmed;
};
const Invoices = () => {
  const {
    profile
  } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState('all');

  // Determine if we need archived data
  const needsArchivedData = statusFilter === 'archived';
  const {
    data: invoices = [],
    isLoading,
    refetch: refetchInvoices
  } = useInvoices(needsArchivedData);
  const {
    data: customers = []
  } = useCustomers();
  const {
    data: company
  } = useCompany();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();
  const archiveInvoice = useArchiveInvoice();
  const unarchiveInvoice = useUnarchiveInvoice();
  const applyLateFee = useApplyLateFee();
  const emailDocument = useEmailDocument();
  const downloadDocument = useDownloadDocument();
  const signInvoice = useSignInvoice();
  const sendSignatureRequest = useSendSignatureRequest();
  const {
    saveScrollPosition,
    restoreScrollPosition
  } = useScrollRestoration();

  // Undo-able delete
  const {
    scheduleDelete: scheduleInvoiceDelete,
    filterPendingDeletes: filterPendingInvoiceDeletes
  } = useUndoableDelete(async id => {
    await deleteInvoice.mutateAsync(id);
  }, {
    itemLabel: 'invoice',
    timeout: 5000
  });
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedInvoiceForEmail, setSelectedInvoiceForEmail] = useState<string | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [archiveConfirmInvoice, setArchiveConfirmInvoice] = useState<Invoice | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<string | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<typeof invoices[0] | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<typeof invoices[0] | null>(null);

  // Signature dialogs
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [signatureInvoice, setSignatureInvoice] = useState<Invoice | null>(null);
  const [viewSignatureId, setViewSignatureId] = useState<string | null>(null);
  const [viewSignatureOpen, setViewSignatureOpen] = useState(false);

  // Wrapped setters for scroll restoration
  const openViewingInvoice = useCallback((invoice: typeof invoices[0] | null) => {
    if (invoice) saveScrollPosition();
    setViewingInvoice(invoice);
    if (!invoice) restoreScrollPosition();
  }, [saveScrollPosition, restoreScrollPosition]);
  const openEditDialog = useCallback((open: boolean) => {
    if (open) saveScrollPosition();
    setIsDialogOpen(open);
    if (!open) restoreScrollPosition();
  }, [saveScrollPosition, restoreScrollPosition]);
  const [formData, setFormData] = useState<{
    customerId: string;
    items: LineItem[];
    notes: string;
    status: string;
    dueDays: number;
  }>({
    customerId: '',
    items: [{
      id: '1',
      description: '',
      quantity: 1,
      unitPrice: 0
    }],
    notes: '',
    status: 'draft',
    dueDays: 30
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
        setSearchParams(searchParams, {
          replace: true
        });
      }
    }
  }, [searchParams, invoices, setSearchParams]);
  const filteredInvoices = useMemo(() => {
    const filtered = invoices.filter(inv => {
      const customer = customers.find(c => c.id === inv.customer_id);
      const customerName = customer?.name || '';
      const matchesSearch = customerName.toLowerCase().includes(searchQuery.toLowerCase()) || inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase());

      // Handle archived filter separately
      if (statusFilter === 'archived') {
        return matchesSearch && !!(inv as any).archived_at;
      }
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      // Hide archived invoices when not viewing archived filter
      const notArchived = !(inv as any).archived_at;
      return matchesSearch && matchesStatus && notArchived;
    });
    return filterPendingInvoiceDeletes(filtered);
  }, [invoices, customers, searchQuery, statusFilter, filterPendingInvoiceDeletes]);
  const resetForm = () => {
    setFormData({
      customerId: '',
      items: [{
        id: '1',
        description: '',
        quantity: 1,
        unitPrice: 0
      }],
      notes: '',
      status: 'draft',
      dueDays: 30
    });
    setEditingInvoice(null);
  };
  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, {
        id: Date.now().toString(),
        description: '',
        quantity: 1,
        unitPrice: 0
      }]
    });
  };
  const handleRemoveItem = (id: string) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter(item => item.id !== id)
      });
    }
  };
  const handleItemChange = (id: string, field: keyof LineItem, value: string | number) => {
    setFormData({
      ...formData,
      items: formData.items.map(item => item.id === id ? {
        ...item,
        [field]: value
      } : item)
    });
  };
  const calculateTotal = (items: LineItem[]) => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
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
      total: subtotal
    };
    try {
      const itemsData = formData.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.quantity * item.unitPrice
      }));
      if (editingInvoice) {
        await updateInvoice.mutateAsync({
          id: editingInvoice,
          ...invoiceData,
          items: itemsData
        } as any);
        toast.success('Invoice updated successfully');
      } else {
        await createInvoice.mutateAsync({
          ...invoiceData,
          items: itemsData
        } as any);
        toast.success('Invoice created successfully');
      }
      openEditDialog(false);
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
        unitPrice: Number(item.unit_price)
      })) || [{
        id: '1',
        description: '',
        quantity: 1,
        unitPrice: 0
      }],
      notes: invoice.notes || '',
      status: invoice.status as any,
      dueDays: 30
    });
    setEditingInvoice(invoice.id);
    openEditDialog(true);
  };
  const handleDeleteClick = (invoice: typeof invoices[0]) => {
    setInvoiceToDelete(invoice);
  };
  const handleConfirmDelete = () => {
    if (invoiceToDelete) {
      scheduleInvoiceDelete(invoiceToDelete.id);
      setInvoiceToDelete(null);
    }
  };
  const handleMarkPaid = async (id: string) => {
    try {
      await updateInvoice.mutateAsync({
        id,
        status: 'paid',
        paid_at: new Date().toISOString()
      });
      toast.success('Invoice marked as paid');
    } catch (error) {
      toast.error('Failed to update invoice');
    }
  };
  const handleStatusChange = async (invoiceId: string, newStatus: string) => {
    try {
      const updateData: {
        id: string;
        status: string;
        paid_at?: string | null;
      } = {
        id: invoiceId,
        status: newStatus
      };
      // Set or clear paid_at based on status
      if (newStatus === 'paid') {
        updateData.paid_at = new Date().toISOString();
      } else {
        updateData.paid_at = null;
      }
      await updateInvoice.mutateAsync(updateData as any);
      toast.success(`Invoice marked as ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };
  const handleDuplicateInvoice = (invoice: typeof invoices[0]) => {
    setFormData({
      customerId: invoice.customer_id,
      items: invoice.items?.map((item: any) => ({
        id: Date.now().toString() + Math.random(),
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price)
      })) || [{
        id: '1',
        description: '',
        quantity: 1,
        unitPrice: 0
      }],
      notes: invoice.notes || '',
      status: 'draft',
      dueDays: 30
    });
    setEditingInvoice(null);
    openEditDialog(true);
    toast.success('Invoice duplicated - make changes and save');
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-success/10 text-success';
      case 'sent':
        return 'bg-primary/10 text-primary';
      case 'overdue':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };
  const getCustomerName = (customerId: string) => {
    return customers.find(c => c.id === customerId)?.name || 'Unknown';
  };
  const getCustomerEmail = (customerId: string) => {
    return customers.find(c => c.id === customerId)?.email || '';
  };
  const lateFeePercentage = company?.late_fee_percentage ?? 0;
  const handleApplyLateFee = async (invoiceId: string) => {
    if (lateFeePercentage <= 0) {
      toast.error('No late fee percentage configured. Set it in Company Settings.');
      return;
    }
    if (confirm(`Apply a ${lateFeePercentage}% late fee to this overdue invoice?`)) {
      await applyLateFee.mutateAsync({
        invoiceId,
        lateFeePercentage
      });
    }
  };
  const handleDownload = (invoiceId: string) => {
    downloadDocument.mutate({
      type: 'invoice',
      documentId: invoiceId
    });
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
      recipientEmail: emailRecipient
    });
    setEmailDialogOpen(false);
    setSelectedInvoiceForEmail(null);
    setEmailRecipient('');
  };
  const handleArchiveInvoice = async (invoice: Invoice) => {
    await archiveInvoice.mutateAsync(invoice.id);
    setArchiveConfirmInvoice(null);
  };
  const handleUnarchiveInvoice = async (invoice: Invoice) => {
    await unarchiveInvoice.mutateAsync(invoice.id);
  };
  const handleOpenSignatureDialog = (invoice: Invoice) => {
    setSignatureInvoice(invoice);
    setSignatureDialogOpen(true);
  };
  const handleSignatureComplete = async (signatureData: string, signerName: string) => {
    if (!signatureInvoice) return;
    const signature = await signInvoice.mutateAsync({
      invoiceId: signatureInvoice.id,
      signatureData,
      signerName,
      customerId: signatureInvoice.customer_id
    });
    // Update viewing invoice with the new signature and status if it's open
    if (viewingInvoice?.id === signatureInvoice.id) {
      setViewingInvoice({
        ...viewingInvoice,
        signature_id: signature.id,
        signed_at: new Date().toISOString(),
        status: 'paid',
        paid_at: new Date().toISOString()
      } as any);
    }
    setSignatureDialogOpen(false);
    setSignatureInvoice(null);
  };
  const handleViewSignature = (signatureId: string) => {
    setViewSignatureId(signatureId);
    setViewSignatureOpen(true);
  };
  const handleSendSignatureRequest = (invoice: Invoice) => {
    const customer = customers.find(c => c.id === invoice.customer_id);
    if (!customer?.email) {
      toast.error('Customer does not have an email address');
      return;
    }
    sendSignatureRequest.mutate({
      documentType: 'invoice',
      documentId: invoice.id,
      recipientEmail: customer.email,
      recipientName: customer.name,
      companyName: company?.name || 'Company',
      documentNumber: invoice.invoice_number,
      customerId: customer.id
    });
  };
  if (isLoading) {
    return <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>;
  }
  return <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold">Invoices</h1>
            <p className="text-muted-foreground mt-1 hidden sm:block">{invoices.length} total invoices</p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative w-24 sm:w-40">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-9" />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={statusFilter !== 'all' ? 'secondary' : 'outline'} size="icon" className="h-9 w-9">
                  <Filter className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => setStatusFilter('all')} className={statusFilter === 'all' ? 'bg-accent' : ''}>
                  All Status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('draft')} className={statusFilter === 'draft' ? 'bg-accent' : ''}>
                  Draft
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('sent')} className={statusFilter === 'sent' ? 'bg-accent' : ''}>
                  Sent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('paid')} className={statusFilter === 'paid' ? 'bg-accent' : ''}>
                  Paid
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('overdue')} className={statusFilter === 'overdue' ? 'bg-accent' : ''}>
                  Overdue
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setStatusFilter('archived')} className={statusFilter === 'archived' ? 'bg-accent' : ''}>
                  <Archive className="w-4 h-4 mr-2" />
                  Archived
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Dialog open={isDialogOpen} onOpenChange={open => {
            openEditDialog(open);
            if (!open) resetForm();
          }}>
              <DialogTrigger asChild>
                <Button className="gap-2 hidden sm:flex">
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
                    <InlineCustomerForm customers={customers} selectedCustomerId={formData.customerId} onCustomerSelect={value => setFormData({
                    ...formData,
                    customerId: value
                  })} />
                    
                    <div className="space-y-2">
                      <Label>Due In (days)</Label>
                      <Input type="number" value={formData.dueDays} onChange={e => setFormData({
                      ...formData,
                      dueDays: parseInt(e.target.value) || 30
                    })} />
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
                    
                    {formData.items.map(item => <div key={item.id} className="space-y-2 sm:space-y-0">
                        {/* Mobile layout */}
                        <div className="sm:hidden space-y-2 p-3 bg-muted/50 rounded-lg">
                          <Input placeholder="Description" value={item.description} onChange={e => handleItemChange(item.id, 'description', e.target.value)} />
                          <div className="flex gap-2">
                            <div className="w-20">
                              <Label className="text-xs text-muted-foreground">Qty</Label>
                              <Input type="number" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs text-muted-foreground">Price</Label>
                              <Input type="number" placeholder="0" value={item.unitPrice === 0 ? '' : item.unitPrice} onChange={e => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} />
                            </div>
                            <div className="flex items-end">
                              <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} disabled={formData.items.length === 1} className="text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex justify-end text-sm font-medium">
                            Total: ${(item.quantity * item.unitPrice).toLocaleString()}
                          </div>
                        </div>
                        {/* Desktop layout */}
                        <div className="hidden sm:flex gap-2 items-start">
                          <Input placeholder="Description" value={item.description} onChange={e => handleItemChange(item.id, 'description', e.target.value)} className="flex-1" />
                          <Input type="number" placeholder="Qty" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)} className="w-20" />
                          <Input type="number" placeholder="0" value={item.unitPrice === 0 ? '' : item.unitPrice} onChange={e => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-24" />
                          <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} disabled={formData.items.length === 1}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>)}

                    <div className="text-right font-semibold text-lg">
                      Total: ${calculateTotal(formData.items).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={formData.notes} onChange={e => setFormData({
                    ...formData,
                    notes: e.target.value
                  })} rows={3} />
                  </div>
                  
                  <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => openEditDialog(false)}>
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
        </div>
        
      </div>

      {/* Invoice List */}
      <PullToRefresh
        onRefresh={async () => {
          await refetchInvoices();
        }}
        className="sm:contents"
      >
        <div className="space-y-3 lg:max-w-4xl lg:mx-auto">
          {filteredInvoices.map((invoice) => (
            <InvoiceListCard
              key={invoice.id}
              invoice={invoice as Invoice}
              lateFeePercentage={lateFeePercentage}
              getCustomerName={getCustomerName}
              getCustomerEmail={getCustomerEmail}
              getStatusColor={getStatusColor}
              isInvoiceOverdue={isInvoiceOverdue}
              getTotalWithLateFee={getTotalWithLateFee}
              onOpen={(inv) => openViewingInvoice(inv)}
              onStatusChange={handleStatusChange}
              onApplyLateFee={handleApplyLateFee}
              onEdit={handleEdit}
              onDuplicate={handleDuplicateInvoice}
              onDownload={handleDownload}
              onEmail={handleOpenEmailDialog}
              onMarkPaid={handleMarkPaid}
              onViewSignature={handleViewSignature}
              onOpenSignatureDialog={(inv) => handleOpenSignatureDialog(inv)}
              onSendSignatureRequest={(inv) => handleSendSignatureRequest(inv)}
              onArchive={(inv) => setArchiveConfirmInvoice(inv)}
              onUnarchive={(inv) => handleUnarchiveInvoice(inv)}
              onDelete={handleDeleteClick}
            />
          ))}
          {filteredInvoices.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No invoices found
              </CardContent>
            </Card>
          )}
        </div>
      </PullToRefresh>


      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Email Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Recipient Email</Label>
              <Input type="email" value={emailRecipient} onChange={e => setEmailRecipient(e.target.value)} placeholder="customer@example.com" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setEmailDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSendEmail} disabled={emailDocument.isPending || !emailRecipient}>
                {emailDocument.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Send Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog for viewing from URL */}
      {viewingInvoice && <Dialog open={!!viewingInvoice} onOpenChange={open => !open && openViewingInvoice(null)}>
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
                {viewingInvoice.due_date && <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Due Date</p>
                    <p className="font-medium text-sm sm:text-base">{format(new Date(viewingInvoice.due_date), 'MMM d, yyyy')}</p>
                  </div>}
                {viewingInvoice.paid_at && <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Paid</p>
                    <p className="font-medium text-green-600 flex items-center gap-1 text-sm sm:text-base">
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                      {format(new Date(viewingInvoice.paid_at), 'MMM d, yyyy')}
                    </p>
                  </div>}
              </div>

              {/* Line Items */}
              <div>
                <h4 className="font-medium mb-2 sm:mb-3 text-sm sm:text-base">Line Items</h4>
                <div className="space-y-2">
                  {viewingInvoice.items && viewingInvoice.items.length > 0 ? <>
                      {/* Desktop header - hidden on mobile */}
                      <div className="hidden sm:grid grid-cols-12 text-xs text-muted-foreground font-medium px-2">
                        <div className="col-span-6">Description</div>
                        <div className="col-span-2 text-right">Qty</div>
                        <div className="col-span-2 text-right">Price</div>
                        <div className="col-span-2 text-right">Total</div>
                      </div>
                      {viewingInvoice.items.map((item: any) => <div key={item.id} className="py-2 px-2 sm:px-3 bg-muted/50 rounded text-sm">
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
                        </div>)}
                    </> : <p className="text-sm text-muted-foreground">No line items</p>}
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
                    <span>${formatAmount(viewingInvoice.total)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Status */}
              {viewingInvoice.status === 'paid' ? <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="font-medium text-xs sm:text-sm">Payment received on {format(new Date(viewingInvoice.paid_at!), 'MMM d, yyyy')}</span>
                </div> : viewingInvoice.due_date && new Date(viewingInvoice.due_date) < new Date() ? <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-400">
                  <span className="font-medium text-xs sm:text-sm">Overdue - was due on {format(new Date(viewingInvoice.due_date), 'MMM d, yyyy')}</span>
                </div> : null}

              {/* Signature Section */}
              <ConstrainedPanel>
                <SignatureSection signatureId={(viewingInvoice as any).signature_id} title="Customer Signature" onCollectSignature={() => handleOpenSignatureDialog(viewingInvoice as Invoice)} showCollectButton={viewingInvoice.status !== 'paid'} collectButtonText="Collect Signature" isCollecting={signInvoice.isPending} />
              </ConstrainedPanel>

              {/* Notes */}
              {viewingInvoice.notes && <div>
                  <h4 className="font-medium mb-2 text-sm sm:text-base">Notes</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">{viewingInvoice.notes}</p>
                </div>}

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
                {viewingInvoice.status !== 'paid' && <Button variant="default" size="sm" onClick={() => handleMarkPaid(viewingInvoice.id)} className="flex-1 sm:flex-none">
                    <CheckCircle className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Mark Paid</span>
                  </Button>}
                <Button variant="outline" size="sm" onClick={() => {
              handleEdit(viewingInvoice);
              openViewingInvoice(null);
            }} className="w-full sm:w-auto sm:ml-auto mt-2 sm:mt-0">
                  <Edit className="w-4 h-4 mr-1" /> Edit
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!invoiceToDelete} onOpenChange={open => !open && setInvoiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice "{invoiceToDelete?.invoice_number}"? 
              You can undo this action within a few seconds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={!!archiveConfirmInvoice} onOpenChange={open => !open && setArchiveConfirmInvoice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive invoice "{archiveConfirmInvoice?.invoice_number}"? 
              Archived invoices can be restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveConfirmInvoice && handleArchiveInvoice(archiveConfirmInvoice)}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Signature Dialog */}
      <SignatureDialog open={signatureDialogOpen} onOpenChange={open => {
      setSignatureDialogOpen(open);
      if (!open) setSignatureInvoice(null);
    }} title="Sign Invoice" description="Customer signature to acknowledge this invoice" signerName={signatureInvoice ? customers.find(c => c.id === signatureInvoice.customer_id)?.name || '' : ''} onSignatureComplete={handleSignatureComplete} isSubmitting={signInvoice.isPending} />

      {/* View Signature Dialog */}
      <ViewSignatureDialog signatureId={viewSignatureId} open={viewSignatureOpen} onOpenChange={open => {
      setViewSignatureOpen(open);
      if (!open) setViewSignatureId(null);
    }} />

      <Button className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg sm:hidden z-50" onClick={() => openEditDialog(true)}>
        <Plus className="w-6 h-6" />
      </Button>
    </div>;
};
export default Invoices;