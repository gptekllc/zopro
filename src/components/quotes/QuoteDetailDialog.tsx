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
  Briefcase, Receipt, Link2, List, Image as ImageIcon, StickyNote, ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { CustomerQuote } from '@/hooks/useCustomerHistory';
import { SignatureSection } from '@/components/signatures/SignatureSection';
import { ConstrainedPanel } from '@/components/ui/constrained-panel';
import { DocumentPhotoGallery } from '@/components/photos/DocumentPhotoGallery';
import { useJobs, Job } from '@/hooks/useJobs';
import { useInvoices, Invoice } from '@/hooks/useInvoices';
import { useQuotePhotos, useUploadQuotePhoto, useDeleteQuotePhoto, useUpdateQuotePhotoType } from '@/hooks/useQuotePhotos';
import { useMemo, useState, useEffect } from 'react';
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
  const { data: quotePhotos = [], isLoading: loadingPhotos } = useQuotePhotos(quote?.id || null);
  const uploadPhoto = useUploadQuotePhoto();
  const deletePhoto = useDeleteQuotePhoto();
  const updatePhotoType = useUpdateQuotePhotoType();
  
  // Local state for optimistic UI updates
  const [localStatus, setLocalStatus] = useState(quote?.status);
  
  // Sync local state when quote prop changes
  useEffect(() => {
    if (quote) {
      setLocalStatus(quote.status);
    }
  }, [quote?.status]);

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

  const handleUploadPhoto = async (file: File, photoType: 'before' | 'after' | 'other') => {
    await uploadPhoto.mutateAsync({
      quoteId: quote.id,
      file,
      photoType,
    });
  };

  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    await deletePhoto.mutateAsync({
      photoId,
      photoUrl,
      quoteId: quote.id,
    });
  };

  const handleUpdatePhotoType = (photoId: string, photoType: 'before' | 'after' | 'other') => {
    updatePhotoType.mutate({
      photoId,
      photoType,
      quoteId: quote.id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[85dvh] sm:max-h-[90vh] overflow-hidden rounded-lg p-0 flex flex-col">
        <DialogHeader className="p-4 sm:p-6 pb-0 sm:pb-0">
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
              <span className="truncate">{quote.quote_number}</span>
            </DialogTitle>
            {onStatusChange ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Badge className={`${statusColors[localStatus || quote.status] || 'bg-muted'} shrink-0 text-xs cursor-pointer hover:opacity-80 transition-opacity capitalize flex items-center gap-1`}>
                    <ChevronDown className="h-3 w-3" />
                    {(localStatus || quote.status) === 'accepted' ? 'approved' : (localStatus || quote.status)}
                  </Badge>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover z-50 min-w-[100px]">
                  {QUOTE_STATUSES.map(status => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => {
                        if ((localStatus || quote.status) !== status) {
                          setLocalStatus(status);
                          onStatusChange(quote.id, status);
                        }
                      }}
                      className={`${(localStatus || quote.status) === status ? 'bg-accent' : ''} p-1`}
                    >
                      <Badge className={`${statusColors[status] || 'bg-muted'} text-xs capitalize w-full justify-center`}>
                        {status === 'accepted' ? 'approved' : status}
                      </Badge>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Badge className={`${statusColors[quote.status] || 'bg-muted'} shrink-0 text-xs capitalize`}>
                {quote.status === 'accepted' ? 'approved' : quote.status}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4 space-y-4 sm:space-y-6">
          {/* Details Grid - Compact */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-medium truncate">{customerName || 'Unknown'}</p>
            </div>
            {creatorName && (
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <UserCog className="w-3 h-3" /> Created By
                </p>
                <p className="font-medium truncate">{creatorName}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="font-medium">{format(new Date(quote.created_at), 'MMM d, yyyy')}</p>
            </div>
          </div>

          {/* Dates - Compact Inline */}
          {(quote.valid_until || quote.signed_at) && (
            <>
              <Separator className="my-2" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                {quote.valid_until && (
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Valid Until
                    </p>
                    <p className="font-medium">{format(new Date(quote.valid_until), 'MMM d, yyyy')}</p>
                  </div>
                )}
                {quote.signed_at && (
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <PenTool className="w-3 h-3" /> Signed
                    </p>
                    <p className="font-medium text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {format(new Date(quote.signed_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Items Section - Compact */}
          <Separator className="my-2" />
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2 text-sm">
              <List className="w-3.5 h-3.5" /> 
              Items
              {(quote.items?.length || 0) > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {quote.items?.length}
                </Badge>
              )}
            </h4>
            {quote.items && quote.items.length > 0 ? (
              <div className="space-y-1.5">
                {/* Desktop header */}
                <div className="hidden sm:grid grid-cols-12 text-[10px] text-muted-foreground font-medium px-2">
                  <div className="col-span-5">Name</div>
                  <div className="col-span-2 text-right">Quantity</div>
                  <div className="col-span-3 text-right">Unit Price</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>
                {/* Items List */}
                <div className="space-y-1">
                  {quote.items.map((item) => (
                    <div key={item.id} className="py-1.5 px-2 bg-muted/50 rounded text-sm">
                      {/* Mobile layout */}
                      <div className="sm:hidden">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{item.description}</span>
                          <span className="font-medium shrink-0">${formatAmount(item.total)}</span>
                        </div>
                        {(item as any).item_description && (
                          <p className="text-xs text-muted-foreground">{(item as any).item_description}</p>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {item.quantity} × ${formatAmount(item.unit_price)}
                        </div>
                      </div>
                      {/* Desktop layout */}
                      <div className="hidden sm:grid grid-cols-12 items-center">
                        <div className="col-span-5 flex flex-col">
                          <span className="font-medium truncate">{item.description}</span>
                          {(item as any).item_description && (
                            <p className="text-xs text-muted-foreground">{(item as any).item_description}</p>
                          )}
                        </div>
                        <div className="col-span-2 text-right text-xs">{item.quantity}</div>
                        <div className="col-span-3 text-right text-xs">${formatAmount(item.unit_price)}</div>
                        <div className="col-span-2 text-right font-medium">${formatAmount(item.total)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals - Compact */}
                <div className="pt-1.5 border-t flex justify-end">
                  <div className="space-y-0.5 min-w-[140px] text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground text-xs">Subtotal</span>
                      <span className="text-xs">${formatAmount(quote.subtotal)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground text-xs">
                        Discount{quote.discount_value && quote.discount_type === 'percentage' ? ` (${quote.discount_value}%)` : ''}
                      </span>
                      <span className={`text-xs ${quote.discount_value && quote.discount_value > 0 ? 'text-green-600' : ''}`}>
                        {quote.discount_value && quote.discount_value > 0 
                          ? `-$${formatAmount(quote.discount_type === 'percentage' 
                              ? (Number(quote.subtotal) * Number(quote.discount_value) / 100) 
                              : Number(quote.discount_value)
                            )}`
                          : '$0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground text-xs">Tax</span>
                      <span className="text-xs">${formatAmount(quote.tax)}</span>
                    </div>
                    <div className="flex justify-between font-medium gap-4">
                      <span className="text-xs flex items-center gap-1"><DollarSign className="w-3 h-3" />Total</span>
                      <span>${formatAmount(quote.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">No items added yet</p>
              </div>
            )}
          </div>

          {/* Notes */}
          {quote.notes && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2 text-sm flex items-center gap-2">
                  <StickyNote className="w-4 h-4" /> Notes
                </h4>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
              </div>
            </>
          )}

          {/* Signature Section */}
          <Separator />
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2 text-sm">
              <PenTool className="w-4 h-4" /> Customer Signature
            </h4>
            <div className="sm:max-w-md">
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
            </div>

            {/* Send Signature Request Button */}
            {showCollectButton && !quote.signature_id && customerEmail && onSendSignatureRequest && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onSendSignatureRequest(quote.id)}
                className="mt-2"
              >
                <Send className="w-4 h-4 mr-2" />
                Send Signature Request via Email
              </Button>
            )}
          </div>

          {/* Tabs for Photos and Linked Docs - At bottom like Job */}
          <Separator />
          <Tabs defaultValue="photos" className="w-full">
            <TabsList className="w-full grid grid-cols-2 h-auto p-1">
              <TabsTrigger value="photos" className="flex items-center gap-1 text-xs sm:text-sm px-1">
                <ImageIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Photos</span>
                {quotePhotos.length > 0 && (
                  <Badge variant="secondary" className="ml-0.5 text-xs hidden sm:inline-flex">
                    {quotePhotos.length}
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
            </TabsList>

            {/* Photos Tab */}
            <TabsContent value="photos" className="mt-4">
              <DocumentPhotoGallery
                photos={quotePhotos.map(p => ({
                  id: p.id,
                  photo_url: p.photo_url,
                  photo_type: p.photo_type,
                  caption: p.caption,
                  created_at: p.created_at,
                  display_order: p.display_order ?? 0,
                }))}
                bucketName="quote-photos"
                documentId={quote.id}
                onUpload={handleUploadPhoto}
                onDelete={handleDeletePhoto}
                onUpdateType={handleUpdatePhotoType}
                isUploading={uploadPhoto.isPending}
                editable={true}
              />
            </TabsContent>

            {/* Linked Docs Tab */}
            <TabsContent value="linked" className="mt-4">
              <div>
                <h4 className="font-medium mb-2 sm:mb-3 flex items-center gap-2 text-sm">
                  <Link2 className="w-4 h-4" /> Linked Documents
                </h4>
                
                {(loadingJobs || loadingInvoices) ? (
                  <p className="text-xs text-muted-foreground">Loading linked documents...</p>
                ) : (linkedJob || linkedInvoices.length > 0) ? (
                  <div className="space-y-2">
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
                          <Badge className={`text-xs capitalize ${invoiceStatusColors[invoice.status] || 'bg-muted'}`}>
                            {invoice.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
                    No linked jobs or invoices yet
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer Actions - Fixed at bottom */}
        <div className="border-t bg-background p-4 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <Button 
              size="sm" 
              onClick={() => onEmail?.(quote.id)} 
              disabled={!customerEmail}
              className="flex-1 sm:flex-none"
              title={!customerEmail ? 'Customer has no email address' : undefined}
            >
              <Send className="w-4 h-4 mr-1" />
              Send
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDownload?.(quote.id)} className="flex-1 sm:flex-none">
              <FileDown className="w-4 h-4 mr-1" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEmailCustom?.(quote.id)} className="flex-1 sm:flex-none">
              <Mail className="w-4 h-4 mr-1" />
              Email
            </Button>
            {quote.status !== 'rejected' && (
              <Button variant="outline" size="sm" onClick={() => onConvertToInvoice?.(quote.id)} className="flex-1 sm:flex-none">
                <ArrowRight className="w-4 h-4 mr-1" />
                Convert to Invoice
              </Button>
            )}
            {quote.status !== 'rejected' && !linkedJob && (
              <Button variant="outline" size="sm" onClick={() => onCreateJob?.(quote.id)} className="flex-1 sm:flex-none">
                <Briefcase className="w-4 h-4 mr-1" />
                Create Job
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
