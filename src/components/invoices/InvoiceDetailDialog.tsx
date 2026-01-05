import { useState } from 'react';
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
  FileDown, Mail, Edit, PenTool, Calendar, 
  DollarSign, Receipt, CheckCircle, Clock, AlertCircle, UserCog, Bell,
  ChevronRight, CheckCircle2, Copy, Briefcase, FileText, Link2, Send, Loader2,
  List, Image as ImageIcon, CreditCard, Trash2, Pencil, RotateCcw, XCircle, MoreHorizontal
} from 'lucide-react';
import { format } from 'date-fns';
import { CustomerInvoice } from '@/hooks/useCustomerHistory';
import { SignatureSection } from '@/components/signatures/SignatureSection';
import { ConstrainedPanel } from '@/components/ui/constrained-panel';
import { DocumentPhotoGallery } from '@/components/photos/DocumentPhotoGallery';
import { useInvoicePhotos, useUploadInvoicePhoto, useDeleteInvoicePhoto, useUpdateInvoicePhotoType } from '@/hooks/useInvoicePhotos';
import { usePayments, useDeletePayment, useUpdatePayment, useRefundPayment, useVoidPayment, Payment } from '@/hooks/usePayments';
import { PAYMENT_METHODS } from './RecordPaymentDialog';
import { EditPaymentDialog, EditPaymentData } from './EditPaymentDialog';
import { RefundPaymentDialog } from './RefundPaymentDialog';

const INVOICE_STATUSES = ['draft', 'sent', 'paid'] as const;

interface ReminderHistory {
  id: string;
  sent_at: string;
  recipient_email: string;
  sent_by_profile?: { full_name: string | null };
}

interface LinkedQuote {
  id: string;
  quote_number: string;
  status: string;
}

interface LinkedJob {
  id: string;
  job_number: string;
  title: string;
  status: string;
}

interface InvoiceDetailDialogProps {
  invoice: CustomerInvoice | null;
  customerName?: string;
  customerEmail?: string;
  creatorName?: string;
  linkedJobNumber?: string | null;
  linkedQuote?: LinkedQuote | null;
  linkedJob?: LinkedJob | null;
  lateFeePercentage?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload?: (invoiceId: string) => void;
  onEmail?: (invoiceId: string) => void;
  onEmailCustom?: (invoiceId: string) => void;
  onMarkPaid?: (invoiceId: string) => void;
  onEdit?: (invoiceId: string) => void;
  onDuplicate?: (invoiceId: string) => void;
  onStatusChange?: (invoiceId: string, status: string) => void;
  onViewSignature?: (signatureId: string) => void;
  onCollectSignature?: (invoiceId: string) => void;
  onSendSignatureRequest?: (invoiceId: string) => void;
  isCollectingSignature?: boolean;
  onApplyLateFee?: (invoiceId: string) => void;
  isApplyingLateFee?: boolean;
  onSendReminder?: (invoiceId: string) => void;
  isSendingReminder?: boolean;
  isSendingEmail?: boolean;
  reminders?: ReminderHistory[];
  onViewQuote?: (quoteId: string) => void;
  onViewJob?: (jobId: string) => void;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const quoteStatusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  expired: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

const jobStatusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  invoiced: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
};

