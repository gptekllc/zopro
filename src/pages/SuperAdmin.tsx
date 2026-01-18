import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, Users, Plus, Trash2, Edit, Shield, Loader2, Search, UserCog, LayoutDashboard, CreditCard, Wrench, History, BarChart3, ToggleLeft, Gauge, RotateCcw, MoreHorizontal, Webhook, MessageSquare } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import PageContainer from '@/components/layout/PageContainer';
import { OverviewTab } from '@/components/superadmin/OverviewTab';
import { SubscriptionsTab } from '@/components/superadmin/SubscriptionsTab';
import { SupportToolsTab } from '@/components/superadmin/SupportToolsTab';
import { AuditLogTab } from '@/components/superadmin/AuditLogTab';
import { AnalyticsTab } from '@/components/superadmin/AnalyticsTab';
import { FeatureFlagsTab } from '@/components/superadmin/FeatureFlagsTab';
import UsageLimitsTab from '@/components/superadmin/UsageLimitsTab';
import { DeletedItemsTab } from '@/components/superadmin/DeletedItemsTab';
import { WebhooksTab } from '@/components/superadmin/WebhooksTab';
import { EmailLogsTab } from '@/components/superadmin/EmailLogsTab';
import { SmsTab } from '@/components/superadmin/SmsTab';

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
  first_name: string | null;
  last_name: string | null;
  company_id: string | null;
  role: string;
  created_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'technician' | 'super_admin' | 'manager';
  created_at: string;
}

const AVAILABLE_ROLES = ['admin', 'manager', 'technician', 'super_admin'] as const;

