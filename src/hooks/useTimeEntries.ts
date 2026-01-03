import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { differenceInMinutes } from 'date-fns';

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
  user?: { full_name: string };
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
          user:profiles(full_name),
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
          user:profiles(full_name)
        `)
        .eq('job_id', jobId)
        .order('clock_in', { ascending: false });
      
      if (error) throw error;
      return data as TimeEntry[];
    },
    enabled: !!jobId,
  });
}

// Store recordWorkHours preference per time entry (in-memory for session)
const recordWorkHoursMap = new Map<string, boolean>();

// Export function to set recordWorkHours flag for an entry
export function setRecordWorkHoursForEntry(entryId: string, shouldRecord: boolean) {
  if (shouldRecord) {
    recordWorkHoursMap.set(entryId, true);
  } else {
    recordWorkHoursMap.delete(entryId);
  }
}

export function useClockIn() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ notes, jobId, recordWorkHours }: { notes?: string; jobId?: string; recordWorkHours?: boolean }) => {
      if (!user || !profile?.company_id) throw new Error('Not authenticated');
      
      const { data, error } = await (supabase as any)
        .from('time_entries')
        .insert({
          company_id: profile.company_id,
          user_id: user.id,
          job_id: jobId || null,
          clock_in: new Date().toISOString(),
          notes,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Store the recordWorkHours preference for this entry
      if (data?.id && recordWorkHours && jobId) {
        recordWorkHoursMap.set(data.id, true);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time_entries'] });
      queryClient.invalidateQueries({ queryKey: ['active_time_entry'] });
      queryClient.invalidateQueries({ queryKey: ['job_time_entries'] });
      toast.success('Clocked in successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to clock in: ' + error.message);
    },
  });
}

export function useClockOut() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, notes, jobId, hourlyRate }: { id: string; notes?: string; jobId?: string | null; hourlyRate?: number }) => {
      const clockOutTime = new Date().toISOString();
      
      // First get the time entry to calculate duration
      const { data: entry, error: fetchError } = await (supabase as any)
        .from('time_entries')
        .select('clock_in, break_minutes')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Update the time entry
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
      
      // Check if we should record work hours to job
      const shouldRecordHours = recordWorkHoursMap.get(id);
      if (shouldRecordHours && jobId && hourlyRate !== undefined) {
        // Calculate worked hours
        const clockIn = new Date(entry.clock_in);
        const clockOut = new Date(clockOutTime);
        const totalMinutes = differenceInMinutes(clockOut, clockIn) - (entry.break_minutes || 0);
        const workedHours = Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimal places
        
        if (workedHours > 0) {
          // Check if there's an existing labor line item for this job
          const { data: existingItems } = await (supabase as any)
            .from('job_items')
            .select('*')
            .eq('job_id', jobId)
            .ilike('description', '%labor%');
          
          if (existingItems && existingItems.length > 0) {
            // Update existing labor item - add hours
            const laborItem = existingItems[0];
            const newQuantity = laborItem.quantity + workedHours;
            const newTotal = newQuantity * hourlyRate;
            
            await (supabase as any)
              .from('job_items')
              .update({
                quantity: newQuantity,
                unit_price: hourlyRate,
                total: newTotal,
              })
              .eq('id', laborItem.id);
          } else {
            // Create new labor line item
            const total = workedHours * hourlyRate;
            
            await (supabase as any)
              .from('job_items')
              .insert({
                job_id: jobId,
                description: 'Labor',
                quantity: workedHours,
                unit_price: hourlyRate,
                total: total,
              });
          }
          
          // Update job totals
          const { data: allItems } = await (supabase as any)
            .from('job_items')
            .select('total')
            .eq('job_id', jobId);
          
          const subtotal = (allItems || []).reduce((sum: number, item: { total: number }) => sum + item.total, 0);
          
          // Get company tax rate
          const { data: job } = await (supabase as any)
            .from('jobs')
            .select('company_id, discount_type, discount_value')
            .eq('id', jobId)
            .single();
          
          if (job) {
            const { data: company } = await (supabase as any)
              .from('companies')
              .select('tax_rate')
              .eq('id', job.company_id)
              .single();
            
            const taxRate = company?.tax_rate || 0;
            const discountAmount = job.discount_value 
              ? (job.discount_type === 'percentage' 
                  ? subtotal * (job.discount_value / 100) 
                  : job.discount_value)
              : 0;
            const taxableAmount = subtotal - discountAmount;
            const tax = taxableAmount * (taxRate / 100);
            const total = taxableAmount + tax;
            
            await (supabase as any)
              .from('jobs')
              .update({ subtotal, tax, total })
              .eq('id', jobId);
          }
        }
        
        // Clean up the map
        recordWorkHoursMap.delete(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time_entries'] });
      queryClient.invalidateQueries({ queryKey: ['active_time_entry'] });
      queryClient.invalidateQueries({ queryKey: ['job_time_entries'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
      toast.success('Clocked out successfully');
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time_entries'] });
      queryClient.invalidateQueries({ queryKey: ['active_time_entry'] });
      queryClient.invalidateQueries({ queryKey: ['job_time_entries'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time_entries'] });
      queryClient.invalidateQueries({ queryKey: ['active_time_entry'] });
      queryClient.invalidateQueries({ queryKey: ['job_time_entries'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time_entries'] });
      queryClient.invalidateQueries({ queryKey: ['active_time_entry'] });
      queryClient.invalidateQueries({ queryKey: ['job_time_entries'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time_entries'] });
      queryClient.invalidateQueries({ queryKey: ['active_time_entry'] });
      queryClient.invalidateQueries({ queryKey: ['job_time_entries'] });
      toast.success('Time entry deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete: ' + error.message);
    },
  });
}
