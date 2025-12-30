import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, Plus, Trash2, Edit, Shield, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Company {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company_id: string | null;
  role: string;
  created_at: string;
}

const SuperAdmin = () => {
  const { roles } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  
  const [companyForm, setCompanyForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
  });

  const isSuperAdmin = roles.some(r => r.role === 'super_admin');

  // Fetch all companies
  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ['all-companies'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Company[];
    },
    enabled: isSuperAdmin,
  });

  // Fetch all profiles
  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
    enabled: isSuperAdmin,
  });

  // Create/Update company mutation
  const companyMutation = useMutation({
    mutationFn: async (data: typeof companyForm & { id?: string }) => {
      if (data.id) {
        const { error } = await (supabase as any)
          .from('companies')
          .update({
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            address: data.address || null,
            city: data.city || null,
            state: data.state || null,
            zip: data.zip || null,
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('companies')
          .insert({
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            address: data.address || null,
            city: data.city || null,
            state: data.state || null,
            zip: data.zip || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-companies'] });
      toast.success(editingCompany ? 'Company updated' : 'Company created');
      setCompanyDialogOpen(false);
      resetCompanyForm();
    },
    onError: (error: any) => {
      toast.error('Failed: ' + error.message);
    },
  });

  // Delete company mutation
  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('companies')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-companies'] });
      toast.success('Company deleted');
    },
    onError: (error: any) => {
      toast.error('Failed: ' + error.message);
    },
  });

  // Assign user to company mutation
  const assignUserMutation = useMutation({
    mutationFn: async ({ userId, companyId }: { userId: string; companyId: string | null }) => {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ company_id: companyId })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-profiles'] });
      toast.success('User updated');
      setAssignDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error('Failed: ' + error.message);
    },
  });

  const resetCompanyForm = () => {
    setCompanyForm({ name: '', email: '', phone: '', address: '', city: '', state: '', zip: '' });
    setEditingCompany(null);
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setCompanyForm({
      name: company.name,
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      zip: company.zip || '',
    });
    setCompanyDialogOpen(true);
  };

  const handleAssignUser = (user: Profile) => {
    setSelectedUser(user);
    setSelectedCompanyId(user.company_id || '');
    setAssignDialogOpen(true);
  };

  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return 'Unassigned';
    return companies.find(c => c.id === companyId)?.name || 'Unknown';
  };

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProfiles = profiles.filter(p =>
    p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          You need super admin privileges to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            Super Admin
          </h1>
          <p className="text-muted-foreground mt-1">Manage companies and users</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="companies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="w-4 h-4" />
            Companies ({companies.length})
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            Users ({profiles.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Companies</CardTitle>
              <Dialog open={companyDialogOpen} onOpenChange={(open) => {
                setCompanyDialogOpen(open);
                if (!open) resetCompanyForm();
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Company
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingCompany ? 'Edit Company' : 'Create Company'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    companyMutation.mutate({ ...companyForm, id: editingCompany?.id });
                  }} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Company Name *</Label>
                      <Input
                        value={companyForm.name}
                        onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={companyForm.email}
                          onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={companyForm.phone}
                          onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Address</Label>
                      <Input
                        value={companyForm.address}
                        onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="City"
                        value={companyForm.city}
                        onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                      />
                      <Input
                        placeholder="State"
                        value={companyForm.state}
                        onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })}
                      />
                      <Input
                        placeholder="ZIP"
                        value={companyForm.zip}
                        onChange={(e) => setCompanyForm({ ...companyForm, zip: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setCompanyDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="flex-1" disabled={companyMutation.isPending}>
                        {companyMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {editingCompany ? 'Update' : 'Create'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingCompanies ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell>{company.email || '-'}</TableCell>
                        <TableCell>{company.phone || '-'}</TableCell>
                        <TableCell>
                          {company.city && company.state ? `${company.city}, ${company.state}` : '-'}
                        </TableCell>
                        <TableCell>{format(new Date(company.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditCompany(company)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('Delete this company?')) {
                                  deleteCompanyMutation.mutate(company.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredCompanies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No companies found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingProfiles ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProfiles.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.full_name || '-'}</TableCell>
                        <TableCell>{profile.email}</TableCell>
                        <TableCell>
                          <Badge variant={profile.company_id ? 'default' : 'secondary'}>
                            {getCompanyName(profile.company_id)}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{profile.role}</TableCell>
                        <TableCell>{format(new Date(profile.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleAssignUser(profile)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredProfiles.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Assign User Dialog */}
          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign User to Company</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">User</p>
                  <p className="font-medium">{selectedUser?.full_name || selectedUser?.email}</p>
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Company (Unassign)</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setAssignDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={assignUserMutation.isPending}
                    onClick={() => {
                      if (selectedUser) {
                        assignUserMutation.mutate({
                          userId: selectedUser.id,
                          companyId: selectedCompanyId === 'none' ? null : selectedCompanyId,
                        });
                      }
                    }}
                  >
                    {assignUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SuperAdmin;
