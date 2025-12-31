import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface TeamInvitation {
  id: string;
  company_id: string;
  email: string;
  full_name: string | null;
  role: string;
  invited_by: string | null;
  status: string;
  created_at: string;
  expires_at: string | null;
  accepted_at: string | null;
}

export const useTeamInvitations = () => {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['team_invitations', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await (supabase as any)
        .from('team_invitations')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as TeamInvitation[];
    },
    enabled: !!profile?.company_id,
  });
};

export const useCreateInvitation = () => {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  
  return useMutation({
    mutationFn: async (data: { email: string; full_name: string; role: string }) => {
      if (!profile?.company_id) throw new Error('No company ID');
      
      const { data: result, error } = await (supabase as any)
        .from('team_invitations')
        .insert({
          company_id: profile.company_id,
          email: data.email,
          full_name: data.full_name,
          role: data.role,
          invited_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result as TeamInvitation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_invitations'] });
    },
  });
};

export const useResendInvitation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (invitation: TeamInvitation) => {
      // Update expires_at to extend invitation
      const { error: updateError } = await (supabase as any)
        .from('team_invitations')
        .update({ 
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() 
        })
        .eq('id', invitation.id);
      
      if (updateError) throw updateError;
      
      // Re-invoke the invite function to send email
      const { data, error } = await supabase.functions.invoke('invite-team-member', {
        body: {
          email: invitation.email,
          full_name: invitation.full_name,
          role: invitation.role,
          company_id: invitation.company_id,
          resend: true,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_invitations'] });
      toast.success('Invitation resent successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to resend invitation: ' + error.message);
    },
  });
};

export const useCancelInvitation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await (supabase as any)
        .from('team_invitations')
        .delete()
        .eq('id', invitationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_invitations'] });
      toast.success('Invitation cancelled');
    },
    onError: (error: any) => {
      toast.error('Failed to cancel invitation: ' + error.message);
    },
  });
};
