import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface TimeEntry {
  id: string;
  company_id: string;
  user_id: string;
  job_id: string | null;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  break_start: string | null;
  is_on_break: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user?: { full_name: string; first_name: string | null; last_name: string | null };
  job?: { job_number: string; title: string };
}

export function useTimeEntries() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['time_entries', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('time_entries')
        .select(`
          *,
          user:profiles(full_name, first_name, last_name),
          job:jobs(job_number, title)
        `)
        .order('clock_in', { ascending: false });
      
      if (error) throw error;
      return data as TimeEntry[];
    },
    enabled: !!profile?.company_id,
  });
}

export function useActiveTimeEntry() {
  const { user, profile } = useAuth();
  
  return useQuery({
    queryKey: ['active_time_entry', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await (supabase as any)
        .from('time_entries')
        .select('*')
        .eq('user_id', user.id)
        .is('clock_out', null)
        .maybeSingle();
      
      if (error) throw error;
      return data as TimeEntry | null;
    },
    enabled: !!user && !!profile?.company_id,
  });
}

export function useJobTimeEntries(jobId: string | null) {
  return useQuery({
    queryKey: ['job_time_entries', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      
      const { data, error } = await (supabase as any)
        .from('time_entries')
        .select(`
          *,
          user:profiles(full_name, first_name, last_name)
        `)
        .eq('job_id', jobId)
        .order('clock_in', { ascending: false });
      
      if (error) throw error;
      return data as TimeEntry[];
    },
    enabled: !!jobId,
    staleTime: 30000,
  });
}

export function useClockIn() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ notes }: { notes?: string }) => {
      if (!user || !profile?.company_id) throw new Error('Not authenticated');
      
      const { data, error } = await (supabase as any)
        .from('time_entries')
        .insert({
          company_id: profile.company_id,
          user_id: user.id,
          job_id: null,
          clock_in: new Date().toISOString(),
          notes,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      // Force immediate refetch to update UI
      await queryClient.invalidateQueries({ queryKey: ['active_time_entry'] });
      await queryClient.invalidateQueries({ queryKey: ['time_entries'] });
    },
    onError: (error: any) => {
      toast.error('Failed to clock in: ' + error.message);
    },
  });
}

export function useClockOut() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const clockOutTime = new Date().toISOString();

      const { error } = await (supabase as any)
        .from('time_entries')
        .update({
          clock_out: clockOutTime,
          notes,
          is_on_break: false,
          break_start: null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['time_entries'] });
      await queryClient.invalidateQueries({ queryKey: ['active_time_entry'] });
    },
    onError: (error: any) => {
      toast.error('Failed to clock out: ' + error.message);
    },
  });
}

export function useStartBreak() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await (supabase as any)
        .from('time_entries')
        .update({
          is_on_break: true,
          break_start: new Date().toISOString(),
        })
        .eq('id', entryId);
      
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['time_entries'] });
      await queryClient.invalidateQueries({ queryKey: ['active_time_entry'] });
      toast.success('Break started');
    },
    onError: (error: any) => {
      toast.error('Failed to start break: ' + error.message);
    },
  });
}

export function useEndBreak() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ entryId, breakStart, currentBreakMinutes }: { 
      entryId: string; 
      breakStart: string;
      currentBreakMinutes: number;
    }) => {
      const breakDuration = Math.floor(
        (new Date().getTime() - new Date(breakStart).getTime()) / 60000
      );
      
      const { error } = await (supabase as any)
        .from('time_entries')
        .update({
          is_on_break: false,
          break_start: null,
          break_minutes: currentBreakMinutes + breakDuration,
        })
        .eq('id', entryId);
      
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['time_entries'] });
      await queryClient.invalidateQueries({ queryKey: ['active_time_entry'] });
      toast.success('Break ended');
    },
    onError: (error: any) => {
      toast.error('Failed to end break: ' + error.message);
    },
  });
}

export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, clock_in, clock_out, notes, break_minutes }: { 
      id: string; 
      clock_in: string; 
      clock_out: string | null; 
      notes: string | null;
      break_minutes?: number;
    }) => {
      const updateData: Record<string, unknown> = { clock_in, clock_out, notes };
      if (break_minutes !== undefined) {
        updateData.break_minutes = break_minutes;
      }
      
      const { error } = await (supabase as any)
        .from('time_entries')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['time_entries'] });
      await queryClient.invalidateQueries({ queryKey: ['active_time_entry'] });
      toast.success('Time entry updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update: ' + error.message);
    },
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('time_entries')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['time_entries'] });
      await queryClient.invalidateQueries({ queryKey: ['active_time_entry'] });
      toast.success('Time entry deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete: ' + error.message);
    },
  });
}