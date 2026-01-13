import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  FileDown, Mail, Edit, PenTool, Calendar, 
  DollarSign, Receipt, CheckCircle, Clock, AlertCircle, UserCog, Bell,
  ChevronRight, CheckCircle2, Briefcase, FileText, Link2, Send, Loader2,
  List, Image as ImageIcon, CreditCard, Trash2, Pencil, RotateCcw, XCircle, MoreHorizontal, Ban, StickyNote, ChevronDown, ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { CustomerInvoice } from '@/hooks/useCustomerHistory';
import { SignatureSection } from '@/components/signatures/SignatureSection';
import { ConstrainedPanel } from '@/components/ui/constrained-panel';
import { DocumentPhotoGallery } from '@/components/photos/DocumentPhotoGallery';
import { useInvoicePhotos, useUploadInvoicePhoto, useDeleteInvoicePhoto, useUpdateInvoicePhotoType } from '@/hooks/useInvoicePhotos';
import { usePayments, useDeletePayment, useUpdatePayment, useRefundPayment, useVoidPayment, useCreatePayment, Payment } from '@/hooks/usePayments';
import { useVoidInvoice } from '@/hooks/useInvoices';
import { useCompany } from '@/hooks/useCompany';
import { PAYMENT_METHODS, RecordPaymentDialog, PaymentData } from './RecordPaymentDialog';
import { SplitPaymentDialog, SplitPaymentData } from './SplitPaymentDialog';
import { EditPaymentDialog, EditPaymentData } from './EditPaymentDialog';
import { RefundPaymentDialog } from './RefundPaymentDialog';
import { VoidInvoiceDialog } from './VoidInvoiceDialog';
import { InvoiceEmailActionDialog } from './InvoiceEmailActionDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatAmount } from '@/lib/formatAmount';

