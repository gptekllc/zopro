import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Users, Loader2, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface JoinCompanyFlowProps {
  onBack: () => void;
  onComplete: () => void;
}

const JoinCompanyFlow = ({ onBack, onComplete }: JoinCompanyFlowProps) => {
  const { user, profile } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [companyName, setCompanyName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinCode.trim()) return;

    setIsLoading(true);

    try {
      // Look up the join code
      const { data: codeData, error: codeError } = await (supabase as any)
        .from('company_join_codes')
        .select('*, companies(id, name, email)')
        .eq('code', joinCode.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (codeError) throw codeError;

      if (!codeData) {
        toast.error('Invalid or expired join code');
        setIsLoading(false);
        return;
      }

      // Check if code is expired
      if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
        toast.error('This join code has expired');
        setIsLoading(false);
        return;
      }

      // Check if user already has a pending request for this company
      const { data: existingRequest } = await (supabase as any)
        .from('join_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('company_id', codeData.company_id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingRequest) {
        toast.error('You already have a pending request for this company');
        setIsLoading(false);
        return;
      }

      // Create join request
      const { error: requestError } = await (supabase as any)
        .from('join_requests')
        .insert({
          user_id: user.id,
          company_id: codeData.company_id,
          join_code_id: codeData.id,
        });

      if (requestError) throw requestError;

      // Create in-app notification for company admins
      const { data: admins } = await (supabase as any)
        .from('profiles')
        .select('id, email, full_name')
        .eq('company_id', codeData.company_id)
        .eq('role', 'admin');

      // Send notifications to admins
      if (admins && admins.length > 0) {
        for (const admin of admins) {
          // In-app notification
          await (supabase as any)
            .from('notifications')
            .insert({
              user_id: admin.id,
              type: 'join_request',
              title: 'New Join Request',
              message: `${profile?.full_name || profile?.email || 'A user'} has requested to join your company.`,
              data: { 
                requesterId: user.id, 
                requesterName: profile?.full_name,
                requesterEmail: profile?.email 
              },
            });

          // Email notification
          try {
            await supabase.functions.invoke('send-notification', {
              body: {
                type: 'join_request_admin',
                recipientEmail: admin.email,
                recipientName: admin.full_name || 'Admin',
                requesterName: profile?.full_name || profile?.email || 'A user',
                requesterEmail: profile?.email,
                companyName: codeData.companies?.name,
              },
            });
          } catch (emailError) {
            console.error('Failed to send admin notification email:', emailError);
          }
        }
      }

      setCompanyName(codeData.companies?.name || 'the company');
      setRequestSubmitted(true);
      toast.success('Join request submitted successfully!');
    } catch (error: any) {
      console.error('Join request error:', error);
      toast.error('Failed to submit join request: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (requestSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
        <div className="w-full max-w-md animate-scale-in">
          <Card className="shadow-lg border-0">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Request Submitted!</h2>
              <p className="text-muted-foreground mb-6">
                Your request to join <strong>{companyName}</strong> has been sent to the company admin. 
                You'll receive a notification when your request is approved.
              </p>
              <Button onClick={onComplete} className="w-full">
                Continue to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 mb-4 shadow-lg">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-primary-foreground">Join a Company</h1>
          <p className="text-primary-foreground/80 mt-2">Enter the join code provided by your employer</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle>Enter Join Code</CardTitle>
            <CardDescription>
              Ask your company administrator for the join code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="joinCode">Join Code *</Label>
                <Input
                  id="joinCode"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter code (e.g., ABC123)"
                  className="text-center text-lg tracking-widest font-mono"
                  maxLength={10}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !joinCode.trim()}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit Request
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default JoinCompanyFlow;
