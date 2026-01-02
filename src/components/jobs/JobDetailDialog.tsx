import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Edit, PenTool, Calendar, User, Briefcase, 
  Clock, FileText, ArrowUp, ArrowDown, Plus, Receipt
} from 'lucide-react';
import { format } from 'date-fns';
import { CustomerJob } from '@/hooks/useCustomerHistory';
import { PhotoGallery } from '@/components/photos/PhotoGallery';
import { useJobRelatedQuotes, useConvertJobToQuote, useConvertJobToInvoice, Job } from '@/hooks/useJobs';
import { Quote } from '@/hooks/useQuotes';
import { QuoteCard } from '@/components/quotes/QuoteCard';
import { useInvoices, Invoice } from '@/hooks/useInvoices';
import { useMemo } from 'react';
import { formatAmount } from '@/lib/formatAmount';

interface JobDetailDialogProps {
  job: CustomerJob | null;
  customerName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (jobId: string) => void;
  onViewSignature?: (signatureId: string) => void;
  onViewQuote?: (quote: Quote) => void;
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
  open,
  onOpenChange,
  onEdit,
  onViewSignature,
  onViewQuote,
}: JobDetailDialogProps) {
  const { data: relatedQuotes, isLoading: loadingQuotes } = useJobRelatedQuotes(
    job?.id || null, 
    job?.quote_id || null
  );
  const convertJobToQuote = useConvertJobToQuote();
  const convertJobToInvoice = useConvertJobToInvoice();
  const { data: allInvoices = [], isLoading: loadingInvoices } = useInvoices(false);

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

  const handleCreateUpsellQuote = () => {
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
    convertJobToQuote.mutate(jobForConversion);
  };

  const handleCreateInvoice = () => {
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
    convertJobToInvoice.mutate(jobForConversion);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
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

          {/* Related Quotes Section */}
          <Separator />
          <div>
            <h4 className="font-medium mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
              <FileText className="w-4 h-4" /> Related Quotes
            </h4>
            
            {loadingQuotes ? (
              <p className="text-xs sm:text-sm text-muted-foreground">Loading quotes...</p>
            ) : (
              <div className="space-y-4">
                {/* Origin Quote (Parent) */}
                {relatedQuotes?.originQuote && (
                  <div>
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                      <ArrowDown className="w-3 h-3" /> Origin Quote (Created This Job)
                    </p>
                    <QuoteCard 
                      quote={relatedQuotes.originQuote} 
                      onView={() => onViewQuote?.(relatedQuotes.originQuote)}
                    />
                  </div>
                )}

                {/* Upsell Quotes (Children) */}
                <div>
                  <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                    <ArrowUp className="w-3 h-3" /> Upsell Quotes (Created During Job)
                  </p>
                  
                  {relatedQuotes?.childQuotes && relatedQuotes.childQuotes.length > 0 ? (
                    <div className="space-y-2">
                      {relatedQuotes.childQuotes.map((quote: Quote) => (
                        <QuoteCard 
                          key={quote.id} 
                          quote={quote} 
                          onView={() => onViewQuote?.(quote)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs sm:text-sm text-muted-foreground">No upsell quotes yet</p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleCreateUpsellQuote}
                        disabled={convertJobToQuote.isPending}
                        className="w-full sm:w-auto"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Create Upsell Quote
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Related Invoices Section */}
          <Separator />
          <div>
            <h4 className="font-medium mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
              <Receipt className="w-4 h-4" /> Related Invoices
            </h4>
            
            {loadingInvoices ? (
              <p className="text-xs sm:text-sm text-muted-foreground">Loading invoices...</p>
            ) : jobInvoices.length > 0 ? (
              <div className="space-y-2">
                {jobInvoices.map((invoice: Invoice) => (
                  <div 
                    key={invoice.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
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
                      <span className="font-medium text-sm">
                        {formatAmount(invoice.total)}
                      </span>
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
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs sm:text-sm text-muted-foreground">No invoices created yet</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleCreateInvoice}
                  disabled={convertJobToInvoice.isPending}
                  className="w-full sm:w-auto"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Create Invoice
                </Button>
              </div>
            )}
          </div>

          {/* Photos */}
          {job.photos && job.photos.length > 0 && (
            <>
              <Separator />
              <PhotoGallery photos={job.photos} />
            </>
          )}

          {/* Completion Signature */}
          {job.completion_signed_at && (
            <>
              <Separator />
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
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 sm:pt-4 justify-end">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCreateUpsellQuote}
              disabled={convertJobToQuote.isPending}
            >
              <FileText className="w-4 h-4 mr-1" />
              Create Quote
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCreateInvoice}
              disabled={convertJobToInvoice.isPending}
            >
              <Receipt className="w-4 h-4 mr-1" />
              Create Invoice
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEdit?.(job.id)}>
              <Edit className="w-4 h-4 mr-1" /> Open in Jobs
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
