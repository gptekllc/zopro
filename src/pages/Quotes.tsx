import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNavigationBlocker } from '@/hooks/useNavigationBlocker';
import { PullToRefresh, ListSkeleton } from '@/components/ui/pull-to-refresh';
import { useQueryClient } from '@tanstack/react-query';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { useQuotes, useCreateQuote, useUpdateQuote, Quote } from '@/hooks/useQuotes';
import { useCustomers } from '@/hooks/useCustomers';
import { useProfiles } from '@/hooks/useProfiles';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2, BookTemplate } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { InlineCustomerForm } from '@/components/customers/InlineCustomerForm';
import { SaveAsQuoteTemplateDialog } from '@/components/quotes/SaveAsQuoteTemplateDialog';
import { SelectQuoteTemplateDialog } from '@/components/quotes/SelectQuoteTemplateDialog';
import { QuoteTemplate } from '@/hooks/useQuoteTemplates';
import { DiscountInput, calculateDiscountAmount, formatDiscount } from "@/components/ui/discount-input";
import { LineItemsEditor, LineItem } from '@/components/line-items/LineItemsEditor';
import { QuoteListManager } from '@/components/quotes/QuoteListManager';
import { QuoteListControls } from '@/components/quotes/QuoteListControls';
import PageContainer from '@/components/layout/PageContainer';
import { formatAmount } from '@/lib/formatAmount';


