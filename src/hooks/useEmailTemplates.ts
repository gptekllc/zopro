import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface EmailTemplate {
  id: string;
  company_id: string;
  name: string;
  template_type: 'invoice' | 'reminder' | 'quote' | 'job' | 'general';
  subject: string;
  body: string;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useEmailTemplates(templateType?: 'invoice' | 'reminder' | 'quote' | 'job' | 'general') {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['email-templates', profile?.company_id, templateType],
    queryFn: async () => {
      if (!profile?.company_id) return [];

      let query = (supabase as any)
        .from('email_templates')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('is_default', { ascending: false })
        .order('name');

      if (templateType) {
        query = query.eq('template_type', templateType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EmailTemplate[];
    },
    enabled: !!profile?.company_id,
  });
}

interface CreateTemplateParams {
  name: string;
  template_type: 'invoice' | 'reminder' | 'quote' | 'job' | 'general';
  subject: string;
  body: string;
  is_default?: boolean;
}

export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();

  return useMutation({
    mutationFn: async (params: CreateTemplateParams) => {
      if (!profile?.company_id) throw new Error('No company associated');

      // If setting as default, unset other defaults of same type
      if (params.is_default) {
        await (supabase as any)
          .from('email_templates')
          .update({ is_default: false })
          .eq('company_id', profile.company_id)
          .eq('template_type', params.template_type);
      }

      const { data, error } = await (supabase as any)
        .from('email_templates')
        .insert({
          company_id: profile.company_id,
          created_by: user?.id,
          ...params,
        })
        .select()
        .single();

      if (error) throw error;
      return data as EmailTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Email template saved');
    },
    onError: (error: any) => {
      toast.error('Failed to save template: ' + error.message);
    },
  });
}

interface UpdateTemplateParams {
  id: string;
  name?: string;
  subject?: string;
  body?: string;
  is_default?: boolean;
}

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...params }: UpdateTemplateParams) => {
      if (!profile?.company_id) throw new Error('No company associated');

      // If setting as default, unset other defaults
      if (params.is_default) {
        const { data: template } = await (supabase as any)
          .from('email_templates')
          .select('template_type')
          .eq('id', id)
          .single();

        if (template) {
          await (supabase as any)
            .from('email_templates')
            .update({ is_default: false })
            .eq('company_id', profile.company_id)
            .eq('template_type', template.template_type)
            .neq('id', id);
        }
      }

      const { data, error } = await (supabase as any)
        .from('email_templates')
        .update(params)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as EmailTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update template: ' + error.message);
    },
  });
}

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await (supabase as any)
        .from('email_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete template: ' + error.message);
    },
  });
}

export function useInitializeDefaultTemplates() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error('No company associated');

      // Call the database function to create default templates
      const { error } = await (supabase as any).rpc('create_default_email_templates', {
        _company_id: profile.company_id,
        _created_by: user?.id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Default templates created successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to create default templates: ' + error.message);
    },
  });
}
