import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, UserCircle, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CustomerOnboardingFlowProps {
  onBack: () => void;
  onComplete: () => void;
}

const CustomerOnboardingFlow = ({ onBack, onComplete }: CustomerOnboardingFlowProps) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      // Add customer role to user_roles table
      const { error: roleError } = await (supabase as any)
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'customer',
        });

      if (roleError && !roleError.message.includes('duplicate')) {
        throw roleError;
      }

      // Update profile role
      const { error: profileError } = await (supabase as any)
        .from('profiles')
        .update({ role: 'customer' })
        .eq('id', user.id);

      if (profileError) throw profileError;

      toast.success('Welcome! You can now access the customer portal.');
      onComplete();
    } catch (error: any) {
      console.error('Customer setup error:', error);
      toast.error('Failed to set up customer account: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
      <div className="w-full max-w-md animate-scale-in">
        <Button 
          variant="ghost" 
          className="mb-4 text-primary-foreground hover:bg-primary-foreground/10"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 mb-4 shadow-lg">
            <UserCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-primary-foreground">Customer Account</h1>
          <p className="text-primary-foreground/80 mt-2">Access your service history and documents</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle>Customer Portal Access</CardTitle>
            <CardDescription>
              As a customer, you'll be able to:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm">View and approve quotes from service providers</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm">Access and pay invoices online</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm">Review your service history</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm">Communicate with your service provider</span>
              </li>
            </ul>

            <div className="pt-4">
              <Button onClick={handleContinue} className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Continue as Customer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerOnboardingFlow;
