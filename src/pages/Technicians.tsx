import { useState, useRef } from 'react';
import { useProfiles, useUpdateProfile, Profile } from '@/hooks/useProfiles';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, UserCog, Mail, Phone, Edit, Shield, Loader2, UserPlus, Camera, AlertTriangle, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { compressImageToFile } from '@/lib/imageCompression';
import { format } from 'date-fns';
import ViewMemberDialog from '@/components/team/ViewMemberDialog';
import PageContainer from '@/components/layout/PageContainer';

const AVAILABLE_ROLES = ['admin', 'manager', 'technician'] as const;
type AppRole = typeof AVAILABLE_ROLES[number];

const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'terminated'] as const;
type EmploymentStatus = typeof EMPLOYMENT_STATUSES[number];

const Technicians = () => {
  const { user, profile: currentProfile, isAdmin, isManager } = useAuth();
  const canManageTeam = isAdmin || isManager;
  const { data: profiles = [], isLoading } = useProfiles();
  const { data: company } = useCompany();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingMember, setViewingMember] = useState<Profile | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'technician' as AppRole,
    employment_status: 'active' as EmploymentStatus,
    hire_date: '',
    termination_date: '',
    hourly_rate: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    avatar_url: '',
  });
  
  // Add member form state
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<AppRole>('technician');

  // Filter to show only technicians, managers, and admins (not customers)
  const teamMembers = profiles.filter(p => p.role === 'admin' || p.role === 'technician' || p.role === 'manager');
  
  const filteredUsers = teamMembers.filter(p =>
    (p.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Update team member mutation with full profile data
  const updateTeamMemberMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      full_name: string;
      phone: string | null;
      role: AppRole;
      employment_status: EmploymentStatus;
      hire_date: string | null;
      termination_date: string | null;
      hourly_rate: number | null;
      address: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
      avatar_url: string | null;
    }) => {
      // Update role in user_roles table
      const { error: deleteError } = await (supabase as any)
        .from('user_roles')
        .delete()
        .eq('user_id', data.userId);
      
      if (deleteError) throw deleteError;

      const { error: insertError } = await (supabase as any)
        .from('user_roles')
        .insert({ user_id: data.userId, role: data.role });
      
      if (insertError) throw insertError;

      const updates: Record<string, any> = {
        full_name: data.full_name || null,
        role: data.role,
        employment_status: data.employment_status,
        hire_date: data.hire_date || null,
        phone: data.phone || null,
        hourly_rate: data.hourly_rate,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zip: data.zip || null,
        avatar_url: data.avatar_url || null,
      };

      // If terminating, also set deleted_at
      if (data.employment_status === 'terminated') {
        updates.termination_date = data.termination_date || new Date().toISOString().split('T')[0];
        updates.deleted_at = new Date().toISOString();
      } else {
        updates.termination_date = null;
      }

      const { error } = await (supabase as any)
        .from('profiles')
        .update(updates)
        .eq('id', data.userId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['team_members'] });
      if (variables.employment_status === 'terminated') {
        toast.success('Team member terminated');
      } else {
        toast.success('Team member updated successfully');
      }
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Failed to update member: ' + error.message);
    },
  });

  // Invite member mutation
  const inviteMemberMutation = useMutation({
    mutationFn: async ({ email, full_name, role }: { email: string; full_name: string; role: AppRole }) => {
      if (!currentProfile?.company_id) throw new Error('No company ID');
      
      const { data, error } = await supabase.functions.invoke('invite-team-member', {
        body: {
          email,
          full_name,
          role,
          company_id: currentProfile.company_id,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
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

  const resetForm = () => {
    setFormData({ 
      full_name: '', 
      email: '', 
      phone: '', 
      role: 'technician',
      employment_status: 'active',
      hire_date: '',
      termination_date: '',
      hourly_rate: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      avatar_url: '',
    });
    setEditingUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingUser) {
      toast.info('New team members must be added via Supabase Auth');
      return;
    }
    
    updateTeamMemberMutation.mutate({
      userId: editingUser,
      full_name: formData.full_name,
      phone: formData.phone || null,
      role: formData.role,
      employment_status: formData.employment_status,
      hire_date: formData.hire_date || null,
      termination_date: formData.termination_date || null,
      hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
      address: formData.address || null,
      city: formData.city || null,
      state: formData.state || null,
      zip: formData.zip || null,
      avatar_url: formData.avatar_url || null,
    });
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editingUser) return;

    setIsUploadingAvatar(true);
    try {
      const compressedFile = await compressImageToFile(file, 70, 400);
      const fileName = `${editingUser}-${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, compressedFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
      toast.success('Avatar uploaded');
    } catch (error: any) {
      toast.error('Failed to upload avatar: ' + error.message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleEdit = (profile: typeof profiles[0]) => {
    setFormData({
      full_name: profile.full_name || '',
      email: profile.email,
      phone: profile.phone || '',
      role: (profile.role as AppRole) || 'technician',
      employment_status: (profile.employment_status as EmploymentStatus) || 'active',
      hire_date: profile.hire_date || '',
      termination_date: profile.termination_date || '',
      hourly_rate: profile.hourly_rate?.toString() || '',
      address: profile.address || '',
      city: profile.city || '',
      state: profile.state || '',
      zip: profile.zip || '',
      avatar_url: profile.avatar_url || '',
    });
    setEditingUser(profile.id);
    setIsDialogOpen(true);
  };

  const handleViewMember = (profile: Profile) => {
    setViewingMember(profile);
    setIsViewDialogOpen(true);
  };

  const getCurrentUserRole = (): 'admin' | 'manager' | 'technician' => {
    if (isAdmin) return 'admin';
    if (isManager) return 'manager';
    return 'technician';
  };

  // Check if current user can edit a specific team member
  const canEditMember = (profile: typeof profiles[0]) => {
    // Can't edit yourself
    if (profile.id === user?.id) return false;
    
    // Admins can edit anyone
    if (isAdmin) return true;
    
    // Managers can only edit technicians, not other managers or admins
    if (isManager && (profile.role === 'admin' || profile.role === 'manager')) return false;
    
    return canManageTeam;
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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-primary/10 text-primary';
      case 'manager':
        return 'bg-secondary/50 text-secondary-foreground';
      case 'technician':
        return 'bg-accent/10 text-accent';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageContainer className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">Team Members</h1>
          <p className="text-muted-foreground mt-1 hidden sm:block">{teamMembers.length} team members</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative w-32 sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          
          {isAdmin && (
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <UserPlus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Member</span>
            </Button>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update details for {formData.full_name || formData.email}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={formData.avatar_url} alt={formData.full_name} />
                  <AvatarFallback className="text-lg">
                    {formData.full_name ? formData.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>
              <p className="text-xs text-muted-foreground">Click the camera to upload a photo</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="editRole">Role</Label>
              <Select 
                value={formData.role} 
                onValueChange={(v) => setFormData({ ...formData, role: v as AppRole })}
                disabled={editingUser === user?.id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ROLES.filter(role => {
                    // Managers cannot assign admin role - only admins can
                    if (role === 'admin' && !isAdmin) return false;
                    return true;
                  }).map((role) => (
                    <SelectItem key={role} value={role}>
                      <span className="capitalize">{role}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isAdmin && (
                <p className="text-xs text-muted-foreground">Only admins can assign the admin role</p>
              )}
              {editingUser === user?.id && (
                <p className="text-xs text-muted-foreground">You cannot change your own role</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="employmentStatus">Employment Status</Label>
              <Select 
                value={formData.employment_status} 
                onValueChange={(v) => setFormData({ ...formData, employment_status: v as EmploymentStatus })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
              {formData.employment_status === 'on_leave' && (
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
                value={formData.hire_date}
                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
              />
            </div>

            {formData.employment_status === 'terminated' && (
              <div className="space-y-2">
                <Label htmlFor="terminationDate">Termination Date</Label>
                <Input
                  id="terminationDate"
                  type="date"
                  value={formData.termination_date}
                  onChange={(e) => setFormData({ ...formData, termination_date: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                placeholder="0.00"
              />
            </div>

            {/* Address Section */}
            <div className="pt-4 border-t space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Address</h4>
              
              <div className="space-y-2">
                <Label htmlFor="editAddress">Street Address</Label>
                <Input
                  id="editAddress"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="editCity">City</Label>
                  <Input
                    id="editCity"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editState">State</Label>
                  <Input
                    id="editState"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="State"
                  />
                </div>
              </div>

              <div className="w-1/2 space-y-2">
                <Label htmlFor="editZip">ZIP Code</Label>
                <Input
                  id="editZip"
                  value={formData.zip}
                  onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                  placeholder="12345"
                />
              </div>
            </div>
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateTeamMemberMutation.isPending}>
                {updateTeamMemberMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Invite someone to join your company.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="newName">Full Name</Label>
              <Input
                id="newName"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newEmail">Email *</Label>
              <Input
                id="newEmail"
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="john@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newRole">Role</Label>
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
            <p className="text-xs text-muted-foreground">
              The user will be added to your company and receive an email to set their password.
            </p>
          </div>
          
          <DialogFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleInviteMember} 
              disabled={inviteMemberMutation.isPending || !newMemberEmail.trim()}
            >
              {inviteMemberMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <UserPlus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* View Member Dialog */}
      <ViewMemberDialog
        member={viewingMember}
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        currentUserRole={getCurrentUserRole()}
        onEdit={handleEdit}
        canEdit={viewingMember ? canEditMember(viewingMember) : false}
      />

      {/* Team Member List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((profile) => (
          <Card 
            key={profile.id} 
            className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleViewMember(profile)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name || 'User'} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {profile.full_name ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{profile.full_name || 'Unnamed'}</h3>
                      {profile.employment_status === 'on_leave' && (
                        <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          On Leave
                        </Badge>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getRoleBadge(profile.role)}`}>
                      {profile.role}
                    </span>
                  </div>
                </div>
                {canEditMember(profile) && (
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(profile);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{profile.email}</span>
                </div>
                {profile.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{profile.phone}</span>
                  </div>
                )}
              </div>

              {profile.id === user?.id && (
                <div className="mt-3 pt-3 border-t">
                  <span className="text-xs flex items-center gap-1 text-primary">
                    <Shield className="w-3 h-3" /> Current User
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <UserCog className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No team members found</h3>
          <p className="text-muted-foreground mt-1">
            {searchQuery ? 'Try a different search term' : 'No team members in your company yet'}
          </p>
        </div>
      )}
    </PageContainer>
  );
};

export default Technicians;
