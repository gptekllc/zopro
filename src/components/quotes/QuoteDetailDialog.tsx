import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  FileDown, Mail, ArrowRight, Edit, PenTool, Calendar, 
  DollarSign, FileText, CheckCircle 
} from 'lucide-react';
import { format } from 'date-fns';
import { CustomerQuote } from '@/hooks/useCustomerHistory';

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
}: QuoteDetailDialogProps) {
  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              {quote.quote_number}
            </DialogTitle>
            <Badge className={statusColors[quote.status] || 'bg-muted'}>
              {quote.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer & Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="font-medium">{customerName || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">{format(new Date(quote.created_at), 'MMM d, yyyy')}</p>
            </div>
            {quote.valid_until && (
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Valid Until
                </p>
                <p className="font-medium">{format(new Date(quote.valid_until), 'MMM d, yyyy')}</p>
              </div>
            )}
            {quote.signed_at && (
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <PenTool className="w-3 h-3" /> Signed
                </p>
                <p className="font-medium text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  {format(new Date(quote.signed_at), 'MMM d, yyyy')}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Line Items */}
          <div>
            <h4 className="font-medium mb-3">Line Items</h4>
            <div className="space-y-2">
              {quote.items && quote.items.length > 0 ? (
                <>
                  <div className="grid grid-cols-12 text-xs text-muted-foreground font-medium px-2">
                    <div className="col-span-6">Description</div>
                    <div className="col-span-2 text-right">Qty</div>
                    <div className="col-span-2 text-right">Price</div>
                    <div className="col-span-2 text-right">Total</div>
                  </div>
                  {quote.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-12 py-2 px-2 bg-muted/50 rounded text-sm">
                      <div className="col-span-6">{item.description}</div>
                      <div className="col-span-2 text-right">{item.quantity}</div>
                      <div className="col-span-2 text-right">${Number(item.unit_price).toLocaleString()}</div>
                      <div className="col-span-2 text-right font-medium">${Number(item.total).toLocaleString()}</div>
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
            <div className="w-48 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${Number(quote.subtotal).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>${Number(quote.tax).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg pt-2 border-t">
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
                <h4 className="font-medium mb-2">Notes</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
              </div>
            </>
          )}

          {/* Signature */}
          {quote.signed_at && quote.signature_id && (
            <>
              <Separator />
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <PenTool className="w-4 h-4" />
                  <span className="text-sm font-medium">This quote has been signed</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onViewSignature?.(quote.signature_id!)}
                >
                  View Signature
                </Button>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => onDownload?.(quote.id)}>
              <FileDown className="w-4 h-4 mr-1" /> Download
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEmail?.(quote.id)}>
              <Mail className="w-4 h-4 mr-1" /> Email
            </Button>
            {quote.status !== 'rejected' && (
              <Button variant="outline" size="sm" onClick={() => onConvertToInvoice?.(quote.id)}>
                <ArrowRight className="w-4 h-4 mr-1" /> Convert to Invoice
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onEdit?.(quote.id)} className="ml-auto">
              <Edit className="w-4 h-4 mr-1" /> Edit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}