const INVOICE_STATUSES = ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'voided'] as const;

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
  onEmailCustom?: (invoiceId: string, recipientEmails?: string[], subject?: string, message?: string, cc?: string[], bcc?: string[]) => void;
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
  onSendReminder?: (invoiceId: string, recipientEmails?: string[], subject?: string, message?: string, cc?: string[], bcc?: string[]) => void;
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
  partially_paid: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  voided: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
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
  const { data: company } = useCompany();
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
  const createPayment = useCreatePayment();
  
  // Edit payment dialog state
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false);
  
  // Refund/void dialog state
  const [refundPayment_, setRefundPayment] = useState<Payment | null>(null);
  const [refundAction, setRefundAction] = useState<'refund' | 'void'>('refund');
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  
  // Record payment dialog state
  const [recordPaymentDialogOpen, setRecordPaymentDialogOpen] = useState(false);
  const [splitPaymentDialogOpen, setSplitPaymentDialogOpen] = useState(false);
  
  // Void invoice dialog state
  const [voidInvoiceDialogOpen, setVoidInvoiceDialogOpen] = useState(false);
  const voidInvoice = useVoidInvoice();
  
  // Email action dialog state
  const [emailActionDialogOpen, setEmailActionDialogOpen] = useState(false);
  
  // Receipt loading state
  const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null);
  
  // Payment link loading state
  const [isGeneratingPaymentLink, setIsGeneratingPaymentLink] = useState(false);
  
  // Local state for optimistic UI updates
  const [localStatus, setLocalStatus] = useState(invoice?.status);
  
  // Sync local state when invoice prop changes
  useEffect(() => {
    if (invoice) {
      setLocalStatus(invoice.status);
    }
  }, [invoice?.status]);

  if (!invoice) return null;

  const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== 'paid';
  const hasLateFee = Number(invoice.late_fee_amount ?? 0) > 0;
  const canApplyLateFee = isOverdue && !hasLateFee && lateFeePercentage > 0;
  const linkedDocsCount = (linkedQuote ? 1 : 0) + (linkedJob ? 1 : 0);
  const isVoided = invoice.status === 'voided';
  
  // Parse void reason from notes if voided
  const voidInfo = (() => {
    if (!isVoided || !invoice.notes) return null;
    const match = invoice.notes.match(/\[VOIDED ([^\]]+)\] (.+?)(?:\n|$)/);
    if (match) {
      return { date: match[1], reason: match[2] };
    }
    return null;
  })();
  
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

  const handleRecordPayment = async (data: PaymentData) => {
    await createPayment.mutateAsync({
      invoiceId: invoice.id,
      amount: data.amount,
      method: data.method,
      paymentDate: data.date,
      notes: data.note,
      sendNotification: data.sendNotification,
    });
    setRecordPaymentDialogOpen(false);
  };

  const handleSplitPayment = async (data: SplitPaymentData) => {
    // Record each payment in sequence
    for (const payment of data.payments) {
      await createPayment.mutateAsync({
        invoiceId: invoice.id,
        amount: payment.amount,
        method: payment.method,
        paymentDate: data.date,
        notes: data.note || `Split payment (${data.payments.length} methods)`,
        sendNotification: false, // Only send one notification at the end
      });
    }
    // Send notification for the last payment if requested
    if (data.sendNotification && data.payments.length > 0) {
      // The last payment already triggers notification if needed
    }
    setSplitPaymentDialogOpen(false);
  };

  const handleSendInvoiceEmail = async (emails: string[], subject: string, message: string, cc?: string[], bcc?: string[]) => {
    if (emails.length > 0) {
      await onEmailCustom?.(invoice.id, emails, subject, message, cc, bcc);
    }
  };

  const handleSendReminderEmail = async (emails: string[], subject: string, message: string, cc?: string[], bcc?: string[]) => {
    if (emails.length > 0) {
      await onSendReminder?.(invoice.id, emails, subject, message, cc, bcc);
    }
  };

  const handleDownloadReceipt = async (paymentId: string) => {
    setReceiptLoadingId(paymentId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-payment-receipt', {
        body: { paymentId, action: 'download' },
      });

      if (error) throw error;
      if (!data?.pdf) throw new Error('No PDF data received');

      // Download the PDF
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${data.pdf}`;
      link.download = data.fileName || `Receipt-${invoice.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Receipt downloaded');
    } catch (error) {
      console.error('Failed to download receipt:', error);
      toast.error('Failed to download receipt');
    } finally {
      setReceiptLoadingId(null);
    }
  };

  const handleEmailReceipt = async (paymentId: string) => {
    if (!customerEmail) {
      toast.error('Customer email not available');
      return;
    }
    
    setReceiptLoadingId(paymentId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-payment-receipt', {
        body: { paymentId, action: 'email', recipientEmail: customerEmail },
      });

      if (error) throw error;
      toast.success('Receipt emailed to customer');
    } catch (error) {
      console.error('Failed to email receipt:', error);
      toast.error('Failed to email receipt');
    } finally {
      setReceiptLoadingId(null);
    }
  };

  const handleVoidInvoice = async (reason: string, sendNotification: boolean) => {
    await voidInvoice.mutateAsync({
      invoiceId: invoice.id,
      reason,
      sendNotification,
    });
    setVoidInvoiceDialogOpen(false);
    onOpenChange(false);
  };

  const handleGeneratePaymentLink = async () => {
    setIsGeneratingPaymentLink(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-payment-link', {
        body: { invoiceId: invoice.id },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No payment URL received');

      // Open in new tab
      window.open(data.url, '_blank');
      toast.success('Payment page opened in new tab');
    } catch (err: any) {
      console.error('Failed to generate payment link:', err);
      toast.error(err.message || 'Failed to generate payment link');
    } finally {
      setIsGeneratingPaymentLink(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl md:max-w-4xl lg:max-w-5xl overflow-hidden rounded-lg p-0 flex flex-col"
      >
        <DialogHeader className="p-4 sm:p-6 pb-0 sm:pb-0">
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
              <span className="truncate">{invoice.invoice_number}</span>
            </DialogTitle>
            {onStatusChange ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Badge className={`${statusColors[localStatus || invoice.status] || 'bg-muted'} shrink-0 text-xs cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1`}>
                    <ChevronDown className="h-3 w-3" />
                    {(localStatus || invoice.status) === 'paid' ? 'Paid in Full' : 
                     (localStatus || invoice.status) === 'partially_paid' ? 'Partially Paid' :
                     (localStatus || invoice.status) === 'voided' ? 'Voided' :
                     (localStatus || invoice.status).charAt(0).toUpperCase() + (localStatus || invoice.status).slice(1)}
                  </Badge>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover z-50 min-w-[120px]">
                  {INVOICE_STATUSES.map(status => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => {
                        if ((localStatus || invoice.status) !== status) {
                          setLocalStatus(status);
                          onStatusChange(invoice.id, status);
                        }
                      }}
                      className={`${(localStatus || invoice.status) === status ? 'bg-accent' : ''} p-1`}
                    >
                      <Badge className={`${statusColors[status] || 'bg-muted'} text-xs w-full justify-center`}>
                        {status === 'paid' ? 'Paid in Full' : 
                         status === 'partially_paid' ? 'Partially Paid' :
                         status === 'voided' ? 'Voided' :
                         status.charAt(0).toUpperCase() + status.slice(1)}
                      </Badge>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Badge className={`${statusColors[invoice.status] || 'bg-muted'} shrink-0 text-xs`}>
                {invoice.status === 'paid' ? 'Paid in Full' : 
                 invoice.status === 'partially_paid' ? 'Partially Paid' :
                 invoice.status === 'voided' ? 'Voided' :
                 invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
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
              <p className="font-medium">{format(new Date(invoice.created_at), 'MMM d, yyyy')}</p>
            </div>
          </div>

          {/* Dates - Compact Inline */}
          {(linkedJobNumber || invoice.due_date || invoice.paid_at) && (
            <>
              <Separator className="my-2" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                {linkedJobNumber && (
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> Linked Job
                    </p>
                    <p className="font-medium">{linkedJobNumber}</p>
                  </div>
                )}
                {invoice.due_date && (
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Due Date
                    </p>
                    <p className="font-medium">{format(new Date(invoice.due_date), 'MMM d, yyyy')}</p>
                  </div>
                )}
                {invoice.paid_at && (
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Paid
                    </p>
                    <p className="font-medium text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {format(new Date(invoice.paid_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Voided Info Banner */}
          {isVoided && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Ban className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-destructive text-sm">This invoice has been voided</p>
                  {voidInfo && (
                    <>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Date:</span> {voidInfo.date}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Reason:</span> {voidInfo.reason}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Items Section - Compact */}
          <Separator className="my-2" />
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2 text-sm">
              <List className="w-3.5 h-3.5" /> 
              Items
              {(invoice.items?.length || 0) > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {invoice.items?.length}
                </Badge>
              )}
            </h4>
            {invoice.items && invoice.items.length > 0 ? (
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
                  {invoice.items.map((item) => (
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
                      <span className="text-xs">${formatAmount(invoice.subtotal)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground text-xs">
                        Discount{invoice.discount_type === 'percentage' && invoice.discount_value ? ` (${invoice.discount_value}%)` : ''}
                      </span>
                      <span className="text-xs">
                        -${invoice.discount_value ? formatAmount(
                          invoice.discount_type === 'percentage'
                            ? (Number(invoice.subtotal) * Number(invoice.discount_value)) / 100
                            : Number(invoice.discount_value)
                        ) : '0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground text-xs">Tax</span>
                      <span className="text-xs">${formatAmount(invoice.tax)}</span>
                    </div>
                    <div className="flex justify-between font-medium gap-4">
                      <span className="text-xs">Invoice Total</span>
                      <span className="text-xs">${formatAmount(invoice.total)}</span>
                    </div>
                    {hasLateFee && (
                      <div className="flex justify-between text-xs text-destructive">
                        <span className="flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Late Fee {lateFeePercentage > 0 ? `(${lateFeePercentage}%)` : ''}
                        </span>
                        <span>+${formatAmount(invoice.late_fee_amount)}</span>
                      </div>
                    )}
                    {totalPaid > 0 && (
                      <div className="flex justify-between text-xs text-green-600 dark:text-green-400">
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Paid
                        </span>
                        <span>-${formatAmount(totalPaid)}</span>
                      </div>
                    )}
                    <div className={`flex justify-between font-bold pt-1 border-t ${remainingBalance > 0 && invoice.status !== 'paid' ? 'border-destructive/30' : ''}`}>
                      <span className="text-xs">
                        {remainingBalance > 0 && invoice.status !== 'paid' ? 'Balance Due' : 'Total'}
                      </span>
                      <span className={`text-xs ${remainingBalance > 0 && invoice.status !== 'paid' ? 'text-destructive' : ''}`}>
                        ${remainingBalance > 0 ? formatAmount(remainingBalance) : formatAmount(totalDue)}
                      </span>
                    </div>
                    {canApplyLateFee && onApplyLateFee && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full mt-2 h-7 text-xs"
                        onClick={() => onApplyLateFee(invoice.id)}
                        disabled={isApplyingLateFee}
                      >
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Apply {lateFeePercentage}% Late Fee
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">No items added yet</p>
              </div>
            )}
          </div>

          {/* Payment History */}
          {payments.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2 text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Payment History ({payments.length})
                </h4>
                <div className="space-y-1.5">
                  {payments.map((payment) => {
                    const isCompleted = payment.status === 'completed';
                    const isRefunded = payment.status === 'refunded';
                    const isVoided = payment.status === 'voided';
                    
                    return (
                      <div 
                        key={payment.id} 
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1.5 px-2 rounded text-sm ${
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
                          <span className={`font-medium text-xs ${
                            isCompleted 
                              ? 'text-green-700 dark:text-green-400' 
                              : isRefunded 
                                ? 'text-orange-700 dark:text-orange-400 line-through' 
                                : 'text-muted-foreground line-through'
                          }`}>
                            ${Number(payment.amount).toFixed(2)}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {formatPaymentMethod(payment.method)}
                          </Badge>
                          {isRefunded && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-300">
                              Refunded
                            </Badge>
                          )}
                          {isVoided && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">
                              Voided
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
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
                                  className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                                >
                                  <MoreHorizontal className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={() => handleDownloadReceipt(payment.id)}
                                  disabled={receiptLoadingId === payment.id}
                                >
                                  {receiptLoadingId === payment.id ? (
                                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                  ) : (
                                    <FileDown className="w-3 h-3 mr-2" />
                                  )}
                                  Download Receipt
                                </DropdownMenuItem>
                                {customerEmail && (
                                  <DropdownMenuItem 
                                    onClick={() => handleEmailReceipt(payment.id)}
                                    disabled={receiptLoadingId === payment.id}
                                  >
                                    {receiptLoadingId === payment.id ? (
                                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                    ) : (
                                      <Mail className="w-3 h-3 mr-2" />
                                    )}
                                    Email Receipt
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
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
                                <DropdownMenuSeparator />
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
                            <span className="italic text-[10px]" title={payment.refund_reason}>
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
          {invoice.status === 'paid' && totalPaid >= totalDue ? (
            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium text-xs">
                Paid in full on {invoice.paid_at ? format(new Date(invoice.paid_at), 'MMM d, yyyy') : 'N/A'}
              </span>
            </div>
          ) : totalPaid > 0 ? (
            <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-700 dark:text-yellow-400">
              <Clock className="w-4 h-4 shrink-0" />
              <span className="font-medium text-xs">
                Partial payment received - ${remainingBalance.toFixed(2)} remaining
              </span>
            </div>
          ) : invoice.due_date && new Date(invoice.due_date) < new Date() ? (
            <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-400">
              <Clock className="w-4 h-4 shrink-0" />
              <span className="font-medium text-xs">Overdue - was due on {format(new Date(invoice.due_date), 'MMM d, yyyy')}</span>
            </div>
          ) : null}

          {/* Notes */}
          {invoice.notes && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2 text-sm flex items-center gap-2">
                  <StickyNote className="w-4 h-4" /> Notes
                </h4>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
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
                  signatureId={(invoice as any).signature_id}
                  title="Customer Signature"
                  onCollectSignature={onCollectSignature ? () => onCollectSignature(invoice.id) : undefined}
                  showCollectButton={invoice.status !== 'paid' && !!onCollectSignature}
                  collectButtonText="Collect Signature"
                  isCollecting={isCollectingSignature}
                  paidOnline={(invoice as any).paid_online}
                />
              </ConstrainedPanel>
            </div>

            {/* Send Signature Request Button */}
            {invoice.status !== 'paid' && !(invoice as any).signature_id && customerEmail && onSendSignatureRequest && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onSendSignatureRequest(invoice.id)}
                className="mt-2"
              >
                <Send className="w-4 h-4 mr-2" />
                Send Signature Request via Email
              </Button>
            )}
          </div>

          {/* Reminder History */}
          {reminders.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2 text-sm flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Payment Reminders Sent ({reminders.length})
                </h4>
                <div className="space-y-1.5">
                  {reminders.map((reminder) => (
                    <div key={reminder.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1.5 px-2 bg-muted/50 rounded text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground">{reminder.recipient_email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
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

          {/* Tabs for Photos and Linked Docs - At bottom like Job */}
          <Separator />
          <Tabs defaultValue="photos" className="w-full">
            <TabsList className="w-full grid grid-cols-2 h-auto p-1">
              <TabsTrigger value="photos" className="flex items-center gap-1 text-xs sm:text-sm px-1">
                <ImageIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Photos</span>
                {invoicePhotos.length > 0 && (
                  <Badge variant="secondary" className="ml-0.5 text-xs hidden sm:inline-flex">
                    {invoicePhotos.length}
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

            {/* Linked Docs Tab */}
            <TabsContent value="linked" className="mt-4">
              <div>
                <h4 className="font-medium mb-2 text-sm flex items-center gap-2">
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
                        <Badge className={`${quoteStatusColors[linkedQuote.status] || 'bg-muted'} capitalize`}>
                          {linkedQuote.status === 'accepted' ? 'approved' : linkedQuote.status}
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
                  <p className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
                    No linked quotes or jobs
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer Actions - Fixed at bottom */}
        <div className="border-t bg-background p-4 sm:px-6">
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            <Button variant="outline" size="sm" onClick={() => onDownload?.(invoice.id)} className="justify-center">
              <FileDown className="w-4 h-4 mr-1" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEmailActionDialogOpen(true)} className="justify-center">
              <Mail className="w-4 h-4 mr-1" />
              Email
            </Button>
            {invoice.status !== 'paid' && remainingBalance > 0 && (
              <>
                <Button 
                  size="sm" 
                  onClick={() => setRecordPaymentDialogOpen(true)}
                  className="bg-green-600 hover:bg-green-700 justify-center"
                >
                  <DollarSign className="w-4 h-4 mr-1" />
                  Payment
                </Button>
                {company?.stripe_payments_enabled !== false && (
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={handleGeneratePaymentLink}
                    disabled={isGeneratingPaymentLink}
                    className="justify-center"
                  >
                    {isGeneratingPaymentLink ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4 mr-1" />
                    )}
                    Pay Online
                  </Button>
                )}
              </>
            )}
            {invoice.status !== 'paid' && invoice.status !== 'voided' && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setVoidInvoiceDialogOpen(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 justify-center"
              >
                <Ban className="w-4 h-4 mr-1" />
                Void
              </Button>
            )}
            <Button size="sm" onClick={() => onEdit?.(invoice.id)} className="sm:ml-auto justify-center">
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          </div>
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

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={recordPaymentDialogOpen}
        onOpenChange={setRecordPaymentDialogOpen}
        invoiceTotal={totalDue}
        remainingBalance={remainingBalance}
        invoiceNumber={invoice.invoice_number}
        customerEmail={customerEmail}
        onConfirm={handleRecordPayment}
        isLoading={createPayment.isPending}
        onSwitchToSplit={() => {
          setRecordPaymentDialogOpen(false);
          setSplitPaymentDialogOpen(true);
        }}
      />

      {/* Split Payment Dialog */}
      <SplitPaymentDialog
        open={splitPaymentDialogOpen}
        onOpenChange={setSplitPaymentDialogOpen}
        invoiceTotal={totalDue}
        remainingBalance={remainingBalance}
        invoiceNumber={invoice.invoice_number}
        customerEmail={customerEmail}
        onConfirm={handleSplitPayment}
        isLoading={createPayment.isPending}
      />

      {/* Void Invoice Dialog */}
      <VoidInvoiceDialog
        open={voidInvoiceDialogOpen}
        onOpenChange={setVoidInvoiceDialogOpen}
        invoiceNumber={invoice.invoice_number}
        customerEmail={customerEmail}
        onConfirm={handleVoidInvoice}
        isLoading={voidInvoice.isPending}
      />

      {/* Email Action Dialog */}
      <InvoiceEmailActionDialog
        open={emailActionDialogOpen}
        onOpenChange={setEmailActionDialogOpen}
        invoiceNumber={invoice.invoice_number}
        customerName={customerName}
        customerEmail={customerEmail}
        companyName={company?.name}
        companyPhone={company?.phone || ''}
        companyEmail={company?.email || ''}
        invoiceTotal={totalDue}
        dueDate={invoice.due_date || undefined}
        invoiceId={invoice.id}
        onSendInvoice={handleSendInvoiceEmail}
        onSendReminder={handleSendReminderEmail}
        isSendingInvoice={isSendingEmail}
        isSendingReminder={isSendingReminder}
        showReminderOption={invoice.status !== 'paid'}
      />
    </Dialog>
  );
}
