import { useState } from 'react';
import { useTeamMembers, useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Users, UserCog, UserMinus, Loader2, Shield, Mail, UserPlus, Copy, Link2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const AVAILABLE_ROLES = ['admin', 'manager', 'technician', 'customer'] as const;
type AppRole = typeof AVAILABLE_ROLES[number];

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  roles?: { role: string }[];
}

const TeamMembersManager = () => {
  const { profile, user, isAdmin } = useAuth();
  const { data: teamMembers, isLoading } = useTeamMembers();
  const { data: company } = useCompany();
  const queryClient = useQueryClient();
  
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [joinCodes, setJoinCodes] = useState<any[]>([]);
  
  // Add member form state
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<AppRole>('technician');

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      // First, delete existing roles for this user
      const { error: deleteError } = await (supabase as any)
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) throw deleteError;

      // Insert the new role
      const { error: insertError } = await (supabase as any)
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });
      
      if (insertError) throw insertError;

      // Update the profile role field as well
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

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Remove from company by setting company_id to null
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ company_id: null })
        .eq('id', userId);
      
      if (error) throw error;

      // Delete their roles
      await (supabase as any)
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] });
      toast.success('Team member removed from company');
      setIsRemoveDialogOpen(false);
      setSelectedMember(null);
    },
    onError: (error: any) => {
      toast.error('Failed to remove member: ' + error.message);
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

  // Fetch join codes when opening add dialog
  const fetchJoinCodes = async () => {
    if (!profile?.company_id) return;
    const { data } = await (supabase as any)
      .from('company_join_codes')
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('is_active', true);
    setJoinCodes(data || []);
  };

  const handleOpenAddDialog = () => {
    fetchJoinCodes();
    setIsAddDialogOpen(true);
  };

  const copyJoinCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Join code copied to clipboard!');
  };

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

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'manager': return 'secondary';
      case 'technician': return 'outline';
      case 'customer': return 'outline';
      default: return 'outline';
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
          <Button onClick={handleOpenAddDialog}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Member
          </Button>
        </CardHeader>
        <CardContent>
          {teamMembers && teamMembers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
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
                        <span className="font-medium">
                          {member.full_name || 'Unnamed User'}
                          {member.id === user?.id && (
                            <span className="text-muted-foreground ml-2">(You)</span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        {member.email}
                      </div>
                    </TableCell>
                    <TableCell>{member.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(getMemberRole(member))}>
                        {getMemberRole(member)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {member.id !== user?.id && (
                        <div className="flex justify-end gap-2">
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
              <p>No team members yet. Share your join code to invite people!</p>
            </div>
          )}
        </CardContent>
      </Card>

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
                    <div className="flex items-center gap-2">
                      <span className="capitalize">{role}</span>
                    </div>
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
              They will no longer have access to company data.
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

      {/* Add Member Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Invite someone to join your company by sharing a join code.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="invite" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="invite">Share Join Code</TabsTrigger>
              <TabsTrigger value="manual">Manual Add</TabsTrigger>
            </TabsList>
            
            <TabsContent value="invite" className="space-y-4 pt-4">
              <div className="text-sm text-muted-foreground">
                Share your company's join code with team members. They can use it when signing up or from the onboarding screen.
              </div>
              
              {joinCodes.length > 0 ? (
                <div className="space-y-2">
                  {joinCodes.map((code) => (
                    <div 
                      key={code.id} 
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono font-bold text-lg tracking-wider">{code.code}</span>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => copyJoinCode(code.code)}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No active join codes. Create one from Company settings.
                </div>
              )}
              
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  <strong>How it works:</strong> The new team member signs up, enters this code, and an admin approves their request.
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="manual" className="space-y-4 pt-4">
              <div className="space-y-4">
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
              <p className="text-xs text-muted-foreground">
                The user will be created and added to your company. They'll receive an email to set their password.
              </p>
              <Button 
                onClick={handleInviteMember} 
                className="w-full"
                disabled={inviteMemberMutation.isPending || !newMemberEmail.trim()}
              >
                {inviteMemberMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <UserPlus className="w-4 h-4 mr-2" />
                Add Team Member
              </Button>
            </TabsContent>
          </Tabs>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TeamMembersManager;
