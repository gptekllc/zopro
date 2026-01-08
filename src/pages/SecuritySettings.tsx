import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '@/components/layout/PageContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Shield, ShieldCheck, ShieldOff, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCompany, useUpdateCompany } from '@/hooks/useCompany';
import MFAEnrollment from '@/components/auth/MFAEnrollment';
import { toast } from 'sonner';
import { format } from 'date-fns';

const SecuritySettings = () => {
  const navigate = useNavigate();
  const { profile, isAdmin, mfaFactors, listMFAFactors, unenrollMFA, refreshMFAStatus } = useAuth();
  const { data: company } = useCompany();
  const updateCompany = useUpdateCompany();
  
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isLoadingFactors, setIsLoadingFactors] = useState(true);
  const [isUnenrolling, setIsUnenrolling] = useState(false);

  const hasMFA = mfaFactors.length > 0;
  const verifiedFactor = mfaFactors.find(f => f.status === 'verified');

  useEffect(() => {
    const loadFactors = async () => {
      setIsLoadingFactors(true);
      await listMFAFactors();
      setIsLoadingFactors(false);
    };
    loadFactors();
  }, []);

  const handleEnrollmentComplete = async () => {
    setIsEnrolling(false);
    await listMFAFactors();
    await refreshMFAStatus();
    toast.success('Two-factor authentication enabled');
  };

  const handleUnenroll = async () => {
    if (!verifiedFactor) return;
    
    setIsUnenrolling(true);
    try {
      const result = await unenrollMFA(verifiedFactor.id);
      if (result.error) {
        toast.error(result.error.message || 'Failed to disable 2FA');
      } else {
        await listMFAFactors();
        await refreshMFAStatus();
        toast.success('Two-factor authentication disabled');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to disable 2FA');
    } finally {
      setIsUnenrolling(false);
    }
  };

  const handleRequireMFAToggle = async (checked: boolean) => {
    if (!company) return;
    
    try {
      await updateCompany.mutateAsync({
        id: company.id,
        require_mfa: checked,
      });
      toast.success(checked ? 'MFA is now required for all team members' : 'MFA requirement removed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update setting');
    }
  };

  if (isEnrolling) {
    return (
      <PageContainer>
        <div className="max-w-md mx-auto py-8">
          <MFAEnrollment 
            onComplete={handleEnrollmentComplete}
            onCancel={() => setIsEnrolling(false)}
          />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* MFA Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {hasMFA ? (
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-green-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Shield className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <CardTitle>Two-Factor Authentication</CardTitle>
                  <CardDescription>
                    Secure your account with an authenticator app
                  </CardDescription>
                </div>
              </div>
              <Badge variant={hasMFA ? 'default' : 'secondary'}>
                {hasMFA ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingFactors ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : hasMFA && verifiedFactor ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Authenticator App</p>
                    <p className="text-sm text-muted-foreground">
                      Added {format(new Date(verifiedFactor.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={isUnenrolling}>
                        {isUnenrolling ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will make your account less secure. You'll need to set up 2FA again if you want to re-enable it.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUnenroll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Disable 2FA
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Two-factor authentication adds an extra layer of security by requiring a code from your authenticator app when signing in.
                </p>
                <Button onClick={() => setIsEnrolling(true)}>
                  <Shield className="h-4 w-4 mr-2" />
                  Enable Two-Factor Authentication
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Controls */}
        {isAdmin && company && (
          <Card>
            <CardHeader>
              <CardTitle>Team Security Policy</CardTitle>
              <CardDescription>
                Manage security requirements for your team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="require-mfa">Require MFA for all team members</Label>
                  <p className="text-sm text-muted-foreground">
                    Team members without MFA will be prompted to set it up
                  </p>
                </div>
                <Switch
                  id="require-mfa"
                  checked={company.require_mfa || false}
                  onCheckedChange={handleRequireMFAToggle}
                  disabled={updateCompany.isPending}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Button variant="ghost" onClick={() => navigate(-1)}>
          ← Back
        </Button>
      </div>
    </PageContainer>
  );
};

export default SecuritySettings;
