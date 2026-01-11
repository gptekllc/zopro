import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SoftwareVersion {
  id: string;
  version: string;
  release_date: string;
  title: string | null;
  features: string[];
  bug_fixes: string[];
  notes: string | null;
  is_current: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useSoftwareVersions() {
  return useQuery({
    queryKey: ['software_versions'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('software_versions')
        .select('*')
        .order('release_date', { ascending: false });

      if (error) throw error;
      return data as SoftwareVersion[];
    },
  });
}

export function useCurrentVersion() {
  return useQuery({
    queryKey: ['current_software_version'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('software_versions')
        .select('*')
        .eq('is_current', true)
        .maybeSingle();

      if (error) throw error;
      return data as SoftwareVersion | null;
    },
  });
}

export function useCreateVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (versionData: {
      version: string;
      title?: string;
      features?: string[];
      bug_fixes?: string[];
      notes?: string;
      is_current?: boolean;
    }) => {
      // If setting as current, unset all other versions first
      if (versionData.is_current) {
        await (supabase as any)
          .from('software_versions')
          .update({ is_current: false })
          .eq('is_current', true);
      }

      const { data, error } = await (supabase as any)
        .from('software_versions')
        .insert({
          version: versionData.version,
          title: versionData.title || null,
          features: versionData.features || [],
          bug_fixes: versionData.bug_fixes || [],
          notes: versionData.notes || null,
          is_current: versionData.is_current || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['software_versions'] });
      queryClient.invalidateQueries({ queryKey: ['current_software_version'] });
      toast.success('Software version created');
    },
    onError: (error: any) => {
      toast.error('Failed to create version: ' + error.message);
    },
  });
}

export function useUpdateVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      version?: string;
      title?: string;
      features?: string[];
      bug_fixes?: string[];
      notes?: string;
      is_current?: boolean;
    }) => {
      // If setting as current, unset all other versions first
      if (updates.is_current) {
        await (supabase as any)
          .from('software_versions')
          .update({ is_current: false })
          .neq('id', id);
      }

      const { data, error } = await (supabase as any)
        .from('software_versions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['software_versions'] });
      queryClient.invalidateQueries({ queryKey: ['current_software_version'] });
      toast.success('Software version updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update version: ' + error.message);
    },
  });
}

export function useDeleteVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('software_versions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['software_versions'] });
      queryClient.invalidateQueries({ queryKey: ['current_software_version'] });
      toast.success('Software version deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete version: ' + error.message);
    },
  });
}

export function useSetCurrentVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Unset all current versions
      await (supabase as any)
        .from('software_versions')
        .update({ is_current: false })
        .eq('is_current', true);

      // Set the specified version as current
      const { data, error } = await (supabase as any)
        .from('software_versions')
        .update({ is_current: true })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['software_versions'] });
      queryClient.invalidateQueries({ queryKey: ['current_software_version'] });
      toast.success('Current version updated');
    },
    onError: (error: any) => {
      toast.error('Failed to set current version: ' + error.message);
    },
  });
}
