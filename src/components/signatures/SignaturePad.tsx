import { useRef, useEffect, useState } from 'react';
import SignaturePadLib from 'signature_pad';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eraser, Check, PenLine } from 'lucide-react';

interface SignaturePadProps {
  title?: string;
  description?: string;
  signerName?: string;
  onSignatureComplete: (signatureData: string, signerName: string) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function SignaturePad({
  title = 'Sign Document',
  description = 'Please sign below to confirm',
  signerName: initialSignerName = '',
  onSignatureComplete,
  onCancel,
  isSubmitting = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePadLib | null>(null);
  const [signerName, setSignerName] = useState(initialSignerName);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    
    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
    }

    // Initialize SignaturePad
    signaturePadRef.current = new SignaturePadLib(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
      minWidth: 1,
      maxWidth: 2.5,
    });

    signaturePadRef.current.addEventListener('endStroke', () => {
      setHasSignature(!signaturePadRef.current?.isEmpty());
    });

    return () => {
      signaturePadRef.current?.off();
    };
  }, []);

  const handleClear = () => {
    signaturePadRef.current?.clear();
    setHasSignature(false);
  };

  const handleSubmit = () => {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      return;
    }
    
    if (!signerName.trim()) {
      return;
    }

    const signatureData = signaturePadRef.current.toDataURL('image/png');
    onSignatureComplete(signatureData, signerName.trim());
  };

  const isValid = hasSignature && signerName.trim().length > 0;

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenLine className="w-5 h-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signer-name">Your Full Name</Label>
          <Input
            id="signer-name"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="Enter your full name"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label>Signature</Label>
          <div className="relative border rounded-lg overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              className="w-full touch-none"
              style={{ height: '150px' }}
            />
            {!hasSignature && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground/50">
                <span className="text-sm">Sign here</span>
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={isSubmitting}
          >
            <Eraser className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>

        <div className="flex gap-2 pt-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? (
              'Submitting...'
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Sign & Confirm
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          By signing, you agree that this electronic signature is legally binding.
        </p>
      </CardContent>
    </Card>
  );
}
