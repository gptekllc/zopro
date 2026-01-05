import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Edit, PenTool, Calendar, User, Briefcase, 
  Clock, FileText, ArrowUp, ArrowDown, Plus, Receipt,
  Download, Mail, Loader2, Send, Bell, Navigation, MessageSquare, Star,
  List
} from 'lucide-react';
import { createOnMyWaySmsLink, createOnMyWayMessage } from '@/lib/smsLink';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { toast } from 'sonner';
import { format, differenceInMinutes } from 'date-fns';
import { CustomerJob } from '@/hooks/useCustomerHistory';
import { PhotoGallery } from '@/components/photos/PhotoGallery';
import { useJobRelatedQuotes, useConvertJobToQuote, useConvertJobToInvoice, Job } from '@/hooks/useJobs';
import { Quote } from '@/hooks/useQuotes';
import { QuoteCard } from '@/components/quotes/QuoteCard';
import { useInvoices, Invoice } from '@/hooks/useInvoices';
import { useMemo, useState } from 'react';
import { formatAmount } from '@/lib/formatAmount';
import { useDownloadDocument, useEmailDocument } from '@/hooks/useDocumentActions';
import { useSendJobNotification } from '@/hooks/useSendJobNotification';
import { useJobNotifications } from '@/hooks/useJobNotifications';
import { useJobFeedbacks, JobFeedback } from '@/hooks/useJobFeedbacks';
import { useJobTimeEntries } from '@/hooks/useTimeEntries';
import { ConvertJobToInvoiceDialog } from '@/components/jobs/ConvertJobToInvoiceDialog';

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
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
};

const priorityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
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
  isCollectingSignature,
}: JobDetailDialogProps) {
  const { profile } = useAuth();
  const { data: company } = useCompany();
  const { data: relatedQuotes, isLoading: loadingQuotes } = useJobRelatedQuotes(
    job?.id || null, 
    job?.quote_id || null
  );
  const convertJobToQuote = useConvertJobToQuote();
  const convertJobToInvoice = useConvertJobToInvoice();
  const { data: allInvoices = [], isLoading: loadingInvoices } = useInvoices(false);
  const downloadDocument = useDownloadDocument();
  const emailDocument = useEmailDocument();
  const sendJobNotification = useSendJobNotification();
  const { data: notifications = [], isLoading: loadingNotifications } = useJobNotifications(job?.id || null);
  const { data: feedbacks = [], isLoading: loadingFeedbacks } = useJobFeedbacks(job?.id || null);
  const { data: jobTimeEntries = [] } = useJobTimeEntries(job?.id || null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');

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
      emailDocument.mutate(
        { type: 'job', documentId: job.id, recipientEmail: emailAddress },
        { onSuccess: handleCloseEmailModal }
      );
    }
  };

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

  if (!job) return null;

  const handleCreateUpsellQuote = async () => {
    // Convert the CustomerJob to Job format for the mutation
    const jobForConversion: Job = {
      id: job.id,
      job_number: job.job_number,
      company_id: '', // Not needed for this operation
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
      items: [], // Will use job items if available
    };
    const quote = await convertJobToQuote.mutateAsync(jobForConversion);
    if (quote?.id) {
      onOpenChange(false);
      window.location.href = `/quotes?edit=${quote.id}`;
    }
  };

  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  
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
      items: [],
    };
    const invoice = await convertJobToInvoice.mutateAsync({ job: jobForConversion, copyPhotos });
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

  const etaOptions = [10, 20, 30, 45, 60] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
              <span className="truncate">{job.job_number}</span>
            </DialogTitle>
            <div className="flex gap-1 sm:gap-2 shrink-0">
              <Badge className={`${priorityColors[job.priority] || 'bg-muted'} text-xs`}>
                {job.priority}
              </Badge>
              <Badge className={`${statusColors[job.status] || 'bg-muted'} text-xs`}>
                {job.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Title */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold">{job.title}</h3>
            {job.description && (
              <p className="text-muted-foreground mt-1 text-sm">{job.description}</p>
            )}
          </div>

          <Separator />

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Customer</p>
              <p className="font-medium text-sm sm:text-base truncate">{customerName || 'Unknown'}</p>
            </div>
            {job.assignee?.full_name && (
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3" /> Assigned To
                </p>
                <p className="font-medium text-sm sm:text-base truncate">{job.assignee.full_name}</p>
              </div>
            )}
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Created</p>
              <p className="font-medium text-sm sm:text-base">{format(new Date(job.created_at), 'MMM d, yyyy')}</p>
            </div>
          </div>

          {/* Schedule */}
          {(job.scheduled_start || job.scheduled_end) && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <Calendar className="w-4 h-4" /> Schedule
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {job.scheduled_start && (
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Scheduled Start</p>
                      <p className="font-medium text-sm sm:text-base">{format(new Date(job.scheduled_start), 'MMM d, yyyy h:mm a')}</p>
                    </div>
                  )}
                  {job.scheduled_end && (
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Scheduled End</p>
                      <p className="font-medium text-sm sm:text-base">{format(new Date(job.scheduled_end), 'MMM d, yyyy h:mm a')}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Actual Times */}
          {(job.actual_start || job.actual_end) && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <Clock className="w-4 h-4" /> Actual Times
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {job.actual_start && (
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Started</p>
                      <p className="font-medium text-sm sm:text-base">{format(new Date(job.actual_start), 'MMM d, yyyy h:mm a')}</p>
                    </div>
                  )}
                  {job.actual_end && (
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Completed</p>
                      <p className="font-medium text-sm sm:text-base">{format(new Date(job.actual_end), 'MMM d, yyyy h:mm a')}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          {job.notes && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2 text-sm sm:text-base">Notes</h4>
                <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">{job.notes}</p>
              </div>
            </>
          )}

          {/* Linked Docs + Photos Tabs */}
          <Separator />
          <Tabs defaultValue="items" className="w-full">
            <TabsList className={`grid w-full grid-cols-4`}>
              <TabsTrigger value="items" className="flex items-center gap-1 text-xs sm:text-sm px-1">
                <List className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Items</span>
                {(job.items?.length || 0) > 0 && (
                  <Badge variant="secondary" className="ml-0.5 text-xs hidden sm:inline-flex">
                    {job.items?.length}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="linked" className="flex items-center gap-1 text-xs sm:text-sm px-1">
                <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Docs</span>
                {((relatedQuotes?.originQuote ? 1 : 0) + (relatedQuotes?.childQuotes?.length || 0) + jobInvoices.length) > 0 && (
                  <Badge variant="secondary" className="ml-0.5 text-xs hidden sm:inline-flex">
                    {(relatedQuotes?.originQuote ? 1 : 0) + (relatedQuotes?.childQuotes?.length || 0) + jobInvoices.length}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="feedback" className="flex items-center gap-1 text-xs sm:text-sm px-1">
                <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Comments</span>
                {feedbacks.length > 0 && (
                  <Badge variant="secondary" className="ml-0.5 text-xs">
                    {feedbacks.length}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="notifications" className="flex items-center gap-1 text-xs sm:text-sm px-1">
                <Bell className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">History</span>
                {notifications.length > 0 && (
                  <Badge variant="secondary" className="ml-0.5 text-xs hidden sm:inline-flex">
                    {notifications.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Items Tab */}
            <TabsContent value="items" className="mt-4">
              {job.items && job.items.length > 0 ? (
                <div className="space-y-3">
                  {/* Items List */}
                  <div className="space-y-2">
                    {job.items.map((item) => {
                      const isLaborItem = item.description.toLowerCase().includes('labor');
                      
                      // Get time entry breakdown for labor items
                      const laborBreakdown = isLaborItem ? jobTimeEntries
                        .filter(entry => entry.clock_out)
                        .reduce((acc, entry) => {
                          const userName = entry.user?.full_name || 'Unknown';
                          const minutes = differenceInMinutes(
                            new Date(entry.clock_out!), 
                            new Date(entry.clock_in)
                          ) - (entry.break_minutes || 0);
                          acc[userName] = (acc[userName] || 0) + minutes;
                          return acc;
                        }, {} as Record<string, number>) : null;
                      
                      return (
                        <div 
                          key={item.id}
                          className={`p-3 rounded-lg border ${
                            isLaborItem 
                              ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/50' 
                              : 'bg-muted/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{item.description}</span>
                                {isLaborItem && (
                                  <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Auto
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {item.quantity.toFixed(2)} × {formatAmount(item.unit_price)}
                              </p>
                              
                              {/* Labor breakdown showing time contributions per technician */}
                              {isLaborItem && laborBreakdown && Object.keys(laborBreakdown).length > 0 && (
                                <div className="mt-2 pt-2 border-t border-blue-200/50 dark:border-blue-700/50">
                                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    Time breakdown:
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(laborBreakdown).map(([name, minutes]) => {
                                      const hours = Math.floor(minutes / 60);
                                      const mins = Math.round(minutes % 60);
                                      return (
                                        <span 
                                          key={name} 
                                          className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full"
                                        >
                                          {name}: {hours > 0 ? `${hours}h ` : ''}{mins}m
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                            <span className="font-medium text-sm whitespace-nowrap">
                              {formatAmount(item.total)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Totals */}
                  {(job.subtotal !== null || job.total !== null) && (
                    <div className="pt-2 border-t space-y-1">
                      {job.subtotal !== null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>{formatAmount(job.subtotal)}</span>
                        </div>
                      )}
                      {job.tax !== null && job.tax > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tax</span>
                          <span>{formatAmount(job.tax)}</span>
                        </div>
                      )}
                      {job.total !== null && (
                        <div className="flex justify-between text-sm font-medium">
                          <span>Total</span>
                          <span>{formatAmount(job.total)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <List className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-xs sm:text-sm text-muted-foreground">No items added yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Items will appear here when added via Edit Job or from time tracking
                  </p>
                  {onEdit && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        onOpenChange(false);
                        onEdit(job.id);
                      }}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit Job
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="linked" className="mt-4">
              {loadingQuotes || loadingInvoices ? (
                <p className="text-xs sm:text-sm text-muted-foreground">Loading...</p>
              ) : (
                <div className="space-y-4">
                  {/* Origin Quote (Parent) */}
                  {relatedQuotes?.originQuote && (
                    <div>
                      <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                        <ArrowDown className="w-3 h-3" /> Origin Quote
                      </p>
                      <QuoteCard 
                        quote={relatedQuotes.originQuote} 
                        onView={() => onViewQuote?.(relatedQuotes.originQuote)}
                      />
                    </div>
                  )}

                  {/* Upsell Quotes (Children) */}
                  {relatedQuotes?.childQuotes && relatedQuotes.childQuotes.length > 0 && (
                    <div>
                      <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                        <ArrowUp className="w-3 h-3" /> Upsell Quotes
                      </p>
                      <div className="space-y-2">
                        {relatedQuotes.childQuotes.map((quote: Quote) => (
                          <QuoteCard 
                            key={quote.id} 
                            quote={quote} 
                            onView={() => onViewQuote?.(quote)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invoices */}
                  {jobInvoices.length > 0 && (
                    <div>
                      <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                        <Receipt className="w-3 h-3" /> Invoices
                      </p>
                      <div className="space-y-2">
                        {jobInvoices.map((invoice: Invoice) => (
                          <div 
                            key={invoice.id}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border cursor-pointer hover:bg-muted transition-colors"
                            onClick={() => {
                              onOpenChange(false);
                              window.location.href = `/invoices?view=${invoice.id}`;
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <Receipt className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div>
                                <p className="font-medium text-sm">{invoice.invoice_number}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{formatAmount(invoice.total)}</span>
                              <Badge className={`text-xs ${
                                invoice.status === 'paid' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : invoice.status === 'sent'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : invoice.status === 'overdue'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {invoice.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty State + Actions */}
                  {!relatedQuotes?.originQuote && (!relatedQuotes?.childQuotes || relatedQuotes.childQuotes.length === 0) && jobInvoices.length === 0 && (
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-xs sm:text-sm text-muted-foreground mb-3">No linked documents yet</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleCreateUpsellQuote}
                          disabled={convertJobToQuote.isPending}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Create Quote
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleCreateInvoice}
                          disabled={convertJobToInvoice.isPending}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Create Invoice
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Action buttons when there are existing docs */}
                  {(relatedQuotes?.originQuote || (relatedQuotes?.childQuotes && relatedQuotes.childQuotes.length > 0) || jobInvoices.length > 0) && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleCreateUpsellQuote}
                        disabled={convertJobToQuote.isPending}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Quote
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleCreateInvoice}
                        disabled={convertJobToInvoice.isPending}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Invoice
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>


            {/* Customer Feedback Tab */}
            <TabsContent value="feedback" className="mt-4">
              {loadingFeedbacks ? (
                <p className="text-xs sm:text-sm text-muted-foreground">Loading...</p>
              ) : feedbacks.length > 0 ? (
                <div className="space-y-3">
                  {feedbacks.map((feedback: JobFeedback) => (
                    <div 
                      key={feedback.id}
                      className={`p-3 rounded-lg border ${
                        feedback.is_negative 
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                          : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${
                                    star <= feedback.rating
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : 'text-muted-foreground/30'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-sm font-medium">
                              {feedback.rating}/5
                            </span>
                            {feedback.is_negative && (
                              <Badge variant="destructive" className="text-xs">
                                Needs Attention
                              </Badge>
                            )}
                          </div>
                          {feedback.feedback_text && (
                            <p className="text-sm text-muted-foreground">
                              "{feedback.feedback_text}"
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <span>{feedback.customer?.name || 'Customer'}</span>
                            <span>•</span>
                            <span>{format(new Date(feedback.created_at), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-xs sm:text-sm text-muted-foreground">No customer feedback yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Feedback will appear here after the customer rates the job
                  </p>
                </div>
              )}

              {/* Photos section within feedback tab */}
              {job.photos && job.photos.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <span>Job Photos</span>
                    <Badge variant="secondary" className="text-xs">
                      {job.photos.length}
                    </Badge>
                  </p>
                  <PhotoGallery photos={job.photos} />
                </div>
              )}
            </TabsContent>

            {/* Notification History Tab */}
            <TabsContent value="notifications" className="mt-4">
              {loadingNotifications ? (
                <p className="text-xs sm:text-sm text-muted-foreground">Loading...</p>
              ) : notifications.length > 0 ? (
                <div className="space-y-2">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id}
                      className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border"
                    >
                      <div className="p-2 bg-primary/10 rounded-full shrink-0">
                        <Mail className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">Email sent</span>
                          {notification.status_at_send && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {notification.status_at_send.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          To: {notification.recipient_email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(notification.sent_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <Bell className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-xs sm:text-sm text-muted-foreground">No notifications sent yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use "Send to Customer" to notify them about this job
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Completion Signature */}
          <Separator />
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2 text-sm sm:text-base">
              <PenTool className="w-4 h-4" /> Customer Signature
            </h4>
            {job.completion_signed_at ? (
              <div className="sm:max-w-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <PenTool className="w-4 h-4 shrink-0" />
                    <div>
                      <span className="text-xs sm:text-sm font-medium">Job completion signed</span>
                      {job.completion_signed_by && (
                        <p className="text-[10px] sm:text-xs">by {job.completion_signed_by}</p>
                      )}
                    </div>
                  </div>
                  {job.completion_signature_id && onViewSignature && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewSignature(job.completion_signature_id!)}
                    >
                      View
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 sm:max-w-md">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCollectSignature}
                  disabled={isCollectingSignature}
                  className="gap-1"
                >
                  {isCollectingSignature ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PenTool className="w-4 h-4" />
                  )}
                  Collect Signature
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSendSignatureRequest}
                  disabled={!customerEmail}
                  className="gap-1"
                  title={customerEmail ? "Send signature request via email" : "No email on file"}
                >
                  <Mail className="w-4 h-4" />
                  Send Signature Request via Email
                </Button>
              </div>
            )}
          </div>

          {/* Email Modal */}
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
                  <Input
                    id="email-address"
                    type="email"
                    placeholder="customer@example.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleCloseEmailModal}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendEmail}
                    disabled={!emailAddress || emailDocument.isPending}
                  >
                    {emailDocument.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                    Send
                  </Button>
                </div>
              </div>
            </AlertDialogContent>
          </AlertDialog>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 sm:pt-4">
            {/* Send to Customer - only show for jobs with status that makes sense */}
            {['scheduled', 'in_progress', 'completed'].includes(job.status) && (
              <Button
                size="sm"
                onClick={() => sendJobNotification.mutate({ jobId: job.id, customerId: job.customer_id })}
                disabled={sendJobNotification.isPending}
                className="flex-1 sm:flex-none"
              >
                {sendJobNotification.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 sm:mr-1" />}
                <span className="hidden sm:inline">Send to Customer</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadDocument.mutate({ type: 'job', documentId: job.id })}
              disabled={downloadDocument.isPending}
              className="flex-1 sm:flex-none"
            >
              {downloadDocument.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 sm:mr-1" />}
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenEmailModal}
              className="flex-1 sm:flex-none"
            >
              <Mail className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Email</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCreateUpsellQuote}
              disabled={convertJobToQuote.isPending}
              className="flex-1 sm:flex-none"
            >
              <FileText className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Create Quote</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCreateInvoice}
              disabled={convertJobToInvoice.isPending}
              className="flex-1 sm:flex-none"
            >
              <Receipt className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Create Invoice</span>
            </Button>
            {/* On My Way with ETA dropdown */}
            {['scheduled', 'in_progress'].includes(job.status) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    title={customerPhone ? "Send SMS to customer" : "Copy message (no phone on file)"}
                  >
                    <Navigation className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">On My Way</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {etaOptions.map((eta) => (
                    <DropdownMenuItem key={eta} onClick={() => handleOnMyWay(eta)}>
                      ~{eta} minutes
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button size="sm" onClick={() => onEdit?.(job.id)} className="w-full sm:w-auto sm:ml-auto mt-2 sm:mt-0">
              <Edit className="w-4 h-4 mr-1" /> Edit
            </Button>
          </div>
        </div>
      </DialogContent>
      
      {/* Convert to Invoice Dialog */}
      <ConvertJobToInvoiceDialog
        open={showInvoiceDialog}
        onOpenChange={setShowInvoiceDialog}
        onConfirm={handleCreateInvoiceWithPhotos}
        isProcessing={convertJobToInvoice.isPending}
        jobNumber={job.job_number}
      />
    </Dialog>
  );
}
