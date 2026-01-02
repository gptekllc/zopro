import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface QuoteTemplateItem {
  id: string;
  template_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

export interface QuoteTemplate {
  id: string;
  company_id: string;
  created_by: string | null;
  name: string;
  notes: string | null;
  valid_days: number;
  created_at: string;
  updated_at: string;
  items?: QuoteTemplateItem[];
}

export interface CreateQuoteTemplateData {
  name: string;
  notes?: string;
  valid_days?: number;
  items: { description: string; quantity: number; unit_price: number }[];
}

export interface UpdateQuoteTemplateData {
  id: string;
  name?: string;
  notes?: string;
  valid_days?: number;
  items?: { description: string; quantity: number; unit_price: number }[];
}

export function useQuoteTemplates() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['quote-templates', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('quote_templates')
        .select(`
          *,
          items:quote_template_items(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as QuoteTemplate[];
    },
    enabled: !!profile?.company_id,
  });
}

export function useQuoteTemplate(templateId: string | null) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['quote-template', templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const { data, error } = await (supabase as any)
        .from('quote_templates')
        .select(`
          *,
          items:quote_template_items(*)
        `)
        .eq('id', templateId)
        .single();

      if (error) throw error;
      return data as QuoteTemplate;
    },
    enabled: !!profile?.company_id && !!templateId,
  });
}

export function useCreateQuoteTemplate() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateQuoteTemplateData) => {
      if (!profile?.company_id) throw new Error('No company associated');

      // Create template
      const { data: templateData, error: templateError } = await (supabase as any)
        .from('quote_templates')
        .insert({
          company_id: profile.company_id,
          created_by: user?.id,
          name: data.name,
          notes: data.notes || null,
          valid_days: data.valid_days || 30,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Create template items
      if (data.items && data.items.length > 0) {
        const { error: itemsError } = await (supabase as any)
          .from('quote_template_items')
          .insert(
            data.items.map((item) => ({
              template_id: templateData.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.quantity * item.unit_price,
            }))
          );

        if (itemsError) throw itemsError;
      }

      return templateData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-templates'] });
      toast.success('Quote template created successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to create template: ' + error.message);
    },
  });
}

export function useUpdateQuoteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, items, ...data }: UpdateQuoteTemplateData) => {
      // Update template
      const { error: templateError } = await (supabase as any)
        .from('quote_templates')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (templateError) throw templateError;

      // Update items if provided
      if (items) {
        // Delete existing items
        await (supabase as any)
          .from('quote_template_items')
          .delete()
          .eq('template_id', id);

        // Insert new items
        if (items.length > 0) {
          const { error: itemsError } = await (supabase as any)
            .from('quote_template_items')
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
      queryClient.invalidateQueries({ queryKey: ['quote-templates'] });
      toast.success('Quote template updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update template: ' + error.message);
    },
  });
}

export function useDeleteQuoteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('quote_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-templates'] });
      toast.success('Quote template deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete template: ' + error.message);
    },
  });
}
