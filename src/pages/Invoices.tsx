import { useState, useEffect, useCallback, useMemo } from "react";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useInvoices, useCreateInvoice, useUpdateInvoice, useDeleteInvoice, useApplyLateFee, useArchiveInvoice, useUnarchiveInvoice, isInvoiceOverdue, getTotalWithLateFee, Invoice, useSendPaymentReminder, useInvoiceReminders } from "@/hooks/useInvoices";
import { useCreatePayment, useInvoiceBalance } from "@/hooks/usePayments";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useCustomers } from "@/hooks/useCustomers";
import { useProfiles } from "@/hooks/useProfiles";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useEmailDocument, useDownloadDocument } from "@/hooks/useDocumentActions";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import { useSignInvoice } from "@/hooks/useSignatures";
import { useSendSignatureRequest } from "@/hooks/useSendSignatureRequest";
import { useInvoicePhotos, useUploadInvoicePhoto, useDeleteInvoicePhoto, useUpdateInvoicePhotoType } from "@/hooks/useInvoicePhotos";
import { DocumentPhotoGallery } from '@/components/photos/DocumentPhotoGallery';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Receipt, Trash2, Edit, DollarSign, CheckCircle, Loader2, FileDown, Mail, FileText, AlertCircle, MoreVertical, Copy, Filter, Archive, ArchiveRestore, PenTool, Eye, Send, Bell, UserCog, Wrench, ChevronRight, CheckCircle2, Briefcase, Link2, Image as ImageIcon, List } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { SignatureDialog } from "@/components/signatures/SignatureDialog";
import { ViewSignatureDialog } from "@/components/signatures/ViewSignatureDialog";
import { RecordPaymentDialog, PaymentData } from "@/components/invoices/RecordPaymentDialog";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { InlineCustomerForm } from "@/components/customers/InlineCustomerForm";
import { SignatureSection } from "@/components/signatures/SignatureSection";
import { ConstrainedPanel } from "@/components/ui/constrained-panel";
import { formatAmount } from "@/lib/formatAmount";
import { DiscountInput, calculateDiscountAmount, formatDiscount } from "@/components/ui/discount-input";
import { LineItemsEditor, LineItem } from '@/components/line-items/LineItemsEditor';
import { InvoiceListCard } from "@/components/invoices/InvoiceListCard";
import { useSwipeHint } from "@/components/ui/swipeable-card";
const normalizeMoneyInput = (value: number | string | null | undefined) => {
  if (typeof value !== "string") return value;
  // Supabase numeric fields can come back as strings like "24.2400".
  // Trim only *trailing* zeros so we don't end up displaying ".00" everywhere.
  const trimmed = value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return trimmed;
};
const Invoices = () => {
  const {
    profile
  } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("all");

  // Determine if we need archived data
  const needsArchivedData = statusFilter === "archived";
  const {
    data: invoices = [],
    isLoading,
    refetch: refetchInvoices
  } = useInvoices(needsArchivedData);
  const {
    data: customers = []
  } = useCustomers();
  const {
    data: profiles = []
  } = useProfiles();
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
  const sendPaymentReminder = useSendPaymentReminder();
  const createPayment = useCreatePayment();
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
    itemLabel: "invoice",
    timeout: 5000
  });
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedInvoiceForEmail, setSelectedInvoiceForEmail] = useState<string | null>(null);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [archiveConfirmInvoice, setArchiveConfirmInvoice] = useState<Invoice | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<string | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<(typeof invoices)[0] | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<(typeof invoices)[0] | null>(null);

  // Signature dialogs
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [signatureInvoice, setSignatureInvoice] = useState<Invoice | null>(null);
  const [viewSignatureId, setViewSignatureId] = useState<string | null>(null);
  const [viewSignatureOpen, setViewSignatureOpen] = useState(false);

  // Record Payment dialog
  const [recordPaymentDialogOpen, setRecordPaymentDialogOpen] = useState(false);
  const [pendingPaymentInvoice, setPendingPaymentInvoice] = useState<Invoice | null>(null);

  // Fetch reminders for the currently viewed invoice
  const {
    data: invoiceReminders = []
  } = useInvoiceReminders(viewingInvoice?.id || null);
  
  // Fetch balance for pending payment invoice
  const { data: pendingInvoiceBalance } = useInvoiceBalance(pendingPaymentInvoice?.id || null);
  
  // Fetch photos for the currently viewed invoice
  const { data: viewingInvoicePhotos = [] } = useInvoicePhotos(viewingInvoice?.id || null);
  const uploadInvoicePhoto = useUploadInvoicePhoto();
  const deleteInvoicePhoto = useDeleteInvoicePhoto();
  const updateInvoicePhotoType = useUpdateInvoicePhotoType();
  
  // Swipe hint for first-time users
  const { showHint: showSwipeHint, dismissHint: dismissSwipeHint } = useSwipeHint("invoices-swipe-hint-shown");

  // Wrapped setters for scroll restoration
  const openViewingInvoice = useCallback((invoice: (typeof invoices)[0] | null) => {
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
    assignedTo: string;
    items: LineItem[];
    notes: string;
    status: string;
    dueDays: number;
    discountType: 'amount' | 'percentage';
    discountValue: number;
  }>({
    customerId: "",
    assignedTo: "",
    items: [{
      id: "1",
      description: "",
      quantity: 1,
      unitPrice: 0
    }],
    notes: "",
    status: "draft",
    dueDays: 30,
    discountType: "amount",
    discountValue: 0
  });

  // State for pending edit from URL param
  const [pendingEditInvoiceId, setPendingEditInvoiceId] = useState<string | null>(null);

  // Handle URL param to auto-open invoice detail or edit form
  useEffect(() => {
    const viewInvoiceId = searchParams.get("view");
    const editInvoiceId = searchParams.get("edit");
    
    if (editInvoiceId && invoices.length > 0) {
      setPendingEditInvoiceId(editInvoiceId);
      // Clear the URL param
      searchParams.delete("edit");
      setSearchParams(searchParams, { replace: true });
    } else if (viewInvoiceId && invoices.length > 0) {
      const invoice = invoices.find(i => i.id === viewInvoiceId);
      if (invoice) {
        setViewingInvoice(invoice);
        // Clear the URL param after opening
        searchParams.delete("view");
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, invoices, setSearchParams]);
  const filteredInvoices = useMemo(() => {
    const filtered = invoices.filter(inv => {
      const customer = customers.find(c => c.id === inv.customer_id);
      const customerName = customer?.name || "";
      const matchesSearch = customerName.toLowerCase().includes(searchQuery.toLowerCase()) || inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase());

      // Handle archived filter separately
      if (statusFilter === "archived") {
        return matchesSearch && !!(inv as any).archived_at;
      }
      const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
      // Hide archived invoices when not viewing archived filter
      const notArchived = !(inv as any).archived_at;
      return matchesSearch && matchesStatus && notArchived;
    });
    return filterPendingInvoiceDeletes(filtered);
  }, [invoices, customers, searchQuery, statusFilter, filterPendingInvoiceDeletes]);

  // Infinite scroll for invoice list
  const { visibleItems: visibleInvoices, hasMore: hasMoreInvoices, loadMoreRef: loadMoreInvoicesRef, loadAll: loadAllInvoices, totalCount: totalInvoicesCount } = useInfiniteScroll(filteredInvoices, { pageSize: 20 });

  const resetForm = () => {
    setFormData({
      customerId: "",
      assignedTo: "",
      items: [{
        id: "1",
        description: "",
        quantity: 1,
        unitPrice: 0,
        type: 'service' as const
      }],
      notes: "",
      status: "draft",
      dueDays: 30,
      discountType: "amount",
      discountValue: 0
    });
    setEditingInvoice(null);
  };
  const handleAddItem = (type: 'product' | 'service' = 'service') => {
    setFormData({
      ...formData,
      items: [...formData.items, {
        id: Date.now().toString(),
        description: "",
        quantity: 1,
        unitPrice: 0,
        type
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
      discount_value: formData.discountValue > 0 ? formData.discountValue : 0
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
        await updateInvoice.mutateAsync({
          id: editingInvoice,
          ...invoiceData,
          items: itemsData
        } as any);
        toast.success("Invoice updated successfully");
      } else {
        await createInvoice.mutateAsync({
          ...invoiceData,
          items: itemsData
        } as any);
        toast.success("Invoice created successfully");
      }
      openEditDialog(false);
      resetForm();
    } catch (error) {
      toast.error(editingInvoice ? "Failed to update invoice" : "Failed to create invoice");
    }
  };
  const handleEdit = (invoice: (typeof invoices)[0]) => {
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
      })) || [{
        id: "1",
        description: "",
        itemDescription: "",
        quantity: 1,
        unitPrice: 0,
        type: 'service' as const
      }],
      notes: invoice.notes || "",
      status: invoice.status as any,
      dueDays: 30,
      discountType: (invoice.discount_type as 'amount' | 'percentage') || "amount",
      discountValue: Number(invoice.discount_value) || 0
    });
    setEditingInvoice(invoice.id);
    openEditDialog(true);
  };

  // Handle pending edit from URL param (after handleEdit is defined)
  useEffect(() => {
    if (pendingEditInvoiceId && invoices.length > 0) {
      const invoice = invoices.find(i => i.id === pendingEditInvoiceId);
      if (invoice) {
        handleEdit(invoice);
        setPendingEditInvoiceId(null);
      }
    }
  }, [pendingEditInvoiceId, invoices]);

  const handleDeleteClick = (invoice: (typeof invoices)[0]) => {
    setInvoiceToDelete(invoice);
  };
  const handleConfirmDelete = () => {
    if (invoiceToDelete) {
      scheduleInvoiceDelete(invoiceToDelete.id);
      setInvoiceToDelete(null);
    }
  };

  // Helper to initiate payment recording
  const initiateRecordPayment = (invoice: Invoice) => {
    setPendingPaymentInvoice(invoice);
    setRecordPaymentDialogOpen(true);
  };

  // Callback when payment is recorded
  const handleRecordPayment = async (paymentData: PaymentData) => {
    if (!pendingPaymentInvoice) return;
    
    // Get customer info for notification
    const customer = customers.find(c => c.id === pendingPaymentInvoice.customer_id);
    
    try {
      await createPayment.mutateAsync({
        invoiceId: pendingPaymentInvoice.id,
        amount: paymentData.amount,
        method: paymentData.method,
        paymentDate: paymentData.date,
        notes: paymentData.note || undefined,
        sendNotification: paymentData.sendNotification,
      });
      
      // Refresh viewing invoice if it's open
      if (viewingInvoice?.id === pendingPaymentInvoice.id) {
        refetchInvoices();
      }
      setRecordPaymentDialogOpen(false);
      setPendingPaymentInvoice(null);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleMarkPaid = async (id: string) => {
    const invoice = invoices.find(inv => inv.id === id);
    if (invoice) {
      initiateRecordPayment(invoice);
    }
  };
  const handleStatusChange = async (invoiceId: string, newStatus: string) => {
    // If changing to paid, show the record payment dialog
    if (newStatus === "paid") {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        initiateRecordPayment(invoice);
        return;
      }
    }
    
    try {
      const updateData: {
        id: string;
        status: string;
        paid_at?: string | null;
      } = {
        id: invoiceId,
        status: newStatus
      };
      // Clear paid_at when changing away from paid
      updateData.paid_at = null;
      await updateInvoice.mutateAsync(updateData as any);
      toast.success(`Invoice marked as ${newStatus}`);
    } catch (error) {
      toast.error("Failed to update status");
    }
  };
  const handleDuplicateInvoice = (invoice: (typeof invoices)[0]) => {
    setFormData({
      customerId: invoice.customer_id,
      assignedTo: invoice.assigned_to || "",
      items: invoice.items?.map((item: any) => ({
        id: Date.now().toString() + Math.random(),
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        type: item.type || 'service'
      })) || [{
        id: "1",
        description: "",
        quantity: 1,
        unitPrice: 0,
        type: 'service' as const
      }],
      notes: invoice.notes || "",
      status: "draft",
      dueDays: 30,
      discountType: (invoice.discount_type as 'amount' | 'percentage') || "amount",
      discountValue: Number(invoice.discount_value) || 0
    });
    setEditingInvoice(null);
    openEditDialog(true);
    toast.success("Invoice duplicated - make changes and save");
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-success/10 text-success";
      case "sent":
        return "bg-primary/10 text-primary";
      case "overdue":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };
  const getCustomerName = (customerId: string) => {
    return customers.find(c => c.id === customerId)?.name || "Unknown";
  };
  const getCustomerEmail = (customerId: string) => {
    return customers.find(c => c.id === customerId)?.email || "";
  };
  const lateFeePercentage = company?.late_fee_percentage ?? 0;
  const handleApplyLateFee = async (invoiceId: string) => {
    if (lateFeePercentage <= 0) {
      toast.error("No late fee percentage configured. Set it in Company Settings.");
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
      type: "invoice",
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
      toast.error("Please enter a recipient email");
      return;
    }
    await emailDocument.mutateAsync({
      type: "invoice",
      documentId: selectedInvoiceForEmail,
      recipientEmail: emailRecipient
    });
    setEmailDialogOpen(false);
    setSelectedInvoiceForEmail(null);
    setEmailRecipient("");
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
        status: "paid",
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
      toast.error("Customer does not have an email address");
      return;
    }
    sendSignatureRequest.mutate({
      documentType: "invoice",
      documentId: invoice.id,
      recipientEmail: customer.email,
      recipientName: customer.name,
      companyName: company?.name || "Company",
      documentNumber: invoice.invoice_number,
      customerId: customer.id
    });
  };
  const handleSendPaymentReminder = async (invoice: Invoice) => {
    try {
      await sendPaymentReminder.mutateAsync(invoice.id);
      // Update viewing invoice status to 'sent' if it was 'draft'
      if (viewingInvoice?.id === invoice.id && invoice.status === 'draft') {
        setViewingInvoice({
          ...viewingInvoice,
          status: 'sent'
        } as any);
      }
    } catch (error) {
      // Error is handled by the mutation's onError
    }
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
                <Button variant={statusFilter !== "all" ? "secondary" : "outline"} size="icon" className="h-9 w-9">
                  <Filter className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => setStatusFilter("all")} className={statusFilter === "all" ? "bg-accent" : ""}>
                  All Status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("draft")} className={statusFilter === "draft" ? "bg-accent" : ""}>
                  Draft
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("sent")} className={statusFilter === "sent" ? "bg-accent" : ""}>
                  Sent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("paid")} className={statusFilter === "paid" ? "bg-accent" : ""}>
                  Paid
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("overdue")} className={statusFilter === "overdue" ? "bg-accent" : ""}>
                  Overdue
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setStatusFilter("archived")} className={statusFilter === "archived" ? "bg-accent" : ""}>
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
                  <DialogTitle>{editingInvoice ? "Edit Invoice" : "Create New Invoice"}</DialogTitle>
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

                  <div className="space-y-2">
                    <Label>Assigned Technician</Label>
                    <Select value={formData.assignedTo} onValueChange={value => setFormData({
                    ...formData,
                    assignedTo: value === "none" ? "" : value
                  })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select technician (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No technician assigned</SelectItem>
                        {profiles.filter(p => p.role === "technician" || p.role === "admin" || p.role === "manager").map(p => <SelectItem key={p.id} value={p.id}>
                              {p.full_name || p.email}
                            </SelectItem>)}
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
                      {editingInvoice ? "Update" : "Create"} Invoice
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Invoice List */}
      <PullToRefresh onRefresh={async () => {
      await refetchInvoices();
    }} className="sm:contents">
        <div className="space-y-3 lg:max-w-4xl lg:mx-auto">
          {visibleInvoices.map((invoice, index) => (
            <InvoiceListCard
              key={invoice.id}
              invoice={invoice}
              lateFeePercentage={lateFeePercentage}
              isInvoiceOverdue={isInvoiceOverdue}
              getTotalWithLateFee={getTotalWithLateFee}
              onOpen={openViewingInvoice}
              onStatusChange={handleStatusChange}
              onApplyLateFee={handleApplyLateFee}
              onEdit={handleEdit}
              onDuplicate={handleDuplicateInvoice}
              onDownload={handleDownload}
              onEmail={handleOpenEmailDialog}
              onMarkPaid={handleMarkPaid}
              onViewSignature={handleViewSignature}
              onOpenSignatureDialog={handleOpenSignatureDialog}
              onSendSignatureRequest={handleSendSignatureRequest}
              onArchive={(inv) => setArchiveConfirmInvoice(inv)}
              onUnarchive={handleUnarchiveInvoice}
              onDelete={handleDeleteClick}
              showSwipeHint={index === 0 && showSwipeHint}
              onSwipeHintDismiss={dismissSwipeHint}
            />
          ))}
          {filteredInvoices.length === 0 && <Card>
              <CardContent className="py-8 text-center text-muted-foreground">No invoices found</CardContent>
            </Card>}
          {/* Infinite scroll trigger */}
          {hasMoreInvoices && (
            <div ref={loadMoreInvoicesRef} className="py-4 flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Showing {visibleInvoices.length} of {totalInvoicesCount}</span>
                <Button variant="ghost" size="sm" onClick={loadAllInvoices} className="h-7 text-xs">
                  Load All
                </Button>
              </div>
            </div>
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 ${getStatusColor(viewingInvoice.status)}`}>
                      {viewingInvoice.status}
                      <ChevronRight className="w-3 h-3 rotate-90" />
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover z-50">
                    {["draft", "sent", "paid"].map(status => (
                      <DropdownMenuItem
                        key={status}
                        onClick={() => {
                          if (status === "paid") {
                            // Use handleStatusChange which will show the payment dialog
                            handleStatusChange(viewingInvoice.id, status);
                          } else {
                            handleStatusChange(viewingInvoice.id, status);
                            setViewingInvoice(prev => prev ? { ...prev, status: status as Invoice['status'] } : null);
                          }
                        }}
                        disabled={viewingInvoice.status === status}
                        className={viewingInvoice.status === status ? "bg-accent" : ""}
                      >
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize mr-2 ${getStatusColor(status)}`}>
                          {status}
                        </span>
                        {viewingInvoice.status === status && <CheckCircle2 className="w-4 h-4 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </DialogHeader>

            <div className="space-y-4 sm:space-y-6">
              {/* Basic Info - responsive grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs sm:text-sm">Customer</Label>
                  <p className="font-medium text-sm sm:text-base truncate">
                    {getCustomerName(viewingInvoice.customer_id)}
                  </p>
                </div>
                {(viewingInvoice as any).creator?.full_name && <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">Created By</Label>
                    <p className="font-medium text-sm sm:text-base truncate">
                      {(viewingInvoice as any).creator.full_name}
                    </p>
                  </div>}
                {/* Linked Job */}
                {((viewingInvoice as any).job?.job_number || (viewingInvoice as any).quote?.job?.job_number) && <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">Linked Job</Label>
                    <p className="font-medium text-sm sm:text-base">
                      {(viewingInvoice as any).job?.job_number || (viewingInvoice as any).quote?.job?.job_number}
                    </p>
                  </div>}
                {((viewingInvoice as any).assigned_technician?.full_name || (viewingInvoice as any).quote?.job?.assigned_technician?.full_name) && <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">Assigned Technician</Label>
                    <p className="font-medium text-sm sm:text-base truncate">
                      {(viewingInvoice as any).assigned_technician?.full_name || (viewingInvoice as any).quote?.job?.assigned_technician?.full_name}
                    </p>
                  </div>}
                <div>
                  <Label className="text-muted-foreground text-xs sm:text-sm">Created</Label>
                  <p className="font-medium text-sm sm:text-base">
                    {format(new Date(viewingInvoice.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                {viewingInvoice.due_date && <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">Due Date</Label>
                    <p className="font-medium text-sm sm:text-base">
                      {format(new Date(viewingInvoice.due_date), "MMM d, yyyy")}
                    </p>
                  </div>}
                {viewingInvoice.paid_at && <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">Paid</Label>
                    <p className="font-medium text-green-600 flex items-center gap-1 text-sm sm:text-base">
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                      {format(new Date(viewingInvoice.paid_at), "MMM d, yyyy")}
                    </p>
                  </div>}
              </div>

              {/* Tabs for Items, Linked Docs, Photos */}
              <Tabs defaultValue="items" className="mt-4">
                <TabsList className="flex-wrap h-auto gap-1 p-1">
                  <TabsTrigger value="items" className="text-xs sm:text-sm px-2 sm:px-3">
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="linked" className="text-xs sm:text-sm px-2 sm:px-3">
                    Linked Docs ({(viewingInvoice.quote_id ? 1 : 0) + ((viewingInvoice as any).job_id || (viewingInvoice as any).quote?.job ? 1 : 0)})
                  </TabsTrigger>
                  <TabsTrigger value="photos" className="text-xs sm:text-sm px-2 sm:px-3">
                    Photos {viewingInvoicePhotos.length > 0 && `(${viewingInvoicePhotos.length})`}
                  </TabsTrigger>
                </TabsList>

                {/* Items Tab */}
                <TabsContent value="items" className="space-y-6 mt-4">
                  {/* Line Items Section */}
                  <div className="space-y-3">
                    <Label className="text-muted-foreground text-xs sm:text-sm font-medium">Line Items</Label>
                    {viewingInvoice.items && viewingInvoice.items.length > 0 ? <>
                        <div className="rounded-lg border">
                          {/* Desktop header - hidden on mobile */}
                          <div className="hidden sm:grid grid-cols-12 gap-2 p-3 bg-muted/50 font-medium text-sm">
                            <div className="col-span-6">Description</div>
                            <div className="col-span-2 text-center">Qty</div>
                            <div className="col-span-2 text-right">Unit Price</div>
                            <div className="col-span-2 text-right">Total</div>
                          </div>
                          {viewingInvoice.items.map((item: any) => <div key={item.id} className="p-3 border-t text-sm">
                              {/* Mobile layout */}
                              <div className="sm:hidden space-y-1">
                                <p className="font-medium">{item.description}</p>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>{item.quantity} × ${Number(item.unit_price).toFixed(2)}</span>
                                  <span className="font-medium text-foreground">${Number(item.total).toFixed(2)}</span>
                                </div>
                              </div>
                              {/* Desktop layout */}
                              <div className="hidden sm:grid grid-cols-12 gap-2">
                                <div className="col-span-6">{item.description}</div>
                                <div className="col-span-2 text-center">{item.quantity}</div>
                                <div className="col-span-2 text-right">${Number(item.unit_price).toFixed(2)}</div>
                                <div className="col-span-2 text-right">${Number(item.total).toFixed(2)}</div>
                              </div>
                            </div>)}
                        </div>
                        <div className="flex flex-col items-end gap-1 text-sm">
                          <div className="flex justify-between w-full sm:w-56">
                            <span className="text-muted-foreground">Subtotal:</span>
                            <span>${Number(viewingInvoice.subtotal).toFixed(2)}</span>
                          </div>
                          {Number(viewingInvoice.discount_value) > 0 && (
                            <div className="flex justify-between w-full sm:w-56 text-success">
                              <span>Discount ({formatDiscount(viewingInvoice.discount_type, Number(viewingInvoice.discount_value))}):</span>
                              <span>-${calculateDiscountAmount(Number(viewingInvoice.subtotal), viewingInvoice.discount_type, Number(viewingInvoice.discount_value)).toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between w-full sm:w-56">
                            <span className="text-muted-foreground">Tax:</span>
                            <span>${Number(viewingInvoice.tax).toFixed(2)}</span>
                          </div>
                          {Number(viewingInvoice.late_fee_amount) > 0 ? <>
                              <div className="flex justify-between w-full sm:w-56 font-semibold pt-1 border-t">
                                <span>Invoice Total:</span>
                                <span>${formatAmount(viewingInvoice.total)}</span>
                              </div>
                              <div className="flex justify-between w-full sm:w-56 text-destructive">
                                <span className="flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  Late Fee {lateFeePercentage > 0 && `(${lateFeePercentage}%)`}:
                                </span>
                                <span>+${Number(viewingInvoice.late_fee_amount).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between w-full sm:w-56 font-semibold text-base pt-1 border-t border-destructive/30">
                                <span className="text-destructive">Total Due:</span>
                                <span className="text-destructive">
                                  ${(Number(viewingInvoice.total) + Number(viewingInvoice.late_fee_amount)).toFixed(2)}
                                </span>
                              </div>
                            </> : <div className="flex justify-between w-full sm:w-56 font-semibold text-base pt-1 border-t">
                              <span>Total:</span>
                              <span>${formatAmount(viewingInvoice.total)}</span>
                            </div>}
                        </div>
                        {viewingInvoice.due_date && new Date(viewingInvoice.due_date) < new Date() && viewingInvoice.status !== "paid" && (!viewingInvoice.late_fee_amount || Number(viewingInvoice.late_fee_amount) === 0) && lateFeePercentage > 0 && (
                          <div className="flex justify-end">
                            <Button variant="destructive" size="sm" onClick={() => handleApplyLateFee(viewingInvoice.id)} disabled={applyLateFee.isPending}>
                              <AlertCircle className="w-4 h-4 mr-2" />
                              Apply {lateFeePercentage}% Late Fee
                            </Button>
                          </div>
                        )}
                      </> : <div className="text-center py-6 text-muted-foreground border rounded-lg">
                        <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No line items added</p>
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => {
                          handleEdit(viewingInvoice);
                          openViewingInvoice(null);
                        }}>
                          <Plus className="w-4 h-4 mr-1" />
                          Add Items
                        </Button>
                      </div>}
                  </div>

                  {/* Payment Status */}
                  {viewingInvoice.status === "paid" ? <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                      <span className="font-medium text-xs sm:text-sm">
                        Payment received on {format(new Date(viewingInvoice.paid_at!), "MMM d, yyyy")}
                      </span>
                    </div> : viewingInvoice.due_date && new Date(viewingInvoice.due_date) < new Date() ? <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-400">
                      <span className="font-medium text-xs sm:text-sm">
                        Overdue - was due on {format(new Date(viewingInvoice.due_date), "MMM d, yyyy")}
                      </span>
                    </div> : null}

                  {/* Notes Section */}
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs sm:text-sm font-medium">Notes</Label>
                    {viewingInvoice.notes ? (
                      <p className="text-sm whitespace-pre-wrap">{viewingInvoice.notes}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No notes</p>
                    )}
                  </div>

                  {/* Signature Section */}
                  <ConstrainedPanel>
                    <SignatureSection signatureId={(viewingInvoice as any).signature_id} title="Customer Signature" onCollectSignature={() => handleOpenSignatureDialog(viewingInvoice as Invoice)} showCollectButton={viewingInvoice.status !== "paid"} collectButtonText="Collect Signature" isCollecting={signInvoice.isPending} />
                  </ConstrainedPanel>

                  {/* Reminder History */}
                  {invoiceReminders.length > 0 && <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs sm:text-sm font-medium flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        Payment Reminders Sent ({invoiceReminders.length})
                      </Label>
                      <div className="space-y-2">
                        {invoiceReminders.map(reminder => <div key={reminder.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2 px-3 bg-muted/50 rounded text-sm">
                            <div className="flex items-center gap-2">
                              <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground">{reminder.recipient_email}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {reminder.sent_by_profile?.full_name && <span>by {reminder.sent_by_profile.full_name}</span>}
                              <span>{format(new Date(reminder.sent_at), 'MMM d, yyyy h:mm a')}</span>
                            </div>
                          </div>)}
                      </div>
                    </div>}
                </TabsContent>

                {/* Linked Docs Tab */}
                <TabsContent value="linked" className="mt-4">
                <div>
                  <h4 className="font-medium mb-2 text-sm sm:text-base flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    Linked Documents
                  </h4>
                  {(viewingInvoice.quote_id || (viewingInvoice as any).job_id || (viewingInvoice as any).quote?.job) ? (
                    <div className="space-y-2">
                      {/* Linked Quote */}
                      {viewingInvoice.quote_id && (viewingInvoice as any).quote && (
                        <div
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => {
                            openViewingInvoice(null);
                            navigate(`/quotes?view=${viewingInvoice.quote_id}`);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{(viewingInvoice as any).quote.quote_number}</span>
                            <span className="text-xs text-muted-foreground">Quote</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            (viewingInvoice as any).quote.status === 'approved' || (viewingInvoice as any).quote.status === 'accepted' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : (viewingInvoice as any).quote.status === 'sent'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                : 'bg-muted text-muted-foreground'
                          }`}>
                            {(viewingInvoice as any).quote.status}
                          </span>
                        </div>
                      )}
                      {/* Linked Job - from direct job_id or via quote */}
                      {((viewingInvoice as any).job || (viewingInvoice as any).quote?.job) && (
                        <div
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => {
                            const job = (viewingInvoice as any).job || (viewingInvoice as any).quote?.job;
                            openViewingInvoice(null);
                            navigate(`/jobs?view=${job.id}`);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-sm">
                              {(viewingInvoice as any).job?.job_number || (viewingInvoice as any).quote?.job?.job_number}
                            </span>
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {(viewingInvoice as any).job?.title || (viewingInvoice as any).quote?.job?.title}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            ((viewingInvoice as any).job?.status || (viewingInvoice as any).quote?.job?.status) === 'completed'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : ((viewingInvoice as any).job?.status || (viewingInvoice as any).quote?.job?.status) === 'in_progress'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                : ((viewingInvoice as any).job?.status || (viewingInvoice as any).quote?.job?.status) === 'scheduled'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : 'bg-muted text-muted-foreground'
                          }`}>
                            {((viewingInvoice as any).job?.status || (viewingInvoice as any).quote?.job?.status || '').replace('_', ' ')}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                      No linked quotes or jobs
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* Photos Tab */}
              <TabsContent value="photos" className="mt-4">
                <DocumentPhotoGallery
                  photos={viewingInvoicePhotos.map(p => ({
                    id: p.id,
                    photo_url: p.photo_url,
                    photo_type: p.photo_type,
                    caption: p.caption,
                    created_at: p.created_at,
                    display_order: p.display_order ?? 0,
                  }))}
                  bucketName="invoice-photos"
                  documentId={viewingInvoice.id}
                  onUpload={async (file, photoType) => {
                    await uploadInvoicePhoto.mutateAsync({
                      invoiceId: viewingInvoice.id,
                      file,
                      photoType,
                    });
                  }}
                  onDelete={async (photoId, photoUrl) => {
                    await deleteInvoicePhoto.mutateAsync({
                      photoId,
                      photoUrl,
                      invoiceId: viewingInvoice.id,
                    });
                  }}
                  onUpdateType={(photoId, photoType) => {
                    updateInvoicePhotoType.mutate({
                      photoId,
                      photoType,
                      invoiceId: viewingInvoice.id,
                    });
                  }}
                  isUploading={uploadInvoicePhoto.isPending}
                  editable={true}
                />
              </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!invoiceToDelete} onOpenChange={open => !open && setInvoiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice "{invoiceToDelete?.invoice_number}"? You can undo this action
              within a few seconds.
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
              Are you sure you want to archive invoice "{archiveConfirmInvoice?.invoice_number}"? Archived invoices can
              be restored later.
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
    }} title="Sign Invoice" description="Customer signature to acknowledge this invoice" signerName={signatureInvoice ? customers.find(c => c.id === signatureInvoice.customer_id)?.name || "" : ""} onSignatureComplete={handleSignatureComplete} isSubmitting={signInvoice.isPending} />

      {/* View Signature Dialog */}
      <ViewSignatureDialog signatureId={viewSignatureId} open={viewSignatureOpen} onOpenChange={open => {
      setViewSignatureOpen(open);
      if (!open) setViewSignatureId(null);
    }} />

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={recordPaymentDialogOpen}
        onOpenChange={(open) => {
          setRecordPaymentDialogOpen(open);
          if (!open) setPendingPaymentInvoice(null);
        }}
        invoiceTotal={pendingPaymentInvoice ? getTotalWithLateFee(pendingPaymentInvoice) : 0}
        remainingBalance={pendingInvoiceBalance?.remaining}
        invoiceNumber={pendingPaymentInvoice?.invoice_number || ""}
        customerEmail={pendingPaymentInvoice ? customers.find(c => c.id === pendingPaymentInvoice.customer_id)?.email : null}
        onConfirm={handleRecordPayment}
        isLoading={createPayment.isPending}
      />

      <Button className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg sm:hidden z-50" onClick={() => openEditDialog(true)}>
        <Plus className="w-6 h-6" />
      </Button>
    </div>;
};
export default Invoices;