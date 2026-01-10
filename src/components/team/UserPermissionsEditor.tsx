import React, { useState } from 'react';
import { 
  useUserPermissions, 
  useUpdateUserPermission, 
  useResetUserPermission,
  PermissionDefinition 
} from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronRight, 
  RotateCcw, 
  Shield, 
  Users, 
  Briefcase, 
  FileText, 
  CreditCard, 
  BarChart3, 
  Settings,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UserPermissionsEditorProps {
  userId: string;
  companyId: string;
  userRole: string;
  onClose?: () => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  Team: <Users className="h-4 w-4" />,
  Jobs: <Briefcase className="h-4 w-4" />,
  Quotes: <FileText className="h-4 w-4" />,
  Billing: <CreditCard className="h-4 w-4" />,
  Customers: <Users className="h-4 w-4" />,
  Reports: <BarChart3 className="h-4 w-4" />,
  Settings: <Settings className="h-4 w-4" />,
};

const categoryOrder = ['Team', 'Jobs', 'Quotes', 'Billing', 'Customers', 'Reports', 'Settings'];

export function UserPermissionsEditor({ 
  userId, 
  companyId, 
  userRole,
  onClose 
}: UserPermissionsEditorProps) {
  const { isAdmin, isManager, isSuperAdmin } = useAuth();
  const { 
    definitions, 
    getPermissionState, 
    getPermissionsByCategory,
    isLoading 
  } = useUserPermissions(userId);
  
  const updatePermission = useUpdateUserPermission();
  const resetPermission = useResetUserPermission();
  
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Team', 'Jobs']));
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleTogglePermission = async (permission: PermissionDefinition, newValue: boolean) => {
    setPendingUpdates(prev => new Set(prev).add(permission.permission_key));
    
    try {
      await updatePermission.mutateAsync({
        userId,
        companyId,
        permissionKey: permission.permission_key,
        enabled: newValue,
      });
      toast.success(`Permission "${permission.display_name}" ${newValue ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update permission');
    } finally {
      setPendingUpdates(prev => {
        const next = new Set(prev);
        next.delete(permission.permission_key);
        return next;
      });
    }
  };

  const handleResetToDefault = async (permission: PermissionDefinition) => {
    setPendingUpdates(prev => new Set(prev).add(permission.permission_key));
    
    try {
      await resetPermission.mutateAsync({
        userId,
        permissionKey: permission.permission_key,
      });
      toast.success(`Permission "${permission.display_name}" reset to default`);
    } catch (error) {
      toast.error('Failed to reset permission');
    } finally {
      setPendingUpdates(prev => {
        const next = new Set(prev);
        next.delete(permission.permission_key);
        return next;
      });
    }
  };

  const canEditPermission = (permission: PermissionDefinition): boolean => {
    // Super admins can edit any permission
    if (isSuperAdmin) return true;
    
    // Admins can edit any permission for their company
    if (isAdmin) return true;
    
    // Managers can only edit technician permissions
    if (isManager && userRole === 'technician') {
      // Managers can only grant permissions they themselves have
      // For now, check if the permission's allowed_roles includes manager
      return permission.allowed_roles.includes('manager');
    }
    
    return false;
  };

  const permissionsByCategory = getPermissionsByCategory();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground pb-2 border-b">
        <Shield className="h-4 w-4" />
        <span>
          Editing permissions for <Badge variant="outline" className="ml-1">{userRole}</Badge> role.
          Custom overrides take precedence over role defaults.
        </span>
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
        {categoryOrder.map(category => {
          const permissions = permissionsByCategory[category];
          if (!permissions || permissions.length === 0) return null;
          
          const isExpanded = expandedCategories.has(category);
          const hasCustomOverrides = permissions.some(p => getPermissionState(p.permission_key).isOverride);
          
          return (
            <Collapsible 
              key={category} 
              open={isExpanded}
              onOpenChange={() => toggleCategory(category)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    {categoryIcons[category]}
                  </span>
                  <span className="font-medium">{category}</span>
                  {hasCustomOverrides && (
                    <Badge variant="secondary" className="text-xs">
                      Custom
                    </Badge>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="space-y-1 pl-4 pr-2 pb-2">
                  {permissions.map(permission => {
                    const state = getPermissionState(permission.permission_key);
                    const canEdit = canEditPermission(permission);
                    const isPending = pendingUpdates.has(permission.permission_key);
                    
                    return (
                      <div 
                        key={permission.permission_key}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-md border",
                          state.isOverride ? "border-primary/30 bg-primary/5" : "border-border",
                          !canEdit && "opacity-60"
                        )}
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {permission.display_name}
                            </span>
                            {state.isOverride && (
                              <Badge variant="default" className="text-xs shrink-0">
                                Custom
                              </Badge>
                            )}
                            {state.isDefault && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                Default
                              </Badge>
                            )}
                          </div>
                          {permission.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {permission.description}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          {state.isOverride && canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetToDefault(permission)}
                              disabled={isPending}
                              className="h-8 px-2 text-muted-foreground hover:text-foreground"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          )}
                          
                          {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Switch
                              checked={state.enabled}
                              onCheckedChange={(checked) => handleTogglePermission(permission, checked)}
                              disabled={!canEdit || isPending}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
