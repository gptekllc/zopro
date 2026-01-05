import { useState, useCallback, useMemo } from 'react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useDownloadDocument, useEmailDocument } from '@/hooks/useDocumentActions';
import { useUndoableDelete } from '@/hooks/useUndoableDelete';
import { useSignJobCompletion } from '@/hooks/useSignatures';
import { useSendSignatureRequest } from '@/hooks/useSendSignatureRequest';
import { useSendJobNotification } from '@/hooks/useSendJobNotification';
import { useDeleteJob, useArchiveJob, useUnarchiveJob, useUpdateJob, useConvertJobToInvoice, useConvertJobToQuote, Job } from '@/hooks/useJobs';
import { useQuotes, Quote } from '@/hooks/useQuotes';
import { useInvoices, Invoice } from '@/hooks/useInvoices';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Search, Loader2, Filter, Archive } from 'lucide-react';
import { SignatureDialog } from '@/components/signatures/SignatureDialog';
import { ViewSignatureDialog } from '@/components/signatures/ViewSignatureDialog';
import { JobDetailDialog } from '@/components/jobs/JobDetailDialog';
import { JobListCard } from '@/components/jobs/JobListCard';
import { ConvertJobToInvoiceDialog } from '@/components/jobs/ConvertJobToInvoiceDialog';
import { useSwipeHint } from '@/components/ui/swipeable-card';
import { Customer } from '@/hooks/useCustomers';
import { toast } from 'sonner';
import { createOnMyWaySmsLink, createOnMyWayMessage } from '@/lib/smsLink';

const JOB_STATUSES = ['draft', 'scheduled', 'in_progress', 'completed', 'invoiced', 'paid'] as const;
const JOB_STATUSES_EDITABLE = ['draft', 'scheduled', 'in_progress', 'completed', 'invoiced'] as const;

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface JobListManagerProps {
  jobs: Job[];
  customers: Customer[];
  profiles: Profile[];
  customerId?: string;
  showFilters?: boolean;
  showSearch?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  hideInlineControls?: boolean;
  onEditJob?: (job: Job) => void;
  onCreateJob?: () => void;
  onRefetch?: () => Promise<void>;
  isLoading?: boolean;
}

