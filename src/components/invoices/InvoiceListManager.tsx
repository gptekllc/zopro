import { useState, useCallback, useMemo, useEffect } from 'react';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { useCompany } from '@/hooks/useCompany';
import { useEmailDocument, useDownloadDocument } from '@/hooks/useDocumentActions';
import { useUndoableDelete } from '@/hooks/useUndoableDelete';
import { useSignInvoice } from '@/hooks/useSignatures';
import { useSendSignatureRequest } from '@/hooks/useSendSignatureRequest';
import { useDeleteInvoice, useArchiveInvoice, useUnarchiveInvoice, useApplyLateFee, isInvoiceOverdue, getTotalWithLateFee, Invoice, useSendPaymentReminder, useInvoiceReminders, useUpdateInvoice, getInvoiceStatusLabel } from '@/hooks/useInvoices';
import { useCreatePayment, useInvoiceBalance, useAllPayments } from '@/hooks/usePayments';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { TablePagination } from '@/components/ui/table-pagination';
import { Search, Loader2, Filter, Archive } from 'lucide-react';
import { SignatureDialog } from '@/components/signatures/SignatureDialog';
import { ViewSignatureDialog } from '@/components/signatures/ViewSignatureDialog';
import { RecordPaymentDialog, PaymentData } from '@/components/invoices/RecordPaymentDialog';
import { SplitPaymentDialog, SplitPaymentData } from '@/components/invoices/SplitPaymentDialog';
import { InvoiceDetailDialog } from '@/components/invoices/InvoiceDetailDialog';
import { InvoiceListCard } from '@/components/invoices/InvoiceListCard';
import { useSwipeHint } from '@/components/ui/swipeable-card';
import { Customer } from '@/hooks/useCustomers';
import { toast } from 'sonner';

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface InvoiceListManagerProps {
  invoices: Invoice[];
  customers: Customer[];
  profiles: Profile[];
  customerId?: string;
  showFilters?: boolean;
  showSearch?: boolean;
  showHeader?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  hideInlineControls?: boolean;
  onEditInvoice?: (invoice: Invoice) => void;
  onCreateInvoice?: () => void;
  onRefetch?: () => Promise<void>;
  isLoading?: boolean;
  initialViewInvoiceId?: string | null;
  onInitialViewHandled?: () => void;
}

