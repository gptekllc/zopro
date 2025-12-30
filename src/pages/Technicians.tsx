import { useState } from 'react';
import { useProfiles, useUpdateProfile } from '@/hooks/useProfiles';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, UserCog, Mail, Phone, Edit, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const Technicians = () => {
  const { user, profile: currentProfile } = useAuth();
  const { data: profiles = [], isLoading } = useProfiles();
  const updateProfile = useUpdateProfile();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'technician',
  });

  // Filter to show only technicians and admins
  const teamMembers = profiles.filter(p => p.role === 'admin' || p.role === 'technician');
  
  const filteredUsers = teamMembers.filter(p =>
    (p.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setFormData({ full_name: '', email: '', phone: '', role: 'technician' });
    setEditingUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingUser) {
      toast.info('New team members must be added via Supabase Auth');
      return;
    }
    
    try {
      await updateProfile.mutateAsync({
        id: editingUser,
        full_name: formData.full_name,
        phone: formData.phone,
        role: formData.role,
      });
      toast.success('Team member updated successfully');
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to update team member');
    }
  };

  const handleEdit = (profile: typeof profiles[0]) => {
    setFormData({
      full_name: profile.full_name || '',
      email: profile.email,
      phone: profile.phone || '',
      role: profile.role,
    });
    setEditingUser(profile.id);
    setIsDialogOpen(true);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-primary/10 text-primary';
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Team Members</h1>
          <p className="text-muted-foreground mt-1">{teamMembers.length} team members</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Team Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
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
                <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                  disabled={editingUser === user?.id}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                  </SelectContent>
                </Select>
                {editingUser === user?.id && (
                  <p className="text-xs text-muted-foreground">You cannot change your own role</p>
                )}
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={updateProfile.isPending}>
                  {updateProfile.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Update Member
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search team members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Team Member List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((profile) => (
          <Card key={profile.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserCog className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{profile.full_name || 'Unnamed'}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getRoleBadge(profile.role)}`}>
                      {profile.role}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(profile)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
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
    </div>
  );
};

export default Technicians;
