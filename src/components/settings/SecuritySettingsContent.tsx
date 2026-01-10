import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Shield, ShieldCheck, Loader2, Trash2, LogOut, Monitor, Smartphone, Users, RotateCcw, Laptop, TabletSmartphone, Link2, Unlink, Key, Eye, EyeOff, Check, X, Mail, MailCheck, RefreshCw, AlertTriangle, KeyRound, UserX } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCompany, useUpdateCompany } from '@/hooks/useCompany';
import { useProfiles } from '@/hooks/useProfiles';
import { useTrustedDevices } from '@/hooks/useTrustedDevices';
import { useTrustedDevice } from '@/hooks/useTrustedDevice';
import MFAEnrollment from '@/components/auth/MFAEnrollment';
import PasswordStrength from '@/components/auth/PasswordStrength';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';

interface SecuritySettingsContentProps {
  mode?: 'personal' | 'admin' | 'all';
}

const SecuritySettingsContent = ({ mode = 'all' }: SecuritySettingsContentProps) => {
  const navigate = useNavigate();
  const { profile, isAdmin, mfaFactors, listMFAFactors, unenrollMFA, refreshMFAStatus, session } = useAuth();
  const { data: company } = useCompany();
  const { data: teamMembers } = useProfiles();
  const updateCompany = useUpdateCompany();
  const { devices, isLoading: isLoadingDevices, revokeDevice, revokeAllDevices, isRevoking, isRevokingAll } = useTrustedDevices();
  const { getStoredToken, clearStoredToken } = useTrustedDevice();
  
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isLoadingFactors, setIsLoadingFactors] = useState(true);
  const [isUnenrolling, setIsUnenrolling] = useState(false);
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [forceResetUserId, setForceResetUserId] = useState<string | null>(null);
  const [forceResetAll, setForceResetAll] = useState(false);
  const [forceSignoutUserId, setForceSignoutUserId] = useState<string | null>(null);
  const [forceSignoutAll, setForceSignoutAll] = useState(false);
  
  // Connected accounts state
  const [identities, setIdentities] = useState<any[]>([]);
  const [isLoadingIdentities, setIsLoadingIdentities] = useState(true);
  const [isUnlinking, setIsUnlinking] = useState<string | null>(null);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  
  // Password setup state
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  
  // Email verification state
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const emailVerified = session?.user?.email_confirmed_at != null;
  const userEmail = session?.user?.email;

  // Email change state
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailChangeConfirmOpen, setEmailChangeConfirmOpen] = useState(false);

  // Get current device token to identify it in the list
  const currentDeviceToken = getStoredToken();

  const hasMFA = mfaFactors.length > 0;
  const verifiedFactor = mfaFactors.find(f => f.status === 'verified');

  // Filter team members excluding self
  const otherTeamMembers = teamMembers?.filter(m => m.id !== profile?.id && m.employment_status !== 'terminated') || [];

  useEffect(() => {
    const loadFactors = async () => {
      setIsLoadingFactors(true);
      await listMFAFactors();
      setIsLoadingFactors(false);
    };
    loadFactors();
  }, []);

  // Load connected identities
  useEffect(() => {
    const loadIdentities = async () => {
      setIsLoadingIdentities(true);
      try {
        const { data, error } = await supabase.auth.getUserIdentities();
        if (error) throw error;
        setIdentities(data?.identities || []);
        // Check if user has email/password identity
        const emailIdentity = data?.identities?.find(i => i.provider === 'email');
        setHasPassword(!!emailIdentity);
      } catch (error) {
        console.error('Failed to load identities:', error);
      } finally {
        setIsLoadingIdentities(false);
      }
    };
    loadIdentities();
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

  const handleResetUserMFA = async (userId: string, userName: string) => {
    setResettingUserId(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      const response = await supabase.functions.invoke('reset-user-mfa', {
        body: { userId }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to reset MFA');
      }

      toast.success(`MFA reset for ${userName}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset MFA');
    } finally {
      setResettingUserId(null);
    }
  };

  const handleForcePasswordReset = async (userId?: string, userName?: string) => {
    if (userId) {
      setForceResetUserId(userId);
    } else {
      setForceResetAll(true);
    }
    try {
      const response = await supabase.functions.invoke('force-password-reset', {
        body: userId ? { userId } : { allMembers: true }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send password reset');
      }

      if (userId && userName) {
        toast.success(`Password reset email sent to ${userName}`);
      } else {
        toast.success('Password reset emails sent to all team members');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send password reset');
    } finally {
      setForceResetUserId(null);
      setForceResetAll(false);
    }
  };

  const handleForceSignout = async (userId?: string, userName?: string) => {
    if (userId) {
      setForceSignoutUserId(userId);
    } else {
      setForceSignoutAll(true);
    }
    try {
      const response = await supabase.functions.invoke('force-signout-user', {
        body: userId ? { userId } : { allMembers: true }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to sign out user');
      }

      if (userId && userName) {
        toast.success(`${userName} has been signed out from all devices`);
      } else {
        toast.success('All team members have been signed out');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign out user');
    } finally {
      setForceSignoutUserId(null);
      setForceSignoutAll(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    setRevokingDeviceId(deviceId);
    try {
      await revokeDevice(deviceId);
      // If revoking the current device, clear the local token
      const device = devices.find(d => d.id === deviceId);
      if (device && currentDeviceToken) {
        // We need to check the device token from the database, but since we don't store it in the response,
        // just clear local storage if any device is revoked to be safe
      }
      clearStoredToken();
      toast.success('Device removed from trusted devices');
    } catch (error: any) {
      toast.error(error.message || 'Failed to revoke device');
    } finally {
      setRevokingDeviceId(null);
    }
  };

  const handleRevokeAllDevices = async () => {
    try {
      await revokeAllDevices();
      clearStoredToken();
      toast.success('All trusted devices have been removed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to revoke devices');
    }
  };

  const getDeviceIcon = (deviceName: string | null) => {
    if (!deviceName) return <Monitor className="w-4 h-4" />;
    const name = deviceName.toLowerCase();
    if (name.includes('mobile') || name.includes('iphone') || name.includes('android')) {
      return <Smartphone className="w-4 h-4" />;
    }
    if (name.includes('ipad') || name.includes('tablet')) {
      return <TabletSmartphone className="w-4 h-4" />;
    }
    return <Laptop className="w-4 h-4" />;
  };

  // Handle unlinking social account
  const handleUnlinkIdentity = async (identity: any) => {
    // Prevent unlinking if it's the only identity and no password set
    if (identities.length <= 1 && !hasPassword) {
      toast.error('Cannot remove your only sign-in method. Set up a password first.');
      return;
    }
    
    setIsUnlinking(identity.id);
    try {
      const { error } = await supabase.auth.unlinkIdentity(identity);
      if (error) throw error;
      
      // Refresh identities
      const { data } = await supabase.auth.getUserIdentities();
      setIdentities(data?.identities || []);
      toast.success(`${getProviderDisplayName(identity.provider)} account disconnected`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect account');
    } finally {
      setIsUnlinking(null);
    }
  };

  // Handle linking Google account
  const handleLinkGoogle = async () => {
    setIsLinkingGoogle(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/security-settings`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || 'Failed to link Google account');
      setIsLinkingGoogle(false);
    }
  };

  // Handle setting up password
  const handleSetPassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    setIsSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      
      // Refresh identities
      const { data } = await supabase.auth.getUserIdentities();
      setIdentities(data?.identities || []);
      const emailIdentity = data?.identities?.find(i => i.provider === 'email');
      setHasPassword(!!emailIdentity);
      
      setNewPassword('');
      setConfirmPassword('');
      setIsSettingPassword(false);
      toast.success(hasPassword ? 'Password updated successfully' : 'Password set up successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to set password');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const getProviderDisplayName = (provider: string) => {
    const names: Record<string, string> = {
      google: 'Google',
      github: 'GitHub',
      email: 'Email/Password',
      facebook: 'Facebook',
      twitter: 'Twitter',
      discord: 'Discord',
      apple: 'Apple',
    };
    return names[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  const getProviderIcon = (provider: string) => {
    // Using simple colored backgrounds with initials for providers
    const colors: Record<string, string> = {
      google: 'bg-red-500',
      github: 'bg-gray-800',
      email: 'bg-blue-500',
      facebook: 'bg-blue-600',
      twitter: 'bg-sky-500',
      discord: 'bg-indigo-500',
      apple: 'bg-gray-900',
    };
    return colors[provider] || 'bg-gray-500';
  };

  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handleResendVerificationEmail = async () => {
    if (!userEmail) {
      toast.error('No email address found');
      return;
    }
    
    setIsResendingVerification(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      
      if (error) throw error;
      toast.success('Verification email sent! Check your inbox.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend verification email');
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail || newEmail === userEmail) {
      toast.error('Please enter a different email address');
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setIsSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      }, {
        emailRedirectTo: `${window.location.origin}/security-settings`,
      });
      
      if (error) throw error;
      
      toast.success('Verification email sent to your new email address. Please check both your current and new email inboxes to confirm the change.');
      setNewEmail('');
      setIsChangingEmail(false);
      setEmailChangeConfirmOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update email');
    } finally {
      setIsSavingEmail(false);
    }
  };

  if (isEnrolling) {
    return (
      <div className="max-w-md mx-auto py-8">
        <MFAEnrollment 
          onComplete={handleEnrollmentComplete}
          onCancel={() => setIsEnrolling(false)}
        />
      </div>
    );
  }

  const showPersonal = mode === 'personal' || mode === 'all';
  const showAdmin = mode === 'admin' || mode === 'all';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Personal Security Features */}
      {showPersonal && (
        <>
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

      {/* Email Verification Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {emailVerified ? (
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <MailCheck className="w-5 h-5 text-green-600" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-amber-600" />
                </div>
              )}
              <div>
                <CardTitle>Email Verification</CardTitle>
                <CardDescription>
                  {userEmail || 'No email associated'}
                </CardDescription>
              </div>
            </div>
            <Badge variant={emailVerified ? 'default' : 'secondary'} className={emailVerified ? 'bg-green-600' : 'bg-amber-500'}>
              {emailVerified ? 'Verified' : 'Unverified'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailVerified ? (
            <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <Check className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-700 dark:text-green-400">
                Your email address has been verified. You can use it for account recovery and notifications.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                <X className="w-4 h-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                    Your email address is not verified
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                    Verify your email to enable account recovery and receive important notifications.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleResendVerificationEmail}
                disabled={isResendingVerification}
                className="w-full"
              >
                {isResendingVerification ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Resend Verification Email
              </Button>
            </div>
          )}

          <Separator className="my-4" />

          {/* Change Email Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Change Email Address</p>
                <p className="text-xs text-muted-foreground">
                  Update your account email address
                </p>
              </div>
              {!isChangingEmail && (
                <Button variant="outline" size="sm" onClick={() => setIsChangingEmail(true)}>
                  <Mail className="h-4 w-4 mr-2" />
                  Change Email
                </Button>
              )}
            </div>
            
            {isChangingEmail && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="new-email">New Email Address</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder="Enter new email address"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    You'll need to verify both your current and new email addresses to complete the change.
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setIsChangingEmail(false); setNewEmail(''); }}>
                    Cancel
                  </Button>
                  <AlertDialog open={emailChangeConfirmOpen} onOpenChange={setEmailChangeConfirmOpen}>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" disabled={!newEmail || newEmail === userEmail || isSavingEmail}>
                        {isSavingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Update Email
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Email Change</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to change your email from <strong>{userEmail}</strong> to <strong>{newEmail}</strong>?
                          <br /><br />
                          Verification links will be sent to both email addresses. You must confirm from both to complete the change.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleChangeEmail} disabled={isSavingEmail}>
                          {isSavingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Confirm Change
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Session Management
          </CardTitle>
          <CardDescription>
            Manage your active sessions and sign out from other devices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Session Info */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Current Session</span>
              <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
            </div>
            {session && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Signed in as: {session.user.email}</p>
                <p>Last sign in: {format(new Date(session.user.last_sign_in_at || ''), 'MMM d, yyyy h:mm a')}</p>
              </div>
            )}
          </div>

          {/* Sign Out All Devices */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full" disabled={isSigningOutAll}>
                {isSigningOutAll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4 mr-2" />
                )}
                Sign out from all devices
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out from all devices?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will sign you out from all devices including this one. You'll need to sign in again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={async () => {
                    setIsSigningOutAll(true);
                    try {
                      await supabase.auth.signOut({ scope: 'global' });
                      toast.success('Signed out from all devices');
                      navigate('/');
                    } catch (error: any) {
                      toast.error(error.message || 'Failed to sign out');
                      setIsSigningOutAll(false);
                    }
                  }}
                >
                  Sign out everywhere
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <p className="text-xs text-muted-foreground">
            If you suspect unauthorized access, sign out from all devices and change your password.
          </p>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Connected Accounts
          </CardTitle>
          <CardDescription>
            Manage your social login connections and backup sign-in methods
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingIdentities ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Connected social accounts */}
              <div className="space-y-2">
                {identities.filter(i => i.provider !== 'email').map((identity) => (
                  <div
                    key={identity.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${getProviderIcon(identity.provider)} flex items-center justify-center text-white text-xs font-bold`}>
                        {getProviderDisplayName(identity.provider).charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{getProviderDisplayName(identity.provider)}</p>
                        <p className="text-xs text-muted-foreground">
                          {identity.identity_data?.email || 'Connected'}
                        </p>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isUnlinking === identity.id || (identities.length <= 1 && !hasPassword)}
                        >
                          {isUnlinking === identity.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Unlink className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect {getProviderDisplayName(identity.provider)}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            You won't be able to sign in with this {getProviderDisplayName(identity.provider)} account anymore.
                            {identities.length <= 2 && !hasPassword && (
                              <span className="block mt-2 text-amber-600 font-medium">
                                Warning: This is your only connected account. Set up a password first to avoid losing access.
                              </span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleUnlinkIdentity(identity)}>
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>

              {/* Link new account */}
              {!identities.find(i => i.provider === 'google') && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleLinkGoogle}
                  disabled={isLinkingGoogle}
                >
                  {isLinkingGoogle ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 mr-2 rounded-full bg-red-500 flex items-center justify-center text-white text-[10px] font-bold">G</div>
                  )}
                  Connect Google Account
                </Button>
              )}

              {/* Password setup section */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <Key className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Email & Password</p>
                    <p className="text-xs text-muted-foreground">
                      {hasPassword ? 'Password is set up' : 'Set up a password as a backup login method'}
                    </p>
                  </div>
                  {hasPassword && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <Check className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>

                {!isSettingPassword ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSettingPassword(true)}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    {hasPassword ? 'Change Password' : 'Set Up Password'}
                  </Button>
                ) : (
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">{hasPassword ? 'New Password' : 'Password'}</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <PasswordStrength password={newPassword} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm password"
                        />
                        {confirmPassword && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {passwordsMatch ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSetPassword}
                        disabled={!passwordsMatch || newPassword.length < 8 || isSavingPassword}
                      >
                        {isSavingPassword ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        {hasPassword ? 'Update Password' : 'Set Password'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsSettingPassword(false);
                          setNewPassword('');
                          setConfirmPassword('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Trusted Devices Management */}
      {hasMFA && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Trusted Devices
            </CardTitle>
            <CardDescription>
              Devices that can skip two-factor authentication for 90 days
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingDevices ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No trusted devices. When you sign in and choose "Trust this device", it will appear here.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getDeviceIcon(device.device_name)}
                        <div>
                          <p className="font-medium text-sm">{device.device_name || 'Unknown Device'}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Last used {formatDistanceToNow(new Date(device.last_used_at), { addSuffix: true })}</span>
                            <span>•</span>
                            <span>Expires {format(new Date(device.expires_at), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={revokingDeviceId === device.id || isRevoking}
                          >
                            {revokingDeviceId === device.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove trusted device?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This device will require two-factor authentication on next sign in.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRevokeDevice(device.id)}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>

                {devices.length > 1 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full" disabled={isRevokingAll}>
                        {isRevokingAll ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Remove all trusted devices
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove all trusted devices?</AlertDialogTitle>
                        <AlertDialogDescription>
                          All devices will require two-factor authentication on next sign in, including this one.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRevokeAllDevices}>
                          Remove All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </>
            )}

            <p className="text-xs text-muted-foreground">
              Removing a device will require MFA verification on next sign in from that device.
            </p>
          </CardContent>
        </Card>
      )}
        </>
      )}

      {/* Admin Controls - Only show when mode is 'admin' or 'all' */}
      {showAdmin && isAdmin && company && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Team Security Policy</CardTitle>
              <CardDescription>
                Manage security requirements for your team
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              
              {company.require_mfa && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Note:</strong> Team members without MFA enabled will be required to set it up on their next login.
                  </p>
                </div>
              )}
              
              <Separator />
              
              <div>
                <p className="text-sm font-medium mb-2">Active Security Policies</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Account lockout after 5 failed login attempts (15 min)</li>
                  <li>Email verification required for new accounts</li>
                  <li>Password requirements: 10+ chars, uppercase, lowercase, number, special char</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Reset Team Member MFA */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team MFA Management
              </CardTitle>
              <CardDescription>
                Reset MFA for team members who have lost access to their authenticator app
              </CardDescription>
            </CardHeader>
            <CardContent>
              {otherTeamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No other team members to manage.</p>
              ) : (
                <div className="space-y-1">
                  {otherTeamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-sm truncate">{member.full_name || 'Unnamed'}</span>
                        <span className="text-xs text-muted-foreground truncate hidden sm:inline">({member.email})</span>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={resettingUserId === member.id}
                          >
                            {resettingUserId === member.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Reset MFA
                              </>
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset MFA for {member.full_name || member.email}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove their two-factor authentication setup. They will need to set up MFA again on their next login if MFA is required.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleResetUserMFA(member.id, member.full_name || member.email)}
                            >
                              Reset MFA
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Force Password Reset */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5" />
                Force Password Reset
              </CardTitle>
              <CardDescription>
                Send password reset emails to team members who need to update their passwords
              </CardDescription>
            </CardHeader>
            <CardContent>
              {otherTeamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No other team members to manage.</p>
              ) : (
                <div className="space-y-3">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full" disabled={forceResetAll}>
                        {forceResetAll ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <KeyRound className="h-4 w-4 mr-2" />
                        )}
                        Reset All Team Passwords
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset passwords for all team members?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will send password reset emails to all {otherTeamMembers.length} team members. They will need to create new passwords.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleForcePasswordReset()}>
                          Send Reset Emails
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <div className="space-y-1">
                    {otherTeamMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-sm truncate">{member.full_name || 'Unnamed'}</span>
                          <span className="text-xs text-muted-foreground truncate hidden sm:inline">({member.email})</span>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={forceResetUserId === member.id}
                            >
                              {forceResetUserId === member.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <KeyRound className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Reset password for {member.full_name || member.email}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will send a password reset email to {member.email}. They will need to create a new password.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleForcePasswordReset(member.id, member.full_name || member.email)}
                              >
                                Send Reset Email
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team Session Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserX className="w-5 h-5" />
                Team Session Management
              </CardTitle>
              <CardDescription>
                Force sign out team members from all their devices and sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {otherTeamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No other team members to manage.</p>
              ) : (
                <div className="space-y-3">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full text-destructive hover:text-destructive" disabled={forceSignoutAll}>
                        {forceSignoutAll ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <LogOut className="h-4 w-4 mr-2" />
                        )}
                        Sign Out All Team Members
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Sign out all team members?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will immediately sign out all {otherTeamMembers.length} team members from all their devices. They will need to sign in again.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleForceSignout()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Sign Out Everyone
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <div className="space-y-1">
                    {otherTeamMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-sm truncate">{member.full_name || 'Unnamed'}</span>
                          <span className="text-xs text-muted-foreground truncate hidden sm:inline">({member.email})</span>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={forceSignoutUserId === member.id}
                            >
                              {forceSignoutUserId === member.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <LogOut className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Sign out {member.full_name || member.email}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will immediately sign them out from all devices and revoke their trusted devices. They will need to sign in again.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleForceSignout(member.id, member.full_name || member.email)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Sign Out
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Use this if you suspect unauthorized access or when an employee leaves.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default SecuritySettingsContent;
