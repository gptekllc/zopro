import { useState, useCallback, useMemo, useEffect } from 'react';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { useCompany } from '@/hooks/useCompany';
import { useEmailDocument, useDownloadDocument, useConvertQuoteToInvoice } from '@/hooks/useDocumentActions';
import { useUndoableDelete } from '@/hooks/useUndoableDelete';
import { useApproveQuoteWithSignature } from '@/hooks/useSignatures';
import { useSendSignatureRequest } from '@/hooks/useSendSignatureRequest';
import { useDeleteQuote, useArchiveQuote, useUnarchiveQuote, useUpdateQuote, Quote } from '@/hooks/useQuotes';
import { useJobs, useCreateJobFromQuoteItems, useAddQuoteItemsToJob, Job } from '@/hooks/useJobs';
import { useInvoices } from '@/hooks/useInvoices';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { TablePagination } from '@/components/ui/table-pagination';
import { Search, Loader2, Filter, Archive } from 'lucide-react';
import { SignatureDialog } from '@/components/signatures/SignatureDialog';
import { ViewSignatureDialog } from '@/components/signatures/ViewSignatureDialog';
import { QuoteDetailDialog } from '@/components/quotes/QuoteDetailDialog';
import { QuoteListCard } from '@/components/quotes/QuoteListCard';
import { CreateJobFromQuoteDialog, AddQuoteItemsToJobDialog } from '@/components/quotes/QuoteToJobDialogs';
import { ConvertToInvoiceDialog } from '@/components/quotes/ConvertToInvoiceDialog';
import { DocumentEmailDialog } from '@/components/email/DocumentEmailDialog';
import { useSwipeHint } from '@/components/ui/swipeable-card';
import { Customer } from '@/hooks/useCustomers';
import { toast } from 'sonner';

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface QuoteListManagerProps {
  quotes: Quote[];
  customers: Customer[];
  profiles: Profile[];
  customerId?: string;
  showFilters?: boolean;
  showSearch?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  statusFilter?: string[];
  onStatusFilterChange?: (statuses: string[]) => void;
  hideInlineControls?: boolean;
  onEditQuote?: (quote: Quote) => void;
  onCreateQuote?: () => void;
  onRefetch?: () => Promise<void>;
  isLoading?: boolean;
  initialViewQuoteId?: string | null;
  onInitialViewHandled?: () => void;
}

