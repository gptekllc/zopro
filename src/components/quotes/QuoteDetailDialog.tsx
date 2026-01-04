import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  FileDown, Mail, ArrowRight, Edit, PenTool, Calendar, 
  DollarSign, FileText, CheckCircle, Send, UserCog, ChevronRight, CheckCircle2,
  Briefcase, Receipt, Link2, List, Image
} from 'lucide-react';
import { format } from 'date-fns';
import { CustomerQuote } from '@/hooks/useCustomerHistory';
import { SignatureSection } from '@/components/signatures/SignatureSection';
import { ConstrainedPanel } from '@/components/ui/constrained-panel';
import { useJobs, Job } from '@/hooks/useJobs';
import { useInvoices, Invoice } from '@/hooks/useInvoices';
import { useMemo } from 'react';
import { formatAmount } from '@/lib/formatAmount';

const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const;

interface QuoteDetailDialogProps {
  quote: CustomerQuote | null;
  customerName?: string;
  creatorName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload?: (quoteId: string) => void;
  onEmail?: (quoteId: string) => void;
  onEmailCustom?: (quoteId: string) => void;
  onConvertToInvoice?: (quoteId: string) => void;
  onCreateJob?: (quoteId: string) => void;
  onEdit?: (quoteId: string) => void;
  onViewSignature?: (signatureId: string) => void;
  onCollectSignature?: (quoteId: string) => void;
  onSendSignatureRequest?: (quoteId: string) => void;
  onStatusChange?: (quoteId: string, status: string) => void;
  isCollectingSignature?: boolean;
  customerEmail?: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const jobStatusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  invoiced: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
};

const invoiceStatusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function QuoteDetailDialog({
  quote,
  customerName,
  creatorName,
  open,
  onOpenChange,
  onDownload,
  onEmail,
  onEmailCustom,
  onConvertToInvoice,
  onCreateJob,
  onEdit,
  onViewSignature,
  onCollectSignature,
  onSendSignatureRequest,
  onStatusChange,
  isCollectingSignature = false,
  customerEmail,
}: QuoteDetailDialogProps) {
  const { data: allJobs = [], isLoading: loadingJobs } = useJobs(false);
  const { data: allInvoices = [], isLoading: loadingInvoices } = useInvoices(false);

  // Find job linked to this quote
  const linkedJob = useMemo(() => {
    if (!quote || !allJobs.length) return null;
    return allJobs.find((job: Job) => job.quote_id === quote.id) || null;
  }, [quote, allJobs]);

  // Find invoices linked to this quote
  const linkedInvoices = useMemo(() => {
    if (!quote || !allInvoices.length) return [];
    return allInvoices.filter((invoice: Invoice) => invoice.quote_id === quote.id);
  }, [quote, allInvoices]);

  if (!quote) return null;

  const isApprovedOrAccepted = quote.status === 'approved' || quote.status === 'accepted';
  const showCollectButton = !isApprovedOrAccepted && quote.status !== 'rejected';
  const linkedDocsCount = (linkedJob ? 1 : 0) + linkedInvoices.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
              <span className="truncate">{quote.quote_number}</span>
            </DialogTitle>
            {onStatusChange ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Badge className={`${statusColors[quote.status] || 'bg-muted'} shrink-0 text-xs cursor-pointer hover:opacity-80 transition-opacity`}>
                    {quote.status === 'accepted' ? 'approved' : quote.status}
                    <ChevronRight className="w-3 h-3 ml-1 rotate-90" />
                  </Badge>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover z-50">
                  {QUOTE_STATUSES.map(status => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => onStatusChange(quote.id, status)}
                      disabled={quote.status === status}
                      className={quote.status === status ? 'bg-accent' : ''}
                    >
                      <Badge className={`${statusColors[status] || 'bg-muted'} mr-2`} variant="outline">
                        {status === 'accepted' ? 'approved' : status}
                      </Badge>
                      {quote.status === status && <CheckCircle2 className="w-4 h-4 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Badge className={`${statusColors[quote.status] || 'bg-muted'} shrink-0 text-xs`}>
                {quote.status === 'accepted' ? 'approved' : quote.status}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Customer & Dates - responsive grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Customer</p>
              <p className="font-medium text-sm sm:text-base truncate">{customerName || 'Unknown'}</p>
            </div>
            {creatorName && (
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                  <UserCog className="w-3 h-3" /> Created By
                </p>
                <p className="font-medium text-sm sm:text-base truncate">{creatorName}</p>
              </div>
            )}
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Created</p>
              <p className="font-medium text-sm sm:text-base">{format(new Date(quote.created_at), 'MMM d, yyyy')}</p>
            </div>
            {quote.valid_until && (
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Valid Until
                </p>
                <p className="font-medium text-sm sm:text-base">{format(new Date(quote.valid_until), 'MMM d, yyyy')}</p>
              </div>
            )}
            {quote.signed_at && (
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                  <PenTool className="w-3 h-3" /> Signed
                </p>
                <p className="font-medium text-green-600 flex items-center gap-1 text-sm sm:text-base">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                  {format(new Date(quote.signed_at), 'MMM d, yyyy')}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Tabs for Details, Linked Docs, Photos */}
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details" className="flex items-center gap-1 text-xs sm:text-sm px-1">
                <List className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Details</span>
                {(quote.items?.length || 0) > 0 && (
                  <Badge variant="secondary" className="ml-0.5 text-xs hidden sm:inline-flex">
                    {quote.items?.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="linked" className="flex items-center gap-1 text-xs sm:text-sm px-1">
                <Link2 className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Linked Docs</span>
                {linkedDocsCount > 0 && (
                  <Badge variant="secondary" className="ml-0.5 text-xs hidden sm:inline-flex">
                    {linkedDocsCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="photos" className="flex items-center gap-1 text-xs sm:text-sm px-1">
                <Image className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Photos</span>
              </TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="mt-4 space-y-4">
              {/* Line Items */}
              <div>
                <h4 className="font-medium mb-2 sm:mb-3 text-sm sm:text-base">Line Items</h4>
                <div className="space-y-2">
                  {quote.items && quote.items.length > 0 ? (
                    <>
                      {/* Desktop header - hidden on mobile */}
                      <div className="hidden sm:grid grid-cols-12 text-xs text-muted-foreground font-medium px-2">
                        <div className="col-span-6">Description</div>
                        <div className="col-span-2 text-right">Qty</div>
                        <div className="col-span-2 text-right">Price</div>
                        <div className="col-span-2 text-right">Total</div>
                      </div>
                      {quote.items.map((item) => (
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

              <Separator />

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-full sm:w-48 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${Number(quote.subtotal).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>${Number(quote.tax).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base sm:text-lg pt-2 border-t">
                    <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" />Total</span>
                    <span>${Number(quote.total).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {quote.notes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2 text-sm sm:text-base">Notes</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
                  </div>
                </>
              )}

              {/* Signature Section */}
              <Separator />
              <ConstrainedPanel>
                <SignatureSection 
                  signatureId={quote.signature_id}
                  title="Customer Signature"
                  onCollectSignature={onCollectSignature ? () => onCollectSignature(quote.id) : undefined}
                  showCollectButton={showCollectButton}
                  collectButtonText="Collect Signature"
                  isCollecting={isCollectingSignature}
                />
              </ConstrainedPanel>

              {/* Send Signature Request Button (separate from in-person collection) */}
              {showCollectButton && !quote.signature_id && customerEmail && onSendSignatureRequest && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onSendSignatureRequest(quote.id)}
                  className="w-full sm:w-auto"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Signature Request via Email
                </Button>
              )}
            </TabsContent>

            {/* Linked Docs Tab */}
            <TabsContent value="linked" className="mt-4">
              <div>
                <h4 className="font-medium mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <Link2 className="w-4 h-4" /> Linked Documents
                </h4>
                
                {(loadingJobs || loadingInvoices) ? (
                  <p className="text-xs sm:text-sm text-muted-foreground">Loading linked documents...</p>
                ) : (linkedJob || linkedInvoices.length > 0) ? (
                  <div className="space-y-3">
                    {/* Linked Job */}
                    {linkedJob && (
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium text-sm">{linkedJob.job_number}</p>
                            <p className="text-xs text-muted-foreground">{linkedJob.title}</p>
                          </div>
                        </div>
                        <Badge className={`text-xs ${jobStatusColors[linkedJob.status] || 'bg-muted'}`}>
                          {linkedJob.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    )}

                    {/* Linked Invoices */}
                    {linkedInvoices.length > 0 && linkedInvoices.map((invoice: Invoice) => (
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
                          <Badge className={`text-xs ${invoiceStatusColors[invoice.status] || 'bg-muted'}`}>
                            {invoice.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                    No linked jobs or invoices yet
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Photos Tab */}
            <TabsContent value="photos" className="mt-4">
              <div className="text-center py-8 text-muted-foreground">
                <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Photos are not available for quotes.</p>
                <p className="text-xs mt-1">Photos can be added to jobs.</p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 sm:pt-4">
            <Button 
              size="sm" 
              onClick={() => onEmail?.(quote.id)} 
              disabled={!customerEmail}
              className="flex-1 sm:flex-none"
              title={!customerEmail ? 'Customer has no email address' : undefined}
            >
              <Send className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Send to Customer</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDownload?.(quote.id)} className="flex-1 sm:flex-none">
              <FileDown className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEmailCustom?.(quote.id)} className="flex-1 sm:flex-none">
              <Mail className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Email</span>
            </Button>
            {quote.status !== 'rejected' && (
              <Button variant="outline" size="sm" onClick={() => onConvertToInvoice?.(quote.id)} className="flex-1 sm:flex-none">
                <ArrowRight className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Convert to Invoice</span>
              </Button>
            )}
            {quote.status !== 'rejected' && !linkedJob && (
              <Button variant="outline" size="sm" onClick={() => onCreateJob?.(quote.id)} className="flex-1 sm:flex-none">
                <Briefcase className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Create Job</span>
              </Button>
            )}
            <Button size="sm" onClick={() => onEdit?.(quote.id)} className="w-full sm:w-auto sm:ml-auto mt-2 sm:mt-0">
              <Edit className="w-4 h-4 mr-1" /> Edit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
