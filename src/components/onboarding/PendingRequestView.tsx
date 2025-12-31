import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, XCircle, RefreshCw, Loader2 } from 'lucide-react';

interface PendingRequestViewProps {
  onStartNew: () => void;
}

const PendingRequestView = ({ onStartNew }: PendingRequestViewProps) => {
  const { user } = useAuth();

  const { data: pendingRequest, isLoading, refetch } = useQuery({
    queryKey: ['my-join-request', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await (supabase as any)
        .from('join_requests')
        .select('*, companies(name)')
        .eq('user_id', user.id)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // Poll every 10 seconds to check for approval
  });

  const handleRefresh = () => {
    refetch().then(() => {
      // If the request was approved, the profile should now have company_id
      // Reload the page to trigger the ProtectedRoute check
      if (pendingRequest?.status === 'approved') {
        window.location.reload();
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
        <div className="animate-pulse text-primary-foreground">Checking request status...</div>
      </div>
    );
  }

  if (!pendingRequest || pendingRequest.status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
        <div className="w-full max-w-md animate-scale-in">
          <Card className="shadow-lg border-0">
            <CardContent className="p-8 text-center">
              {pendingRequest?.status === 'rejected' ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-8 h-8 text-destructive" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Request Not Approved</h2>
                  <p className="text-muted-foreground mb-6">
                    Your request to join <strong>{pendingRequest.companies?.name}</strong> was not approved.
                    You can try joining a different company or create your own.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">No Pending Request</h2>
                  <p className="text-muted-foreground mb-6">
                    You don't have any pending company join requests.
                  </p>
                </>
              )}
              <Button onClick={onStartNew} className="w-full">
                Start New Request or Create Company
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (pendingRequest.status === 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
        <div className="w-full max-w-md animate-scale-in">
          <Card className="shadow-lg border-0">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Request Approved!</h2>
              <p className="text-muted-foreground mb-6">
                Your request to join <strong>{pendingRequest.companies?.name}</strong> has been approved!
                {pendingRequest.assigned_role && (
                  <> You've been assigned the role of <strong>{pendingRequest.assigned_role}</strong>.</>
                )}
              </p>
              <Button onClick={() => window.location.reload()} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Continue to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Pending status
  return (
    <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
      <div className="w-full max-w-md animate-scale-in">
        <Card className="shadow-lg border-0">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Waiting for Approval</h2>
            <p className="text-muted-foreground mb-6">
              Your request to join <strong>{pendingRequest.companies?.name}</strong> is pending approval.
              The company admin will review your request shortly.
            </p>
            <div className="space-y-3">
              <Button onClick={handleRefresh} variant="outline" className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Check Status
              </Button>
              <Button onClick={onStartNew} variant="ghost" className="w-full text-muted-foreground">
                Cancel and Start Over
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PendingRequestView;