export function JobListManager({
  jobs,
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
  onEditJob,
  onCreateJob,
  onRefetch,
  isLoading = false,
}: JobListManagerProps) {
  const { profile } = useAuth();
  const { data: company } = useCompany();
  const { saveScrollPosition, restoreScrollPosition } = useScrollRestoration();
  const { data: quotes = [] } = useQuotes(false);
  const { data: invoices = [] } = useInvoices(false);
  
  // Safe arrays
  const safeQuotes = useMemo(() => (Array.isArray(quotes) ? quotes : []).filter((q: any) => q && q.id) as Quote[], [quotes]);
  const safeInvoices = useMemo(() => (Array.isArray(invoices) ? invoices : []).filter((i: any) => i && i.id) as Invoice[], [invoices]);

  // Track quotes/invoices per job
  const quotesPerJob = useMemo(() => {
    const counts = new Map<string, number>();
    safeQuotes.forEach((quote: any) => {
      if (quote.job_id) counts.set(quote.job_id, (counts.get(quote.job_id) || 0) + 1);
    });
    return counts;
  }, [safeQuotes]);

  const invoicesPerJob = useMemo(() => {
    const counts = new Map<string, number>();
    safeInvoices.forEach((invoice: any) => {
      if (!invoice?.id) return;
      if (invoice.job_id) {
        counts.set(invoice.job_id, (counts.get(invoice.job_id) || 0) + 1);
        return;
      }
      if (invoice.quote_id) {
        const job = jobs.find((j: any) => j?.quote_id === invoice.quote_id);
        if (job?.id) {
          counts.set(job.id, (counts.get(job.id) || 0) + 1);
          return;
        }
        const upsellQuote = safeQuotes.find((q: any) => q?.id === invoice.quote_id && q?.job_id);
        if (upsellQuote?.job_id) {
          counts.set(upsellQuote.job_id, (counts.get(upsellQuote.job_id) || 0) + 1);
        }
      }
    });
    return counts;
  }, [jobs, safeQuotes, safeInvoices]);

  // Mutations
  const deleteJob = useDeleteJob();
  const archiveJob = useArchiveJob();
  const unarchiveJob = useUnarchiveJob();
  const updateJob = useUpdateJob();
  const emailDocument = useEmailDocument();
  const downloadDocument = useDownloadDocument();
  const convertToInvoice = useConvertJobToInvoice();
  const convertToQuote = useConvertJobToQuote();
  const signJobCompletion = useSignJobCompletion();
  const sendSignatureRequest = useSendSignatureRequest();
  const sendJobNotification = useSendJobNotification();

  // Undo-able delete
  const { scheduleDelete: scheduleJobDelete, filterPendingDeletes: filterPendingJobDeletes } = useUndoableDelete(
    async (id) => { await deleteJob.mutateAsync(id); },
    { itemLabel: 'job', timeout: 5000 }
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
  const [viewingJob, setViewingJob] = useState<Job | null>(null);
  const [deleteConfirmJob, setDeleteConfirmJob] = useState<Job | null>(null);
  const [archiveConfirmJob, setArchiveConfirmJob] = useState<Job | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');

  // Signature dialogs
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [signatureJob, setSignatureJob] = useState<Job | null>(null);
  const [viewSignatureId, setViewSignatureId] = useState<string | null>(null);
  const [viewSignatureOpen, setViewSignatureOpen] = useState(false);

  // Create invoice dialog
  const [createInvoiceConfirmJob, setCreateInvoiceConfirmJob] = useState<Job | null>(null);

  // Create quote confirmation
  const [createQuoteConfirmJob, setCreateQuoteConfirmJob] = useState<Job | null>(null);

  // Swipe hint
  const { showHint: showSwipeHint, dismissHint: dismissSwipeHint } = useSwipeHint('jobs-swipe-hint-shown');

  // Wrapped setters for scroll restoration
  const openViewingJob = useCallback((job: Job | null) => {
    if (job) saveScrollPosition();
    setViewingJob(job);
    if (!job) restoreScrollPosition();
  }, [saveScrollPosition, restoreScrollPosition]);

  // Filtering
  const filteredJobs = useMemo(() => {
    const filtered = jobs.filter(job => {
      if (!job) return false;
      if (customerId && job.customer_id !== customerId) return false;
      
      const matchesSearch = String(job.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(job.job_number ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String((job as any).customer?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase());

      if (statusFilter === 'archived') {
        return matchesSearch && !!job.archived_at;
      }
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
      const notArchived = !job.archived_at;
      return matchesSearch && matchesStatus && notArchived;
    });
    return filterPendingJobDeletes(filtered);
  }, [jobs, searchQuery, statusFilter, customerId, filterPendingJobDeletes]);

  // Infinite scroll
  const { visibleItems: visibleJobs, hasMore, loadMoreRef, loadAll, totalCount } = useInfiniteScroll(filteredJobs, { pageSize: 20 });

  // Helpers
  const getCustomerName = (customerId: string) => customers.find(c => c.id === customerId)?.name || 'Unknown';
  const getCustomerEmail = (customerId: string) => customers.find(c => c.id === customerId)?.email || '';
  const getCustomerPhone = (customerId: string) => customers.find(c => c.id === customerId)?.phone || '';

  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'draft': return 'bg-muted text-muted-foreground';
      case 'scheduled': return 'bg-blue-500/10 text-blue-500';
      case 'in_progress': return 'bg-warning/10 text-warning';
      case 'completed': return 'bg-success/10 text-success';
      case 'invoiced': return 'bg-primary/10 text-primary';
      case 'paid': return 'bg-success/10 text-success';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-muted text-muted-foreground';
      case 'medium': return 'bg-blue-500/10 text-blue-500';
      case 'high': return 'bg-warning/10 text-warning';
      case 'urgent': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Handlers
  const handleStatusChange = async (jobId: string, newStatus: Job['status']) => {
    const job = jobs.find(j => j.id === jobId);
    const oldStatus = job?.status;
    
    const updates: Partial<Job> = { status: newStatus };
    if (newStatus === 'in_progress' && !job?.actual_start) {
      updates.actual_start = new Date().toISOString();
    }
    if (newStatus === 'completed') {
      updates.actual_end = new Date().toISOString();
    }
    await updateJob.mutateAsync({ id: jobId, ...updates });

    // Auto-send notification when scheduled
    if (newStatus === 'scheduled' && oldStatus === 'draft' && job?.customer_id) {
      const autoSendEnabled = (company as any)?.auto_send_job_scheduled_email !== false;
      if (autoSendEnabled) {
        sendJobNotification.mutate({ jobId, customerId: job.customer_id });
      }
    }
  };

  const handlePriorityChange = async (jobId: string, newPriority: Job['priority']) => {
    await updateJob.mutateAsync({ id: jobId, priority: newPriority });
  };

  const handleDownload = (jobId: string) => {
    downloadDocument.mutate({ type: 'job', documentId: jobId });
  };

  const handleEmail = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      setEmailAddress(getCustomerEmail(job.customer_id));
      setEmailDialogOpen(true);
    }
  };

  const handleSendEmail = () => {
    if (!viewingJob || !emailAddress) return;
    emailDocument.mutate(
      { type: 'job', documentId: viewingJob.id, recipientEmail: emailAddress },
      { onSuccess: () => setEmailDialogOpen(false) }
    );
  };

  const handleArchiveJob = async (job: Job) => {
    await archiveJob.mutateAsync(job.id);
    setArchiveConfirmJob(null);
  };

  const handleUnarchiveJob = async (job: Job) => {
    await unarchiveJob.mutateAsync(job.id);
  };

  const handleDeleteClick = (job: Job) => setDeleteConfirmJob(job);
  const handleConfirmDelete = () => {
    if (deleteConfirmJob) {
      scheduleJobDelete(deleteConfirmJob.id);
      setDeleteConfirmJob(null);
    }
  };

  // Signature handlers
  const handleOpenSignatureDialog = (job: Job) => {
    setSignatureJob(job);
    setSignatureDialogOpen(true);
  };

  const handleSignatureComplete = async (signatureData: string, signerName: string) => {
    if (!signatureJob) return;
    const signature = await signJobCompletion.mutateAsync({
      jobId: signatureJob.id,
      signatureData,
      signerName,
      customerId: signatureJob.customer_id,
    });
    if (viewingJob?.id === signatureJob.id) {
      setViewingJob({
        ...viewingJob,
        completion_signature_id: signature.id,
        completion_signed_at: new Date().toISOString(),
        completion_signed_by: signerName,
        status: 'completed',
      } as any);
    }
    setSignatureDialogOpen(false);
    setSignatureJob(null);
  };

  const handleViewSignature = (signatureId: string) => {
    setViewSignatureId(signatureId);
    setViewSignatureOpen(true);
  };

  const handleSendSignatureRequest = (job: Job) => {
    const customer = customers.find(c => c.id === job.customer_id);
    if (!customer?.email) {
      toast.error('Customer does not have an email address');
      return;
    }
    sendSignatureRequest.mutate({
      documentType: 'job',
      documentId: job.id,
      recipientEmail: customer.email,
      recipientName: customer.name,
      companyName: company?.name || 'Company',
      documentNumber: job.job_number,
      customerId: customer.id,
    });
  };

  // Create Quote
  const handleCreateQuote = async (job: Job) => {
    const existingQuotes = quotesPerJob.get(job.id) || 0;
    if (existingQuotes > 0) {
      setCreateQuoteConfirmJob(job);
    } else {
      const quote = await convertToQuote.mutateAsync(job);
      if (quote?.id) {
        window.location.href = `/quotes?edit=${quote.id}`;
      }
    }
  };

  const handleCreateQuoteConfirmed = async () => {
    if (!createQuoteConfirmJob) return;
    const quote = await convertToQuote.mutateAsync(createQuoteConfirmJob);
    setCreateQuoteConfirmJob(null);
    if (quote?.id) {
      window.location.href = `/quotes?edit=${quote.id}`;
    }
  };

  // Create Invoice
  const handleCreateInvoice = (job: Job) => {
    setCreateInvoiceConfirmJob(job);
  };

  const handleCreateInvoiceWithPhotos = async (copyPhotos: boolean) => {
    if (!createInvoiceConfirmJob) return;
    const invoice = await convertToInvoice.mutateAsync({ job: createInvoiceConfirmJob, copyPhotos });
    setCreateInvoiceConfirmJob(null);
    openViewingJob(null);
    if (invoice?.id) {
      window.location.href = `/invoices?edit=${invoice.id}`;
    }
  };

  const handleDuplicateJob = (job: Job) => {
    window.location.href = `/jobs?duplicate=${job.id}`;
  };

  // On My Way handler
  const etaOptions = [10, 20, 30, 45, 60] as const;
  const handleOnMyWay = (job: Job, etaMinutes?: number) => {
    const customerPhone = (job as any).customer?.phone;
    if (!customerPhone || !profile?.full_name || !company?.name) {
      const message = createOnMyWayMessage({
        technicianName: profile?.full_name || 'Your technician',
        companyName: company?.name || 'our company',
        etaMinutes,
      });
      navigator.clipboard.writeText(message);
      toast.success('Message copied to clipboard');
      return;
    }
    const smsLink = createOnMyWaySmsLink({
      customerPhone,
      technicianName: profile.full_name,
      companyName: company.name,
      etaMinutes,
    });
    window.location.href = smsLink;
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
                <DropdownMenuItem onClick={() => handleStatusFilterChange('all')} className={statusFilter === 'all' ? 'bg-accent' : ''}>
                  All Status
                </DropdownMenuItem>
                {JOB_STATUSES_EDITABLE.map(s => (
                  <DropdownMenuItem key={s} onClick={() => handleStatusFilterChange(s)} className={`capitalize ${statusFilter === s ? 'bg-accent' : ''}`}>
                    {s.replace('_', ' ')}
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

      {/* Job List */}
      <PullToRefresh onRefresh={async () => { if (onRefetch) await onRefetch(); }} className="sm:contents">
        <div className="space-y-3">
          {visibleJobs.map((job, index) => (
            <JobListCard
              key={job.id}
              job={job}
              notificationCount={0}
              getPriorityColor={getPriorityColor}
              getStatusColor={getStatusColor}
              onView={openViewingJob}
              onEdit={onEditJob || (() => {})}
              onDuplicate={handleDuplicateJob}
              onSaveAsTemplate={() => window.location.href = `/jobs?saveTemplate=${job.id}`}
              onPriorityChange={handlePriorityChange}
              onDownload={() => handleDownload(job.id)}
              onEmail={() => handleEmail(job.id)}
              onSendNotification={() => job.customer_id && sendJobNotification.mutate({ jobId: job.id, customerId: job.customer_id })}
              onOnMyWay={(j, minutes) => handleOnMyWay(j, minutes)}
              onViewSignature={handleViewSignature}
              onOpenSignatureDialog={handleOpenSignatureDialog}
              onSendSignatureRequest={handleSendSignatureRequest}
              onCreateInvoice={handleCreateInvoice}
              onCreateQuote={handleCreateQuote}
              onArchive={(j) => setArchiveConfirmJob(j)}
              onUnarchive={handleUnarchiveJob}
              onDelete={handleDeleteClick}
              showSwipeHint={index === 0 && showSwipeHint}
              onSwipeHintDismiss={dismissSwipeHint}
            />
          ))}
          {filteredJobs.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">No jobs found</CardContent>
            </Card>
          )}
          {hasMore && (
            <div ref={loadMoreRef} className="py-4 flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Showing {visibleJobs.length} of {totalCount}</span>
                <Button variant="ghost" size="sm" onClick={loadAll} className="h-7 text-xs">
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
            <DialogTitle>Email Job Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Recipient Email</Label>
              <Input
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setEmailDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSendEmail} disabled={emailDocument.isPending || !emailAddress}>
                {emailDocument.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Send Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Job Detail Dialog */}
      <JobDetailDialog
        job={viewingJob as any}
        customerName={viewingJob ? getCustomerName(viewingJob.customer_id) : undefined}
        customerEmail={viewingJob ? getCustomerEmail(viewingJob.customer_id) : undefined}
        customerPhone={viewingJob ? getCustomerPhone(viewingJob.customer_id) : undefined}
        open={!!viewingJob}
        onOpenChange={(open) => !open && openViewingJob(null)}
        onEdit={onEditJob ? (id) => {
          if (viewingJob) {
            onEditJob(viewingJob);
            openViewingJob(null);
          }
        } : undefined}
        onViewSignature={handleViewSignature}
        onCollectSignature={() => viewingJob && handleOpenSignatureDialog(viewingJob)}
        onSendSignatureRequest={() => viewingJob && handleSendSignatureRequest(viewingJob)}
        isCollectingSignature={signJobCompletion.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmJob} onOpenChange={() => setDeleteConfirmJob(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete job {deleteConfirmJob?.job_number}? This action cannot be undone.
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
      <AlertDialog open={!!archiveConfirmJob} onOpenChange={() => setArchiveConfirmJob(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Job</AlertDialogTitle>
            <AlertDialogDescription>
              Archive job {archiveConfirmJob?.job_number}? You can restore it later from the archived filter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveConfirmJob && handleArchiveJob(archiveConfirmJob)}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Quote Confirmation */}
      <AlertDialog open={!!createQuoteConfirmJob} onOpenChange={() => setCreateQuoteConfirmJob(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quote Already Exists</AlertDialogTitle>
            <AlertDialogDescription>
              A quote has already been created from this job. Create another quote anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateQuoteConfirmed}>
              Create Another Quote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Invoice Dialog */}
      {createInvoiceConfirmJob && (
        <ConvertJobToInvoiceDialog
          open={!!createInvoiceConfirmJob}
          onOpenChange={() => setCreateInvoiceConfirmJob(null)}
          jobNumber={createInvoiceConfirmJob.job_number}
          onConfirm={handleCreateInvoiceWithPhotos}
          isProcessing={convertToInvoice.isPending}
        />
      )}

      {/* Signature Dialog */}
      <SignatureDialog
        open={signatureDialogOpen}
        onOpenChange={setSignatureDialogOpen}
        onSignatureComplete={handleSignatureComplete}
        title={`Sign Job ${signatureJob?.job_number || ''}`}
      />

      {/* View Signature Dialog */}
      <ViewSignatureDialog
        signatureId={viewSignatureId}
        open={viewSignatureOpen}
        onOpenChange={setViewSignatureOpen}
      />
    </div>
  );
}