export function InvoiceListManager({
  invoices,
  customers,
  profiles,
  customerId,
  showFilters = true,
  showSearch = true,
  showHeader = false,
  searchQuery: externalSearchQuery,
  onSearchChange,
  statusFilter: externalStatusFilter,
  onStatusFilterChange,
  hideInlineControls = false,
  onEditInvoice,
  onCreateInvoice,
  onRefetch,
  isLoading = false,
  initialViewInvoiceId,
  onInitialViewHandled,
}: InvoiceListManagerProps) {
  const { data: company } = useCompany();
  const { saveScrollPosition, restoreScrollPosition } = useScrollRestoration();
  
  // Mutations
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
  const updateInvoice = useUpdateInvoice();
  
  // Fetch all payments for calculating totals per invoice
  const { data: allPayments = [] } = useAllPayments();

  // Undo-able delete
  const { scheduleDelete: scheduleInvoiceDelete, filterPendingDeletes: filterPendingInvoiceDeletes } = useUndoableDelete(
    async (id) => { await deleteInvoice.mutateAsync(id); },
    { itemLabel: 'invoice', timeout: 5000 }
  );

  // State - use external values if provided, otherwise use internal state
  const [internalStatusFilter, setInternalStatusFilter] = useState('all');
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  
  const statusFilter = externalStatusFilter ?? internalStatusFilter;
  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  
  const handleSearchChange = (query: string) => {
    if (onSearchChange) {
      onSearchChange(query);
    } else {
      setInternalSearchQuery(query);
    }
  };
  
  const handleStatusFilterChange = (status: string) => {
    if (onStatusFilterChange) {
      onStatusFilterChange(status);
    } else {
      setInternalStatusFilter(status);
    }
  };
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // Handle initial view invoice from parent
  useEffect(() => {
    if (initialViewInvoiceId && invoices.length > 0 && !viewingInvoice) {
      const invoice = invoices.find(i => i.id === initialViewInvoiceId);
      if (invoice) {
        setViewingInvoice(invoice);
        onInitialViewHandled?.();
      }
    }
  }, [initialViewInvoiceId, invoices, viewingInvoice, onInitialViewHandled]);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [archiveConfirmInvoice, setArchiveConfirmInvoice] = useState<Invoice | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedInvoiceForEmail, setSelectedInvoiceForEmail] = useState<string | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');

  // Signature dialogs
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [signatureInvoice, setSignatureInvoice] = useState<Invoice | null>(null);
  const [viewSignatureId, setViewSignatureId] = useState<string | null>(null);
  const [viewSignatureOpen, setViewSignatureOpen] = useState(false);

  // Record Payment dialog
  const [recordPaymentDialogOpen, setRecordPaymentDialogOpen] = useState(false);
  const [splitPaymentDialogOpen, setSplitPaymentDialogOpen] = useState(false);
  const [pendingPaymentInvoice, setPendingPaymentInvoice] = useState<Invoice | null>(null);

  // Fetch reminders for the currently viewed invoice
  const { data: invoiceReminders = [] } = useInvoiceReminders(viewingInvoice?.id || null);
  
  // Fetch balance for pending payment invoice
  const { data: pendingInvoiceBalance } = useInvoiceBalance(pendingPaymentInvoice?.id || null);

  // Swipe hint
  const { showHint: showSwipeHint, dismissHint: dismissSwipeHint } = useSwipeHint('invoices-swipe-hint-shown');

  // Wrapped setters for scroll restoration
  const openViewingInvoice = useCallback((invoice: Invoice | null) => {
    if (invoice) saveScrollPosition();
    setViewingInvoice(invoice);
    if (!invoice) restoreScrollPosition();
  }, [saveScrollPosition, restoreScrollPosition]);

  // Filtering
  const filteredInvoices = useMemo(() => {
    const filtered = invoices.filter(inv => {
      // Pre-filter by customerId if provided
      if (customerId && inv.customer_id !== customerId) return false;
      
      const customer = customers.find(c => c.id === inv.customer_id);
      const customerName = customer?.name || '';
      const matchesSearch = customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase());

      if (statusFilter === 'archived') {
        return matchesSearch && !!(inv as any).archived_at;
      }
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      const notArchived = !(inv as any).archived_at;
      return matchesSearch && matchesStatus && notArchived;
    });
    return filterPendingInvoiceDeletes(filtered);
  }, [invoices, customers, searchQuery, statusFilter, customerId, filterPendingInvoiceDeletes]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Calculate paginated invoices
  const totalPages = Math.ceil(filteredInvoices.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedInvoices = filteredInvoices.slice(startIndex, startIndex + pageSize);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, customerId, pageSize]);
  const getCustomerName = (customerId: string) => customers.find(c => c.id === customerId)?.name || 'Unknown';
  const getCustomerEmail = (customerId: string) => customers.find(c => c.id === customerId)?.email || '';
  const lateFeePercentage = company?.late_fee_percentage ?? 0;

  // Calculate total paid per invoice from all payments
  const getInvoiceTotalPaid = (invoiceId: string): number => {
    const invoicePayments = allPayments.filter(p => p.invoice_id === invoiceId && p.status === 'completed');
    return invoicePayments.reduce((sum, p) => sum + Number(p.amount), 0);
  };

  // Handlers
  const handleStatusChange = async (invoiceId: string, newStatus: string) => {
    if (newStatus === 'paid') {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        initiateRecordPayment(invoice);
        return;
      }
    }
    
    try {
      await updateInvoice.mutateAsync({ id: invoiceId, status: newStatus, paid_at: null } as any);
      toast.success(`Invoice marked as ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleApplyLateFee = async (invoiceId: string) => {
    if (lateFeePercentage <= 0) {
      toast.error('No late fee percentage configured.');
      return;
    }
    if (confirm(`Apply a ${lateFeePercentage}% late fee to this overdue invoice?`)) {
      await applyLateFee.mutateAsync({ invoiceId, lateFeePercentage });
    }
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
    await emailDocument.mutateAsync({ type: 'invoice', documentId: selectedInvoiceForEmail, recipientEmail: emailRecipient });
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

  const handleDeleteClick = (invoice: Invoice) => setInvoiceToDelete(invoice);
  const handleConfirmDelete = () => {
    if (invoiceToDelete) {
      scheduleInvoiceDelete(invoiceToDelete.id);
      setInvoiceToDelete(null);
    }
  };

  const initiateRecordPayment = (invoice: Invoice) => {
    setPendingPaymentInvoice(invoice);
    setRecordPaymentDialogOpen(true);
  };

  const handleRecordPayment = async (paymentData: PaymentData) => {
    if (!pendingPaymentInvoice) return;
    try {
      await createPayment.mutateAsync({
        invoiceId: pendingPaymentInvoice.id,
        amount: paymentData.amount,
        method: paymentData.method,
        paymentDate: paymentData.date,
        notes: paymentData.note || undefined,
        sendNotification: paymentData.sendNotification,
      });
      if (viewingInvoice?.id === pendingPaymentInvoice.id && onRefetch) {
        onRefetch();
      }
      setRecordPaymentDialogOpen(false);
      setPendingPaymentInvoice(null);
    } catch {
      // Error handled by hook
    }
  };

  const handleSplitPayment = async (data: SplitPaymentData) => {
    if (!pendingPaymentInvoice) return;
    try {
      for (const payment of data.payments) {
        await createPayment.mutateAsync({
          invoiceId: pendingPaymentInvoice.id,
          amount: payment.amount,
          method: payment.method,
          paymentDate: data.date,
          notes: data.note || undefined,
          sendNotification: false,
        });
      }
      if (viewingInvoice?.id === pendingPaymentInvoice.id && onRefetch) {
        onRefetch();
      }
      setSplitPaymentDialogOpen(false);
      setPendingPaymentInvoice(null);
    } catch {
      // Error handled by hook
    }
  };


  // Signature handlers
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
      customerId: signatureInvoice.customer_id,
    });
    if (viewingInvoice?.id === signatureInvoice.id) {
      setViewingInvoice({
        ...viewingInvoice,
        signature_id: signature.id,
        signed_at: new Date().toISOString(),
        status: 'paid',
        paid_at: new Date().toISOString(),
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
      customerId: customer.id,
    });
  };

  const handleSendPaymentReminder = async (invoice: Invoice, recipientEmails?: string[], subject?: string, message?: string, cc?: string[], bcc?: string[]) => {
    try {
      await sendPaymentReminder.mutateAsync({ invoiceId: invoice.id, recipientEmails });
      if (viewingInvoice?.id === invoice.id && invoice.status === 'draft') {
        setViewingInvoice({ ...viewingInvoice, status: 'sent' } as any);
      }
    } catch {
      // Error handled by mutation
    }
  };

  const handleEmailInvoice = async (invoiceId: string, recipientEmails?: string[], subject?: string, message?: string, cc?: string[], bcc?: string[]) => {
    if (!recipientEmails || recipientEmails.length === 0) return;
    await emailDocument.mutateAsync({ 
      type: 'invoice', 
      documentId: invoiceId, 
      recipientEmail: recipientEmails[0],
      recipientEmails,
      customSubject: subject,
      customMessage: message,
      ccEmails: cc,
      bccEmails: bcc,
    });
  };

  const handleDuplicateInvoice = (invoice: Invoice) => {
    // For duplicate, we need to pass to the parent's edit handler with indication it's a duplicate
    // Since detail dialog is self-contained, this navigates to the main page with a duplicate param
    window.location.href = `/invoices?duplicate=${invoice.id}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Optional Header with Search and Filters - only show if not hidden */}
      {!hideInlineControls && (showSearch || showFilters) && (
        <div className="flex items-center gap-2">
          {showSearch && (
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          )}
          {showFilters && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={statusFilter !== 'all' ? 'secondary' : 'outline'} size="icon" className="h-9 w-9">
                  <Filter className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                {['all', 'draft', 'sent', 'partially_paid', 'paid', 'overdue', 'voided'].map((status) => (
                  <DropdownMenuItem 
                    key={status}
                    onClick={() => handleStatusFilterChange(status)} 
                    className={statusFilter === status ? 'bg-accent' : ''}
                  >
                    {status === 'all' ? 'All Status' : getInvoiceStatusLabel(status)}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleStatusFilterChange('archived')} className={statusFilter === 'archived' ? 'bg-accent' : ''}>
                  <Archive className="w-4 h-4 mr-2" />
                  Archived
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Invoice List */}
      <PullToRefresh onRefresh={async () => { if (onRefetch) await onRefetch(); }} className="sm:contents">
        <div className="space-y-3">
          {paginatedInvoices.map((invoice, index) => (
            <InvoiceListCard
              key={invoice.id}
              invoice={invoice}
              lateFeePercentage={lateFeePercentage}
              isInvoiceOverdue={isInvoiceOverdue}
              getTotalWithLateFee={getTotalWithLateFee}
              onOpen={openViewingInvoice}
              onStatusChange={handleStatusChange}
              onApplyLateFee={handleApplyLateFee}
              onEdit={onEditInvoice || (() => {})}
              onDuplicate={handleDuplicateInvoice}
              onDownload={handleDownload}
              onEmail={handleOpenEmailDialog}
              onViewSignature={handleViewSignature}
              onOpenSignatureDialog={handleOpenSignatureDialog}
              onSendSignatureRequest={handleSendSignatureRequest}
              onArchive={(inv) => setArchiveConfirmInvoice(inv)}
              onUnarchive={handleUnarchiveInvoice}
              onDelete={handleDeleteClick}
              showSwipeHint={index === 0 && showSwipeHint}
              onSwipeHintDismiss={dismissSwipeHint}
              totalPaid={getInvoiceTotalPaid(invoice.id)}
            />
          ))}
          {filteredInvoices.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">No invoices found</CardContent>
            </Card>
          )}
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredInvoices.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            itemLabel="invoices"
            pageSizeOptions={[25, 50, 100, 150]}
          />
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
              <Button className="flex-1" onClick={handleSendEmail} disabled={emailDocument.isPending || !emailRecipient}>
                {emailDocument.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Send Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      {viewingInvoice && (
        <InvoiceDetailDialog
          invoice={{
            id: viewingInvoice.id,
            invoice_number: viewingInvoice.invoice_number,
            status: viewingInvoice.status as 'draft' | 'sent' | 'paid',
            created_at: viewingInvoice.created_at,
            due_date: viewingInvoice.due_date,
            paid_at: viewingInvoice.paid_at,
            subtotal: Number(viewingInvoice.subtotal),
            tax: Number(viewingInvoice.tax),
            total: Number(viewingInvoice.total),
            discount_type: (viewingInvoice as any).discount_type ?? null,
            discount_value: (viewingInvoice as any).discount_value ?? null,
            notes: viewingInvoice.notes,
            items: viewingInvoice.items,
            signature_id: (viewingInvoice as any).signature_id,
            signed_at: (viewingInvoice as any).signed_at,
            late_fee_amount: viewingInvoice.late_fee_amount,
            late_fee_applied_at: (viewingInvoice as any).late_fee_applied_at,
            job: (viewingInvoice as any).job,
            quote: (viewingInvoice as any).quote,
          }}
          customerName={getCustomerName(viewingInvoice.customer_id)}
          customerEmail={customers.find(c => c.id === viewingInvoice.customer_id)?.email}
          creatorName={(viewingInvoice as any)?.creator?.full_name}
          linkedJobNumber={(viewingInvoice as any)?.job?.job_number || (viewingInvoice as any)?.quote?.job?.job_number}
          linkedQuote={(viewingInvoice as any).quote ? {
            id: (viewingInvoice as any).quote.id,
            quote_number: (viewingInvoice as any).quote.quote_number,
            status: (viewingInvoice as any).quote.status,
          } : null}
          linkedJob={(viewingInvoice as any).job ? {
            id: (viewingInvoice as any).job.id,
            job_number: (viewingInvoice as any).job.job_number,
            title: (viewingInvoice as any).job.title,
            status: (viewingInvoice as any).job.status,
          } : null}
          lateFeePercentage={lateFeePercentage}
          open={!!viewingInvoice}
          onOpenChange={(open) => !open && openViewingInvoice(null)}
          onDownload={handleDownload}
          onEmail={(id) => handleOpenEmailDialog(id, viewingInvoice.customer_id)}
          onEdit={onEditInvoice ? () => {
            onEditInvoice(viewingInvoice);
            openViewingInvoice(null);
          } : undefined}
          onDuplicate={(id) => handleDuplicateInvoice(viewingInvoice)}
          onStatusChange={handleStatusChange}
          onMarkPaid={(id) => initiateRecordPayment(viewingInvoice)}
          onViewSignature={handleViewSignature}
          onCollectSignature={() => handleOpenSignatureDialog(viewingInvoice)}
          onSendSignatureRequest={() => handleSendSignatureRequest(viewingInvoice)}
          onApplyLateFee={() => handleApplyLateFee(viewingInvoice.id)}
          isApplyingLateFee={applyLateFee.isPending}
          onSendReminder={(id, emails, subject, message, cc, bcc) => handleSendPaymentReminder(viewingInvoice, emails, subject, message, cc, bcc)}
          isSendingReminder={sendPaymentReminder.isPending}
          onEmailCustom={(id, emails, subject, message, cc, bcc) => handleEmailInvoice(id, emails, subject, message, cc, bcc)}
          isSendingEmail={emailDocument.isPending}
          reminders={invoiceReminders}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!invoiceToDelete} onOpenChange={() => setInvoiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice {invoiceToDelete?.invoice_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation */}
      <AlertDialog open={!!archiveConfirmInvoice} onOpenChange={() => setArchiveConfirmInvoice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Archive invoice {archiveConfirmInvoice?.invoice_number}? You can restore it later from the archived filter.
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
      <SignatureDialog
        open={signatureDialogOpen}
        onOpenChange={setSignatureDialogOpen}
        onSignatureComplete={handleSignatureComplete}
        title={`Sign Invoice ${signatureInvoice?.invoice_number || ''}`}
      />

      {/* View Signature Dialog */}
      <ViewSignatureDialog
        signatureId={viewSignatureId}
        open={viewSignatureOpen}
        onOpenChange={setViewSignatureOpen}
      />

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={recordPaymentDialogOpen}
        onOpenChange={setRecordPaymentDialogOpen}
        invoiceTotal={pendingPaymentInvoice ? getTotalWithLateFee(pendingPaymentInvoice) : 0}
        remainingBalance={pendingInvoiceBalance?.remaining}
        invoiceNumber={pendingPaymentInvoice?.invoice_number || ''}
        customerEmail={pendingPaymentInvoice ? getCustomerEmail(pendingPaymentInvoice.customer_id) : undefined}
        onConfirm={handleRecordPayment}
        onSwitchToSplit={() => {
          setRecordPaymentDialogOpen(false);
          setSplitPaymentDialogOpen(true);
        }}
      />

      {/* Split Payment Dialog */}
      <SplitPaymentDialog
        open={splitPaymentDialogOpen}
        onOpenChange={setSplitPaymentDialogOpen}
        invoiceTotal={pendingPaymentInvoice ? getTotalWithLateFee(pendingPaymentInvoice) : 0}
        remainingBalance={pendingInvoiceBalance?.remaining}
        invoiceNumber={pendingPaymentInvoice?.invoice_number || ''}
        customerEmail={pendingPaymentInvoice ? getCustomerEmail(pendingPaymentInvoice.customer_id) : undefined}
        onConfirm={handleSplitPayment}
      />
    </div>
  );
}
