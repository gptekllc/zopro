import { useAuth } from '@/hooks/useAuth';
import { useUpdateProfile } from '@/hooks/useProfiles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Settings as SettingsIcon, User, Save, Loader2 } from 'lucide-react';

const Settings = () => {
  const { user, profile } = useAuth();
  const updateProfile = useUpdateProfile();
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      await updateProfile.mutateAsync({
        id: user.id,
        full_name: formData.full_name,
        phone: formData.phone,
      });
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings</p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="w-20 h-20">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {profile?.full_name ? getInitials(profile.full_name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg">{profile?.full_name || 'Unnamed User'}</h3>
              <p className="text-muted-foreground capitalize">User</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
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

            <Button type="submit" className="gap-2" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            About
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>App:</strong> Service App</p>
            <p><strong>Version:</strong> 1.0.0</p>
            <p className="text-muted-foreground">
              Multi-tenant service management platform for plumbing, HVAC, electrical, and general service companies.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