const SuperAdmin = () => {
  const { roles } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedUserRoles, setSelectedUserRoles] = useState<string[]>([]);
  const [deleteCompanyId, setDeleteCompanyId] = useState<string | null>(null);
  
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
    enabled: isSuperAdmin,
  });

  // Fetch all user roles
  const { data: allUserRoles = [] } = useQuery({
    queryKey: ['all-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*');
      if (error) throw error;
      return data as UserRole[];
    },
    enabled: isSuperAdmin,
  });

  // Create/Update company mutation
  const companyMutation = useMutation({
    mutationFn: async (data: typeof companyForm & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
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
        const { error } = await supabase
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
      const { error } = await supabase
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
    mutationFn: async ({ userId, companyId, userEmail, userName }: { 
      userId: string; 
      companyId: string | null;
      userEmail: string;
      userName: string | null;
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ company_id: companyId })
        .eq('id', userId);
      if (error) throw error;

      const companyName = companyId ? companies.find(c => c.id === companyId)?.name : null;

      try {
        await supabase.functions.invoke('send-notification', {
          body: {
            type: 'company_assigned',
            recipientEmail: userEmail,
            recipientName: userName || 'User',
            companyName,
          },
        });
      } catch (emailError) {
        console.error('Failed to send notification email:', emailError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-profiles'] });
      toast.success('User company updated and notification sent');
      setAssignDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error('Failed: ' + error.message);
    },
  });

  // Update user roles mutation
  const updateRolesMutation = useMutation({
    mutationFn: async ({ userId, newRoles, userEmail, userName }: { 
      userId: string; 
      newRoles: string[];
      userEmail: string;
      userName: string | null;
    }) => {
      const currentRoles = allUserRoles.filter(r => r.user_id === userId);
      const currentRoleNames = currentRoles.map(r => r.role);
      
      const rolesToAdd = newRoles.filter(r => !currentRoleNames.includes(r as any));
      const rolesToRemove = currentRoleNames.filter(r => !newRoles.includes(r));
      
      for (const role of rolesToAdd) {
        const { error } = await supabase
          .from('user_roles')
          .insert([{ user_id: userId, role: role as any }]);
        if (error && !error.message.includes('duplicate')) throw error;
      }
      
      for (const role of rolesToRemove) {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', role);
        if (error) throw error;
      }
      
      const primaryRole = newRoles.includes('admin') ? 'admin' : 
                         newRoles.includes('manager') ? 'manager' :
                         newRoles.includes('technician') ? 'technician' : 'technician';
      await supabase
        .from('profiles')
        .update({ role: primaryRole })
        .eq('id', userId);

      try {
        await supabase.functions.invoke('send-notification', {
          body: {
            type: 'roles_changed',
            recipientEmail: userEmail,
            recipientName: userName || 'User',
            roles: newRoles,
            previousRoles: currentRoleNames,
          },
        });
      } catch (emailError) {
        console.error('Failed to send notification email:', emailError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['all-profiles'] });
      toast.success('User roles updated and notification sent');
      setRolesDialogOpen(false);
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

  const handleManageRoles = (user: Profile) => {
    setSelectedUser(user);
    const userRolesList = allUserRoles.filter(r => r.user_id === user.id).map(r => r.role);
    setSelectedUserRoles(userRolesList);
    setRolesDialogOpen(true);
  };

  const handleRoleToggle = (role: string) => {
    setSelectedUserRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return 'Unassigned';
    return companies.find(c => c.id === companyId)?.name || 'Unknown';
  };

  const getUserRoles = (userId: string) => {
    return allUserRoles.filter(r => r.user_id === userId).map(r => r.role);
  };

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProfiles = profiles.filter(p =>
    p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.first_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.last_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
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
    <PageContainer className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            Super Admin
          </h1>
          <p className="text-muted-foreground mt-1">Platform back office • God view</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="w-4 h-4" />
            Companies ({companies.length})
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            Users ({profiles.length})
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Subscriptions
          </TabsTrigger>
          <TabsTrigger value="support" className="gap-2">
            <Wrench className="w-4 h-4" />
            Support Tools
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="features" className="gap-2">
            <ToggleLeft className="w-4 h-4" />
            Feature Flags
          </TabsTrigger>
          <TabsTrigger value="limits" className="gap-2">
            <Gauge className="w-4 h-4" />
            Usage Limits
          </TabsTrigger>
          <TabsTrigger value="deleted" className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Deleted Items
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="w-4 h-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-2">
            <MoreHorizontal className="w-4 h-4" />
            Email Logs
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <History className="w-4 h-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <OverviewTab companies={companies} profiles={profiles} />
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies">
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
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
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Open menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditCompany(company)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteCompanyId(company.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
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
                        <TableHead>First Name</TableHead>
                        <TableHead>Last Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-32">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProfiles.map((profile) => {
                        const userRoles = getUserRoles(profile.id);
                        return (
                          <TableRow key={profile.id}>
                            <TableCell className="font-medium">{profile.first_name || '-'}</TableCell>
                            <TableCell>{profile.last_name || '-'}</TableCell>
                            <TableCell>{profile.email}</TableCell>
                            <TableCell>
                              <Badge variant={profile.company_id ? 'default' : 'secondary'}>
                                {getCompanyName(profile.company_id)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {userRoles.length > 0 ? (
                                  userRoles.map(role => (
                                    <Badge 
                                      key={role} 
                                      variant={role === 'super_admin' ? 'destructive' : role === 'admin' ? 'default' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {role.replace('_', ' ')}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-muted-foreground text-sm">No roles</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{format(new Date(profile.created_at), 'MMM d, yyyy')}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleAssignUser(profile)}
                                  title="Assign to Company"
                                >
                                  <Building2 className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleManageRoles(profile)}
                                  title="Manage Roles"
                                >
                                  <UserCog className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredProfiles.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No users found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Assign User to Company Dialog */}
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
                            userEmail: selectedUser.email,
                            userName: selectedUser.full_name,
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

            {/* Manage User Roles Dialog */}
            <Dialog open={rolesDialogOpen} onOpenChange={setRolesDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Manage User Roles</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">User</p>
                    <p className="font-medium">{selectedUser?.full_name || selectedUser?.email}</p>
                  </div>
                  <div className="space-y-3">
                    <Label>Roles</Label>
                    {AVAILABLE_ROLES.map((role) => (
                      <div key={role} className="flex items-center space-x-3 p-3 rounded-lg border">
                        <Checkbox
                          id={role}
                          checked={selectedUserRoles.includes(role)}
                          onCheckedChange={() => handleRoleToggle(role)}
                        />
                        <div className="flex-1">
                          <label 
                            htmlFor={role} 
                            className="font-medium capitalize cursor-pointer"
                          >
                            {role.replace('_', ' ')}
                          </label>
                          <p className="text-xs text-muted-foreground">
                            {role === 'super_admin' && 'Full access to all companies and users (God view)'}
                            {role === 'admin' && 'Manage company settings, team members, and view all data'}
                            {role === 'manager' && 'Manage jobs, schedules, and view reports'}
                            {role === 'technician' && 'Standard access to quotes, invoices, and time tracking'}
                          </p>
                        </div>
                        {role === 'super_admin' && (
                          <Badge variant="destructive" className="text-xs">Powerful</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setRolesDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={updateRolesMutation.isPending}
                      onClick={() => {
                        if (selectedUser) {
                          updateRolesMutation.mutate({
                            userId: selectedUser.id,
                            newRoles: selectedUserRoles,
                            userEmail: selectedUser.email,
                            userName: selectedUser.full_name,
                          });
                        }
                      }}
                    >
                      {updateRolesMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Save Roles
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions">
          <SubscriptionsTab companies={companies} />
        </TabsContent>

        {/* Support Tools Tab */}
        <TabsContent value="support">
          <SupportToolsTab profiles={profiles} companies={companies} />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <AnalyticsTab companies={companies} profiles={profiles} />
        </TabsContent>

        {/* Feature Flags Tab */}
        <TabsContent value="features">
          <FeatureFlagsTab companies={companies} />
        </TabsContent>

        {/* Usage Limits Tab */}
        <TabsContent value="limits">
          <UsageLimitsTab />
        </TabsContent>

        {/* Deleted Items Tab */}
        <TabsContent value="deleted">
          <DeletedItemsTab companies={companies} />
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks">
          <WebhooksTab />
        </TabsContent>

        {/* Email Logs Tab */}
        <TabsContent value="emails">
          <EmailLogsTab />
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <AuditLogTab profiles={profiles} />
        </TabsContent>
      </Tabs>

      {/* Delete Company Confirmation Dialog */}
      <AlertDialog open={!!deleteCompanyId} onOpenChange={(open) => !open && setDeleteCompanyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this company? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteCompanyId) {
                  deleteCompanyMutation.mutate(deleteCompanyId);
                  setDeleteCompanyId(null);
                }
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
};

export default SuperAdmin;
