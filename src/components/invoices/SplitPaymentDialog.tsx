import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { PAYMENT_METHODS, PaymentMethod } from './RecordPaymentDialog';

export interface SplitPaymentItem {
  id: string;
  method: PaymentMethod;
  amount: string;
}

export interface SplitPaymentData {
  payments: { method: PaymentMethod; amount: number }[];
  date: Date;
  note: string;
  sendNotification: boolean;
}

interface SplitPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceTotal: number;
  remainingBalance: number;
  invoiceNumber: string;
  customerEmail?: string | null;
  onConfirm: (data: SplitPaymentData) => void;
  isLoading?: boolean;
}

export function SplitPaymentDialog({
  open,
  onOpenChange,
  invoiceTotal,
  remainingBalance,
  invoiceNumber,
  customerEmail,
  onConfirm,
  isLoading = false,
}: SplitPaymentDialogProps) {
  const [payments, setPayments] = useState<SplitPaymentItem[]>([
    { id: '1', method: 'cash', amount: '' },
    { id: '2', method: 'credit_debit', amount: '' },
  ]);
  const [date, setDate] = useState<Date>(new Date());
  const [note, setNote] = useState('');
  const [sendNotification, setSendNotification] = useState(true);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      const balance = remainingBalance ?? invoiceTotal ?? 0;
      const halfAmount = (balance / 2).toFixed(2);
      setPayments([
        { id: '1', method: 'cash', amount: halfAmount },
        { id: '2', method: 'credit_debit', amount: halfAmount },
      ]);
      setDate(new Date());
      setNote('');
      setSendNotification(!!customerEmail);
    }
  }, [open, remainingBalance, customerEmail]);

  const totalEntered = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const difference = remainingBalance - totalEntered;

  const handleAddPayment = () => {
    setPayments([
      ...payments,
      { id: Date.now().toString(), method: 'cash', amount: '' },
    ]);
  };

  const handleRemovePayment = (id: string) => {
    if (payments.length > 2) {
      setPayments(payments.filter((p) => p.id !== id));
    }
  };

  const handlePaymentChange = (id: string, field: 'method' | 'amount', value: string) => {
    setPayments(
      payments.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validPayments = payments
      .filter((p) => parseFloat(p.amount) > 0)
      .map((p) => ({
        method: p.method,
        amount: parseFloat(p.amount),
      }));

    if (validPayments.length === 0) return;

    onConfirm({
      payments: validPayments,
      date,
      note,
      sendNotification,
    });
  };

  const isValid = totalEntered > 0 && payments.some((p) => parseFloat(p.amount) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Split Payment for {invoiceNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Payment splits */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Payment Methods</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddPayment}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Method
              </Button>
            </div>
            
            {payments.map((payment, index) => (
              <div key={payment.id} className="flex gap-2 items-start">
                <div className="flex-1">
                  <Select
                    value={payment.method}
                    onValueChange={(v) => handlePaymentChange(payment.id, 'method', v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={payment.amount}
                      onChange={(e) => handlePaymentChange(payment.id, 'amount', e.target.value)}
                      className="pl-6 h-9"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {payments.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemovePayment(payment.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance Due</span>
              <span>${remainingBalance.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Entered</span>
              <span className={totalEntered > remainingBalance ? 'text-orange-600' : ''}>
                ${totalEntered.toFixed(2)}
              </span>
            </div>
            {difference !== 0 && (
              <div className="flex justify-between font-medium pt-1 border-t">
                <span>{difference > 0 ? 'Remaining' : 'Overpayment'}</span>
                <span className={difference > 0 ? 'text-destructive' : 'text-orange-600'}>
                  ${Math.abs(difference).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this payment..."
              rows={2}
            />
          </div>

          {customerEmail && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendNotification"
                checked={sendNotification}
                onCheckedChange={(checked) => setSendNotification(checked === true)}
              />
              <Label htmlFor="sendNotification" className="text-sm font-normal cursor-pointer">
                Send payment confirmation email to customer
              </Label>
            </div>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !isValid}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Record Split Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
