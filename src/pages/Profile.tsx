import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { User, Mail, Phone, Building2, DollarSign, Loader2, Save, Camera, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { compressImageToFile } from '@/lib/imageCompression';

const Profile = () => {
  const { user, profile, roles, isLoading: authLoading, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    hourly_rate: 0,
    avatar_url: '',
  });
  const [isOnLeave, setIsOnLeave] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        hourly_rate: profile.hourly_rate || 0,
        avatar_url: profile.avatar_url || '',
      });
      setIsOnLeave(profile.employment_status === 'on_leave');
    }
  }, [profile]);

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingAvatar(true);
    try {
      // Compress to 70kb
      const compressedFile = await compressImageToFile(file, 70, 400);
      const fileName = `${user.id}-${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, compressedFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await (supabase as any)
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
      await refreshProfile();
      toast.success('Profile photo updated');
    } catch (error: any) {
      toast.error('Failed to upload photo: ' + error.message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);

    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone || null,
          hourly_rate: formData.hourly_rate || 0,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      toast.success('Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnLeaveToggle = async (checked: boolean) => {
    if (!user || !profile) return;

    setIsUpdatingStatus(true);
    try {
      const newStatus = checked ? 'on_leave' : 'active';
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ employment_status: newStatus })
        .eq('id', user.id);

      if (error) throw error;

      // If going on leave, notify managers in the same company
      if (checked && profile.company_id) {
        // Get all managers and admins in the same company
        const { data: managers } = await (supabase as any)
          .from('profiles')
          .select('id, full_name, email')
          .eq('company_id', profile.company_id)
          .in('role', ['admin', 'manager'])
          .neq('id', user.id);

        if (managers && managers.length > 0) {
          // Create in-app notifications for each manager
          const notifications = managers.map((manager: any) => ({
            user_id: manager.id,
            type: 'member_on_leave',
            title: 'Team Member On Leave',
            message: `${profile.full_name || profile.email} has set themselves as on leave.`,
            data: {
              member_id: user.id,
              member_name: profile.full_name,
              member_email: profile.email,
            },
          }));

          await (supabase as any)
            .from('notifications')
            .insert(notifications);
        }
      }

      setIsOnLeave(checked);
      await refreshProfile();
      toast.success(checked ? 'You are now marked as on leave' : 'You are now marked as active');
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status: ' + error.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings</p>
      </div>

      {/* Profile Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="w-20 h-20">
                <AvatarImage src={formData.avatar_url || undefined} alt={profile?.full_name || 'User'} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {getInitials(profile?.full_name)}
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
            <div className="flex-1">
              <h2 className="text-2xl font-semibold">{profile?.full_name || 'User'}</h2>
              <p className="text-muted-foreground">{profile?.email}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {roles.map(r => (
                  <Badge 
                    key={r.role} 
                    variant={r.role === 'super_admin' ? 'destructive' : r.role === 'admin' ? 'default' : 'secondary'}
                  >
                    {r.role.replace('_', ' ')}
                  </Badge>
                ))}
                {roles.length === 0 && (
                  <Badge variant="secondary">No roles assigned</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Personal Information
          </CardTitle>
          <CardDescription>
            Update your personal details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="John Smith"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="pl-9 bg-muted"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="hourly_rate"
                    type="number"
                    step="0.01"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isLoading} className="gap-2">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* On Leave Status */}
      <Card className={isOnLeave ? 'border-yellow-500/50 bg-yellow-500/5' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${isOnLeave ? 'text-yellow-600' : ''}`} />
            Availability Status
          </CardTitle>
          <CardDescription>
            Set yourself as on leave when you're unavailable for job assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">On Leave</p>
              <p className="text-sm text-muted-foreground">
                {isOnLeave 
                  ? "You won't be assigned to new jobs while on leave"
                  : "Toggle this when you need time off"
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isUpdatingStatus && <Loader2 className="w-4 h-4 animate-spin" />}
              <Switch
                checked={isOnLeave}
                onCheckedChange={handleOnLeaveToggle}
                disabled={isUpdatingStatus}
              />
            </div>
          </div>
          {isOnLeave && (
            <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm text-yellow-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                You are currently marked as on leave. Team members will see this status.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Info Card */}
      {profile?.company_id && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Company
            </CardTitle>
            <CardDescription>
              Your current company assignment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You are assigned to a company. Contact your administrator to change company assignment.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Profile;
