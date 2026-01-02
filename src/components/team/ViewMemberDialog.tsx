import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Mail, Phone, MapPin, Calendar, DollarSign, AlertTriangle, Edit } from 'lucide-react';
import { format } from 'date-fns';

interface TeamMemberProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  avatar_url?: string | null;
  employment_status?: string | null;
  hire_date?: string | null;
  termination_date?: string | null;
  hourly_rate?: number | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

interface ViewMemberDialogProps {
  member: TeamMemberProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserRole: 'admin' | 'manager' | 'technician';
  onEdit?: (member: TeamMemberProfile) => void;
  canEdit?: boolean;
}

const ViewMemberDialog = ({
  member,
  open,
  onOpenChange,
  currentUserRole,
  onEdit,
  canEdit = false,
}: ViewMemberDialogProps) => {
  if (!member) return null;

  const memberRole = member.role || 'technician';
  
  // Determine what information the current user can see
  // - Technicians can only see basic info (email, phone, status) of other technicians
  // - Managers can see all technician info, but not other managers' pay rate and address
  // - Admins can see everything
  
  const canSeeFullInfo = () => {
    if (currentUserRole === 'admin') return true;
    if (currentUserRole === 'manager') {
      // Managers can see full info for technicians
      if (memberRole === 'technician') return true;
      // Managers cannot see other managers' pay rate and address
      return false;
    }
    // Technicians can only see basic info
    return false;
  };

  const canSeeSensitiveInfo = () => {
    if (currentUserRole === 'admin') return true;
    if (currentUserRole === 'manager' && memberRole === 'technician') return true;
    return false;
  };

  const showFullInfo = canSeeFullInfo();
  const showSensitiveInfo = canSeeSensitiveInfo();

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'manager':
        return 'bg-secondary/50 text-secondary-foreground border-secondary/20';
      case 'technician':
        return 'bg-accent/10 text-accent-foreground border-accent/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getEmploymentStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>;
      case 'on_leave':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <AlertTriangle className="w-3 h-3 mr-1" />
            On Leave
          </Badge>
        );
      case 'terminated':
        return <Badge variant="destructive">Terminated</Badge>;
      default:
        return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>;
    }
  };

  const formatAddress = () => {
    const parts = [member.address, member.city, member.state, member.zip].filter(Boolean);
    return parts.join(', ') || null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Team Member Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Header with Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={member.avatar_url || undefined} alt={member.full_name || 'User'} />
              <AvatarFallback className="text-lg bg-primary/10 text-primary">
                {getInitials(member.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{member.full_name || 'Unnamed'}</h3>
              <div className="flex flex-wrap gap-2 mt-1">
                <Badge className={getRoleBadgeClass(memberRole)}>
                  {memberRole}
                </Badge>
                {getEmploymentStatusBadge(member.employment_status || 'active')}
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact Information - Always visible */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Contact Information</h4>
            
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span>{member.email}</span>
            </div>
            
            {member.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{member.phone}</span>
              </div>
            )}
          </div>

          {/* Employment Details - Show if manager+ or viewing technician */}
          {showFullInfo && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Employment Details</h4>
                
                {member.hire_date && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>Hired: {format(new Date(member.hire_date), 'MMM d, yyyy')}</span>
                  </div>
                )}
                
                {member.termination_date && (
                  <div className="flex items-center gap-3 text-sm text-destructive">
                    <Calendar className="w-4 h-4" />
                    <span>Terminated: {format(new Date(member.termination_date), 'MMM d, yyyy')}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Sensitive Info - Pay rate and address (only for admins, or managers viewing technicians) */}
          {showSensitiveInfo && (
            <>
              {(member.hourly_rate !== null && member.hourly_rate !== undefined) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Compensation</h4>
                    <div className="flex items-center gap-3 text-sm">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span>${member.hourly_rate.toFixed(2)}/hour</span>
                    </div>
                  </div>
                </>
              )}

              {formatAddress() && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Address</h4>
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <span>{formatAddress()}</span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Edit button if user has permission */}
          {canEdit && onEdit && (
            <>
              <Separator />
              <Button 
                onClick={() => {
                  onOpenChange(false);
                  onEdit(member);
                }}
                className="w-full"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Team Member
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ViewMemberDialog;
