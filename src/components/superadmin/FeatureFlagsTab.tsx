import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Trash2, Building2, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { FEATURE_FLAGS, type FeatureFlag } from '@/hooks/useFeatureFlags';

interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  features: Record<string, boolean> | null;
}

interface Company {
  id: string;
  name: string;
}

interface FeatureOverride {
  id: string;
  company_id: string;
  feature_key: string;
  enabled: boolean;
  reason: string | null;
  companies?: { name: string };
}

interface FeatureFlagsTabProps {
  companies: Company[];
}

export function FeatureFlagsTab({ companies }: FeatureFlagsTabProps) {
  const queryClient = useQueryClient();
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedFeature, setSelectedFeature] = useState<FeatureFlag | ''>('');
  const [overrideEnabled, setOverrideEnabled] = useState(true);
  const [overrideReason, setOverrideReason] = useState('');

  // Fetch plans
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, display_name, features')
        .order('price_monthly');
      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });

  // Fetch all overrides
  const { data: overrides = [], isLoading: overridesLoading } = useQuery({
    queryKey: ['all-feature-overrides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_feature_overrides')
        .select('*, companies (name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FeatureOverride[];
    },
  });

  // Update plan features
  const updatePlanMutation = useMutation({
    mutationFn: async ({ planId, features }: { planId: string; features: Record<string, boolean> }) => {
      const { error } = await supabase
        .from('subscription_plans')
        .update({ features, updated_at: new Date().toISOString() })
        .eq('id', planId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      toast.success('Plan features updated');
    },
    onError: (error: any) => {
      toast.error('Failed: ' + error.message);
    },
  });

  // Add override
  const addOverrideMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('company_feature_overrides')
        .insert({
          company_id: selectedCompanyId,
          feature_key: selectedFeature,
          enabled: overrideEnabled,
          reason: overrideReason || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-feature-overrides'] });
      toast.success('Override added');
      setOverrideDialogOpen(false);
      resetOverrideForm();
    },
    onError: (error: any) => {
      toast.error('Failed: ' + error.message);
    },
  });

  // Delete override
  const deleteOverrideMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('company_feature_overrides')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-feature-overrides'] });
      toast.success('Override removed');
    },
  });

  const resetOverrideForm = () => {
    setSelectedCompanyId('');
    setSelectedFeature('');
    setOverrideEnabled(true);
    setOverrideReason('');
  };

  const featureKeys = Object.keys(FEATURE_FLAGS) as FeatureFlag[];

  return (
    <Tabs defaultValue="plans" className="space-y-6">
      <TabsList>
        <TabsTrigger value="plans" className="gap-2">
          <Layers className="w-4 h-4" />
          Plan Features
        </TabsTrigger>
        <TabsTrigger value="overrides" className="gap-2">
          <Building2 className="w-4 h-4" />
          Company Overrides
        </TabsTrigger>
      </TabsList>

      {/* Plan Features Tab */}
      <TabsContent value="plans" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Feature Flags by Plan</CardTitle>
            <CardDescription>
              Toggle switches directly to enable/disable features for each subscription tier
            </CardDescription>
          </CardHeader>
          <CardContent>
            {plansLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Feature</TableHead>
                    {plans.map(plan => (
                      <TableHead key={plan.id} className="text-center">
                        {plan.display_name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {featureKeys.map(feature => (
                    <TableRow key={feature}>
                      <TableCell className="font-medium">
                        <div>
                          <p className="capitalize">{feature.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-muted-foreground">
                            {FEATURE_FLAGS[feature]}
                          </p>
                        </div>
                      </TableCell>
                      {plans.map(plan => (
                        <TableCell key={plan.id} className="text-center">
                          <Switch
                            checked={plan.features?.[feature] || false}
                            onCheckedChange={(checked) => {
                              const newFeatures = { ...plan.features, [feature]: checked };
                              updatePlanMutation.mutate({ planId: plan.id, features: newFeatures });
                            }}
                            disabled={updatePlanMutation.isPending}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Company Overrides Tab */}
      <TabsContent value="overrides" className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Company Feature Overrides</CardTitle>
              <CardDescription>
                Enable or disable specific features for individual companies
              </CardDescription>
            </div>
            <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Override
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Feature Override</DialogTitle>
                  <DialogDescription>
                    Override a feature for a specific company regardless of their subscription plan.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map(company => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Feature</Label>
                    <Select value={selectedFeature} onValueChange={(v) => setSelectedFeature(v as FeatureFlag)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select feature" />
                      </SelectTrigger>
                      <SelectContent>
                        {featureKeys.map(feature => (
                          <SelectItem key={feature} value={feature}>
                            {feature.replace(/_/g, ' ')} - {FEATURE_FLAGS[feature]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Enable Feature</Label>
                    <Switch
                      checked={overrideEnabled}
                      onCheckedChange={setOverrideEnabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Reason (optional)</Label>
                    <Input
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Why is this override needed?"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setOverrideDialogOpen(false);
                        resetOverrideForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => addOverrideMutation.mutate()}
                      disabled={addOverrideMutation.isPending || !selectedCompanyId || !selectedFeature}
                    >
                      {addOverrideMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Add Override
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {overridesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : overrides.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No company overrides configured
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Feature</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overrides.map(override => (
                    <TableRow key={override.id}>
                      <TableCell className="font-medium">
                        {override.companies?.name || 'Unknown'}
                      </TableCell>
                      <TableCell className="capitalize">
                        {override.feature_key.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell>
                        {override.enabled ? (
                          <Badge className="bg-green-500">Enabled</Badge>
                        ) : (
                          <Badge variant="destructive">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {override.reason || '—'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteOverrideMutation.mutate(override.id)}
                          disabled={deleteOverrideMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
