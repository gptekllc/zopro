import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PenTool, Calendar, User, Globe, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
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

interface SignatureSectionProps {
  signatureId: string | null | undefined;
  title?: string;
  onCollectSignature?: () => void;
  showCollectButton?: boolean;
  collectButtonText?: string;
  isCollecting?: boolean;
  onClearSignature?: () => void;
  isClearing?: boolean;
  showClearButton?: boolean;
  paidOnline?: boolean;
}

interface Signature {
  id: string;
  signature_data: string;
  signer_name: string;
  signer_ip: string | null;
  signed_at: string;
  document_type: string;
  document_id: string;
}

export function SignatureSection({
  signatureId,
  title = 'Digital Signature',
  onCollectSignature,
  showCollectButton = true,
  collectButtonText = 'Collect Signature',
  isCollecting = false,
  onClearSignature,
  isClearing = false,
  showClearButton = true,
  paidOnline = false,
}: SignatureSectionProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const { data: signature, isLoading } = useQuery({
    queryKey: ['signature', signatureId],
    queryFn: async () => {
      if (!signatureId) return null;
      const { data, error } = await supabase
        .from('signatures')
        .select('*')
        .eq('id', signatureId)
        .maybeSingle();
      if (error) throw error;
      return data as Signature | null;
    },
    enabled: !!signatureId,
  });

  const handleClearClick = () => {
    setShowClearConfirm(true);
  };

  const handleConfirmClear = () => {
    setShowClearConfirm(false);
    onClearSignature?.();
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <PenTool className="w-3 h-3" />
          {title}
        </p>
        <Card>
          <CardContent className="p-4 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!signatureId || !signature) {
    // No signature yet - but if paid online, show that instead
    if (paidOnline) {
      return (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <PenTool className="w-3 h-3" />
            {title}
          </p>
          <Card className="border-success/30 bg-success/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="font-medium text-success text-sm">Paid Online via Stripe</p>
                <p className="text-xs text-muted-foreground">No signature required for online payments</p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <PenTool className="w-3 h-3" />
          {title}
        </p>
        <Card className="border-dashed">
          <CardContent className="p-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">No signature collected yet</p>
            {showCollectButton && onCollectSignature && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onCollectSignature}
                disabled={isCollecting}
              >
                {isCollecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <PenTool className="w-4 h-4 mr-2" />
                )}
                {collectButtonText}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <PenTool className="w-3 h-3" />
          {title}
        </p>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4 space-y-3">
            {/* Signature Image */}
            <div className="bg-white rounded-md p-3 border">
              <img 
                src={signature.signature_data} 
                alt="Customer Signature" 
                className="max-w-full h-auto max-h-24 mx-auto"
              />
            </div>

            {/* Signature Details */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span className="font-medium text-foreground">{signature.signer_name}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>{format(new Date(signature.signed_at), 'MMM d, yyyy \'at\' h:mm a')}</span>
              </div>
              {signature.signer_ip && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="w-3.5 h-3.5" />
                  <span className="font-mono text-xs">{signature.signer_ip}</span>
                </div>
              )}
            </div>

            {/* Clear Button */}
            {showClearButton && onClearSignature && (
              <div className="flex justify-end">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleClearClick}
                  disabled={isClearing}
                >
                  {isClearing ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-1" />
                  )}
                  Clear
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Signature?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear this signature? This action will be recorded in the history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClear} className="bg-destructive hover:bg-destructive/90">
              Yes, Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