const Quotes = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Determine if we need archived data
  const [includeArchived, setIncludeArchived] = useState(false);
  const { data: quotes = [], isLoading, refetch: refetchQuotes } = useQuotes(includeArchived);
  const { data: customers = [] } = useCustomers();
  const { data: profiles = [] } = useProfiles();
  const { data: company } = useCompany();
  
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const { saveScrollPosition, restoreScrollPosition } = useScrollRestoration();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['quotes'] });
  }, [queryClient]);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  useNavigationBlocker(isDialogOpen);
  const [editingQuote, setEditingQuote] = useState<string | null>(null);
  const [pendingEditQuoteId, setPendingEditQuoteId] = useState<string | null>(null);
  const [pendingDuplicateQuoteId, setPendingDuplicateQuoteId] = useState<string | null>(null);
  const [pendingSaveTemplateQuoteId, setPendingSaveTemplateQuoteId] = useState<string | null>(null);

  // Search and filter state (lifted for header placement)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>(['all']);

  // Template dialogs
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [selectedQuoteForTemplate, setSelectedQuoteForTemplate] = useState<Quote | null>(null);
  const [selectTemplateDialogOpen, setSelectTemplateDialogOpen] = useState(false);

  // Available technicians for assignment
  const technicians = profiles.filter(p => p.role === 'technician' || p.role === 'admin' || p.role === 'manager');
  const availableTechnicians = technicians.filter(p => p.employment_status !== 'on_leave');

  // Form state
  const [formData, setFormData] = useState<{
    customerId: string;
    items: LineItem[];
    notes: string;
    status: string;
    validDays: number;
    createdBy: string;
    assignedTo: string;
    discountType: 'amount' | 'percentage';
    discountValue: number;
  }>({
    customerId: '',
    items: [{ id: '1', description: '', quantity: 1, unitPrice: 0, type: 'service', taxable: true }],
    notes: '',
    status: 'draft',
    validDays: 30,
    createdBy: '',
    assignedTo: '',
    discountType: 'amount',
    discountValue: 0
  });

  // Wrapped setters for scroll restoration
  const openEditDialog = useCallback((open: boolean) => {
    if (open) saveScrollPosition();
    setIsDialogOpen(open);
    if (!open) restoreScrollPosition();
  }, [saveScrollPosition, restoreScrollPosition]);

  // State for viewing quote from URL
  const [urlViewQuoteId, setUrlViewQuoteId] = useState<string | null>(null);

  // Handle URL params for edit/duplicate/saveTemplate/create/view
  useEffect(() => {
    const createParam = searchParams.get('create');
    const editQuoteId = searchParams.get('edit');
    const duplicateQuoteId = searchParams.get('duplicate');
    const saveTemplateId = searchParams.get('saveTemplate');
    const viewQuoteId = searchParams.get('view');
    
    // Handle create param from mobile FAB
    if (createParam === 'true') {
      resetForm();
      openEditDialog(true);
      searchParams.delete('create');
      setSearchParams(searchParams, { replace: true });
      return;
    }
    
    if (viewQuoteId && quotes.length > 0) {
      setUrlViewQuoteId(viewQuoteId);
      searchParams.delete('view');
      setSearchParams(searchParams, { replace: true });
    } else if (saveTemplateId && quotes.length > 0) {
      setPendingSaveTemplateQuoteId(saveTemplateId);
      searchParams.delete('saveTemplate');
      setSearchParams(searchParams, { replace: true });
    } else if (editQuoteId && quotes.length > 0) {
      setPendingEditQuoteId(editQuoteId);
      searchParams.delete('edit');
      setSearchParams(searchParams, { replace: true });
    } else if (duplicateQuoteId && quotes.length > 0) {
      setPendingDuplicateQuoteId(duplicateQuoteId);
      searchParams.delete('duplicate');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, quotes, setSearchParams]);

  // Handle pending save template
  useEffect(() => {
    if (pendingSaveTemplateQuoteId && quotes.length > 0) {
      const quote = quotes.find(q => q.id === pendingSaveTemplateQuoteId);
      if (quote) {
        setSelectedQuoteForTemplate(quote);
        setSaveTemplateDialogOpen(true);
        setPendingSaveTemplateQuoteId(null);
      }
    }
  }, [pendingSaveTemplateQuoteId, quotes]);

  // Handle pending edit
  useEffect(() => {
    if (pendingEditQuoteId && quotes.length > 0) {
      const quote = quotes.find(q => q.id === pendingEditQuoteId);
      if (quote) {
        handleEdit(quote);
        setPendingEditQuoteId(null);
      }
    }
  }, [pendingEditQuoteId, quotes]);

  // Handle pending duplicate
  useEffect(() => {
    if (pendingDuplicateQuoteId && quotes.length > 0) {
      const quote = quotes.find(q => q.id === pendingDuplicateQuoteId);
      if (quote) {
        handleDuplicate(quote);
        setPendingDuplicateQuoteId(null);
      }
    }
  }, [pendingDuplicateQuoteId, quotes]);

  const resetForm = () => {
    setFormData({
      customerId: '',
      items: [{ id: '1', description: '', quantity: 1, unitPrice: 0, type: 'service' }],
      notes: '',
      status: 'draft',
      validDays: 30,
      createdBy: '',
      assignedTo: '',
      discountType: 'amount',
      discountValue: 0
    });
    setEditingQuote(null);
  };

  const handleAddItem = (type: 'product' | 'service' = 'service') => {
    setFormData({
      ...formData,
      items: [...formData.items, { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, type }]
    });
  };

  const handleRemoveItem = (id: string) => {
    if (formData.items.length > 1) {
      setFormData({ ...formData, items: formData.items.filter(item => item.id !== id) });
    }
  };

  const handleItemChange = (id: string, field: keyof LineItem, value: string | number | boolean) => {
    setFormData({
      ...formData,
      items: formData.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    });
  };

  const calculateTotal = (items: LineItem[]) => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  // State for auto-opening detail dialog after create/update
  const [pendingViewQuoteId, setPendingViewQuoteId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) {
      toast.error('Please select a customer');
      return;
    }
    
    const subtotal = calculateTotal(formData.items);
    const discountAmount = calculateDiscountAmount(subtotal, formData.discountType, formData.discountValue);
    const afterDiscount = subtotal - discountAmount;
    
    const quoteData: any = {
      customer_id: formData.customerId,
      notes: formData.notes || null,
      status: formData.status,
      valid_until: format(addDays(new Date(), formData.validDays), 'yyyy-MM-dd'),
      subtotal,
      tax: 0,
      total: afterDiscount,
      discount_type: formData.discountValue > 0 ? formData.discountType : null,
      discount_value: formData.discountValue > 0 ? formData.discountValue : 0,
      assigned_to: formData.assignedTo || null
    };

    if (formData.createdBy) {
      quoteData.created_by = formData.createdBy;
    }
    
    try {
      const itemsData = formData.items.map(item => ({
        description: item.description,
        item_description: item.itemDescription || null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.quantity * item.unitPrice,
        type: item.type || 'service',
        taxable: item.taxable !== false
      }));
      
      let resultQuoteId: string | null = null;
      if (editingQuote) {
        await updateQuote.mutateAsync({ id: editingQuote, ...quoteData, items: itemsData } as any);
        resultQuoteId = editingQuote;
        toast.success('Quote updated successfully');
      } else {
        const created = await createQuote.mutateAsync({ ...quoteData, items: itemsData } as any);
        resultQuoteId = created?.id || null;
        toast.success('Quote created successfully');
      }
      openEditDialog(false);
      resetForm();
      
      // Refresh the page to ensure all list cards show updated data
      window.location.reload();
    } catch (error) {
      toast.error(editingQuote ? 'Failed to update quote' : 'Failed to create quote');
    }
  };

  const handleEdit = (quote: Quote) => {
    setFormData({
      customerId: quote.customer_id,
      items: quote.items?.map((item: any) => ({
        id: item.id,
        description: item.description,
        itemDescription: item.item_description || '',
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        type: item.type || 'service',
        taxable: item.taxable !== false
      })) || [{ id: '1', description: '', itemDescription: '', quantity: 1, unitPrice: 0, type: 'service', taxable: true }],
      notes: quote.notes || '',
      status: quote.status as any,
      validDays: 30,
      createdBy: quote.created_by || '',
      assignedTo: quote.assigned_to || '',
      discountType: (quote.discount_type as 'amount' | 'percentage') || 'amount',
      discountValue: Number(quote.discount_value) || 0
    });
    setEditingQuote(quote.id);
    openEditDialog(true);
  };

  const handleDuplicate = (quote: Quote) => {
    setFormData({
      customerId: quote.customer_id,
      items: quote.items?.map((item: any) => ({
        id: Date.now().toString() + Math.random(),
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        type: item.type || 'service'
      })) || [{ id: '1', description: '', quantity: 1, unitPrice: 0, type: 'service' }],
      notes: quote.notes || '',
      status: 'draft',
      validDays: 30,
      createdBy: '',
      assignedTo: '',
      discountType: (quote.discount_type as 'amount' | 'percentage') || 'amount',
      discountValue: Number(quote.discount_value) || 0
    });
    setEditingQuote(null);
    openEditDialog(true);
    toast.success('Quote duplicated - make changes and save');
  };

  const handleSelectTemplate = (template: QuoteTemplate) => {
    setFormData({
      customerId: '',
      items: template.items?.map(item => ({
        id: Date.now().toString() + Math.random(),
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        type: (item as any).type || 'service'
      })) || [{ id: '1', description: '', quantity: 1, unitPrice: 0, type: 'service' }],
      notes: template.notes || '',
      status: 'draft',
      validDays: template.valid_days || 30,
      createdBy: '',
      assignedTo: '',
      discountType: 'amount',
      discountValue: 0
    });
    setEditingQuote(null);
    openEditDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} renderSkeleton={() => <ListSkeleton count={5} />} className="min-h-full">
    <PageContainer className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Quotes</h1>
          <p className="text-muted-foreground mt-1 hidden sm:block">{quotes.length} total quotes</p>
        </div>

        <div className="flex items-center gap-2">
          <QuoteListControls
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
          
          <Button variant="outline" className="gap-2 hidden sm:flex" onClick={() => setSelectTemplateDialogOpen(true)}>
            <BookTemplate className="w-4 h-4" />
            <span className="hidden lg:inline">From Template</span>
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={open => {
            openEditDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 hidden sm:flex">
                <Plus className="w-4 h-4" />
                Create Quote
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-3xl overflow-y-auto">
              <DialogHeader className="flex-shrink-0 pr-8">
                <DialogTitle>{editingQuote ? 'Edit Quote' : 'Create New Quote'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-[2fr_1fr_1fr] md:gap-4">
                  <InlineCustomerForm
                    customers={customers}
                    selectedCustomerId={formData.customerId}
                    onCustomerSelect={value => setFormData({ ...formData, customerId: value })}
                  />
                  <div className="grid grid-cols-2 gap-4 md:contents">
                    <div className="space-y-2">
                      <Label>Valid For (days)</Label>
                      <Input
                        type="number"
                        value={formData.validDays}
                        onChange={e => setFormData({ ...formData, validDays: parseInt(e.target.value) || 30 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={formData.status} onValueChange={value => setFormData({ ...formData, status: value })}>
                        <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft" className="capitalize">Draft</SelectItem>
                          <SelectItem value="sent" className="capitalize">Sent</SelectItem>
                          <SelectItem value="accepted" className="capitalize">Accepted</SelectItem>
                          <SelectItem value="rejected" className="capitalize">Rejected</SelectItem>
                          <SelectItem value="expired" className="capitalize">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Assign To</Label>
                    <Select value={formData.assignedTo} onValueChange={value => setFormData({ ...formData, assignedTo: value === "none" ? "" : value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select technician (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not assigned</SelectItem>
                        {availableTechnicians.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {technicians.some(t => t.employment_status === 'on_leave') && (
                      <p className="text-xs text-muted-foreground">Team members on leave are hidden</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Created By</Label>
                    <Select value={formData.createdBy} onValueChange={value => setFormData({ ...formData, createdBy: value === "none" ? "" : value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select team member (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        {availableTechnicians.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Line Items */}
                <LineItemsEditor
                  items={formData.items}
                  onAddItem={handleAddItem}
                  onAddFromCatalog={(catalogItem) => {
                    setFormData({
                      ...formData,
                      items: [...formData.items, {
                        id: Date.now().toString(),
                        description: catalogItem.name,
                        itemDescription: catalogItem.description || '',
                        quantity: 1,
                        unitPrice: Number(catalogItem.unit_price),
                        type: catalogItem.type
                      }]
                    });
                  }}
                  onRemoveItem={handleRemoveItem}
                  onUpdateItem={handleItemChange}
                />

                {/* Discount and Totals */}
                <div className="border-t pt-3 space-y-2">
                  <DiscountInput
                    discountType={formData.discountType}
                    discountValue={formData.discountValue}
                    onDiscountTypeChange={(type) => setFormData({ ...formData, discountType: type })}
                    onDiscountValueChange={(value) => setFormData({ ...formData, discountValue: value })}
                  />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>${formatAmount(calculateTotal(formData.items))}</span>
                  </div>
                  {formData.discountValue > 0 && (
                    <div className="flex justify-between text-sm text-success">
                      <span>Discount ({formatDiscount(formData.discountType, formData.discountValue)}):</span>
                      <span>-${formatAmount(calculateDiscountAmount(calculateTotal(formData.items), formData.discountType, formData.discountValue))}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-lg pt-1 border-t">
                    <span>Total:</span>
                    <span>${formatAmount(calculateTotal(formData.items) - calculateDiscountAmount(calculateTotal(formData.items), formData.discountType, formData.discountValue))}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={3} />
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => openEditDialog(false)}>
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
      </div>

      {/* Quote List Manager */}
      <div className="lg:max-w-4xl lg:mx-auto">
        <QuoteListManager
          quotes={quotes}
          customers={customers}
          profiles={profiles}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          hideInlineControls={true}
          onEditQuote={handleEdit}
          onCreateQuote={() => openEditDialog(true)}
          onRefetch={async () => { await refetchQuotes(); }}
          isLoading={isLoading}
          initialViewQuoteId={urlViewQuoteId || pendingViewQuoteId}
          onInitialViewHandled={() => {
            setUrlViewQuoteId(null);
            setPendingViewQuoteId(null);
          }}
        />
      </div>

      {/* Save As Template Dialog */}
      {selectedQuoteForTemplate && (
        <SaveAsQuoteTemplateDialog
          quote={selectedQuoteForTemplate}
          open={saveTemplateDialogOpen}
          onOpenChange={(open) => {
            setSaveTemplateDialogOpen(open);
            if (!open) setSelectedQuoteForTemplate(null);
          }}
        />
      )}

      {/* Select Template Dialog */}
      <SelectQuoteTemplateDialog
        open={selectTemplateDialogOpen}
        onOpenChange={setSelectTemplateDialogOpen}
        onSelect={handleSelectTemplate}
      />
    </PageContainer>
    </PullToRefresh>
  );
};

export default Quotes;
