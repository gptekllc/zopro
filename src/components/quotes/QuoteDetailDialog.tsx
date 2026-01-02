import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  FileDown, Mail, ArrowRight, Edit, PenTool, Calendar, 
  DollarSign, FileText, CheckCircle, Send
} from 'lucide-react';
import { format } from 'date-fns';
import { CustomerQuote } from '@/hooks/useCustomerHistory';
import { SignatureSection } from '@/components/signatures/SignatureSection';

interface QuoteDetailDialogProps {
  quote: CustomerQuote | null;
  customerName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload?: (quoteId: string) => void;
  onEmail?: (quoteId: string) => void;
  onConvertToInvoice?: (quoteId: string) => void;
  onEdit?: (quoteId: string) => void;
  onViewSignature?: (signatureId: string) => void;
  onCollectSignature?: (quoteId: string) => void;
  onSendSignatureRequest?: (quoteId: string) => void;
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

export function QuoteDetailDialog({
  quote,
  customerName,
  open,
  onOpenChange,
  onDownload,
  onEmail,
  onConvertToInvoice,
  onEdit,
  onViewSignature,
  onCollectSignature,
  onSendSignatureRequest,
  isCollectingSignature = false,
  customerEmail,
}: QuoteDetailDialogProps) {
  if (!quote) return null;

  const isApprovedOrAccepted = quote.status === 'approved' || quote.status === 'accepted';
  const showCollectButton = !isApprovedOrAccepted && quote.status !== 'rejected';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
              <span className="truncate">{quote.quote_number}</span>
            </DialogTitle>
            <Badge className={`${statusColors[quote.status] || 'bg-muted'} shrink-0 text-xs`}>
              {quote.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Customer & Dates - responsive grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Customer</p>
              <p className="font-medium text-sm sm:text-base truncate">{customerName || 'Unknown'}</p>
            </div>
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
          <SignatureSection 
            signatureId={quote.signature_id}
            title="Customer Signature"
            onCollectSignature={onCollectSignature ? () => onCollectSignature(quote.id) : undefined}
            showCollectButton={showCollectButton}
            collectButtonText="Collect Signature"
            isCollecting={isCollectingSignature}
          />

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

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 sm:pt-4">
            <Button variant="outline" size="sm" onClick={() => onDownload?.(quote.id)} className="flex-1 sm:flex-none">
              <FileDown className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEmail?.(quote.id)} className="flex-1 sm:flex-none">
              <Mail className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Email</span>
            </Button>
            {quote.status !== 'rejected' && (
              <Button variant="outline" size="sm" onClick={() => onConvertToInvoice?.(quote.id)} className="flex-1 sm:flex-none">
                <ArrowRight className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Convert to Invoice</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onEdit?.(quote.id)} className="w-full sm:w-auto sm:ml-auto mt-2 sm:mt-0">
              <Edit className="w-4 h-4 mr-1" /> Open in Quotes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}