import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { useInvoices, useCreateInvoice, useUpdateInvoice, Invoice } from "@/hooks/useInvoices";
import { useCustomers } from "@/hooks/useCustomers";
import { useProfiles } from "@/hooks/useProfiles";
import { useCompany } from "@/hooks/useCompany";
import { useJobs, Job } from "@/hooks/useJobs";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, FileInput } from "lucide-react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { InlineCustomerForm } from "@/components/customers/InlineCustomerForm";
import { DiscountInput, calculateDiscountAmount, formatDiscount } from "@/components/ui/discount-input";
import { LineItemsEditor, LineItem } from '@/components/line-items/LineItemsEditor';
import { InvoiceListManager } from "@/components/invoices/InvoiceListManager";
import { InvoiceListControls } from "@/components/invoices/InvoiceListControls";
import PageContainer from '@/components/layout/PageContainer';

const Invoices = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Determine if we need archived data based on URL or default
  const [includeArchived, setIncludeArchived] = useState(false);
  const { data: invoices = [], isLoading, refetch: refetchInvoices } = useInvoices(includeArchived);
  const { data: customers = [] } = useCustomers();
  const { data: profiles = [] } = useProfiles();
  const { data: company } = useCompany();
  const { data: jobs = [] } = useJobs();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const { saveScrollPosition, restoreScrollPosition } = useScrollRestoration();

  // Jobs available for import (completed/in_progress but not yet invoiced)
  const availableJobsForImport = jobs.filter(job => 
    (job.status === 'completed' || job.status === 'in_progress') && 
    !invoices.some(inv => inv.job_id === job.id)
  );

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<string | null>(null);
  const [pendingEditInvoiceId, setPendingEditInvoiceId] = useState<string | null>(null);
  const [pendingDuplicateInvoiceId, setPendingDuplicateInvoiceId] = useState<string | null>(null);

  // Search and filter state (lifted for header placement)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form state
  const [formData, setFormData] = useState<{
    customerId: string;
    assignedTo: string;
    items: LineItem[];
    notes: string;
    status: string;
    dueDays: number;
    discountType: 'amount' | 'percentage';
    discountValue: number;
    importedJobId: string | null;
  }>({
    customerId: "",
    assignedTo: "",
    items: [{ id: "1", description: "", quantity: 1, unitPrice: 0, type: 'service' }],
    notes: "",
    status: "draft",
    dueDays: 30,
    discountType: "amount",
    discountValue: 0,
    importedJobId: null
  });

  // Wrapped setters for scroll restoration
  const openEditDialog = useCallback((open: boolean) => {
    if (open) saveScrollPosition();
    setIsDialogOpen(open);
    if (!open) restoreScrollPosition();
  }, [saveScrollPosition, restoreScrollPosition]);

  // Handle URL params for edit/duplicate/create
  useEffect(() => {
    const createParam = searchParams.get("create");
    const editInvoiceId = searchParams.get("edit");
    const duplicateInvoiceId = searchParams.get("duplicate");
    
    // Handle create param from mobile FAB
    if (createParam === "true") {
      resetForm();
      openEditDialog(true);
      searchParams.delete("create");
      setSearchParams(searchParams, { replace: true });
      return;
    }
    
    if (editInvoiceId && invoices.length > 0) {
      setPendingEditInvoiceId(editInvoiceId);
      searchParams.delete("edit");
      setSearchParams(searchParams, { replace: true });
    } else if (duplicateInvoiceId && invoices.length > 0) {
      setPendingDuplicateInvoiceId(duplicateInvoiceId);
      searchParams.delete("duplicate");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, invoices, setSearchParams]);

  // Handle pending edit
  useEffect(() => {
    if (pendingEditInvoiceId && invoices.length > 0) {
      const invoice = invoices.find(i => i.id === pendingEditInvoiceId);
      if (invoice) {
        handleEdit(invoice);
        setPendingEditInvoiceId(null);
      }
    }
  }, [pendingEditInvoiceId, invoices]);

  // Handle pending duplicate
  useEffect(() => {
    if (pendingDuplicateInvoiceId && invoices.length > 0) {
      const invoice = invoices.find(i => i.id === pendingDuplicateInvoiceId);
      if (invoice) {
        handleDuplicate(invoice);
        setPendingDuplicateInvoiceId(null);
      }
    }
  }, [pendingDuplicateInvoiceId, invoices]);

  const resetForm = () => {
    setFormData({
      customerId: "",
      assignedTo: "",
      items: [{ id: "1", description: "", quantity: 1, unitPrice: 0, type: 'service' }],
      notes: "",
      status: "draft",
      dueDays: 30,
      discountType: "amount",
      discountValue: 0,
      importedJobId: null
    });
    setEditingInvoice(null);
  };

  const handleImportJob = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    setFormData({
      customerId: job.customer_id,
      assignedTo: job.assigned_to || (job.assignees?.[0]?.profile_id) || "",
      items: job.items?.map((item: any) => ({
        id: Date.now().toString() + Math.random(),
        description: item.description,
        itemDescription: item.item_description || '',
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        type: item.type || 'service'
      })) || [{ id: "1", description: "", itemDescription: "", quantity: 1, unitPrice: 0, type: 'service' }],
      notes: job.notes || "",
      status: "draft",
      dueDays: 30,
      discountType: (job.discount_type as 'amount' | 'percentage') || "amount",
      discountValue: Number(job.discount_value) || 0,
      importedJobId: job.id
    });
    toast.success(`Imported from ${job.job_number} - ${job.title}`);
  };

  const handleAddItem = (type: 'product' | 'service' = 'service') => {
    setFormData({
      ...formData,
      items: [...formData.items, { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0, type }]
    });
  };

  const handleRemoveItem = (id: string) => {
    if (formData.items.length > 1) {
      setFormData({ ...formData, items: formData.items.filter(item => item.id !== id) });
    }
  };

  const handleItemChange = (id: string, field: keyof LineItem, value: string | number) => {
    setFormData({
      ...formData,
      items: formData.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    });
  };

  const calculateTotal = (items: LineItem[]) => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) {
      toast.error("Please select a customer");
      return;
    }
    
    const subtotal = calculateTotal(formData.items);
    const discountAmount = calculateDiscountAmount(subtotal, formData.discountType, formData.discountValue);
    const afterDiscount = subtotal - discountAmount;
    
    const invoiceData = {
      customer_id: formData.customerId,
      assigned_to: formData.assignedTo || null,
      notes: formData.notes || null,
      status: formData.status,
      due_date: format(addDays(new Date(), formData.dueDays), "yyyy-MM-dd"),
      subtotal,
      tax: 0,
      total: afterDiscount,
      discount_type: formData.discountValue > 0 ? formData.discountType : null,
      discount_value: formData.discountValue > 0 ? formData.discountValue : 0,
      job_id: formData.importedJobId || null
    };
    
    try {
      const itemsData = formData.items.map(item => ({
        description: item.description,
        item_description: item.itemDescription || null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.quantity * item.unitPrice,
        type: item.type || 'service'
      }));
      
      if (editingInvoice) {
        await updateInvoice.mutateAsync({ id: editingInvoice, ...invoiceData, items: itemsData } as any);
        toast.success("Invoice updated successfully");
      } else {
        const createdInvoice = await createInvoice.mutateAsync({ ...invoiceData, items: itemsData } as any);
        
        // If importing from a job, copy the job photos to the invoice
        if (formData.importedJobId && createdInvoice?.id) {
          const importedJob = jobs.find(j => j.id === formData.importedJobId);
          if (importedJob?.photos && importedJob.photos.length > 0) {
            try {
              // Copy each photo from job_photos to invoice_photos
              const photoInserts = importedJob.photos.map((photo, index) => ({
                invoice_id: createdInvoice.id,
                photo_url: photo.photo_url,
                photo_type: photo.photo_type,
                caption: photo.caption,
                display_order: index,
                uploaded_by: photo.uploaded_by
              }));
              
              await (supabase as any)
                .from('invoice_photos')
                .insert(photoInserts);
              
              toast.success(`Imported ${importedJob.photos.length} photos from job`);
            } catch (photoError) {
              console.error('Failed to copy photos:', photoError);
              // Don't fail the whole operation if photo copy fails
            }
          }
        }
        
        toast.success("Invoice created successfully");
      }
      openEditDialog(false);
      resetForm();
    } catch (error) {
      toast.error(editingInvoice ? "Failed to update invoice" : "Failed to create invoice");
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setFormData({
      customerId: invoice.customer_id,
      assignedTo: invoice.assigned_to || "",
      items: invoice.items?.map((item: any) => ({
        id: item.id,
        description: item.description,
        itemDescription: item.item_description || '',
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        type: item.type || 'service'
      })) || [{ id: "1", description: "", itemDescription: "", quantity: 1, unitPrice: 0, type: 'service' }],
      notes: invoice.notes || "",
      status: invoice.status as any,
      dueDays: 30,
      discountType: (invoice.discount_type as 'amount' | 'percentage') || "amount",
      discountValue: Number(invoice.discount_value) || 0,
      importedJobId: invoice.job_id || null
    });
    setEditingInvoice(invoice.id);
    openEditDialog(true);
  };

  const handleDuplicate = (invoice: Invoice) => {
    setFormData({
      customerId: invoice.customer_id,
      assignedTo: invoice.assigned_to || "",
      items: invoice.items?.map((item: any) => ({
        id: Date.now().toString() + Math.random(),
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        type: item.type || 'service'
      })) || [{ id: "1", description: "", quantity: 1, unitPrice: 0, type: 'service' }],
      notes: invoice.notes || "",
      status: "draft",
      dueDays: 30,
      discountType: (invoice.discount_type as 'amount' | 'percentage') || "amount",
      discountValue: Number(invoice.discount_value) || 0,
      importedJobId: null
    });
    setEditingInvoice(null);
    openEditDialog(true);
    toast.success("Invoice duplicated - make changes and save");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageContainer className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground mt-1 hidden sm:block">{invoices.length} total invoices</p>
        </div>

        <div className="flex items-center gap-2">
          <InvoiceListControls
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />

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
              <DialogTitle>{editingInvoice ? "Edit Invoice" : "Create New Invoice"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Import from Job - only show when creating new invoice */}
              {!editingInvoice && availableJobsForImport.length > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg border border-dashed">
                  <Label className="flex items-center gap-2 text-sm font-medium mb-2">
                    <FileInput className="w-4 h-4" />
                    Import from Existing Job
                  </Label>
                  <Select
                    value={formData.importedJobId || "none"}
                    onValueChange={(value) => {
                      if (value === "none") {
                        resetForm();
                      } else {
                        handleImportJob(value);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a job to import..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No job selected</SelectItem>
                      {availableJobsForImport.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.job_number} - {job.title} ({job.customer?.name || 'No customer'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.importedJobId && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Importing from: {jobs.find(j => j.id === formData.importedJobId)?.job_number}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InlineCustomerForm
                  customers={customers}
                  selectedCustomerId={formData.customerId}
                  onCustomerSelect={value => setFormData({ ...formData, customerId: value })}
                />
                <div className="space-y-2">
                  <Label>Due In (days)</Label>
                  <Input
                    type="number"
                    value={formData.dueDays}
                    onChange={e => setFormData({ ...formData, dueDays: parseInt(e.target.value) || 30 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assigned Technician</Label>
                <Select value={formData.assignedTo} onValueChange={value => setFormData({ ...formData, assignedTo: value === "none" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select technician (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No technician assigned</SelectItem>
                    {profiles.filter(p => p.role === "technician" || p.role === "admin" || p.role === "manager").map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  <span>${calculateTotal(formData.items).toLocaleString()}</span>
                </div>
                {formData.discountValue > 0 && (
                  <div className="flex justify-between text-sm text-success">
                    <span>Discount ({formatDiscount(formData.discountType, formData.discountValue)}):</span>
                    <span>-${calculateDiscountAmount(calculateTotal(formData.items), formData.discountType, formData.discountValue).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg pt-1 border-t">
                  <span>Total:</span>
                  <span>${(calculateTotal(formData.items) - calculateDiscountAmount(calculateTotal(formData.items), formData.discountType, formData.discountValue)).toLocaleString()}</span>
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
                <Button type="submit" className="flex-1" disabled={createInvoice.isPending || updateInvoice.isPending}>
                  {(createInvoice.isPending || updateInvoice.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingInvoice ? "Update" : "Create"} Invoice
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Invoice List Manager */}
      <div className="lg:max-w-4xl lg:mx-auto">
        <InvoiceListManager
          invoices={invoices}
          customers={customers}
          profiles={profiles}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          hideInlineControls={true}
          onEditInvoice={handleEdit}
          onCreateInvoice={() => openEditDialog(true)}
          onRefetch={async () => { await refetchInvoices(); }}
          isLoading={isLoading}
        />
      </div>
    </PageContainer>
  );
};

export default Invoices;