export function QuoteListManager({
  quotes,
  customers,
  profiles,
  customerId,
  showFilters = true,
  showSearch = true,
  searchQuery: externalSearchQuery,
  onSearchChange,
  statusFilter: externalStatusFilter,
  onStatusFilterChange,
  hideInlineControls = false,
  onEditQuote,
  onCreateQuote,
  onRefetch,
  isLoading = false,
  initialViewQuoteId,
  onInitialViewHandled,
}: QuoteListManagerProps) {
  const { data: company } = useCompany();
  const { saveScrollPosition, restoreScrollPosition } = useScrollRestoration();
  const { data: jobs = [] } = useJobs(false);
  const { data: invoices = [] } = useInvoices(false);
  
  // Safe arrays
  const safeJobs = useMemo(() => (Array.isArray(jobs) ? jobs : []).filter((j: any) => j && j.id) as Job[], [jobs]);
  const safeInvoices = useMemo(() => (Array.isArray(invoices) ? invoices : []).filter((i: any) => i && i.id) as any[], [invoices]);

  // Track jobs/invoices per quote
  const jobsPerQuote = useMemo(() => {
    const counts = new Map<string, number>();
    safeJobs.forEach((job: any) => {
      if (job.quote_id) counts.set(job.quote_id, (counts.get(job.quote_id) || 0) + 1);
    });
    return counts;
  }, [safeJobs]);

  const invoicesPerQuote = useMemo(() => {
    const counts = new Map<string, number>();
    safeInvoices.forEach((invoice: any) => {
      if (invoice.quote_id) counts.set(invoice.quote_id, (counts.get(invoice.quote_id) || 0) + 1);
    });
    return counts;
  }, [safeInvoices]);

  // Mutations
  const deleteQuote = useDeleteQuote();
  const archiveQuote = useArchiveQuote();
  const unarchiveQuote = useUnarchiveQuote();
  const updateQuote = useUpdateQuote();
  const emailDocument = useEmailDocument();
  const downloadDocument = useDownloadDocument();
  const convertToInvoice = useConvertQuoteToInvoice();
  const createJobFromQuote = useCreateJobFromQuoteItems();
  const addItemsToJob = useAddQuoteItemsToJob();
  const approveWithSignature = useApproveQuoteWithSignature();
  const sendSignatureRequest = useSendSignatureRequest();

  // Undo-able delete
  const { scheduleDelete: scheduleQuoteDelete, filterPendingDeletes: filterPendingQuoteDeletes } = useUndoableDelete(
    async (id) => { await deleteQuote.mutateAsync(id); },
    { itemLabel: 'quote', timeout: 5000 }
  );

  // State - use external values if provided, otherwise use internal state
  const [internalStatusFilter, setInternalStatusFilter] = useState<string[]>(['all']);
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
  
  const handleStatusFilterChange = (statuses: string[]) => {
    if (onStatusFilterChange) {
      onStatusFilterChange(statuses);
    } else {
      setInternalStatusFilter(statuses);
    }
  };
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null);

  // Handle initial view quote from parent
  useEffect(() => {
    if (initialViewQuoteId && quotes.length > 0 && !viewingQuote) {
      const quote = quotes.find(q => q.id === initialViewQuoteId);
      if (quote) {
        setViewingQuote(quote);
        onInitialViewHandled?.();
      }
    }
  }, [initialViewQuoteId, quotes, viewingQuote, onInitialViewHandled]);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const [archiveConfirmQuote, setArchiveConfirmQuote] = useState<Quote | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedQuoteForEmail, setSelectedQuoteForEmail] = useState<Quote | null>(null);

  // Signature dialogs
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [signatureQuote, setSignatureQuote] = useState<Quote | null>(null);
  const [viewSignatureId, setViewSignatureId] = useState<string | null>(null);
  const [viewSignatureOpen, setViewSignatureOpen] = useState(false);

  // Quote to Job dialogs
  const [createJobDialogOpen, setCreateJobDialogOpen] = useState(false);
  const [addToJobDialogOpen, setAddToJobDialogOpen] = useState(false);
  const [selectedQuoteForJob, setSelectedQuoteForJob] = useState<Quote | null>(null);

  // Convert to invoice dialog
  const [convertToInvoiceDialogOpen, setConvertToInvoiceDialogOpen] = useState(false);
  const [selectedQuoteForInvoice, setSelectedQuoteForInvoice] = useState<Quote | null>(null);
  const [convertingQuoteId, setConvertingQuoteId] = useState<string | null>(null);

  // Duplicate prevention confirmation dialogs
  const [createJobConfirmQuote, setCreateJobConfirmQuote] = useState<Quote | null>(null);
  const [createInvoiceConfirmQuote, setCreateInvoiceConfirmQuote] = useState<Quote | null>(null);

  // Swipe hint
  const { showHint: showSwipeHint, dismissHint: dismissSwipeHint } = useSwipeHint('quotes-swipe-hint-shown');

  // Wrapped setters for scroll restoration
  const openViewingQuote = useCallback((quote: Quote | null) => {
    if (quote) saveScrollPosition();
    setViewingQuote(quote);
    if (!quote) restoreScrollPosition();
  }, [saveScrollPosition, restoreScrollPosition]);

  // Filtering
  const filteredQuotes = useMemo(() => {
    const isAllSelected = statusFilter.length === 0 || statusFilter.includes('all');
    const includesArchived = statusFilter.includes('archived');
    
    const filtered = quotes.filter(q => {
      if (customerId && q.customer_id !== customerId) return false;
      
      const customer = customers.find(c => c.id === q.customer_id);
      const customerName = customer?.name || '';
      const matchesSearch = customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.quote_number.toLowerCase().includes(searchQuery.toLowerCase());

      // Handle archived filter
      if (includesArchived && !isAllSelected) {
        // If only archived is selected, show only archived
        if (statusFilter.length === 1) {
          return matchesSearch && !!(q as any).archived_at;
        }
        // If archived + other statuses, show archived OR matching active statuses
        const activeStatuses = statusFilter.filter(s => s !== 'archived');
        const matchesActiveStatus = activeStatuses.includes(q.status) || 
          (activeStatuses.includes('approved') && q.status === 'accepted');
        return matchesSearch && (!!(q as any).archived_at || (matchesActiveStatus && !(q as any).archived_at));
      }
      
      // Normal filtering (no archived)
      const matchesStatus = isAllSelected || statusFilter.includes(q.status) ||
        (statusFilter.includes('approved') && q.status === 'accepted');
      const notArchived = !(q as any).archived_at;
      return matchesSearch && matchesStatus && notArchived;
    });
    return filterPendingQuoteDeletes(filtered);
  }, [quotes, customers, searchQuery, statusFilter, customerId, filterPendingQuoteDeletes]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Calculate paginated quotes
  const totalPages = Math.ceil(filteredQuotes.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedQuotes = filteredQuotes.slice(startIndex, startIndex + pageSize);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, customerId, pageSize]);
  const getCustomerName = (customerId: string) => customers.find(c => c.id === customerId)?.name || 'Unknown';
  const getCustomerEmail = (customerId: string) => customers.find(c => c.id === customerId)?.email || '';

  // Handlers
  const handleStatusChange = async (quoteId: string, newStatus: string) => {
    try {
      await updateQuote.mutateAsync({ id: quoteId, status: newStatus } as any);
      toast.success(`Quote marked as ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDownload = (quoteId: string) => {
    downloadDocument.mutate({ type: 'quote', documentId: quoteId });
  };

  const handleOpenEmailDialog = (quoteId: string, customerId: string) => {
    const quote = quotes.find(q => q.id === quoteId);
    if (quote) {
      setSelectedQuoteForEmail(quote);
      setEmailDialogOpen(true);
    }
  };

  const handleSendQuoteEmail = async (emails: string[], subject: string, message: string) => {
    if (!selectedQuoteForEmail) return;
    // For now, send to first email (the backend will handle multiple recipients)
    await emailDocument.mutateAsync({ 
      type: 'quote', 
      documentId: selectedQuoteForEmail.id, 
      recipientEmail: emails[0] 
    });
    setEmailDialogOpen(false);
    setSelectedQuoteForEmail(null);
  };

  const handleArchiveQuote = async (quote: Quote) => {
    await archiveQuote.mutateAsync(quote.id);
    setArchiveConfirmQuote(null);
  };

  const handleUnarchiveQuote = async (quote: Quote) => {
    await unarchiveQuote.mutateAsync(quote.id);
  };

  const handleDeleteClick = (quote: Quote) => setQuoteToDelete(quote);
  const handleConfirmDelete = () => {
    if (quoteToDelete) {
      scheduleQuoteDelete(quoteToDelete.id);
      setQuoteToDelete(null);
    }
  };

  // Signature handlers
  const handleOpenSignatureDialog = (quote: Quote) => {
    setSignatureQuote(quote);
    setSignatureDialogOpen(true);
  };

  const handleSignatureComplete = async (signatureData: string, signerName: string) => {
    if (!signatureQuote) return;
    const signature = await approveWithSignature.mutateAsync({
      quoteId: signatureQuote.id,
      signatureData,
      signerName,
      customerId: signatureQuote.customer_id,
    });
    if (viewingQuote?.id === signatureQuote.id) {
      setViewingQuote({
        ...viewingQuote,
        signature_id: signature.id,
        signed_at: new Date().toISOString(),
        status: 'accepted',
      });
    }
    setSignatureDialogOpen(false);
    setSignatureQuote(null);
  };

  const handleViewSignature = (signatureId: string) => {
    setViewSignatureId(signatureId);
    setViewSignatureOpen(true);
  };

  const handleSendSignatureRequest = async (quote: Quote) => {
    const customer = customers.find(c => c.id === quote.customer_id);
    if (!customer?.email) {
      toast.error('Customer does not have an email address');
      return;
    }
    await sendSignatureRequest.mutateAsync({
      documentType: 'quote',
      documentId: quote.id,
      recipientEmail: customer.email,
      recipientName: customer.name,
      companyName: company?.name || '',
      documentNumber: quote.quote_number,
      customerId: quote.customer_id,
    });
  };

  // Convert to invoice
  const handleConvertToInvoice = (quote: Quote) => {
    const existingInvoices = invoicesPerQuote.get(quote.id) || 0;
    if (existingInvoices > 0) {
      setCreateInvoiceConfirmQuote(quote);
    } else {
      setSelectedQuoteForInvoice(quote);
      setConvertToInvoiceDialogOpen(true);
    }
  };

  const handleConvertToInvoiceConfirmed = (quoteId: string) => {
    const quote = quotes.find(q => q.id === quoteId);
    if (quote) {
      setSelectedQuoteForInvoice(quote);
      setConvertToInvoiceDialogOpen(true);
      setCreateInvoiceConfirmQuote(null);
    }
  };

  const handleConvertToInvoiceWithPhotos = async (quoteId: string, copyPhotos: boolean) => {
    setConvertingQuoteId(quoteId);
    try {
      const invoice = await convertToInvoice.mutateAsync({ quoteId, copyPhotos });
      if (invoice?.id) {
        window.location.href = `/invoices?edit=${invoice.id}`;
      }
    } finally {
      setConvertingQuoteId(null);
      setConvertToInvoiceDialogOpen(false);
      setSelectedQuoteForInvoice(null);
    }
  };

  // Create job from quote
  const handleOpenCreateJobDialog = (quote: Quote) => {
    const existingJobs = jobsPerQuote.get(quote.id) || 0;
    if (existingJobs > 0) {
      setCreateJobConfirmQuote(quote);
    } else {
      setSelectedQuoteForJob(quote);
      setCreateJobDialogOpen(true);
    }
  };

  const handleOpenCreateJobDialogConfirmed = () => {
    if (createJobConfirmQuote) {
      setSelectedQuoteForJob(createJobConfirmQuote);
      setCreateJobDialogOpen(true);
      setCreateJobConfirmQuote(null);
    }
  };

  const handleOpenAddToJobDialog = (quote: Quote) => {
    setSelectedQuoteForJob(quote);
    setAddToJobDialogOpen(true);
  };

  const handleCreateJobFromQuote = async (quoteId: string, selectedItemIds: string[], copyPhotos: boolean) => {
    const job = await createJobFromQuote.mutateAsync({ quoteId, selectedItemIds, copyPhotos });
    if (job?.id) {
      window.location.href = `/jobs?edit=${job.id}`;
    }
  };

  const handleAddItemsToJob = async (quoteId: string, jobId: string, selectedItemIds: string[]) => {
    await addItemsToJob.mutateAsync({ quoteId, jobId, selectedItemIds });
    window.location.href = `/jobs?view=${jobId}`;
  };

  const handleDuplicateQuote = (quote: Quote) => {
    window.location.href = `/quotes?duplicate=${quote.id}`;
  };

  const handleSaveAsTemplate = (quote: Quote) => {
    window.location.href = `/quotes?saveTemplate=${quote.id}`;
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
                <Button variant={!statusFilter.includes('all') && statusFilter.length > 0 ? 'secondary' : 'outline'} size="icon" className="h-9 w-9">
                  <Filter className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => handleStatusFilterChange(['all'])} className={statusFilter.includes('all') ? 'bg-accent' : ''}>
                  All Status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusFilterChange(['draft'])} className={statusFilter.includes('draft') ? 'bg-accent' : ''}>
                  Draft
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusFilterChange(['sent'])} className={statusFilter.includes('sent') ? 'bg-accent' : ''}>
                  Sent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusFilterChange(['approved'])} className={statusFilter.includes('approved') ? 'bg-accent' : ''}>
                  Approved
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusFilterChange(['rejected'])} className={statusFilter.includes('rejected') ? 'bg-accent' : ''}>
                  Rejected
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleStatusFilterChange(['archived'])} className={statusFilter.includes('archived') ? 'bg-accent' : ''}>
                  <Archive className="w-4 h-4 mr-2" />
                  Archived
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Quote List */}
      <PullToRefresh onRefresh={async () => { if (onRefetch) await onRefetch(); }} className="sm:contents">
        <div className="space-y-3">
          {paginatedQuotes.map((quote, index) => (
            <QuoteListCard
              key={quote.id}
              quote={quote}
              jobsCount={jobsPerQuote.get(quote.id) || 0}
              invoicesCount={invoicesPerQuote.get(quote.id) || 0}
              isConverting={convertingQuoteId === quote.id}
              onView={openViewingQuote}
              onEdit={onEditQuote || (() => {})}
              onDuplicate={handleDuplicateQuote}
              onSaveAsTemplate={handleSaveAsTemplate}
              onDownload={handleDownload}
              onEmail={handleOpenEmailDialog}
              onConvertToInvoice={handleConvertToInvoice}
              onViewSignature={handleViewSignature}
              onCreateJob={handleOpenCreateJobDialog}
              onAddToJob={handleOpenAddToJobDialog}
              onArchive={(q) => setArchiveConfirmQuote(q)}
              onUnarchive={handleUnarchiveQuote}
              onDelete={handleDeleteClick}
              onStatusChange={handleStatusChange}
              showSwipeHint={index === 0 && showSwipeHint}
              onSwipeHintDismiss={dismissSwipeHint}
            />
          ))}
          {filteredQuotes.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">No quotes found</CardContent>
            </Card>
          )}
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredQuotes.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            itemLabel="quotes"
            pageSizeOptions={[25, 50, 100, 150]}
          />
        </div>
      </PullToRefresh>

      {/* Quote Email Dialog with Templates */}
      <DocumentEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        documentType="quote"
        documentNumber={selectedQuoteForEmail?.quote_number}
        customerName={selectedQuoteForEmail ? getCustomerName(selectedQuoteForEmail.customer_id) : undefined}
        customerEmail={selectedQuoteForEmail ? getCustomerEmail(selectedQuoteForEmail.customer_id) : undefined}
        companyName={company?.name}
        companyPhone={company?.phone || ''}
        companyEmail={company?.email || ''}
        documentTotal={selectedQuoteForEmail?.total}
        validUntil={selectedQuoteForEmail?.valid_until || undefined}
        onSend={handleSendQuoteEmail}
        isSending={emailDocument.isPending}
      />

      {/* Quote Detail Dialog */}
      <QuoteDetailDialog
        quote={viewingQuote}
        customerName={viewingQuote ? getCustomerName(viewingQuote.customer_id) : undefined}
        customerEmail={viewingQuote ? getCustomerEmail(viewingQuote.customer_id) : undefined}
        creatorName={(viewingQuote as any)?.creator?.full_name}
        open={!!viewingQuote}
        onOpenChange={(open) => !open && openViewingQuote(null)}
        onDownload={handleDownload}
        onEmail={(id) => viewingQuote && handleOpenEmailDialog(id, viewingQuote.customer_id)}
        onEdit={onEditQuote ? (id) => {
          if (viewingQuote) {
            onEditQuote(viewingQuote);
            openViewingQuote(null);
          }
        } : undefined}
        onConvertToInvoice={(id) => viewingQuote && handleConvertToInvoice(viewingQuote)}
        onCreateJob={(id) => viewingQuote && handleOpenCreateJobDialog(viewingQuote)}
        onStatusChange={handleStatusChange}
        onViewSignature={handleViewSignature}
        onCollectSignature={(id) => viewingQuote && handleOpenSignatureDialog(viewingQuote)}
        onSendSignatureRequest={(id) => viewingQuote && handleSendSignatureRequest(viewingQuote)}
        isCollectingSignature={approveWithSignature.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!quoteToDelete} onOpenChange={() => setQuoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete quote {quoteToDelete?.quote_number}? This action cannot be undone.
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
      <AlertDialog open={!!archiveConfirmQuote} onOpenChange={() => setArchiveConfirmQuote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Archive quote {archiveConfirmQuote?.quote_number}? You can restore it later from the archived filter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveConfirmQuote && handleArchiveQuote(archiveConfirmQuote)}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Job Confirmation */}
      <AlertDialog open={!!createJobConfirmQuote} onOpenChange={() => setCreateJobConfirmQuote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Job Already Exists</AlertDialogTitle>
            <AlertDialogDescription>
              A job has already been created from this quote. Create another job anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleOpenCreateJobDialogConfirmed}>
              Create Another Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Invoice Confirmation */}
      <AlertDialog open={!!createInvoiceConfirmQuote} onOpenChange={() => setCreateInvoiceConfirmQuote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Invoice Already Exists</AlertDialogTitle>
            <AlertDialogDescription>
              An invoice has already been created from this quote. Create another invoice anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => createInvoiceConfirmQuote && handleConvertToInvoiceConfirmed(createInvoiceConfirmQuote.id)}>
              Create Another Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Signature Dialog */}
      <SignatureDialog
        open={signatureDialogOpen}
        onOpenChange={setSignatureDialogOpen}
        onSignatureComplete={handleSignatureComplete}
        title={`Sign Quote ${signatureQuote?.quote_number || ''}`}
      />

      {/* View Signature Dialog */}
      <ViewSignatureDialog
        signatureId={viewSignatureId}
        open={viewSignatureOpen}
        onOpenChange={setViewSignatureOpen}
      />

      {/* Create Job From Quote Dialog */}
      {selectedQuoteForJob && (
        <CreateJobFromQuoteDialog
          open={createJobDialogOpen}
          onOpenChange={setCreateJobDialogOpen}
          quote={selectedQuoteForJob as any}
          onConfirm={handleCreateJobFromQuote}
          isPending={createJobFromQuote.isPending}
        />
      )}

      {/* Add Quote Items To Job Dialog */}
      {selectedQuoteForJob && (
        <AddQuoteItemsToJobDialog
          open={addToJobDialogOpen}
          onOpenChange={setAddToJobDialogOpen}
          quote={selectedQuoteForJob as any}
          jobs={safeJobs as any[]}
          onConfirm={handleAddItemsToJob}
          isPending={addItemsToJob.isPending}
        />
      )}

      {/* Convert To Invoice Dialog */}
      {selectedQuoteForInvoice && (
        <ConvertToInvoiceDialog
          open={convertToInvoiceDialogOpen}
          onOpenChange={setConvertToInvoiceDialogOpen}
          quote={{ id: selectedQuoteForInvoice.id, quote_number: selectedQuoteForInvoice.quote_number, total: selectedQuoteForInvoice.total }}
          onConfirm={handleConvertToInvoiceWithPhotos}
          isPending={convertToInvoice.isPending}
        />
      )}
    </div>
  );
}
