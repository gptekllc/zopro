import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Receipt } from 'lucide-react';
import { formatAmount } from '@/lib/formatAmount';

interface Quote {
  id: string;
  quote_number: string;
  total: number;
}

interface ConvertToInvoiceDialogProps {
  quote: Quote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (quoteId: string, copyPhotos: boolean) => Promise<void>;
  isPending: boolean;
}

export function ConvertToInvoiceDialog({
  quote,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: ConvertToInvoiceDialogProps) {
  const [copyPhotos, setCopyPhotos] = useState(true);

  const handleConfirm = async () => {
    if (quote) {
      await onConfirm(quote.id, copyPhotos);
      onOpenChange(false);
    }
  };

  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Convert to Invoice
          </DialogTitle>
          <DialogDescription>
            Create an invoice from {quote.quote_number} (${formatAmount(quote.total)})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Copy Photos Option */}
          <label className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors">
            <Checkbox
              checked={copyPhotos}
              onCheckedChange={(checked) => setCopyPhotos(checked === true)}
            />
            <div className="flex-1">
              <p className="font-medium text-sm">Copy photos to invoice</p>
              <p className="text-xs text-muted-foreground">
                Include all photos from this quote in the new invoice
              </p>
            </div>
          </label>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
