import React from 'react';
import { usePermissions, PermissionKey } from '@/hooks/usePermissions';
import { Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PermissionGateProps {
  permission: PermissionKey;
  children: React.ReactNode;
  /** Hide content entirely when permission is denied (default: false) */
  hideWhenDenied?: boolean;
  /** Show disabled state instead of hiding (default: true) */
  disableWhenDenied?: boolean;
  /** Custom fallback to render when permission is denied */
  fallback?: React.ReactNode;
  /** Tooltip message to show when disabled */
  deniedMessage?: string;
}

/**
 * PermissionGate - Conditionally renders or disables content based on user permissions
 * 
 * @example
 * // Hide content when denied
 * <PermissionGate permission="create_invoices" hideWhenDenied>
 *   <CreateInvoiceButton />
 * </PermissionGate>
 * 
 * @example
 * // Show disabled state with tooltip
 * <PermissionGate permission="void_invoices" deniedMessage="You don't have permission to void invoices">
 *   <VoidButton />
 * </PermissionGate>
 * 
 * @example
 * // Custom fallback
 * <PermissionGate permission="view_reports" fallback={<UpgradePrompt />}>
 *   <ReportsPage />
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  children,
  hideWhenDenied = false,
  disableWhenDenied = true,
  fallback,
  deniedMessage = "You don't have permission to perform this action",
}: PermissionGateProps) {
  const { hasPermission, isLoading, definitions } = usePermissions();
  
  // While loading, show children (optimistic) to prevent flicker
  if (isLoading) {
    return <>{children}</>;
  }
  
  const isAllowed = hasPermission(permission);
  
  if (isAllowed) {
    return <>{children}</>;
  }
  
  // Permission denied
  if (hideWhenDenied) {
    return null;
  }
  
  if (fallback) {
    return <>{fallback}</>;
  }
  
  if (disableWhenDenied) {
    // Wrap children in a disabled state with tooltip
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative inline-block">
            <div className="pointer-events-none opacity-50 select-none">
              {children}
            </div>
            <div className="absolute inset-0 cursor-not-allowed" />
          </div>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2 max-w-xs">
          <Lock className="h-3 w-3" />
          <span>{deniedMessage}</span>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  return null;
}

/**
 * RequirePermission - A simpler wrapper that just hides content if permission is denied
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: PermissionKey;
  children: React.ReactNode;
}) {
  return (
    <PermissionGate permission={permission} hideWhenDenied>
      {children}
    </PermissionGate>
  );
}

/**
 * usePermissionGate - Hook version for programmatic permission checks
 */
export function usePermissionGate(permission: PermissionKey): {
  isAllowed: boolean;
  isLoading: boolean;
} {
  const { hasPermission, isLoading } = usePermissions();
  
  return {
    isAllowed: hasPermission(permission),
    isLoading,
  };
}
