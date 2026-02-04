import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import zoproLogo from '@/assets/ZoPro_Logo.png';

const StripeConnectReturn = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    onboardingComplete: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  } | null>(null);

  useEffect(() => {
    const syncStatus = async () => {
      try {
        // Call the sync function to update company's Stripe status
        const { data, error } = await supabase.functions.invoke('sync-stripe-connect-status');
        
        if (error) {
          console.error('Error syncing Stripe status:', error);
          setSyncError('Failed to verify Stripe account status');
        } else if (data?.status) {
          setStatus(data.status);
        }
      } catch (err) {
        console.error('Error syncing Stripe status:', err);
        setSyncError('Failed to verify Stripe account status');
      } finally {
        setIsSyncing(false);
        // Invalidate company query to refresh status in the app
        queryClient.invalidateQueries({ queryKey: ['company'] });
      }
    };

    syncStatus();
  }, [queryClient]);

  const isComplete = status?.onboardingComplete && status?.chargesEnabled;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-primary">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-card mb-4 shadow-lg overflow-hidden">
            <img src={zoproLogo} alt="ZoPro Logo" className="w-16 h-16 object-contain" />
          </div>
        </div>
        <Card className="shadow-lg border-0">
          <CardHeader className="text-center">
            {isSyncing ? (
              <>
                <div className="flex justify-center mb-4">
                  <Loader2 className="w-16 h-16 text-primary animate-spin" />
                </div>
                <CardTitle className="text-2xl">Verifying Setup...</CardTitle>
                <CardDescription>
                  Please wait while we verify your Stripe account status.
                </CardDescription>
              </>
            ) : syncError ? (
              <>
                <div className="flex justify-center mb-4">
                  <AlertCircle className="w-16 h-16 text-amber-500" />
                </div>
                <CardTitle className="text-2xl">Verification Issue</CardTitle>
                <CardDescription>
                  {syncError}. Your setup may still be complete - please check Company Settings.
                </CardDescription>
              </>
            ) : isComplete ? (
              <>
                <div className="flex justify-center mb-4">
                  <CheckCircle2 className="w-16 h-16 text-green-500" />
                </div>
                <CardTitle className="text-2xl">Stripe Setup Complete</CardTitle>
                <CardDescription>
                  Your Stripe account has been connected. You can now accept online payments for invoices.
                </CardDescription>
              </>
            ) : (
              <>
                <div className="flex justify-center mb-4">
                  <AlertCircle className="w-16 h-16 text-amber-500" />
                </div>
                <CardTitle className="text-2xl">Setup Incomplete</CardTitle>
                <CardDescription>
                  Your Stripe account setup is not complete yet. Please continue the setup process in Company Settings.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!isSyncing && isComplete && (
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p>
                  <strong>What happens next?</strong>
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Customers can pay invoices online with cards or bank transfers</li>
                  <li>Payments are deposited directly to your bank account</li>
                  <li>Stripe handles all payment processing securely</li>
                </ul>
              </div>
            )}
            
            <Button onClick={() => navigate('/company')} className="w-full gap-2" disabled={isSyncing}>
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Go to Company Settings
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StripeConnectReturn;
