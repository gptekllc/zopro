import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Permission keys - keep in sync with database
export const PERMISSION_KEYS = {
  // Team
  EDIT_OWN_HOURLY_RATE: 'edit_own_hourly_rate',
  EDIT_TECH_HOURLY_RATES: 'edit_tech_hourly_rates',
  EDIT_MANAGER_HOURLY_RATES: 'edit_manager_hourly_rates',
  MANAGE_TEAM: 'manage_team',
  INVITE_MEMBERS: 'invite_members',
  TERMINATE_MEMBERS: 'terminate_members',
  // Jobs
  CREATE_JOBS: 'create_jobs',
  EDIT_JOBS: 'edit_jobs',
  DELETE_JOBS: 'delete_jobs',
  ASSIGN_JOBS: 'assign_jobs',
  COMPLETE_JOBS: 'complete_jobs',
  // Quotes
  CREATE_QUOTES: 'create_quotes',
  EDIT_QUOTES: 'edit_quotes',
  DELETE_QUOTES: 'delete_quotes',
  SEND_QUOTES: 'send_quotes',
  APPROVE_QUOTES: 'approve_quotes',
  // Billing
  CREATE_INVOICES: 'create_invoices',
  EDIT_INVOICES: 'edit_invoices',
  VOID_INVOICES: 'void_invoices',
  RECORD_PAYMENTS: 'record_payments',
  REFUND_PAYMENTS: 'refund_payments',
  VIEW_PAYMENT_HISTORY: 'view_payment_history',
  // Customers
  CREATE_CUSTOMERS: 'create_customers',
  EDIT_CUSTOMERS: 'edit_customers',
  DELETE_CUSTOMERS: 'delete_customers',
  // Reports
  VIEW_REPORTS: 'view_reports',
  EXPORT_DATA: 'export_data',
  VIEW_TEAM_TIMESHEETS: 'view_team_timesheets',
  // Settings
  MANAGE_COMPANY_SETTINGS: 'manage_company_settings',
  MANAGE_STRIPE_CONNECT: 'manage_stripe_connect',
  MANAGE_TEMPLATES: 'manage_templates',
  MANAGE_ITEMS_CATALOG: 'manage_items_catalog',
} as const;

export type PermissionKey = typeof PERMISSION_KEYS[keyof typeof PERMISSION_KEYS];

export interface PermissionDefinition {
  id: string;
  permission_key: string;
  display_name: string;
  description: string | null;
  category: string;
  allowed_roles: string[];
  display_order: number;
}

export interface RoleDefaultPermission {
  role: string;
  permission_key: string;
  default_enabled: boolean;
}

export interface UserPermissionOverride {
  id: string;
  user_id: string;
  permission_key: string;
  enabled: boolean;
  set_by: string | null;
  reason: string | null;
}

interface PermissionState {
  enabled: boolean;
  isOverride: boolean;
  isDefault: boolean;
}

