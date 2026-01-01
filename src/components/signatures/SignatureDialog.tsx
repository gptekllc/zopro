import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SignaturePad } from './SignaturePad';

interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  signerName?: string;
  onSignatureComplete: (signatureData: string, signerName: string) => void;
  isSubmitting?: boolean;
}

export function SignatureDialog({
  open,
  onOpenChange,
  title = 'Sign Document',
  description = 'Please sign below to confirm',
  signerName = '',
  onSignatureComplete,
  isSubmitting = false,
}: SignatureDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <SignaturePad
          title={title}
          description={description}
          signerName={signerName}
          onSignatureComplete={onSignatureComplete}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
}
