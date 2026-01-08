import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import zoproLogo from '@/assets/ZoPro_Logo.png';

const StripeConnectReturn = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Invalidate company query to refresh Stripe Connect status
    queryClient.invalidateQueries({ queryKey: ['company'] });
  }, [queryClient]);

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
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Stripe Setup Complete</CardTitle>
            <CardDescription>
              Your Stripe account has been connected. You can now accept online payments for invoices.
            </CardDescription>
          </CardHeader>
        <CardContent className="space-y-4">
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
          
          <Button onClick={() => navigate('/company')} className="w-full gap-2">
            Go to Company Settings
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default StripeConnectReturn;
