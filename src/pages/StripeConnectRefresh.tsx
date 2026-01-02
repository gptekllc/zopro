import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const StripeConnectRefresh = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refreshOnboarding = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('stripe-connect-refresh');
        
        if (error) throw new Error(error.message);
        if (!data?.url) throw new Error('No onboarding URL returned');

        // Redirect to new onboarding link
        window.location.href = data.url;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to refresh onboarding link';
        setError(message);
        setIsLoading(false);
        toast.error(message);
      }
    };

    refreshOnboarding();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Refreshing your Stripe onboarding link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertCircle className="w-16 h-16 text-amber-500" />
          </div>
          <CardTitle className="text-2xl">Link Expired</CardTitle>
          <CardDescription>
            {error || 'Your Stripe onboarding link has expired. Please try again.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => navigate('/company')} className="w-full gap-2">
            <RefreshCw className="w-4 h-4" />
            Return to Company Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default StripeConnectRefresh;
