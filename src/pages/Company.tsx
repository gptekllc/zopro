import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany, useUpdateCompany } from '@/hooks/useCompany';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Building2, Save, Loader2, Key, Plus, Copy, Trash2, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import JoinRequestsManager from '@/components/admin/JoinRequestsManager';
import TeamMembersManager from '@/components/team/TeamMembersManager';

const Company = () => {
  const { profile, isAdmin } = useAuth();
  const { data: company, isLoading } = useCompany();
  const updateCompany = useUpdateCompany();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
  });
  const [formInitialized, setFormInitialized] = useState(false);
  const [newCodeDays, setNewCodeDays] = useState('7');
  const [createCodeOpen, setCreateCodeOpen] = useState(false);

  // Initialize form when company loads
  if (company && !formInitialized) {
    setFormData({
      name: company.name || '',
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      zip: company.zip || '',
    });
    setFormInitialized(true);
  }

  // Fetch join codes
  const { data: joinCodes = [] } = useQuery({
    queryKey: ['join-codes', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await (supabase as any)
        .from('company_join_codes')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id && isAdmin,
  });

  // Generate new join code
  const createCodeMutation = useMutation({
    mutationFn: async (expiresInDays: number) => {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      
      const { error } = await (supabase as any)
        .from('company_join_codes')
        .insert({
          company_id: profile?.company_id,
          code,
          expires_at: expiresAt.toISOString(),
          created_by: profile?.id,
        });
      if (error) throw error;
      return code;
    },
    onSuccess: (code) => {
      queryClient.invalidateQueries({ queryKey: ['join-codes'] });
      toast.success(`New join code created: ${code}`);
      setCreateCodeOpen(false);
    },
    onError: (error: any) => toast.error(error.message),
  });

  // Deactivate join code
  const deactivateCodeMutation = useMutation({
    mutationFn: async (codeId: string) => {
      const { error } = await (supabase as any)
        .from('company_join_codes')
        .update({ is_active: false })
        .eq('id', codeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['join-codes'] });
      toast.success('Code deactivated');
    },
    onError: (error: any) => toast.error(error.message),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    await updateCompany.mutateAsync({ id: company.id, ...formData });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Copied to clipboard');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No company found</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Company Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your company details and team</p>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          {isAdmin && <TabsTrigger value="team">Team Members</TabsTrigger>}
          {isAdmin && <TabsTrigger value="join-codes">Join Codes</TabsTrigger>}
          {isAdmin && <TabsTrigger value="requests">Join Requests</TabsTrigger>}
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">ZIP</Label>
                    <Input
                      id="zip"
                      value={formData.zip}
                      onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" className="gap-2" disabled={updateCompany.isPending}>
                  {updateCompany.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="team">
            <TeamMembersManager />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="join-codes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Join Codes
                </CardTitle>
                <Dialog open={createCodeOpen} onOpenChange={setCreateCodeOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                      <Plus className="w-4 h-4" />
                      Generate Code
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Generate Join Code</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Expires in (days)</Label>
                        <Input
                          type="number"
                          value={newCodeDays}
                          onChange={(e) => setNewCodeDays(e.target.value)}
                          min="1"
                          max="365"
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => createCodeMutation.mutate(parseInt(newCodeDays))}
                        disabled={createCodeMutation.isPending}
                      >
                        {createCodeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Generate
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {joinCodes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No join codes yet</p>
                ) : (
                  <div className="space-y-3">
                    {joinCodes.map((code: any) => {
                      const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
                      const isActive = code.is_active && !isExpired;
                      return (
                        <div key={code.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <code className="bg-muted px-3 py-1 rounded font-mono text-lg">{code.code}</code>
                            {isActive ? (
                              <Badge variant="default" className="bg-green-500">Active</Badge>
                            ) : isExpired ? (
                              <Badge variant="secondary">Expired</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {code.expires_at && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(new Date(code.expires_at), 'MMM d, yyyy')}
                              </span>
                            )}
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => copyCode(code.code)}>
                                <Copy className="w-4 h-4" />
                              </Button>
                              {isActive && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deactivateCodeMutation.mutate(code.id)}
                                  disabled={deactivateCodeMutation.isPending}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="requests">
            <JoinRequestsManager />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Company;
