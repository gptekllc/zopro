import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";

export type DashboardAccess = {
  isAdminOrManager: boolean;
  /**
   * Technician detection for dashboard-scoped UI.
   * NOTE: we also consider profile.role==='technician' as a *restrictive* signal to avoid accidental exposure.
   */
  isTechnicianDashboardScoped: boolean;
  canSeeTimeEntriesWidget: boolean;
};

export function useDashboardAccess(): DashboardAccess {
  const { roles, profile } = useAuth();

  return useMemo(() => {
    const isAdminOrManager = roles.some(
      (r) => r.role === "admin" || r.role === "manager" || r.role === "super_admin"
    );

    const hasTechnicianRoleRow = roles.some((r) => r.role === "technician");
    const hasTechnicianProfileRole = profile?.role === "technician";

    // Restrictive: if either indicates technician, scope the dashboard like a technician.
    const isTechnicianDashboardScoped = hasTechnicianRoleRow || hasTechnicianProfileRole;

    // This card should never show for technicians (even if they also have admin/manager roles).
    const canSeeTimeEntriesWidget = isAdminOrManager && !isTechnicianDashboardScoped;

    return { isAdminOrManager, isTechnicianDashboardScoped, canSeeTimeEntriesWidget };
  }, [roles, profile?.role]);
}
