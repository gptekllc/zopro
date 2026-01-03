import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Company {
  timezone?: string;
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  website: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  logo_url: string | null;
  tax_rate: number | null;
  payment_terms_days: number | null;
  late_fee_percentage: number | null;
  default_payment_method: string | null;
  // Stripe Connect fields
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean | null;
  stripe_charges_enabled: boolean | null;
  stripe_payouts_enabled: boolean | null;
  stripe_payments_enabled: boolean | null;
  platform_fee_percentage: number | null;
  // Signature settings
  require_job_completion_signature: boolean | null;
  // PDF Preferences
  pdf_show_notes: boolean | null;
  pdf_show_signature: boolean | null;
  pdf_terms_conditions: string | null;
  pdf_show_logo: boolean | null;
  pdf_show_line_item_details: boolean | null;
  pdf_footer_text: string | null;
  // Job Settings
  default_job_duration: number | null;
  default_job_priority: string | null;
  auto_archive_days: number | null;
  notify_on_job_assignment: boolean | null;
  // Quote Settings
  default_quote_validity_days: number | null;
  auto_expire_quotes: boolean | null;
  require_quote_signature: boolean | null;
  // Invoice Settings
  auto_send_invoice_reminders: boolean | null;
  invoice_reminder_days: number | null;
  auto_apply_late_fees: boolean | null;
  // Notification Preferences
  email_on_new_job: boolean | null;
  email_on_payment_received: boolean | null;
  send_weekly_summary: boolean | null;
  // Branding
  brand_primary_color: string | null;
  customer_portal_welcome_message: string | null;
  // Automation notifications
  notify_on_automation_run: boolean | null;
  created_at: string;
  updated_at: string;
}

export function useCompany() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['company', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      
      const { data, error } = await (supabase as any)
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Company | null;
    },
    enabled: !!profile?.company_id,
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Company> & { id: string }) => {
      const { error } = await (supabase as any)
        .from('companies')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      toast.success('Company updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update company: ' + error.message);
    },
  });
}

export interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  company_id: string | null;
  hourly_rate: number | null;
  employment_status: 'active' | 'on_leave' | 'terminated' | null;
  hire_date: string | null;
  termination_date: string | null;
  deleted_at?: string | null;
  roles?: { role: string }[];
  avatar_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export function useTeamMembers() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['team_members', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      // First get profiles with new fields
      const { data: profiles, error: profilesError } = await (supabase as any)
        .from('profiles')
        .select('id, email, full_name, phone, role, company_id, hourly_rate, employment_status, hire_date, termination_date, avatar_url, address, city, state, zip')
        .eq('company_id', profile.company_id)
        .is('deleted_at', null);
      
      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) return [];
      
      // Then get roles for these users in a separate query (faster)
      const userIds = profiles.map((p: any) => p.id);
      const { data: roles } = await (supabase as any)
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);
      
      // Merge roles into profiles
      const rolesMap = new Map();
      (roles || []).forEach((r: any) => {
        if (!rolesMap.has(r.user_id)) rolesMap.set(r.user_id, []);
        rolesMap.get(r.user_id).push({ role: r.role });
      });
      
      return profiles.map((p: any) => ({
        ...p,
        roles: rolesMap.get(p.id) || [],
      })) as TeamMember[];
    },
    enabled: !!profile?.company_id,
    staleTime: 30000, // Cache for 30 seconds
  });
}