export function InvoiceDetailDialog({
  invoice,
  customerName,
  customerEmail,
  creatorName,
  linkedJobNumber,
  linkedQuote,
  linkedJob,
  lateFeePercentage = 0,
  open,
  onOpenChange,
  onDownload,
  onEmail,
  onEmailCustom,
  onMarkPaid,
  onEdit,
  onDuplicate,
  onStatusChange,
  onViewSignature,
  onCollectSignature,
  onSendSignatureRequest,
  isCollectingSignature = false,
  onApplyLateFee,
  isApplyingLateFee = false,
  onSendReminder,
  isSendingReminder = false,
  isSendingEmail = false,
  reminders = [],
  onViewQuote,
  onViewJob,
}: InvoiceDetailDialogProps) {
  const { data: invoicePhotos = [], isLoading: loadingPhotos } = useInvoicePhotos(invoice?.id || null);
  const uploadPhoto = useUploadInvoicePhoto();
  const deletePhoto = useDeleteInvoicePhoto();
  const updatePhotoType = useUpdateInvoicePhotoType();
  
  // Fetch payments for this invoice
  const { data: payments = [], isLoading: loadingPayments } = usePayments(invoice?.id || null);
  const deletePayment = useDeletePayment();
  const updatePayment = useUpdatePayment();
  const refundPayment = useRefundPayment();
  const voidPayment = useVoidPayment();
  
  // Edit payment dialog state
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false);
  
  // Refund/void dialog state
  const [refundPayment_, setRefundPayment] = useState<Payment | null>(null);
  const [refundAction, setRefundAction] = useState<'refund' | 'void'>('refund');
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);

  if (!invoice) return null;

  const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== 'paid';
  const hasLateFee = invoice.late_fee_amount && Number(invoice.late_fee_amount) > 0;
  const canApplyLateFee = isOverdue && !hasLateFee && lateFeePercentage > 0;
  const linkedDocsCount = (linkedQuote ? 1 : 0) + (linkedJob ? 1 : 0);
  
  // Calculate payment totals - only count completed payments
  const totalDue = Number(invoice.total) + Number(invoice.late_fee_amount || 0);
  const completedPayments = payments.filter(p => p.status === 'completed');
  const totalPaid = completedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remainingBalance = Math.max(0, totalDue - totalPaid);
  
  // Helper to format payment method
  const formatPaymentMethod = (method: string) => {
    const found = PAYMENT_METHODS.find(m => m.value === method);
    return found?.label || method;
  };

  const handleUploadPhoto = async (file: File, photoType: 'before' | 'after' | 'other') => {
    await uploadPhoto.mutateAsync({
      invoiceId: invoice.id,
      file,
      photoType,
    });
  };

  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    await deletePhoto.mutateAsync({
      photoId,
      photoUrl,
      invoiceId: invoice.id,
    });
  };

  const handleUpdatePhotoType = (photoId: string, photoType: 'before' | 'after' | 'other') => {
    updatePhotoType.mutate({
      photoId,
      photoType,
      invoiceId: invoice.id,
    });
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setEditPaymentDialogOpen(true);
  };

  const handleUpdatePayment = async (data: EditPaymentData) => {
    if (!editingPayment) return;
    await updatePayment.mutateAsync({
      paymentId: editingPayment.id,
      invoiceId: invoice.id,
      amount: data.amount,
      method: data.method,
      paymentDate: data.date,
      notes: data.notes || undefined,
    });
    setEditPaymentDialogOpen(false);
    setEditingPayment(null);
  };

  const handleRefundPayment = (payment: Payment) => {
    setRefundPayment(payment);
    setRefundAction('refund');
    setRefundDialogOpen(true);
  };

  const handleVoidPayment = (payment: Payment) => {
    setRefundPayment(payment);
    setRefundAction('void');
    setRefundDialogOpen(true);
  };

  const handleConfirmRefund = async (reason: string, sendNotification: boolean) => {
    if (!refundPayment_) return;
    if (refundAction === 'refund') {
      await refundPayment.mutateAsync({
        paymentId: refundPayment_.id,
        invoiceId: invoice.id,
        reason,
        sendNotification,
      });
    } else {
      await voidPayment.mutateAsync({
        paymentId: refundPayment_.id,
        invoiceId: invoice.id,
        reason,
        sendNotification,
      });
    }
    setRefundDialogOpen(false);
    setRefundPayment(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
              <span className="truncate">{invoice.invoice_number}</span>
            </DialogTitle>
            {onStatusChange ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Badge className={`${statusColors[invoice.status] || 'bg-muted'} shrink-0 text-xs cursor-pointer hover:opacity-80 transition-opacity`}>
                    {invoice.status}
                    <ChevronRight className="w-3 h-3 ml-1 rotate-90" />
                  </Badge>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover z-50">
                  {INVOICE_STATUSES.map(status => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => onStatusChange(invoice.id, status)}
                      disabled={invoice.status === status}
                      className={invoice.status === status ? 'bg-accent' : ''}
                    >
                      <Badge className={`${statusColors[status] || 'bg-muted'} mr-2`} variant="outline">
                        {status}
                      </Badge>
                      {invoice.status === status && <CheckCircle2 className="w-4 h-4 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Badge className={`${statusColors[invoice.status] || 'bg-muted'} shrink-0 text-xs`}>
                {invoice.status}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Tabs for Details, Linked Docs, Photos - at top like Job dialog */}
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details" className="flex items-center gap-1 text-xs sm:text-sm px-1">
              <List className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Details</span>
              {(invoice.items?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-0.5 text-xs hidden sm:inline-flex">
                  {invoice.items?.length}
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
              <ImageIcon className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Photos</span>
              {invoicePhotos.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 text-xs hidden sm:inline-flex">
                  {invoicePhotos.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="mt-4 space-y-4">
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
              {linkedJobNumber && (
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                    <Briefcase className="w-3 h-3" /> Linked Job
                  </p>
                  <p className="font-medium text-sm sm:text-base">{linkedJobNumber}</p>
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
                        <div className="col-span-5">Name</div>
                        <div className="col-span-2 text-right">Quantity</div>
                        <div className="col-span-3 text-right">Unit Price</div>
                        <div className="col-span-2 text-right">Total</div>
                      </div>
                      {invoice.items.map((item) => (
                        <div key={item.id} className="py-2 px-2 sm:px-3 bg-muted/50 rounded text-sm">
                          {/* Mobile layout */}
                          <div className="sm:hidden space-y-1">
                            <p className="font-medium">{item.description}</p>
                            {(item as any).item_description && (
                              <p className="text-xs text-muted-foreground">{(item as any).item_description}</p>
                            )}
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Qty: {item.quantity} × Unit: ${Number(item.unit_price).toLocaleString()}</span>
                              <span className="font-medium text-foreground">${Number(item.total).toLocaleString()}</span>
                            </div>
                          </div>
                          {/* Desktop layout */}
                          <div className="hidden sm:block">
                            <div className="grid grid-cols-12 items-start">
                              <div className="col-span-5">
                                <span>{item.description}</span>
                                {(item as any).item_description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{(item as any).item_description}</p>
                                )}
                              </div>
                              <div className="col-span-2 text-right">{item.quantity}</div>
                              <div className="col-span-3 text-right">${Number(item.unit_price).toLocaleString()}</div>
                              <div className="col-span-2 text-right font-medium">${Number(item.total).toLocaleString()}</div>
                            </div>
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
                <div className="w-full sm:w-64 space-y-1">
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
                  {hasLateFee && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Late Fee {lateFeePercentage > 0 && `(${lateFeePercentage}%)`}
                      </span>
                      <span>+${Number(invoice.late_fee_amount).toFixed(2)}</span>
                    </div>
                  )}
                  {totalPaid > 0 && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Paid
                      </span>
                      <span>-${totalPaid.toFixed(2)}</span>
                    </div>
                  )}
                  <div className={`flex justify-between font-bold text-base sm:text-lg pt-2 border-t ${remainingBalance > 0 && invoice.status !== 'paid' ? 'border-destructive/30' : ''}`}>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {remainingBalance > 0 && invoice.status !== 'paid' ? 'Balance Due' : 'Total'}
                    </span>
                    <span className={remainingBalance > 0 && invoice.status !== 'paid' ? 'text-destructive' : ''}>
                      ${remainingBalance > 0 ? remainingBalance.toFixed(2) : totalDue.toFixed(2)}
                    </span>
                  </div>
                  {canApplyLateFee && onApplyLateFee && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => onApplyLateFee(invoice.id)}
                      disabled={isApplyingLateFee}
                    >
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Apply {lateFeePercentage}% Late Fee
                    </Button>
                  )}
                </div>
              </div>

              {/* Payment History */}
              {payments.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2 text-sm sm:text-base flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Payment History ({payments.length})
                    </h4>
                    <div className="space-y-2">
                      {payments.map((payment) => {
                        const isCompleted = payment.status === 'completed';
                        const isRefunded = payment.status === 'refunded';
                        const isVoided = payment.status === 'voided';
                        
                        return (
                          <div 
                            key={payment.id} 
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2 px-3 rounded text-sm ${
                              isCompleted 
                                ? 'bg-green-50 dark:bg-green-900/20' 
                                : isRefunded 
                                  ? 'bg-orange-50 dark:bg-orange-900/20' 
                                  : 'bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              {isCompleted ? (
                                <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400 shrink-0" />
                              ) : isRefunded ? (
                                <RotateCcw className="w-3 h-3 text-orange-600 dark:text-orange-400 shrink-0" />
                              ) : (
                                <XCircle className="w-3 h-3 text-muted-foreground shrink-0" />
                              )}
                              <span className={`font-medium ${
                                isCompleted 
                                  ? 'text-green-700 dark:text-green-400' 
                                  : isRefunded 
                                    ? 'text-orange-700 dark:text-orange-400 line-through' 
                                    : 'text-muted-foreground line-through'
                              }`}>
                                ${Number(payment.amount).toFixed(2)}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {formatPaymentMethod(payment.method)}
                              </Badge>
                              {isRefunded && (
                                <Badge variant="outline" className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-300">
                                  Refunded
                                </Badge>
                              )}
                              {isVoided && (
                                <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                                  Voided
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {payment.recorded_by_profile?.full_name && (
                                <span>by {payment.recorded_by_profile.full_name}</span>
                              )}
                              <span>{format(new Date(payment.payment_date), 'MMM d, yyyy')}</span>
                              {isCompleted && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                    >
                                      <MoreHorizontal className="w-3 h-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEditPayment(payment)}>
                                      <Pencil className="w-3 h-3 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleRefundPayment(payment)}>
                                      <RotateCcw className="w-3 h-3 mr-2" />
                                      Refund
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleVoidPayment(payment)}>
                                      <XCircle className="w-3 h-3 mr-2" />
                                      Void
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => deletePayment.mutate({ paymentId: payment.id, invoiceId: invoice.id })}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="w-3 h-3 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                              {(isRefunded || isVoided) && payment.refund_reason && (
                                <span className="italic" title={payment.refund_reason}>
                                  "{payment.refund_reason.substring(0, 20)}{payment.refund_reason.length > 20 ? '...' : ''}"
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Payment Status Banner */}
              {invoice.status === 'paid' || (totalPaid > 0 && remainingBalance === 0) ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="font-medium text-xs sm:text-sm">
                    {invoice.paid_at 
                      ? `Paid in full on ${format(new Date(invoice.paid_at), 'MMM d, yyyy')}`
                      : 'Paid in full'
                    }
                  </span>
                </div>
              ) : totalPaid > 0 ? (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-700 dark:text-yellow-400">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="font-medium text-xs sm:text-sm">
                    Partial payment received - ${remainingBalance.toFixed(2)} remaining
                  </span>
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

              {/* Reminder History */}
              {reminders.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2 text-sm sm:text-base flex items-center gap-2">
                      <Bell className="w-4 h-4" />
                      Payment Reminders Sent ({reminders.length})
                    </h4>
                    <div className="space-y-2">
                      {reminders.map((reminder) => (
                        <div key={reminder.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2 px-3 bg-muted/50 rounded text-sm">
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground">{reminder.recipient_email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {reminder.sent_by_profile?.full_name && (
                              <span>by {reminder.sent_by_profile.full_name}</span>
                            )}
                            <span>{format(new Date(reminder.sent_at), 'MMM d, yyyy h:mm a')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Signature Section */}
              <ConstrainedPanel>
                <SignatureSection
                  signatureId={(invoice as any).signature_id}
                  title="Customer Signature"
                  onCollectSignature={onCollectSignature ? () => onCollectSignature(invoice.id) : undefined}
                  showCollectButton={invoice.status !== 'paid' && !!onCollectSignature}
                  collectButtonText="Collect Signature"
                  isCollecting={isCollectingSignature}
                />
              </ConstrainedPanel>

              {/* Send Signature Request Button */}
              {invoice.status !== 'paid' && !(invoice as any).signature_id && customerEmail && onSendSignatureRequest && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onSendSignatureRequest(invoice.id)}
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
                <h4 className="font-medium mb-2 text-sm sm:text-base flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Linked Documents
                </h4>
                {(linkedQuote || linkedJob) ? (
                  <div className="space-y-2">
                    {linkedQuote && (
                      <div
                        className={`flex items-center justify-between p-3 bg-muted/50 rounded-lg ${onViewQuote ? 'cursor-pointer hover:bg-muted transition-colors' : ''}`}
                        onClick={() => onViewQuote?.(linkedQuote.id)}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{linkedQuote.quote_number}</span>
                          <span className="text-xs text-muted-foreground">Quote</span>
                        </div>
                        <Badge className={quoteStatusColors[linkedQuote.status] || 'bg-muted'}>
                          {linkedQuote.status}
                        </Badge>
                      </div>
                    )}
                    {linkedJob && (
                      <div
                        className={`flex items-center justify-between p-3 bg-muted/50 rounded-lg ${onViewJob ? 'cursor-pointer hover:bg-muted transition-colors' : ''}`}
                        onClick={() => onViewJob?.(linkedJob.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{linkedJob.job_number}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[150px]">{linkedJob.title}</span>
                        </div>
                        <Badge className={jobStatusColors[linkedJob.status] || 'bg-muted'}>
                          {linkedJob.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                    No linked quotes or jobs
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Photos Tab */}
            <TabsContent value="photos" className="mt-4">
              <DocumentPhotoGallery
                photos={invoicePhotos.map(p => ({
                  id: p.id,
                  photo_url: p.photo_url,
                  photo_type: p.photo_type,
                  caption: p.caption,
                  created_at: p.created_at,
                  display_order: p.display_order ?? 0,
                }))}
                bucketName="invoice-photos"
                documentId={invoice.id}
                onUpload={handleUploadPhoto}
                onDelete={handleDeletePhoto}
                onUpdateType={handleUpdatePhotoType}
                isUploading={uploadPhoto.isPending}
                editable={true}
              />
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <Separator />
          <div className="flex flex-wrap gap-2 pt-2 sm:pt-4">
            <Button 
              size="sm" 
              onClick={() => onEmail?.(invoice.id)} 
              disabled={!customerEmail || isSendingEmail}
              title={!customerEmail ? 'Customer has no email address' : undefined}
            >
              {isSendingEmail ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-1" />
              )}
              {isSendingEmail ? 'Sending...' : 'Send to Customer'}
            </Button>
            {onDuplicate && (
              <Button variant="outline" size="sm" onClick={() => onDuplicate(invoice.id)}>
                <Copy className="w-4 h-4 mr-1" />
                Duplicate
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onDownload?.(invoice.id)}>
              <FileDown className="w-4 h-4 mr-1" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEmailCustom?.(invoice.id)}>
              <Mail className="w-4 h-4 mr-1" />
              Email
            </Button>
            {invoice.status !== 'paid' && onSendReminder && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onSendReminder(invoice.id)} 
                disabled={isSendingReminder}
              >
                <Bell className="w-4 h-4 mr-1" />
                {isSendingReminder ? 'Sending...' : 'Send Reminder'}
              </Button>
            )}
            {invoice.status !== 'paid' && (
              <Button variant="outline" size="sm" onClick={() => onMarkPaid?.(invoice.id)}>
                <CheckCircle className="w-4 h-4 mr-1" />
                Mark Paid
              </Button>
            )}
            <Button size="sm" onClick={() => onEdit?.(invoice.id)} className="sm:ml-auto">
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          </div>
      </DialogContent>

      {/* Edit Payment Dialog */}
      <EditPaymentDialog
        open={editPaymentDialogOpen}
        onOpenChange={(open) => {
          setEditPaymentDialogOpen(open);
          if (!open) setEditingPayment(null);
        }}
        payment={editingPayment}
        onConfirm={handleUpdatePayment}
        isLoading={updatePayment.isPending}
      />

      {/* Refund/Void Payment Dialog */}
      <RefundPaymentDialog
        open={refundDialogOpen}
        onOpenChange={(open) => {
          setRefundDialogOpen(open);
          if (!open) setRefundPayment(null);
        }}
        payment={refundPayment_}
        action={refundAction}
        onConfirm={handleConfirmRefund}
        isLoading={refundPayment.isPending || voidPayment.isPending}
        customerHasEmail={!!customerEmail}
      />
    </Dialog>
  );
}
