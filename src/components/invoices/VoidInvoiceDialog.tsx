import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface VoidInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  customerEmail?: string | null;
  onConfirm: (reason: string, sendNotification: boolean) => Promise<void>;
  isLoading?: boolean;
}

export function VoidInvoiceDialog({
  open,
  onOpenChange,
  invoiceNumber,
  customerEmail,
  onConfirm,
  isLoading = false,
}: VoidInvoiceDialogProps) {
  const [reason, setReason] = useState('');
  const [sendNotification, setSendNotification] = useState(!!customerEmail);

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    await onConfirm(reason.trim(), sendNotification);
    setReason('');
    setSendNotification(!!customerEmail);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setReason('');
      setSendNotification(!!customerEmail);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Void Invoice {invoiceNumber}
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. The invoice will be marked as voided and no payments can be recorded against it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="void-reason">Reason for voiding <span className="text-destructive">*</span></Label>
            <Textarea
              id="void-reason"
              placeholder="Enter reason for voiding this invoice..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {customerEmail && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify-customer"
                checked={sendNotification}
                onCheckedChange={(checked) => setSendNotification(checked === true)}
              />
              <Label htmlFor="notify-customer" className="text-sm font-normal cursor-pointer">
                Notify customer via email
              </Label>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Voiding...
              </>
            ) : (
              'Void Invoice'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
