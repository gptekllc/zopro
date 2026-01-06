import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Edit, PenTool, Calendar, User, Briefcase, Clock, FileText, ArrowUp, ArrowDown, Plus, Receipt, Download, Mail, Loader2, Send, Bell, Navigation, MessageSquare, Star, List, Camera, StickyNote, History, RefreshCw } from 'lucide-react';
import { createOnMyWaySmsLink, createOnMyWayMessage } from '@/lib/smsLink';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { toast } from 'sonner';
import { format, differenceInMinutes } from 'date-fns';
import { CustomerJob } from '@/hooks/useCustomerHistory';
import { PhotoGallery } from '@/components/photos/PhotoGallery';
import { JobPhotoGallery } from '@/components/jobs/JobPhotoGallery';
import { useJobRelatedQuotes, useConvertJobToQuote, useConvertJobToInvoice, Job, useUploadJobPhoto, useDeleteJobPhoto, useUpdateJobPhotoType } from '@/hooks/useJobs';
import { Quote } from '@/hooks/useQuotes';
import { QuoteCard } from '@/components/quotes/QuoteCard';
import { useInvoices, Invoice, getInvoiceStatusLabel } from '@/hooks/useInvoices';
import { useMemo, useState } from 'react';
import { formatAmount } from '@/lib/formatAmount';
import { useDownloadDocument, useEmailDocument } from '@/hooks/useDocumentActions';
import { useJobNotifications } from '@/hooks/useJobNotifications';
import { useJobFeedbacks, JobFeedback } from '@/hooks/useJobFeedbacks';
import { useJobTimeEntries } from '@/hooks/useTimeEntries';
import { ConvertJobToInvoiceDialog } from '@/components/jobs/ConvertJobToInvoiceDialog';
import { SignatureSection } from '@/components/signatures/SignatureSection';
import { useSignatureHistory, useClearJobSignature } from '@/hooks/useSignatureHistory';
import { useJobActivities } from '@/hooks/useJobActivities';
interface JobDetailDialogProps {
  job: CustomerJob | null;
  customerName?: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (jobId: string) => void;
  onViewSignature?: (signatureId: string) => void;
  onViewQuote?: (quote: Quote) => void;
  onCollectSignature?: () => void;
  onSendSignatureRequest?: () => void;
  isCollectingSignature?: boolean;
}
const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  invoiced: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
};
const priorityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
};
export function JobDetailDialog({
  job,
  customerName,
  customerEmail,
  customerPhone,
  open,
  onOpenChange,
  onEdit,
  onViewSignature,
  onViewQuote,
  onCollectSignature,
  onSendSignatureRequest,
  isCollectingSignature
}: JobDetailDialogProps) {
  // ALL hooks must come first, before any conditional returns
  const {
    profile
  } = useAuth();
  const {
    data: company
  } = useCompany();
  const {
    data: relatedQuotes,
    isLoading: loadingQuotes
  } = useJobRelatedQuotes(job?.id || null, job?.quote_id || null);
  const convertJobToQuote = useConvertJobToQuote();
  const convertJobToInvoice = useConvertJobToInvoice();
  const {
    data: allInvoices = [],
    isLoading: loadingInvoices
  } = useInvoices(false);
  const downloadDocument = useDownloadDocument();
  const emailDocument = useEmailDocument();
  const uploadJobPhoto = useUploadJobPhoto();
  const deleteJobPhoto = useDeleteJobPhoto();
  const updateJobPhotoType = useUpdateJobPhotoType();
  const {
    data: notifications = [],
    isLoading: loadingNotifications
  } = useJobNotifications(job?.id || null);
  const {
    data: feedbacks = [],
    isLoading: loadingFeedbacks
  } = useJobFeedbacks(job?.id || null);
  const {
    data: jobTimeEntries = []
  } = useJobTimeEntries(job?.id || null);
  const {
    data: signatureHistory = [],
    isLoading: loadingSignatureHistory
  } = useSignatureHistory('job', job?.id || null);
  const {
    data: jobActivities = [],
    isLoading: loadingJobActivities
  } = useJobActivities(job?.id || null);
  const clearSignature = useClearJobSignature();

  // State hooks - must be before any conditionals
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);

  // Filter invoices that are linked to this job (via quote_id that matches job's origin quote or child quotes)
  const jobInvoices = useMemo(() => {
    if (!job || !allInvoices.length) return [];

    // Get all quote IDs related to this job
    const relatedQuoteIds = new Set<string>();
    if (relatedQuotes?.originQuote) {
      relatedQuoteIds.add(relatedQuotes.originQuote.id);
    }
    if (relatedQuotes?.childQuotes) {
      relatedQuotes.childQuotes.forEach((q: Quote) => relatedQuoteIds.add(q.id));
    }

    // Filter invoices that have quote_id matching any related quote OR are linked via job's origin quote
    // Also check if quote has job_id matching this job
    return allInvoices.filter((invoice: Invoice) => {
      // Direct quote link
      if (invoice.quote_id && relatedQuoteIds.has(invoice.quote_id)) {
        return true;
      }
      // Check if invoice's quote has this job_id
      if (invoice.quote_id && job.quote_id) {
        // The origin quote is the one that created this job
        return invoice.quote_id === job.quote_id;
      }
      return false;
    });
  }, [job, allInvoices, relatedQuotes]);

  // Early return AFTER all hooks
  if (!job) return null;
  const handleOpenEmailModal = () => {
    setEmailAddress(customerEmail || '');
    setShowEmailModal(true);
  };
  const handleCloseEmailModal = () => {
    setShowEmailModal(false);
    setEmailAddress('');
  };
  const handleSendEmail = () => {
    if (emailAddress) {
      emailDocument.mutate({
        type: 'job',
        documentId: job.id,
        recipientEmail: emailAddress
      }, {
        onSuccess: handleCloseEmailModal
      });
    }
  };
  const handleCreateUpsellQuote = async () => {
    // Convert the CustomerJob to Job format for the mutation
    const jobForConversion: Job = {
      id: job.id,
      job_number: job.job_number,
      company_id: '',
      // Not needed for this operation
      customer_id: job.customer_id,
      quote_id: job.quote_id,
      assigned_to: job.assigned_to,
      status: job.status,
      priority: job.priority,
      title: job.title,
      description: job.description,
      scheduled_start: job.scheduled_start,
      scheduled_end: job.scheduled_end,
      actual_start: job.actual_start,
      actual_end: job.actual_end,
      notes: job.notes,
      created_by: null,
      created_at: job.created_at,
      updated_at: '',
      archived_at: null,
      subtotal: null,
      tax: null,
      total: null,
      discount_type: null,
      discount_value: null,
      items: [] // Will use job items if available
    };
    const quote = await convertJobToQuote.mutateAsync(jobForConversion);
    if (quote?.id) {
      onOpenChange(false);
      window.location.href = `/quotes?edit=${quote.id}`;
    }
  };
  const handleCreateInvoice = () => {
    setShowInvoiceDialog(true);
  };
  const handleCreateInvoiceWithPhotos = async (copyPhotos: boolean) => {
    const jobForConversion: Job = {
      id: job.id,
      job_number: job.job_number,
      company_id: '',
      customer_id: job.customer_id,
      quote_id: job.quote_id,
      assigned_to: job.assigned_to,
      status: job.status,
      priority: job.priority,
      title: job.title,
      description: job.description,
      scheduled_start: job.scheduled_start,
      scheduled_end: job.scheduled_end,
      actual_start: job.actual_start,
      actual_end: job.actual_end,
      notes: job.notes,
      created_by: null,
      created_at: job.created_at,
      updated_at: '',
      archived_at: null,
      subtotal: null,
      tax: null,
      total: null,
      discount_type: null,
      discount_value: null,
      items: []
    };
    const invoice = await convertJobToInvoice.mutateAsync({
      job: jobForConversion,
      copyPhotos
    });
    setShowInvoiceDialog(false);
    if (invoice?.id) {
      onOpenChange(false);
      window.location.href = `/invoices?edit=${invoice.id}`;
    }
  };
  const handleOnMyWay = (etaMinutes?: number) => {
    if (!customerPhone || !profile?.full_name || !company?.name) {
      // Fallback: copy message to clipboard for manual use
      const message = createOnMyWayMessage({
        technicianName: profile?.full_name || 'Your technician',
        companyName: company?.name || 'our company',
        etaMinutes
      });
      navigator.clipboard.writeText(message);
      toast.success('Message copied to clipboard');
      return;
    }
    const smsLink = createOnMyWaySmsLink({
      customerPhone,
      technicianName: profile.full_name,
      companyName: company.name,
      etaMinutes
    });
    window.location.href = smsLink;
  };
  const etaOptions = [10, 20, 30, 45, 60] as const;
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[85dvh] sm:max-h-[90vh] overflow-hidden mx-4 my-auto rounded-lg p-0 flex flex-col">
        <DialogHeader className="p-4 sm:p-6 pb-0 sm:pb-0">
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
              <span className="truncate">{job.job_number}</span>
            </DialogTitle>
            <div className="flex gap-1 sm:gap-2 shrink-0">
              <Badge className={`${priorityColors[job.priority] || 'bg-muted'} text-xs capitalize`}>
                {job.priority}
              </Badge>
              <Badge className={`${statusColors[job.status] || 'bg-muted'} text-xs capitalize`}>
                {job.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4 space-y-4 sm:space-y-6">
          {/* Title */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold">{job.title}</h3>
            {job.description && <p className="text-muted-foreground mt-1 text-sm">{job.description}</p>}
          </div>

          <Separator className="my-2" />

          {/* Details Grid - Compact */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-medium truncate">{customerName || 'Unknown'}</p>
            </div>
            {job.assignee?.full_name && <div>
                <p className="text-xs text-muted-foreground">Assigned To</p>
                <p className="font-medium truncate">{job.assignee.full_name}</p>
              </div>}
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="font-medium">{format(new Date(job.created_at), 'MMM d, yyyy')}</p>
            </div>
          </div>

          {/* Schedule & Actual Times - Inline Compact */}
          {(job.scheduled_start || job.scheduled_end || job.actual_start || job.actual_end) && <>
              <Separator className="my-2" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                {job.scheduled_start && <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Scheduled
                    </p>
                    <p className="font-medium">{format(new Date(job.scheduled_start), 'MMM d, h:mm a')}</p>
                  </div>}
                {job.scheduled_end && <div>
                    <p className="text-xs text-muted-foreground">End</p>
                    <p className="font-medium">{format(new Date(job.scheduled_end), 'MMM d, h:mm a')}</p>
                  </div>}
                {job.actual_start && <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Started
                    </p>
                    <p className="font-medium">{format(new Date(job.actual_start), 'MMM d, h:mm a')}</p>
                  </div>}
                {job.actual_end && <div>
                    <p className="text-xs text-muted-foreground">Completed</p>
                    <p className="font-medium">{format(new Date(job.actual_end), 'MMM d, h:mm a')}</p>
                  </div>}
              </div>
            </>}

          {/* Items Section - Compact */}
          <Separator className="my-2" />
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2 text-sm">
              <List className="w-3.5 h-3.5" /> 
              Items
              {(job.items?.length || 0) > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {job.items?.length}
                </Badge>}
            </h4>
            {job.items && job.items.length > 0 ? <div className="space-y-1.5">
                {/* Desktop header */}
                <div className="hidden sm:grid grid-cols-12 text-[10px] text-muted-foreground font-medium px-2">
                  <div className="col-span-5">Name</div>
                  <div className="col-span-2 text-right">Quantity</div>
                  <div className="col-span-3 text-right">Unit Price</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>
                {/* Items List */}
                <div className="space-y-1">
                  {job.items.map(item => {
                const isLaborItem = item.description.toLowerCase().includes('labor');

                // Get time entry breakdown for labor items
                const laborBreakdown = isLaborItem ? jobTimeEntries.filter(entry => entry.clock_out).reduce((acc, entry) => {
                  const userName = entry.user?.full_name || 'Unknown';
                  const minutes = differenceInMinutes(new Date(entry.clock_out!), new Date(entry.clock_in)) - (entry.break_minutes || 0);
                  acc[userName] = (acc[userName] || 0) + minutes;
                  return acc;
                }, {} as Record<string, number>) : null;
                return <div key={item.id} className={`py-1.5 px-2 rounded text-sm ${isLaborItem ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'bg-muted/50'}`}>
                        {/* Mobile layout */}
                        <div className="sm:hidden">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">{item.description}</span>
                            <span className="font-medium shrink-0">{formatAmount(item.total)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.quantity.toFixed(2)} × {formatAmount(item.unit_price)}
                          </div>
                        </div>
                        
                        {/* Desktop layout */}
                        <div className="hidden sm:grid grid-cols-12 items-center">
                          <div className="col-span-5 flex items-center gap-1.5">
                            <span className="font-medium truncate">{item.description}</span>
                            {isLaborItem && <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                Auto
                              </Badge>}
                          </div>
                          <div className="col-span-2 text-right text-xs">{item.quantity.toFixed(2)}</div>
                          <div className="col-span-3 text-right text-xs">{formatAmount(item.unit_price)}</div>
                          <div className="col-span-2 text-right font-medium">{formatAmount(item.total)}</div>
                        </div>
                        
                        {/* Labor breakdown */}
                        {isLaborItem && laborBreakdown && Object.keys(laborBreakdown).length > 0 && <div className="mt-1 pt-1 border-t border-blue-200/50 dark:border-blue-700/50 flex flex-wrap gap-1">
                            {Object.entries(laborBreakdown).map(([name, minutes]) => {
                      const hours = Math.floor(minutes / 60);
                      const mins = Math.round(minutes % 60);
                      return <span key={name} className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                                  {name}: {hours > 0 ? `${hours}h ` : ''}{mins}m
                                </span>;
                    })}
                          </div>}
                      </div>;
              })}
                </div>
                
                {/* Totals - Compact */}
                {(job.subtotal !== null || job.total !== null) && <div className="pt-1.5 border-t flex justify-end">
                    <div className="space-y-0.5 min-w-[140px] text-sm">
                      {job.subtotal !== null && <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground text-xs">Subtotal</span>
                          <span className="text-xs">{formatAmount(job.subtotal)}</span>
                        </div>}
                      {job.tax !== null && job.tax > 0 && <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground text-xs">Tax</span>
                          <span className="text-xs">{formatAmount(job.tax)}</span>
                        </div>}
                      {job.total !== null && <div className="flex justify-between font-medium gap-4">
                          <span className="text-xs">Total</span>
                          <span>{formatAmount(job.total)}</span>
                        </div>}
                    </div>
                  </div>}
              </div> : <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">No items added yet</p>
                {onEdit && <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => {
              onOpenChange(false);
              onEdit(job.id);
            }}>
                    <Edit className="w-3 h-3 mr-1" />
                    Edit Job
                  </Button>}
              </div>}
          </div>

          {/* Notes */}
          {job.notes && <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2 text-sm sm:text-base flex items-center gap-2">
                  <StickyNote className="w-4 h-4" /> Notes
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">{job.notes}</p>
              </div>
            </>}

          {/* Completion Signature */}
          <Separator />
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2 text-sm sm:text-base">
              <PenTool className="w-4 h-4" /> Customer Signature
            </h4>
            {job.completion_signed_at && job.completion_signature_id ? <div className="sm:max-w-md">
                <SignatureSection signatureId={job.completion_signature_id} title="Job Completion Signature" showCollectButton={false} showClearButton={true} onClearSignature={() => clearSignature.mutate({
              jobId: job.id,
              signatureId: job.completion_signature_id!,
              customerId: job.customer_id
            })} isClearing={clearSignature.isPending} />
              </div> : <div className="flex flex-col sm:flex-row gap-2 sm:max-w-md">
                <Button variant="outline" size="sm" onClick={onCollectSignature} disabled={isCollectingSignature} className="gap-1">
                  {isCollectingSignature ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenTool className="w-4 h-4" />}
                  Collect Signature
                </Button>
                <Button variant="ghost" size="sm" onClick={onSendSignatureRequest} disabled={!customerEmail} className="gap-1" title={customerEmail ? "Send signature request via email" : "No email on file"}>
                  <Mail className="w-4 h-4" />
                  Send Signature Request via Email
                </Button>
              </div>}
          </div>

          {/* Photos, Related Docs, Comments, History Tabs */}
          <Separator />
          <Tabs defaultValue="photos" className="w-full">
            <TabsList className="w-full grid grid-cols-4 h-auto p-1">
              <TabsTrigger value="photos" className="flex items-center gap-1 text-xs sm:text-sm px-1">
                <Camera className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Photos</span>
                {(job.photos?.length || 0) > 0 && <Badge variant="secondary" className="ml-0.5 text-xs hidden sm:inline-flex">
                    {job.photos?.length}
                  </Badge>}
              </TabsTrigger>

              <TabsTrigger value="linked" className="flex items-center gap-1 text-xs sm:text-sm px-1">
                <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Related Docs</span>
                {(relatedQuotes?.originQuote ? 1 : 0) + (relatedQuotes?.childQuotes?.length || 0) + jobInvoices.length > 0 && <Badge variant="secondary" className="ml-0.5 text-xs hidden sm:inline-flex">
                    {(relatedQuotes?.originQuote ? 1 : 0) + (relatedQuotes?.childQuotes?.length || 0) + jobInvoices.length}
                  </Badge>}
              </TabsTrigger>

              <TabsTrigger value="feedback" className="flex items-center gap-1 text-xs sm:text-sm px-1">
                <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Feedbacks</span>
                {feedbacks.length > 0 && <Badge variant="secondary" className="ml-0.5 text-xs">
                    {feedbacks.length}
                  </Badge>}
              </TabsTrigger>

              <TabsTrigger value="activities" className="flex items-center gap-1 text-xs sm:text-sm px-1">
                <History className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Activities</span>
                {notifications.length + signatureHistory.length + jobActivities.length > 0 && <Badge variant="secondary" className="ml-0.5 text-xs hidden sm:inline-flex">
                    {notifications.length + signatureHistory.length + jobActivities.length}
                  </Badge>}
              </TabsTrigger>
            </TabsList>

            {/* Photos Tab */}
            <TabsContent value="photos" className="mt-4">
              <JobPhotoGallery photos={(job.photos || []).map(p => ({
              id: p.id,
              photo_url: p.photo_url,
              photo_type: p.photo_type as 'before' | 'after' | 'other',
              caption: p.caption,
              created_at: p.created_at
            }))} onUpload={async (file, photoType) => {
              await uploadJobPhoto.mutateAsync({
                jobId: job.id,
                file,
                photoType
              });
            }} onDelete={async photoId => {
              await deleteJobPhoto.mutateAsync(photoId);
            }} onUpdateType={(photoId, photoType) => {
              updateJobPhotoType.mutate({
                photoId,
                photoType
              });
            }} isUploading={uploadJobPhoto.isPending} editable={true} />
            </TabsContent>

            {/* Related Docs Tab */}
            <TabsContent value="linked" className="mt-4">
              {loadingQuotes || loadingInvoices ? <p className="text-xs sm:text-sm text-muted-foreground">Loading...</p> : <div className="space-y-4">
                  {/* Origin Quote (Parent) */}
                  {relatedQuotes?.originQuote && <div>
                      <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                        <ArrowDown className="w-3 h-3" /> Origin Quote
                      </p>
                      <QuoteCard quote={relatedQuotes.originQuote} onView={() => onViewQuote?.(relatedQuotes.originQuote)} />
                    </div>}

                  {/* Upsell Quotes (Children) */}
                  {relatedQuotes?.childQuotes && relatedQuotes.childQuotes.length > 0 && <div>
                      <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                        <ArrowUp className="w-3 h-3" /> Upsell Quotes
                      </p>
                      <div className="space-y-2">
                        {relatedQuotes.childQuotes.map((quote: Quote) => <QuoteCard key={quote.id} quote={quote} onView={() => onViewQuote?.(quote)} />)}
                      </div>
                    </div>}

                  {/* Invoices */}
                  {jobInvoices.length > 0 && <div>
                      <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                        <Receipt className="w-3 h-3" /> Invoices
                      </p>
                      <div className="space-y-2">
                        {jobInvoices.map((invoice: Invoice) => <div key={invoice.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border cursor-pointer hover:bg-muted transition-colors" onClick={() => {
                    onOpenChange(false);
                    window.location.href = `/invoices?view=${invoice.id}`;
                  }}>
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/10 rounded-full shrink-0">
                                <Receipt className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{invoice.invoice_number}</p>
                                <p className="text-xs text-muted-foreground">
                                  {invoice.customer?.name || customerName}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-primary">
                                ${Number(invoice.total || 0).toFixed(2)}
                              </span>
                              <Badge variant="outline" className={`text-xs ${invoice.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : invoice.status === 'overdue' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : ''}`}>
                                {getInvoiceStatusLabel(invoice.status)}
                              </Badge>
                            </div>
                          </div>)}
                      </div>
                    </div>}

                  {/* Empty State + Actions */}
                  {!relatedQuotes?.originQuote && (!relatedQuotes?.childQuotes || relatedQuotes.childQuotes.length === 0) && jobInvoices.length === 0 && <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-xs sm:text-sm text-muted-foreground mb-3">No linked documents yet</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleCreateUpsellQuote} disabled={convertJobToQuote.isPending}>
                          <Plus className="w-3 h-3 mr-1" />
                          Create Quote
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCreateInvoice} disabled={convertJobToInvoice.isPending}>
                          <Plus className="w-3 h-3 mr-1" />
                          Create Invoice
                        </Button>
                      </div>
                    </div>}

                  {/* Action buttons when there are existing docs */}
                  {(relatedQuotes?.originQuote || relatedQuotes?.childQuotes && relatedQuotes.childQuotes.length > 0 || jobInvoices.length > 0) && <div className="flex flex-wrap gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={handleCreateUpsellQuote} disabled={convertJobToQuote.isPending}>
                        <Plus className="w-3 h-3 mr-1" />
                        Add Quote
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleCreateInvoice} disabled={convertJobToInvoice.isPending}>
                        <Plus className="w-3 h-3 mr-1" />
                        Add Invoice
                      </Button>
                    </div>}
                </div>}
            </TabsContent>

            {/* Customer Feedback Tab */}
            <TabsContent value="feedback" className="mt-4">
              {loadingFeedbacks ? <p className="text-xs sm:text-sm text-muted-foreground">Loading...</p> : feedbacks.length > 0 ? <div className="space-y-3">
                  {feedbacks.map((feedback: JobFeedback) => <div key={feedback.id} className={`p-3 rounded-lg border ${feedback.is_negative ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-muted/50'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map(star => <Star key={star} className={`w-4 h-4 ${star <= feedback.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />)}
                            </div>
                            <span className="text-sm font-medium">
                              {feedback.rating}/5
                            </span>
                            {feedback.is_negative && <Badge variant="destructive" className="text-xs">
                                Needs Attention
                              </Badge>}
                          </div>
                          {feedback.feedback_text && <p className="text-sm text-muted-foreground">
                              "{feedback.feedback_text}"
                            </p>}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <span>{feedback.customer?.name || 'Customer'}</span>
                            <span>•</span>
                            <span>{format(new Date(feedback.created_at), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                      </div>
                    </div>)}
                </div> : <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-xs sm:text-sm text-muted-foreground">No customer feedback yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Feedback will appear here after the customer rates the job
                  </p>
                </div>}
            </TabsContent>

            {/* Activities Tab (Combined Email + Signature + Job Activities) */}
            <TabsContent value="activities" className="mt-4">
              {loadingNotifications || loadingSignatureHistory || loadingJobActivities ? <p className="text-xs sm:text-sm text-muted-foreground">Loading...</p> : (() => {
              // Create unified activity items
              type ActivityItem = {
                id: string;
                type: 'email' | 'signature_collected' | 'signature_cleared' | 'status_change' | 'priority_change' | 'quote_created' | 'invoice_created';
                timestamp: string;
                title: string;
                details: string;
                performer?: string | null;
                extra?: string;
              };
              const activities: ActivityItem[] = [
              // Email notifications
              ...notifications.map(n => ({
                id: `email-${n.id}`,
                type: 'email' as const,
                timestamp: n.sent_at,
                title: 'Email Sent',
                details: `To: ${n.recipient_email}`,
                performer: n.sent_by_profile?.full_name || null,
                extra: n.status_at_send ? n.status_at_send.replace('_', ' ') : undefined
              })),
              // Signature events
              ...signatureHistory.map(e => ({
                id: `sig-${e.id}`,
                type: e.event_type === 'signed' ? 'signature_collected' as const : 'signature_cleared' as const,
                timestamp: e.created_at,
                title: e.event_type === 'signed' ? 'Signature Collected' : 'Signature Cleared',
                details: e.signer_name ? `Signer: ${e.signer_name}` : '',
                performer: e.performer?.full_name || null
              })),
              // Job activities (status changes, priority changes, document creation)
              ...jobActivities.map(a => ({
                id: `activity-${a.id}`,
                type: a.activity_type as 'status_change' | 'priority_change' | 'quote_created' | 'invoice_created',
                timestamp: a.created_at,
                title: a.activity_type === 'status_change' ? 'Status Changed' : 
                       a.activity_type === 'priority_change' ? 'Priority Changed' :
                       a.activity_type === 'quote_created' ? 'Quote Created' : 'Invoice Created',
                details: a.activity_type === 'status_change' ? `${(a.old_value || 'draft').replace('_', ' ')} → ${(a.new_value || '').replace('_', ' ')}` : 
                         a.activity_type === 'priority_change' ? `${a.old_value || 'medium'} → ${a.new_value || ''}` :
                         a.new_value || '',
                performer: a.performer?.full_name || null
              }))];

              // Sort by timestamp descending
              activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              if (activities.length === 0) {
                return <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <History className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-xs sm:text-sm text-muted-foreground">No activity yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Status changes, emails, and signature events will appear here
                      </p>
                    </div>;
              }
              const getActivityStyles = (type: ActivityItem['type']) => {
                switch (type) {
                  case 'email':
                    return {
                      bg: 'bg-muted/50',
                      iconBg: 'bg-primary/10',
                      iconColor: 'text-primary'
                    };
                  case 'signature_collected':
                    return {
                      bg: 'bg-success/5 border-success/30',
                      iconBg: 'bg-success/10',
                      iconColor: 'text-success'
                    };
                  case 'signature_cleared':
                    return {
                      bg: 'bg-destructive/5 border-destructive/30',
                      iconBg: 'bg-destructive/10',
                      iconColor: 'text-destructive'
                    };
                  case 'status_change':
                    return {
                      bg: 'bg-blue-50/50 dark:bg-blue-900/10',
                      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
                      iconColor: 'text-blue-600 dark:text-blue-400'
                    };
                  case 'priority_change':
                    return {
                      bg: 'bg-amber-50/50 dark:bg-amber-900/10',
                      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
                      iconColor: 'text-amber-600 dark:text-amber-400'
                    };
                  case 'quote_created':
                    return {
                      bg: 'bg-purple-50/50 dark:bg-purple-900/10',
                      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
                      iconColor: 'text-purple-600 dark:text-purple-400'
                    };
                  case 'invoice_created':
                    return {
                      bg: 'bg-orange-50/50 dark:bg-orange-900/10',
                      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
                      iconColor: 'text-orange-600 dark:text-orange-400'
                    };
                  default:
                    return {
                      bg: 'bg-muted/50',
                      iconBg: 'bg-muted',
                      iconColor: 'text-muted-foreground'
                    };
                }
              };
              const getActivityIcon = (type: ActivityItem['type'], colorClass: string) => {
                switch (type) {
                  case 'email':
                    return <Mail className={`w-3 h-3 sm:w-4 sm:h-4 ${colorClass}`} />;
                  case 'signature_collected':
                  case 'signature_cleared':
                    return <PenTool className={`w-3 h-3 sm:w-4 sm:h-4 ${colorClass}`} />;
                  case 'status_change':
                    return <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${colorClass}`} />;
                  case 'priority_change':
                    return <ArrowUp className={`w-3 h-3 sm:w-4 sm:h-4 ${colorClass}`} />;
                  case 'quote_created':
                    return <FileText className={`w-3 h-3 sm:w-4 sm:h-4 ${colorClass}`} />;
                  case 'invoice_created':
                    return <Receipt className={`w-3 h-3 sm:w-4 sm:h-4 ${colorClass}`} />;
                  default:
                    return <History className={`w-3 h-3 sm:w-4 sm:h-4 ${colorClass}`} />;
                }
              };
              return <div className="space-y-2">
                    {activities.map(activity => {
                  const styles = getActivityStyles(activity.type);
                  return <div key={activity.id} className={`flex items-start gap-3 p-3 rounded-lg border ${styles.bg}`}>
                          <div className={`p-2 rounded-full shrink-0 ${styles.iconBg}`}>
                            {getActivityIcon(activity.type, styles.iconColor)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{activity.title}</span>
                              {activity.extra && <Badge variant="outline" className="text-xs capitalize">
                                  {activity.extra}
                                </Badge>}
                            </div>
                            {activity.details && <p className="text-xs text-muted-foreground truncate">
                                {activity.details}
                              </p>}
                            {activity.performer && <p className="text-xs text-muted-foreground">
                                By: {activity.performer}
                              </p>}
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(activity.timestamp), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                        </div>;
                })}
                  </div>;
            })()}
            </TabsContent>
          </Tabs>

          <AlertDialog open={showEmailModal} onOpenChange={setShowEmailModal}>
            <AlertDialogContent className="sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  Send Job Summary
                </AlertDialogTitle>
              </AlertDialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-address">Email Address</Label>
                  <Input id="email-address" type="email" placeholder="customer@example.com" value={emailAddress} onChange={e => setEmailAddress(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleCloseEmailModal}>
                    Cancel
                  </Button>
                  <Button onClick={handleSendEmail} disabled={!emailAddress || emailDocument.isPending}>
                    {emailDocument.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                    Send
                  </Button>
                </div>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Footer Actions - Fixed at bottom */}
        <div className="border-t bg-background p-4 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadDocument.mutate({
            type: 'job',
            documentId: job.id
          })} disabled={downloadDocument.isPending} className="flex-1 sm:flex-none">
              {downloadDocument.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenEmailModal} className="flex-1 sm:flex-none">
              <Mail className="w-4 h-4 mr-1" />
              Email
            </Button>
            <Button variant="outline" size="sm" onClick={handleCreateUpsellQuote} disabled={convertJobToQuote.isPending} className="flex-1 sm:flex-none">
              <FileText className="w-4 h-4 mr-1" />
              Create Quote
            </Button>
            <Button variant="outline" size="sm" onClick={handleCreateInvoice} disabled={convertJobToInvoice.isPending} className="flex-1 sm:flex-none">
              <Receipt className="w-4 h-4 mr-1" />
              Convert to Invoice
            </Button>
            {/* On My Way with ETA dropdown */}
            {['scheduled', 'in_progress'].includes(job.status) && <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 sm:flex-none" title={customerPhone ? "Send SMS to customer" : "Copy message (no phone on file)"}>
                    <Navigation className="w-4 h-4 mr-1" />
                    On My Way
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {etaOptions.map(eta => <DropdownMenuItem key={eta} onClick={() => handleOnMyWay(eta)}>
                      ~{eta} minutes
                    </DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>}
            <Button size="sm" onClick={() => onEdit?.(job.id)} className="w-full sm:w-auto sm:ml-auto mt-2 sm:mt-0">
              <Edit className="w-4 h-4 mr-1" /> Edit
            </Button>
          </div>
        </div>
      </DialogContent>
      
      {/* Convert to Invoice Dialog */}
      <ConvertJobToInvoiceDialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog} onConfirm={handleCreateInvoiceWithPhotos} isProcessing={convertJobToInvoice.isPending} jobNumber={job.job_number} />
    </Dialog>;
}