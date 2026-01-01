import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PenTool, Calendar, User, Globe, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface ViewSignatureDialogProps {
  signatureId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function ViewSignatureDialog({
  signatureId,
  open,
  onOpenChange,
}: ViewSignatureDialogProps) {
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
    enabled: !!signatureId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="w-5 h-5 text-primary" />
            Signature Details
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : signature ? (
          <div className="space-y-4">
            {/* Signature Image */}
            <div className="border rounded-lg p-4 bg-white">
              <img 
                src={signature.signature_data} 
                alt="Signature" 
                className="max-w-full h-auto"
              />
            </div>

            {/* Signature Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Signed by</p>
                  <p className="font-medium">{signature.signer_name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Date & Time</p>
                  <p className="font-medium">
                    {format(new Date(signature.signed_at), 'MMM d, yyyy \'at\' h:mm a')}
                  </p>
                </div>
              </div>

              {signature.signer_ip && (
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">IP Address</p>
                    <p className="font-medium font-mono text-sm">{signature.signer_ip}</p>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Document Type: <span className="capitalize">{signature.document_type}</span>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Signature not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}