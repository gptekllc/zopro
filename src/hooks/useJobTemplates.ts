import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface JobTemplateItem {
  id: string;
  template_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

export interface JobTemplate {
  id: string;
  company_id: string;
  name: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimated_duration: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: JobTemplateItem[];
}

interface CreateTemplateData {
  name: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimated_duration?: number;
  notes?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>;
}

interface UpdateTemplateData extends Partial<CreateTemplateData> {
  id: string;
}

export function useJobTemplates() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['job-templates', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];

      const { data: templates, error } = await supabase
        .from('job_templates')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name');

      if (error) throw error;

      // Fetch items for each template
      const templatesWithItems = await Promise.all(
        templates.map(async (template) => {
          const { data: items } = await supabase
            .from('job_template_items')
            .select('*')
            .eq('template_id', template.id)
            .order('created_at');

          return {
            ...template,
            items: items || [],
          } as JobTemplate;
        })
      );

      return templatesWithItems;
    },
    enabled: !!profile?.company_id,
  });
}

export function useJobTemplate(templateId: string | null) {
  return useQuery({
    queryKey: ['job-template', templateId],
    queryFn: async () => {
      if (!templateId) return null;

      const { data: template, error } = await supabase
        .from('job_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) throw error;

      const { data: items } = await supabase
        .from('job_template_items')
        .select('*')
        .eq('template_id', templateId)
        .order('created_at');

      return {
        ...template,
        items: items || [],
      } as JobTemplate;
    },
    enabled: !!templateId,
  });
}

export function useCreateJobTemplate() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateTemplateData) => {
      if (!profile?.company_id) throw new Error('No company found');

      const { data: userData } = await supabase.auth.getUser();
      
      // Insert template
      const { data: template, error: templateError } = await supabase
        .from('job_templates')
        .insert({
          company_id: profile.company_id,
          name: data.name,
          title: data.title,
          description: data.description || null,
          priority: data.priority,
          estimated_duration: data.estimated_duration || 60,
          notes: data.notes || null,
          created_by: userData.user?.id || null,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Insert items
      if (data.items.length > 0) {
        const { error: itemsError } = await supabase
          .from('job_template_items')
          .insert(
            data.items.map((item) => ({
              template_id: template.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.quantity * item.unit_price,
            }))
          );

        if (itemsError) throw itemsError;
      }

      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-templates'] });
      toast.success('Template saved successfully');
    },
    onError: (error) => {
      console.error('Failed to create template:', error);
      toast.error('Failed to save template');
    },
  });
}

export function useUpdateJobTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateTemplateData) => {
      const { id, items, ...updateData } = data;

      // Update template
      const { error: templateError } = await supabase
        .from('job_templates')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (templateError) throw templateError;

      // Update items if provided
      if (items) {
        // Delete existing items
        await supabase
          .from('job_template_items')
          .delete()
          .eq('template_id', id);

        // Insert new items
        if (items.length > 0) {
          const { error: itemsError } = await supabase
            .from('job_template_items')
            .insert(
              items.map((item) => ({
                template_id: id,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total: item.quantity * item.unit_price,
              }))
            );

          if (itemsError) throw itemsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-templates'] });
      toast.success('Template updated successfully');
    },
    onError: (error) => {
      console.error('Failed to update template:', error);
      toast.error('Failed to update template');
    },
  });
}

export function useDeleteJobTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('job_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-templates'] });
      toast.success('Template deleted');
    },
    onError: (error) => {
      console.error('Failed to delete template:', error);
      toast.error('Failed to delete template');
    },
  });
}
