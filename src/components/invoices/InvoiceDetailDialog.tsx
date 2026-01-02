import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  FileDown, Mail, Edit, PenTool, Calendar, 
  DollarSign, Receipt, CheckCircle, Clock, AlertCircle, UserCog
} from 'lucide-react';
import { format } from 'date-fns';
import { CustomerInvoice } from '@/hooks/useCustomerHistory';

interface InvoiceDetailDialogProps {
  invoice: CustomerInvoice | null;
  customerName?: string;
  creatorName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload?: (invoiceId: string) => void;
  onEmail?: (invoiceId: string) => void;
  onMarkPaid?: (invoiceId: string) => void;
  onEdit?: (invoiceId: string) => void;
  onViewSignature?: (signatureId: string) => void;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function InvoiceDetailDialog({
  invoice,
  customerName,
  creatorName,
  open,
  onOpenChange,
  onDownload,
  onEmail,
  onMarkPaid,
  onEdit,
  onViewSignature,
}: InvoiceDetailDialogProps) {
  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
              <span className="truncate">{invoice.invoice_number}</span>
            </DialogTitle>
            <Badge className={`${statusColors[invoice.status] || 'bg-muted'} shrink-0 text-xs`}>
              {invoice.status}
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
              <p className="font-medium text-sm sm:text-base">{format(new Date(invoice.created_at), 'MMM d, yyyy')}</p>
            </div>
            {invoice.due_date && (
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Due Date
                </p>
                <p className="font-medium text-sm sm:text-base">{format(new Date(invoice.due_date), 'MMM d, yyyy')}</p>
              </div>
            )}
            {invoice.paid_at && (
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Paid
                </p>
                <p className="font-medium text-green-600 flex items-center gap-1 text-sm sm:text-base">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                  {format(new Date(invoice.paid_at), 'MMM d, yyyy')}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Line Items */}
          <div>
            <h4 className="font-medium mb-2 sm:mb-3 text-sm sm:text-base">Line Items</h4>
            <div className="space-y-2">
              {invoice.items && invoice.items.length > 0 ? (
                <>
                  {/* Desktop header - hidden on mobile */}
                  <div className="hidden sm:grid grid-cols-12 text-xs text-muted-foreground font-medium px-2">
                    <div className="col-span-6">Description</div>
                    <div className="col-span-2 text-right">Qty</div>
                    <div className="col-span-2 text-right">Price</div>
                    <div className="col-span-2 text-right">Total</div>
                  </div>
                  {invoice.items.map((item) => (
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
            <div className="w-full sm:w-56 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${Number(invoice.subtotal).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>${Number(invoice.tax).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Invoice Total</span>
                <span>${Number(invoice.total).toLocaleString()}</span>
              </div>
              {invoice.late_fee_amount && Number(invoice.late_fee_amount) > 0 && (
                <>
                  <div className="flex justify-between text-sm text-destructive">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Late Fee
                    </span>
                    <span>+${Number(invoice.late_fee_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base sm:text-lg pt-2 border-t border-destructive/30">
                    <span className="flex items-center gap-1 text-destructive"><DollarSign className="w-4 h-4" />Total Due</span>
                    <span className="text-destructive">${(Number(invoice.total) + Number(invoice.late_fee_amount)).toLocaleString()}</span>
                  </div>
                </>
              )}
              {(!invoice.late_fee_amount || Number(invoice.late_fee_amount) === 0) && (
                <div className="flex justify-between font-semibold text-base sm:text-lg pt-2 border-t">
                  <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" />Total</span>
                  <span>${Number(invoice.total).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Status Banner */}
          {invoice.status === 'paid' ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span className="font-medium text-xs sm:text-sm">Payment received on {format(new Date(invoice.paid_at!), 'MMM d, yyyy')}</span>
            </div>
          ) : invoice.due_date && new Date(invoice.due_date) < new Date() ? (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-400">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span className="font-medium text-xs sm:text-sm">Overdue - was due on {format(new Date(invoice.due_date), 'MMM d, yyyy')}</span>
            </div>
          ) : null}

          {/* Notes */}
          {invoice.notes && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2 text-sm sm:text-base">Notes</h4>
                <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            </>
          )}

          {/* Signature */}
          {invoice.signed_at && invoice.signature_id && (
            <>
              <Separator />
              <div className="sm:max-w-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <PenTool className="w-4 h-4 shrink-0" />
                    <span className="text-xs sm:text-sm font-medium">This invoice has been signed</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onViewSignature?.(invoice.signature_id!)}
                    className="w-full sm:w-auto"
                  >
                    View Signature
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 sm:pt-4">
            <Button variant="outline" size="sm" onClick={() => onDownload?.(invoice.id)} className="flex-1 sm:flex-none">
              <FileDown className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEmail?.(invoice.id)} className="flex-1 sm:flex-none">
              <Mail className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Email</span>
            </Button>
            {invoice.status !== 'paid' && (
              <Button variant="default" size="sm" onClick={() => onMarkPaid?.(invoice.id)} className="flex-1 sm:flex-none">
                <CheckCircle className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Mark Paid</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onEdit?.(invoice.id)} className="w-full sm:w-auto sm:ml-auto mt-2 sm:mt-0">
              <Edit className="w-4 h-4 mr-1" /> Open in Invoices
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
