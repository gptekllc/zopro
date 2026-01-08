import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KeyRound, ShieldOff, UserPlus, Building2, Loader2, Mail, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company_id: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface SupportToolsTabProps {
  profiles: Profile[];
  companies: Company[];
}

export function SupportToolsTab({ profiles, companies }: SupportToolsTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Password Reset
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetPasswordEmail, setResetPasswordEmail] = useState('');
  
  // MFA Reset
  const [mfaResetOpen, setMfaResetOpen] = useState(false);
  const [mfaResetUserId, setMfaResetUserId] = useState('');
  
  // Manual Onboarding
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState({
    companyName: '',
    adminEmail: '',
    adminName: '',
  });

  // Log super admin action
  const logAction = async (action: string, targetType: string, targetId?: string, details?: Record<string, any>) => {
    try {
      await supabase.from('super_admin_audit_log').insert({
        admin_id: user?.id,
        action,
        target_type: targetType,
        target_id: targetId,
        details: details || {},
      });
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  };

  // Password reset mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      await logAction('password_reset', 'user', undefined, { email });
    },
    onSuccess: () => {
      toast.success('Password reset email sent');
      setResetPasswordOpen(false);
      setResetPasswordEmail('');
    },
    onError: (error: any) => {
      toast.error('Failed: ' + error.message);
    },
  });

  // MFA reset mutation
  const mfaResetMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.functions.invoke('reset-user-mfa', {
        body: { userId },
      });
      if (error) throw error;
      await logAction('mfa_reset', 'user', userId);
    },
    onSuccess: () => {
      toast.success('MFA has been reset for this user');
      setMfaResetOpen(false);
      setMfaResetUserId('');
    },
    onError: (error: any) => {
      toast.error('Failed: ' + error.message);
    },
  });

  // Manual onboarding mutation
  const onboardingMutation = useMutation({
    mutationFn: async () => {
      // First create the company
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({ name: onboardingForm.companyName })
        .select()
        .single();
      
      if (companyError) throw companyError;

      // Create default email templates for the company
      await supabase.rpc('create_default_email_templates', {
        _company_id: companyData.id,
      });

      // Send invite to admin
      const { error: inviteError } = await supabase.functions.invoke('invite-team-member', {
        body: {
          email: onboardingForm.adminEmail,
          full_name: onboardingForm.adminName,
          role: 'admin',
          company_id: companyData.id,
        },
      });

      if (inviteError) throw inviteError;

      await logAction('manual_onboarding', 'company', companyData.id, {
        company_name: onboardingForm.companyName,
        admin_email: onboardingForm.adminEmail,
      });

      return companyData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-companies'] });
      toast.success('Company created and invite sent to admin');
      setOnboardingOpen(false);
      setOnboardingForm({ companyName: '', adminEmail: '', adminName: '' });
    },
    onError: (error: any) => {
      toast.error('Failed: ' + error.message);
    },
  });

  const selectedUserForMfa = profiles.find(p => p.id === mfaResetUserId);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Password Reset Tool */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Password Reset</CardTitle>
            </div>
            <CardDescription>
              Send a password reset email to any user
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => setResetPasswordOpen(true)}>
              Reset User Password
            </Button>
          </CardContent>
        </Card>

        {/* MFA Reset Tool */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldOff className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base">MFA Reset</CardTitle>
            </div>
            <CardDescription>
              Reset MFA for locked-out users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => setMfaResetOpen(true)}>
              Reset User MFA
            </Button>
          </CardContent>
        </Card>

        {/* Manual Onboarding Tool */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-green-500" />
              <CardTitle className="text-base">Manual Onboarding</CardTitle>
            </div>
            <CardDescription>
              Create company and invite admin in one step
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => setOnboardingOpen(true)}>
              Onboard New Company
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Password Reset Dialog */}
      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Reset User Password
            </DialogTitle>
            <DialogDescription>
              Send a password reset email to any registered user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>User Email</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={resetPasswordEmail}
                  onChange={(e) => setResetPasswordEmail(e.target.value)}
                  className="flex-1"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Or select from existing users:
              </p>
              <Select value={resetPasswordEmail} onValueChange={setResetPasswordEmail}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.slice(0, 50).map(profile => (
                    <SelectItem key={profile.id} value={profile.email}>
                      {profile.full_name || profile.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setResetPasswordOpen(false)}>
                Cancel
              </Button>
              <Button 
                className="flex-1 gap-2" 
                onClick={() => resetPasswordMutation.mutate(resetPasswordEmail)}
                disabled={resetPasswordMutation.isPending || !resetPasswordEmail}
              >
                {resetPasswordMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                Send Reset Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MFA Reset Dialog */}
      <Dialog open={mfaResetOpen} onOpenChange={setMfaResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldOff className="h-5 w-5" />
              Reset User MFA
            </DialogTitle>
            <DialogDescription>
              This will disable all MFA factors for the selected user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select User</Label>
              <Select value={mfaResetUserId} onValueChange={setMfaResetUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map(profile => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name || profile.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedUserForMfa && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-600">Warning</p>
                    <p className="text-muted-foreground">
                      This will reset MFA for <strong>{selectedUserForMfa.email}</strong>. 
                      They will need to set up MFA again.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMfaResetOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                className="flex-1" 
                onClick={() => mfaResetMutation.mutate(mfaResetUserId)}
                disabled={mfaResetMutation.isPending || !mfaResetUserId}
              >
                {mfaResetMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Reset MFA
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Onboarding Dialog */}
      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Manual Company Onboarding
            </DialogTitle>
            <DialogDescription>
              Create a new company and send an invite to the admin.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            onboardingMutation.mutate();
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input
                value={onboardingForm.companyName}
                onChange={(e) => setOnboardingForm({ ...onboardingForm, companyName: e.target.value })}
                placeholder="Acme Corp"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Admin Email *</Label>
              <Input
                type="email"
                value={onboardingForm.adminEmail}
                onChange={(e) => setOnboardingForm({ ...onboardingForm, adminEmail: e.target.value })}
                placeholder="admin@acmecorp.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Admin Name</Label>
              <Input
                value={onboardingForm.adminName}
                onChange={(e) => setOnboardingForm({ ...onboardingForm, adminName: e.target.value })}
                placeholder="John Smith"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOnboardingOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit"
                className="flex-1" 
                disabled={onboardingMutation.isPending}
              >
                {onboardingMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create & Invite
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
