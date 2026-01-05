import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface CatalogItem {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  type: 'product' | 'service';
  unit_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useCatalogItems = () => {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['catalog_items', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('type', { ascending: true })
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as CatalogItem[];
    },
    enabled: !!profile?.company_id,
  });
};

export const useActiveCatalogItems = () => {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['catalog_items', 'active', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('type', { ascending: true })
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as CatalogItem[];
    },
    enabled: !!profile?.company_id,
  });
};

export const useCreateCatalogItem = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (item: Omit<CatalogItem, 'id' | 'company_id' | 'created_at' | 'updated_at'>) => {
      if (!profile?.company_id) throw new Error('No company ID');
      
      const { data, error } = await supabase
        .from('catalog_items')
        .insert({
          ...item,
          company_id: profile.company_id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog_items'] });
      toast.success('Item created');
    },
    onError: () => {
      toast.error('Failed to create item');
    },
  });
};

export const useUpdateCatalogItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CatalogItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('catalog_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog_items'] });
      toast.success('Item updated');
    },
    onError: () => {
      toast.error('Failed to update item');
    },
  });
};

export const useDeleteCatalogItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('catalog_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog_items'] });
      toast.success('Item deleted');
    },
    onError: () => {
      toast.error('Failed to delete item');
    },
  });
};
