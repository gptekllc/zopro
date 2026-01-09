import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Search, Settings, HardDrive, Camera, Briefcase, Users, RefreshCw } from 'lucide-react';
import { formatBytes } from '@/hooks/useStorageUsage';

interface Company {
  id: string;
  name: string;
  subscription?: {
    plan_name: string;
    display_name: string;
    status: string;
  };
  storage_usage?: {
    total_bytes_used: number;
  };
  overrides?: Array<{
    limit_key: string;
    limit_value: number;
  }>;
}

const LIMIT_KEYS = [
  { key: 'max_photos_per_document', label: 'Photos per Document', icon: Camera, unit: 'photos' },
  { key: 'storage_limit_bytes', label: 'Storage Limit', icon: HardDrive, unit: 'bytes' },
  { key: 'max_jobs_per_month', label: 'Jobs per Month', icon: Briefcase, unit: 'jobs' },
  { key: 'max_users', label: 'Team Members', icon: Users, unit: 'users' },
];

export default function UsageLimitsTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideKey, setOverrideKey] = useState('');
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const queryClient = useQueryClient();

  // Fetch companies with usage data
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['admin-companies-usage', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('companies')
        .select(`
          id,
          name,
          company_subscriptions (
            status,
            subscription_plans (
              name,
              display_name
            )
          ),
          company_storage_usage (
            total_bytes_used
          ),
          company_usage_limits (
            limit_key,
            limit_value
          )
        `)
        .order('name');

      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;

      return (data || []).map((c: any) => {
        const subscription = c.company_subscriptions?.[0];
        // subscription_plans can be an object or array depending on the relationship
        const plan = subscription?.subscription_plans;
        const planData = Array.isArray(plan) ? plan[0] : plan;
        
        return {
          id: c.id,
          name: c.name,
          subscription: subscription ? {
            plan_name: planData?.name,
            display_name: planData?.display_name,
            status: subscription.status,
          } : undefined,
          storage_usage: c.company_storage_usage?.[0],
          overrides: c.company_usage_limits || [],
        };
      }) as Company[];
    },
    staleTime: 30 * 1000,
  });

  // Fetch plan defaults for reference
  const { data: planDefaults } = useQuery({
    queryKey: ['plan-defaults'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('name, max_photos_per_document, storage_limit_bytes, max_jobs_per_month, max_users');
      if (error) throw error;
      return data;
    },
  });

  // Set override mutation
  const setOverrideMutation = useMutation({
    mutationFn: async ({ companyId, limitKey, limitValue, reason }: {
      companyId: string;
      limitKey: string;
      limitValue: number;
      reason: string;
    }) => {
      const { error } = await supabase
        .from('company_usage_limits')
        .upsert({
          company_id: companyId,
          limit_key: limitKey,
          limit_value: limitValue,
          reason,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'company_id,limit_key',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Limit override saved');
      queryClient.invalidateQueries({ queryKey: ['admin-companies-usage'] });
      setOverrideDialogOpen(false);
      resetOverrideForm();
    },
    onError: (error: any) => {
      toast.error('Failed to save override', { description: error.message });
    },
  });

  // Remove override mutation
  const removeOverrideMutation = useMutation({
    mutationFn: async ({ companyId, limitKey }: { companyId: string; limitKey: string }) => {
      const { error } = await supabase
        .from('company_usage_limits')
        .delete()
        .eq('company_id', companyId)
        .eq('limit_key', limitKey);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Override removed');
      queryClient.invalidateQueries({ queryKey: ['admin-companies-usage'] });
    },
    onError: (error: any) => {
      toast.error('Failed to remove override', { description: error.message });
    },
  });

  // Recalculate storage mutation
  const recalculateStorageMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const { error } = await supabase.rpc('recalculate_company_storage', {
        p_company_id: companyId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Storage recalculated');
      queryClient.invalidateQueries({ queryKey: ['admin-companies-usage'] });
    },
    onError: (error: any) => {
      toast.error('Failed to recalculate storage', { description: error.message });
    },
  });

  const resetOverrideForm = () => {
    setOverrideKey('');
    setOverrideValue('');
    setOverrideReason('');
    setSelectedCompany(null);
  };

  const openOverrideDialog = (company: Company, limitKey?: string) => {
    setSelectedCompany(company);
    if (limitKey) {
      setOverrideKey(limitKey);
      const existingOverride = company.overrides?.find(o => o.limit_key === limitKey);
      setOverrideValue(existingOverride?.limit_value?.toString() || '');
    }
    setOverrideDialogOpen(true);
  };

  const handleSaveOverride = () => {
    if (!selectedCompany || !overrideKey || !overrideValue) {
      toast.error('Please fill all fields');
      return;
    }

    let valueToSave = parseInt(overrideValue);
    
    // Convert GB to bytes for storage
    if (overrideKey === 'storage_limit_bytes' && !overrideValue.includes('000000')) {
      valueToSave = parseInt(overrideValue) * 1024 * 1024 * 1024; // GB to bytes
    }

    setOverrideMutation.mutate({
      companyId: selectedCompany.id,
      limitKey: overrideKey,
      limitValue: valueToSave,
      reason: overrideReason,
    });
  };

  const getPlanDefault = (planName: string | undefined, limitKey: string) => {
    if (!planName || !planDefaults) return null;
    const plan = planDefaults.find(p => p.name === planName);
    if (!plan) return null;
    return (plan as any)[limitKey];
  };

  const getOverrideValue = (company: Company, limitKey: string) => {
    return company.overrides?.find(o => o.limit_key === limitKey)?.limit_value;
  };

  const getEffectiveValue = (company: Company, limitKey: string) => {
    const override = getOverrideValue(company, limitKey);
    if (override !== undefined) return override;
    return getPlanDefault(company.subscription?.plan_name, limitKey);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Company Usage Limits
          </CardTitle>
          <CardDescription>
            View and override usage limits for any company
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Photos/Doc</TableHead>
                  <TableHead>Jobs/Mo</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => {
                  const storageUsed = company.storage_usage?.total_bytes_used || 0;
                  const storageLimit = getEffectiveValue(company, 'storage_limit_bytes');
                  const storagePercent = storageLimit ? (storageUsed / storageLimit) * 100 : 0;

                  return (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {company.subscription?.display_name || 'No plan'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 min-w-[120px]">
                          <div className="text-xs text-muted-foreground">
                            {formatBytes(storageUsed)} / {storageLimit ? formatBytes(storageLimit) : '∞'}
                          </div>
                          {storageLimit && (
                            <Progress value={Math.min(storagePercent, 100)} className="h-1" />
                          )}
                          {getOverrideValue(company, 'storage_limit_bytes') !== undefined && (
                            <Badge variant="secondary" className="text-xs">Override</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getEffectiveValue(company, 'max_photos_per_document') ?? '∞'}
                          {getOverrideValue(company, 'max_photos_per_document') !== undefined && (
                            <Badge variant="secondary" className="text-xs">O</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getEffectiveValue(company, 'max_jobs_per_month') ?? '∞'}
                          {getOverrideValue(company, 'max_jobs_per_month') !== undefined && (
                            <Badge variant="secondary" className="text-xs">O</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getEffectiveValue(company, 'max_users') ?? '∞'}
                          {getOverrideValue(company, 'max_users') !== undefined && (
                            <Badge variant="secondary" className="text-xs">O</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openOverrideDialog(company)}
                            title="Set override"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => recalculateStorageMutation.mutate(company.id)}
                            disabled={recalculateStorageMutation.isPending}
                            title="Recalculate storage"
                          >
                            <RefreshCw className={`w-4 h-4 ${recalculateStorageMutation.isPending ? 'animate-spin' : ''}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Override Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Limit Override</DialogTitle>
            <DialogDescription>
              Override limits for {selectedCompany?.name}. This takes precedence over plan defaults.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Limit Type</Label>
              <Select value={overrideKey} onValueChange={setOverrideKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Select limit type" />
                </SelectTrigger>
                <SelectContent>
                  {LIMIT_KEYS.map((limit) => (
                    <SelectItem key={limit.key} value={limit.key}>
                      <div className="flex items-center gap-2">
                        <limit.icon className="w-4 h-4" />
                        {limit.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                New Value
                {overrideKey === 'storage_limit_bytes' && ' (in GB)'}
              </Label>
              <Input
                type="number"
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value)}
                placeholder={overrideKey === 'storage_limit_bytes' ? 'e.g., 50 for 50 GB' : 'Enter value'}
              />
              {selectedCompany && overrideKey && (
                <p className="text-xs text-muted-foreground">
                  Plan default: {
                    overrideKey === 'storage_limit_bytes'
                      ? formatBytes(getPlanDefault(selectedCompany.subscription?.plan_name, overrideKey) || 0)
                      : getPlanDefault(selectedCompany.subscription?.plan_name, overrideKey) ?? 'Unlimited'
                  }
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Why is this override being set?"
                rows={2}
              />
            </div>

            {selectedCompany && overrideKey && getOverrideValue(selectedCompany, overrideKey) !== undefined && (
              <Button
                variant="outline"
                className="w-full text-destructive"
                onClick={() => {
                  removeOverrideMutation.mutate({
                    companyId: selectedCompany.id,
                    limitKey: overrideKey,
                  });
                  setOverrideDialogOpen(false);
                  resetOverrideForm();
                }}
              >
                Remove Override (Use Plan Default)
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveOverride} disabled={setOverrideMutation.isPending}>
              {setOverrideMutation.isPending ? 'Saving...' : 'Save Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
