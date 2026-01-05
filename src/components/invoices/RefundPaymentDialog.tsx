import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, RotateCcw, XCircle } from 'lucide-react';
import { Payment } from '@/hooks/usePayments';
import { PAYMENT_METHODS } from './RecordPaymentDialog';
import { format } from 'date-fns';

type RefundAction = 'refund' | 'void';

interface RefundPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment | null;
  action: RefundAction;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}

export function RefundPaymentDialog({
  open,
  onOpenChange,
  payment,
  action,
  onConfirm,
  isLoading = false,
}: RefundPaymentDialogProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(reason);
  };

  const formatPaymentMethod = (method: string) => {
    const found = PAYMENT_METHODS.find(m => m.value === method);
    return found?.label || method;
  };

  if (!payment) return null;

  const isRefund = action === 'refund';
  const title = isRefund ? 'Refund Payment' : 'Void Payment';
  const description = isRefund 
    ? 'This will mark the payment as refunded. The invoice balance will be updated accordingly.'
    : 'This will void the payment as if it never happened. Use this for payment entry errors.';
  const buttonText = isRefund ? 'Process Refund' : 'Void Payment';
  const Icon = isRefund ? RotateCcw : XCircle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">${Number(payment.amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Method</span>
              <span>{formatPaymentMethod(payment.method)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span>{format(new Date(payment.payment_date), 'MMM d, yyyy')}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason {isRefund ? '(optional)' : '(recommended)'}</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isRefund 
                ? "e.g., Customer requested refund, duplicate payment..."
                : "e.g., Payment entered in error, wrong amount..."
              }
              rows={3}
            />
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant={isRefund ? 'default' : 'destructive'}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {buttonText}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
