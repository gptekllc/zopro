import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuotes, useCreateQuote, useUpdateQuote, useDeleteQuote } from '@/hooks/useQuotes';
import { useCustomers } from '@/hooks/useCustomers';
import { useAuth } from '@/hooks/useAuth';
import { useConvertQuoteToInvoice, useEmailDocument, useDownloadDocument } from '@/hooks/useDocumentActions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, FileText, Trash2, Edit, DollarSign, Loader2, FileDown, Mail, ArrowRight, Send, CheckCircle, XCircle, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { InlineCustomerForm } from '@/components/customers/InlineCustomerForm';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

const Quotes = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: quotes = [], isLoading } = useQuotes();
  const { data: customers = [] } = useCustomers();
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const deleteQuote = useDeleteQuote();
  const convertToInvoice = useConvertQuoteToInvoice();
  const emailDocument = useEmailDocument();
  const downloadDocument = useDownloadDocument();
  
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedQuoteForEmail, setSelectedQuoteForEmail] = useState<string | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<string | null>(null);
  const [viewingQuote, setViewingQuote] = useState<typeof quotes[0] | null>(null);
  const [formData, setFormData] = useState<{
    customerId: string;
    items: LineItem[];
    notes: string;
    status: string;
    validDays: number;
  }>({
    customerId: '',
    items: [{ id: '1', description: '', quantity: 1, unitPrice: 0 }],
    notes: '',
    status: 'draft',
    validDays: 30,
  });

  // Handle URL param to auto-open quote detail
  useEffect(() => {
    const viewQuoteId = searchParams.get('view');
    if (viewQuoteId && quotes.length > 0) {
      const quote = quotes.find(q => q.id === viewQuoteId);
      if (quote) {
        setViewingQuote(quote);
        // Clear the URL param after opening
        searchParams.delete('view');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, quotes, setSearchParams]);

  const filteredQuotes = quotes.filter(q => {
    const customer = customers.find(c => c.id === q.customer_id);
    const customerName = customer?.name || '';
    const matchesSearch = customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.quote_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const resetForm = () => {
    setFormData({
      customerId: '',
      items: [{ id: '1', description: '', quantity: 1, unitPrice: 0 }],
      notes: '',
      status: 'draft',
      validDays: 30,
    });
    setEditingQuote(null);
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
    const quoteData = {
      customer_id: formData.customerId,
      notes: formData.notes || null,
      status: formData.status,
      valid_until: format(addDays(new Date(), formData.validDays), 'yyyy-MM-dd'),
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

      if (editingQuote) {
        await updateQuote.mutateAsync({
          id: editingQuote,
          ...quoteData,
          items: itemsData,
        } as any);
        toast.success('Quote updated successfully');
      } else {
        await createQuote.mutateAsync({
          ...quoteData,
          items: itemsData,
        } as any);
        toast.success('Quote created successfully');
      }
      
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(editingQuote ? 'Failed to update quote' : 'Failed to create quote');
    }
  };

  const handleEdit = (quote: typeof quotes[0]) => {
    setFormData({
      customerId: quote.customer_id,
      items: quote.items?.map((item: any) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
      })) || [{ id: '1', description: '', quantity: 1, unitPrice: 0 }],
      notes: quote.notes || '',
      status: quote.status as any,
      validDays: 30,
    });
    setEditingQuote(quote.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this quote?')) {
      try {
        await deleteQuote.mutateAsync(id);
        toast.success('Quote deleted');
      } catch (error) {
        toast.error('Failed to delete quote');
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': 
      case 'accepted': return 'bg-success/10 text-success';
      case 'sent': return 'bg-primary/10 text-primary';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getCustomerName = (customerId: string) => {
    return customers.find(c => c.id === customerId)?.name || 'Unknown';
  };

  const getCustomerEmail = (customerId: string) => {
    return customers.find(c => c.id === customerId)?.email || '';
  };

  const handleDownload = (quoteId: string) => {
    downloadDocument.mutate({ type: 'quote', documentId: quoteId });
  };

  const handleOpenEmailDialog = (quoteId: string, customerId: string) => {
    setSelectedQuoteForEmail(quoteId);
    setEmailRecipient(getCustomerEmail(customerId));
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!selectedQuoteForEmail || !emailRecipient) {
      toast.error('Please enter a recipient email');
      return;
    }
    await emailDocument.mutateAsync({
      type: 'quote',
      documentId: selectedQuoteForEmail,
      recipientEmail: emailRecipient,
    });
    setEmailDialogOpen(false);
    setSelectedQuoteForEmail(null);
    setEmailRecipient('');
  };

  const handleConvertToInvoice = async (quoteId: string) => {
    if (confirm('Convert this quote to an invoice?')) {
      await convertToInvoice.mutateAsync({ quoteId });
    }
  };

  const handleStatusChange = async (quoteId: string, newStatus: string) => {
    try {
      await updateQuote.mutateAsync({ id: quoteId, status: newStatus } as any);
      toast.success(`Quote marked as ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
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
          <h1 className="text-3xl font-bold">Quotes</h1>
          <p className="text-muted-foreground mt-1">{quotes.length} total quotes</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Quote
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingQuote ? 'Edit Quote' : 'Create New Quote'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InlineCustomerForm
                  customers={customers}
                  selectedCustomerId={formData.customerId}
                  onCustomerSelect={(value) => setFormData({ ...formData, customerId: value })}
                />
                
                <div className="space-y-2">
                  <Label>Valid For (days)</Label>
                  <Input
                    type="number"
                    value={formData.validDays}
                    onChange={(e) => setFormData({ ...formData, validDays: parseInt(e.target.value) || 30 })}
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
                  <div key={item.id} className="flex gap-2 items-start">
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
                      placeholder="Price"
                      value={item.unitPrice}
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
              
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={createQuote.isPending || updateQuote.isPending}>
                  {(createQuote.isPending || updateQuote.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingQuote ? 'Update' : 'Create'} Quote
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
            placeholder="Search quotes..."
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
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quote List */}
      <div className="space-y-3">
        {filteredQuotes.map((quote) => (
          <Card key={quote.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                {/* Left: Icon + Info - Clickable */}
                <div 
                  className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 cursor-pointer"
                  onClick={() => setViewingQuote(quote)}
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm sm:text-base">{quote.quote_number}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(quote.status)}`}>
                        {quote.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{getCustomerName(quote.customer_id)}</p>
                    {/* Mobile: Amount + Date */}
                    <div className="flex items-center gap-3 mt-1 sm:hidden">
                      <p className="font-semibold text-sm flex items-center gap-0.5">
                        <DollarSign className="w-3.5 h-3.5" />
                        {Number(quote.total).toLocaleString()}
                      </p>
                      {quote.valid_until && (
                        <p className="text-xs text-muted-foreground">
                          Valid: {format(new Date(quote.valid_until), 'MMM d')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Desktop Amount + Actions */}
                <div className="flex items-center gap-4 sm:gap-6 justify-end">
                  <div className="text-right hidden sm:block">
                    <p className="font-semibold flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {Number(quote.total).toLocaleString()}
                    </p>
                    {quote.valid_until && (
                      <p className="text-xs text-muted-foreground">
                        Valid until {format(new Date(quote.valid_until), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {/* Status change dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" title="Change Status">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange(quote.id, 'sent')}
                          disabled={quote.status === 'sent'}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Mark as Sent
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange(quote.id, 'accepted')}
                          disabled={quote.status === 'accepted'}
                        >
                          <CheckCircle className="w-4 h-4 mr-2 text-success" />
                          Mark as Accepted
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange(quote.id, 'rejected')}
                          disabled={quote.status === 'rejected'}
                        >
                          <XCircle className="w-4 h-4 mr-2 text-destructive" />
                          Mark as Rejected
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange(quote.id, 'draft')}
                          disabled={quote.status === 'draft'}
                        >
                          Reset to Draft
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDownload(quote.id)}
                      title="Download PDF"
                    >
                      <FileDown className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleOpenEmailDialog(quote.id, quote.customer_id)}
                      title="Email Quote"
                    >
                      <Mail className="w-4 h-4" />
                    </Button>
                    {quote.status === 'accepted' && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleConvertToInvoice(quote.id)}
                        title="Convert to Invoice"
                        disabled={convertToInvoice.isPending}
                      >
                        <ArrowRight className="w-4 h-4 text-success" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(quote)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(quote.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredQuotes.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No quotes found</h3>
          <p className="text-muted-foreground mt-1">
            {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first quote to get started'}
          </p>
        </div>
      )}

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Email Quote</DialogTitle>
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

      {/* Quote Detail Dialog for viewing from URL */}
      {viewingQuote && (
        <Dialog open={!!viewingQuote} onOpenChange={(open) => !open && setViewingQuote(null)}>
          <DialogContent className="max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between pr-8">
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                  <span className="truncate">{viewingQuote.quote_number}</span>
                </DialogTitle>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 ${getStatusColor(viewingQuote.status)}`}>
                  {viewingQuote.status}
                </span>
              </div>
            </DialogHeader>

            <div className="space-y-4 sm:space-y-6">
              {/* Customer & Dates - responsive grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium text-sm sm:text-base truncate">{getCustomerName(viewingQuote.customer_id)}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Created</p>
                  <p className="font-medium text-sm sm:text-base">{format(new Date(viewingQuote.created_at), 'MMM d, yyyy')}</p>
                </div>
                {viewingQuote.valid_until && (
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Valid Until</p>
                    <p className="font-medium text-sm sm:text-base">{format(new Date(viewingQuote.valid_until), 'MMM d, yyyy')}</p>
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div>
                <h4 className="font-medium mb-2 sm:mb-3 text-sm sm:text-base">Line Items</h4>
                <div className="space-y-2">
                  {viewingQuote.items && viewingQuote.items.length > 0 ? (
                    <>
                      {/* Desktop header - hidden on mobile */}
                      <div className="hidden sm:grid grid-cols-12 text-xs text-muted-foreground font-medium px-2">
                        <div className="col-span-6">Description</div>
                        <div className="col-span-2 text-right">Qty</div>
                        <div className="col-span-2 text-right">Price</div>
                        <div className="col-span-2 text-right">Total</div>
                      </div>
                      {viewingQuote.items.map((item: any) => (
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
                    <span>${Number(viewingQuote.subtotal).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>${Number(viewingQuote.tax).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base sm:text-lg pt-2 border-t">
                    <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" />Total</span>
                    <span>${Number(viewingQuote.total).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {viewingQuote.notes && (
                <div>
                  <h4 className="font-medium mb-2 text-sm sm:text-base">Notes</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">{viewingQuote.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 sm:pt-4">
                <Button variant="outline" size="sm" onClick={() => handleDownload(viewingQuote.id)} className="flex-1 sm:flex-none">
                  <FileDown className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleOpenEmailDialog(viewingQuote.id, viewingQuote.customer_id)} className="flex-1 sm:flex-none">
                  <Mail className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Email</span>
                </Button>
                {viewingQuote.status !== 'rejected' && (
                  <Button variant="outline" size="sm" onClick={() => handleConvertToInvoice(viewingQuote.id)} className="flex-1 sm:flex-none">
                    <ArrowRight className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Convert to Invoice</span>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => { handleEdit(viewingQuote); setViewingQuote(null); }} className="w-full sm:w-auto sm:ml-auto mt-2 sm:mt-0">
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

export default Quotes;
