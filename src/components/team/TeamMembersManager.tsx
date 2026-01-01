import { useState } from 'react';
import { useTeamMembers, TeamMember } from '@/hooks/useCompany';
import { useTeamInvitations, useCancelInvitation, useResendInvitation } from '@/hooks/useTeamInvitations';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Users, UserCog, UserMinus, Loader2, Shield, Mail, UserPlus, RefreshCw, X, RotateCcw, Clock, Edit, Calendar, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';

const AVAILABLE_ROLES = ['admin', 'manager', 'technician'] as const;
type AppRole = typeof AVAILABLE_ROLES[number];

const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'terminated'] as const;
type EmploymentStatus = typeof EMPLOYMENT_STATUSES[number];

const TeamMembersManager = () => {
  const { profile, user, isAdmin } = useAuth();
  const { data: teamMembers, isLoading } = useTeamMembers();
  const { data: invitations = [], isLoading: loadingInvitations } = useTeamInvitations();
  const cancelInvitation = useCancelInvitation();
  const resendInvitation = useResendInvitation();
  const queryClient = useQueryClient();
  
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Add member form state
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<AppRole>('technician');

  // Edit member form state
  const [editEmploymentStatus, setEditEmploymentStatus] = useState<EmploymentStatus>('active');
  const [editHireDate, setEditHireDate] = useState('');
  const [editTerminationDate, setEditTerminationDate] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editHourlyRate, setEditHourlyRate] = useState('');

  // Fetch deleted team members
  const { data: deletedMembers = [] } = useQuery({
    queryKey: ['deleted_team_members', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('id, email, full_name, phone, role, company_id, employment_status, hire_date, termination_date, deleted_at')
        .eq('company_id', profile.company_id)
        .not('deleted_at', 'is', null);
      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: !!profile?.company_id && isAdmin,
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const { error: deleteError } = await (supabase as any)
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) throw deleteError;

      const { error: insertError } = await (supabase as any)
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });
      
      if (insertError) throw insertError;

      const { error: profileError } = await (supabase as any)
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
      
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] });
      toast.success('Role updated successfully');
      setIsRoleDialogOpen(false);
      setSelectedMember(null);
    },
    onError: (error: any) => {
      toast.error('Failed to update role: ' + error.message);
    },
  });

  // Update team member mutation (employment status, hire date, etc.)
  const updateTeamMemberMutation = useMutation({
    mutationFn: async ({ 
      userId, 
      employment_status, 
      hire_date, 
      termination_date,
      phone,
      hourly_rate 
    }: { 
      userId: string; 
      employment_status: EmploymentStatus;
      hire_date: string | null;
      termination_date: string | null;
      phone: string | null;
      hourly_rate: number | null;
    }) => {
      const updates: Record<string, any> = {
        employment_status,
        hire_date: hire_date || null,
        phone: phone || null,
        hourly_rate: hourly_rate,
      };

      // If terminating, also set deleted_at to move to Removed tab
      if (employment_status === 'terminated') {
        updates.termination_date = termination_date || new Date().toISOString().split('T')[0];
        updates.deleted_at = new Date().toISOString();
      } else {
        updates.termination_date = null;
      }

      const { error } = await (supabase as any)
        .from('profiles')
        .update(updates)
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] });
      queryClient.invalidateQueries({ queryKey: ['deleted_team_members'] });
      if (variables.employment_status === 'terminated') {
        toast.success('Team member terminated and moved to Removed');
      } else {
        toast.success('Team member updated successfully');
      }
      setIsEditDialogOpen(false);
      setSelectedMember(null);
    },
    onError: (error: any) => {
      toast.error('Failed to update member: ' + error.message);
    },
  });

  // Soft delete member mutation (now uses deleted_at)
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ 
          deleted_at: new Date().toISOString(),
          employment_status: 'terminated',
          termination_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] });
      queryClient.invalidateQueries({ queryKey: ['deleted_team_members'] });
      toast.success('Team member removed from company');
      setIsRemoveDialogOpen(false);
      setSelectedMember(null);
    },
    onError: (error: any) => {
      toast.error('Failed to remove member: ' + error.message);
    },
  });

  // Restore member mutation
  const restoreMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ 
          deleted_at: null,
          employment_status: 'active',
          termination_date: null
        })
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] });
      queryClient.invalidateQueries({ queryKey: ['deleted_team_members'] });
      toast.success('Team member restored');
    },
    onError: (error: any) => {
      toast.error('Failed to restore member: ' + error.message);
    },
  });

  // Invite member mutation
  const inviteMemberMutation = useMutation({
    mutationFn: async ({ email, full_name, role }: { email: string; full_name: string; role: AppRole }) => {
      if (!profile?.company_id) throw new Error('No company ID');
      
      const { data, error } = await supabase.functions.invoke('invite-team-member', {
        body: {
          email,
          full_name,
          role,
          company_id: profile.company_id,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] });
      queryClient.invalidateQueries({ queryKey: ['team_invitations'] });
      toast.success(data?.message || 'Team member invited successfully');
      setIsAddDialogOpen(false);
      setNewMemberEmail('');
      setNewMemberName('');
      setNewMemberRole('technician');
    },
    onError: (error: any) => {
      toast.error('Failed to invite member: ' + error.message);
    },
  });

  const handleInviteMember = () => {
    if (!newMemberEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    inviteMemberMutation.mutate({
      email: newMemberEmail.trim(),
      full_name: newMemberName.trim(),
      role: newMemberRole,
    });
  };

  const handleRoleChange = (member: TeamMember) => {
    setSelectedMember(member);
    const currentRole = member.roles?.[0]?.role || member.role || 'technician';
    setSelectedRole(currentRole);
    setIsRoleDialogOpen(true);
  };

  const handleEditMember = (member: TeamMember) => {
    setSelectedMember(member);
    setEditEmploymentStatus((member.employment_status as EmploymentStatus) || 'active');
    setEditHireDate(member.hire_date || '');
    setEditTerminationDate(member.termination_date || '');
    setEditPhone(member.phone || '');
    setEditHourlyRate(member.hourly_rate?.toString() || '');
    setIsEditDialogOpen(true);
  };

  const handleRemoveMember = (member: TeamMember) => {
    setSelectedMember(member);
    setIsRemoveDialogOpen(true);
  };

  const confirmRoleChange = () => {
    if (selectedMember && selectedRole) {
      updateRoleMutation.mutate({
        userId: selectedMember.id,
        newRole: selectedRole as AppRole,
      });
    }
  };

  const confirmRemoveMember = () => {
    if (selectedMember) {
      removeMemberMutation.mutate(selectedMember.id);
    }
  };

  const handleSaveEdit = () => {
    if (!selectedMember) return;

    updateTeamMemberMutation.mutate({
      userId: selectedMember.id,
      employment_status: editEmploymentStatus,
      hire_date: editHireDate || null,
      termination_date: editTerminationDate || null,
      phone: editPhone || null,
      hourly_rate: editHourlyRate ? parseFloat(editHourlyRate) : null,
    });
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'manager': return 'secondary';
      case 'technician': return 'outline';
      default: return 'outline';
    }
  };

  const getEmploymentStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>;
      case 'on_leave':
        return <Badge className="bg-warning/10 text-warning border-warning/20">On Leave</Badge>;
      case 'terminated':
        return <Badge variant="destructive">Terminated</Badge>;
      default:
        return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>;
    }
  };

  const getMemberRole = (member: TeamMember) => {
    return member.roles?.[0]?.role || member.role || 'technician';
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Only admins can manage team members.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Members ({teamMembers?.length || 0})
          </CardTitle>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Member
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="active">Active Members</TabsTrigger>
              <TabsTrigger value="pending">
                Pending Invitations
                {invitations.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{invitations.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="deleted">
                Removed
                {deletedMembers.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{deletedMembers.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              {teamMembers && teamMembers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Hire Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member: TeamMember) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(member.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-medium flex items-center gap-2">
                                {member.full_name || 'Unnamed User'}
                                {member.id === user?.id && (
                                  <span className="text-muted-foreground text-sm">(You)</span>
                                )}
                              </span>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {member.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getEmploymentStatusBadge(member.employment_status)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(getMemberRole(member))}>
                            {getMemberRole(member)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {member.hire_date ? (
                            <span className="text-sm flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              {format(new Date(member.hire_date), 'MMM d, yyyy')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {member.id !== user?.id && (
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditMember(member)}
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRoleChange(member)}
                              >
                                <UserCog className="w-4 h-4 mr-1" />
                                Role
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveMember(member)}
                                className="text-destructive hover:text-destructive"
                              >
                                <UserMinus className="w-4 h-4 mr-1" />
                                Remove
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No team members yet. Invite someone to get started!</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pending">
              {loadingInvitations ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                </div>
              ) : invitations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            {invitation.email}
                          </div>
                        </TableCell>
                        <TableCell>{invitation.full_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(invitation.role)}>
                            {invitation.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resendInvitation.mutate(invitation)}
                              disabled={resendInvitation.isPending}
                            >
                              {resendInvitation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4 mr-1" />
                              )}
                              Resend
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => cancelInvitation.mutate(invitation.id)}
                              disabled={cancelInvitation.isPending}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No pending invitations</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="deleted">
              {deletedMembers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Termination Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletedMembers.map((member) => (
                      <TableRow key={member.id} className="opacity-60">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(member.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              {member.full_name || 'Unnamed User'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          {member.termination_date ? (
                            <span className="text-sm">
                              {format(new Date(member.termination_date), 'MMM d, yyyy')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => restoreMemberMutation.mutate(member.id)}
                            disabled={restoreMemberMutation.isPending}
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Restore
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No removed team members</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Team Member Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update employment details for {selectedMember?.full_name || selectedMember?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="employmentStatus">Employment Status</Label>
              <Select value={editEmploymentStatus} onValueChange={(v) => setEditEmploymentStatus(v as EmploymentStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
              {editEmploymentStatus === 'on_leave' && (
                <p className="text-xs text-warning flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" />
                  Members on leave cannot be assigned to new jobs
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="hireDate">Hire Date</Label>
              <Input
                id="hireDate"
                type="date"
                value={editHireDate}
                onChange={(e) => setEditHireDate(e.target.value)}
              />
            </div>

            {editEmploymentStatus === 'terminated' && (
              <div className="space-y-2">
                <Label htmlFor="terminationDate">Termination Date</Label>
                <Input
                  id="terminationDate"
                  type="date"
                  value={editTerminationDate}
                  onChange={(e) => setEditTerminationDate(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
              <Input
                id="hourlyRate"
                type="number"
                step="0.01"
                min="0"
                value={editHourlyRate}
                onChange={(e) => setEditHourlyRate(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateTeamMemberMutation.isPending}
            >
              {updateTeamMemberMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedMember?.full_name || selectedMember?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    <span className="capitalize">{role}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmRoleChange}
              disabled={updateRoleMutation.isPending}
            >
              {updateRoleMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation */}
      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedMember?.full_name || selectedMember?.email} from your company?
              They will no longer have access to company data. You can restore them later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMemberMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite Member Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Enter the email address and role for the new team member. They'll receive an invitation email with login instructions.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newMemberName">Full Name</Label>
              <Input
                id="newMemberName"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newMemberEmail">Email *</Label>
              <Input
                id="newMemberEmail"
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="john@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newMemberRole">Role</Label>
              <Select value={newMemberRole} onValueChange={(v) => setNewMemberRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      <span className="capitalize">{role}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleInviteMember} 
              disabled={inviteMemberMutation.isPending || !newMemberEmail.trim()}
            >
              {inviteMemberMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <UserPlus className="w-4 h-4 mr-2" />
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TeamMembersManager;