// Fetch all permission definitions
export function usePermissionDefinitions() {
  return useQuery({
    queryKey: ['permission-definitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permission_definitions')
        .select('*')
        .order('display_order');
      
      if (error) throw error;
      return data as PermissionDefinition[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour - definitions rarely change
  });
}

// Fetch role default permissions
export function useRoleDefaultPermissions() {
  return useQuery({
    queryKey: ['role-default-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_default_permissions')
        .select('*');
      
      if (error) throw error;
      return data as RoleDefaultPermission[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

// Main hook for checking current user's permissions
export function usePermissions() {
  const { user, roles, isSuperAdmin, isAdmin, isManager } = useAuth();
  const { data: definitions } = usePermissionDefinitions();
  const { data: roleDefaults } = useRoleDefaultPermissions();
  
  // Fetch user-specific overrides
  const { data: userOverrides, isLoading } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as UserPermissionOverride[];
    },
    enabled: !!user?.id,
  });

  // Get primary role for the user
  const getPrimaryRole = (): string => {
    if (isSuperAdmin) return 'super_admin';
    if (isAdmin) return 'admin';
    if (isManager) return 'manager';
    // Check if user has any roles
    if (roles && roles.length > 0) {
      // Return the highest priority role
      const rolePriority = ['super_admin', 'admin', 'manager', 'technician'];
      for (const role of rolePriority) {
        if (roles.some(r => r.role === role)) {
          return role;
        }
      }
    }
    return 'technician';
  };

  const hasPermission = (permissionKey: PermissionKey): boolean => {
    // Super admins have all permissions
    if (isSuperAdmin) return true;
    
    // Check for user-specific override first
    const override = userOverrides?.find(o => o.permission_key === permissionKey);
    if (override !== undefined) {
      return override.enabled;
    }
    
    // Fall back to role default
    const role = getPrimaryRole();
    const roleDefault = roleDefaults?.find(
      rd => rd.role === role && rd.permission_key === permissionKey
    );
    
    return roleDefault?.default_enabled ?? false;
  };

  const getPermissionState = (permissionKey: PermissionKey): PermissionState => {
    const override = userOverrides?.find(o => o.permission_key === permissionKey);
    const role = getPrimaryRole();
    const roleDefault = roleDefaults?.find(
      rd => rd.role === role && rd.permission_key === permissionKey
    );
    
    if (override !== undefined) {
      return {
        enabled: override.enabled,
        isOverride: true,
        isDefault: false,
      };
    }
    
    return {
      enabled: roleDefault?.default_enabled ?? false,
      isOverride: false,
      isDefault: true,
    };
  };

  const getAllPermissions = (): Record<PermissionKey, boolean> => {
    const result = {} as Record<PermissionKey, boolean>;
    
    Object.values(PERMISSION_KEYS).forEach(key => {
      result[key] = hasPermission(key);
    });
    
    return result;
  };

  const getPermissionsByCategory = (): Record<string, PermissionDefinition[]> => {
    if (!definitions) return {};
    
    return definitions.reduce((acc, def) => {
      if (!acc[def.category]) {
        acc[def.category] = [];
      }
      acc[def.category].push(def);
      return acc;
    }, {} as Record<string, PermissionDefinition[]>);
  };

  return {
    hasPermission,
    getPermissionState,
    getAllPermissions,
    getPermissionsByCategory,
    definitions,
    roleDefaults,
    userOverrides,
    isLoading,
    primaryRole: getPrimaryRole(),
  };
}

// Hook for fetching another user's permissions (for editing)
export function useUserPermissions(userId: string | null) {
  const { data: definitions } = usePermissionDefinitions();
  const { data: roleDefaults } = useRoleDefaultPermissions();
  
  // Fetch target user's role
  const { data: userRole } = useQuery({
    queryKey: ['user-role', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      // Return highest priority role
      const rolePriority = ['super_admin', 'admin', 'manager', 'technician'];
      for (const role of rolePriority) {
        if (data.some(r => r.role === role)) {
          return role;
        }
      }
      return 'technician';
    },
    enabled: !!userId,
  });

  // Fetch user-specific overrides
  const { data: userOverrides, isLoading } = useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      return data as UserPermissionOverride[];
    },
    enabled: !!userId,
  });

  const getPermissionState = (permissionKey: string): PermissionState => {
    if (!userRole) {
      return { enabled: false, isOverride: false, isDefault: true };
    }

    const override = userOverrides?.find(o => o.permission_key === permissionKey);
    const roleDefault = roleDefaults?.find(
      rd => rd.role === userRole && rd.permission_key === permissionKey
    );
    
    if (override !== undefined) {
      return {
        enabled: override.enabled,
        isOverride: true,
        isDefault: false,
      };
    }
    
    return {
      enabled: roleDefault?.default_enabled ?? false,
      isOverride: false,
      isDefault: true,
    };
  };

  const getPermissionsByCategory = (): Record<string, PermissionDefinition[]> => {
    if (!definitions) return {};
    
    return definitions.reduce((acc, def) => {
      if (!acc[def.category]) {
        acc[def.category] = [];
      }
      acc[def.category].push(def);
      return acc;
    }, {} as Record<string, PermissionDefinition[]>);
  };

  return {
    userRole,
    definitions,
    roleDefaults,
    userOverrides,
    getPermissionState,
    getPermissionsByCategory,
    isLoading,
  };
}

// Mutation hook for updating a user's permission
export function useUpdateUserPermission() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({
      userId,
      companyId,
      permissionKey,
      enabled,
      reason,
    }: {
      userId: string;
      companyId: string;
      permissionKey: string;
      enabled: boolean;
      reason?: string;
    }) => {
      const { data, error } = await supabase
        .from('user_permissions')
        .upsert({
          user_id: userId,
          company_id: companyId,
          permission_key: permissionKey,
          enabled,
          set_by: profile?.id,
          reason,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,permission_key',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', variables.userId] });
    },
  });
}

// Mutation hook for resetting a user's permission to default
export function useResetUserPermission() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      userId,
      permissionKey,
    }: {
      userId: string;
      permissionKey: string;
    }) => {
      const { error } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('permission_key', permissionKey);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', variables.userId] });
    },
  });
}

// Simple permission check hook for single permission
export function useHasPermission(permissionKey: PermissionKey): boolean {
  const { hasPermission, isLoading } = usePermissions();
  
  // Return false while loading, then the actual value
  if (isLoading) return false;
  return hasPermission(permissionKey);
}
