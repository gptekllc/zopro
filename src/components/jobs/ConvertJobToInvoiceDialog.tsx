import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, FileText, ImageIcon } from 'lucide-react';

interface ConvertJobToInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (copyPhotos: boolean) => void;
  isProcessing?: boolean;
  jobNumber?: string;
}

export function ConvertJobToInvoiceDialog({
  open,
  onOpenChange,
  onConfirm,
  isProcessing = false,
  jobNumber,
}: ConvertJobToInvoiceDialogProps) {
  const [copyPhotos, setCopyPhotos] = useState(true);

  const handleConfirm = () => {
    onConfirm(copyPhotos);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Create Invoice from Job {jobNumber}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              <p>This will create a new invoice from the job details.</p>
              
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="copy-photos"
                    checked={copyPhotos}
                    onCheckedChange={(checked) => setCopyPhotos(checked as boolean)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="copy-photos"
                      className="flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <ImageIcon className="w-4 h-4" />
                      Copy Photos to Invoice
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Include all job photos in the new invoice
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Create Invoice
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
