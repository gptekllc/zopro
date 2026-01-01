import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCompany, useUpdateCompany } from '@/hooks/useCompany';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Save, Loader2, Globe, Receipt } from 'lucide-react';
import TeamMembersManager from '@/components/team/TeamMembersManager';
import LogoUpload from '@/components/company/LogoUpload';
import { TIMEZONES } from '@/lib/timezones';

const Company = () => {
  const { isAdmin } = useAuth();
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
    timezone: 'America/New_York',
  });
  const [billingData, setBillingData] = useState({
    tax_rate: 8.25,
    payment_terms_days: 30,
    late_fee_percentage: 0,
    default_payment_method: 'any',
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [formInitialized, setFormInitialized] = useState(false);

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
      timezone: company.timezone || 'America/New_York',
    });
    setBillingData({
      tax_rate: company.tax_rate ?? 8.25,
      payment_terms_days: company.payment_terms_days ?? 30,
      late_fee_percentage: company.late_fee_percentage ?? 0,
      default_payment_method: company.default_payment_method ?? 'any',
    });
    setLogoUrl(company.logo_url || null);
    setFormInitialized(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    await updateCompany.mutateAsync({ id: company.id, ...formData });
  };

  const handleBillingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    await updateCompany.mutateAsync({ 
      id: company.id, 
      tax_rate: billingData.tax_rate,
      payment_terms_days: billingData.payment_terms_days,
      late_fee_percentage: billingData.late_fee_percentage,
      default_payment_method: billingData.default_payment_method,
    });
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
          <TabsTrigger value="billing">Billing & Tax</TabsTrigger>
          {isAdmin && <TabsTrigger value="team">Team Members</TabsTrigger>}
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
              <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>Company Logo</Label>
                  <LogoUpload
                    companyId={company.id}
                    currentLogoUrl={logoUrl}
                    companyName={company.name}
                    onUploadSuccess={(url) => {
                      setLogoUrl(url);
                      queryClient.invalidateQueries({ queryKey: ['company'] });
                    }}
                  />
                </div>

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

                {/* Timezone Selection */}
                <div className="space-y-2">
                  <Label htmlFor="timezone" className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Company Timezone
                  </Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    This timezone will be used for all time tracking across your company
                  </p>
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

        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Billing & Tax Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBillingSubmit} className="space-y-6 max-w-xl">
                <div className="space-y-2">
                  <Label htmlFor="tax_rate">Default Tax Rate (%)</Label>
                  <Input
                    id="tax_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={billingData.tax_rate}
                    onChange={(e) => setBillingData({ ...billingData, tax_rate: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Applied to all new quotes, invoices, and jobs
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_terms">Payment Terms (days)</Label>
                  <Select
                    value={String(billingData.payment_terms_days)}
                    onValueChange={(value) => setBillingData({ ...billingData, payment_terms_days: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment terms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Net 7 (Due in 7 days)</SelectItem>
                      <SelectItem value="14">Net 14 (Due in 14 days)</SelectItem>
                      <SelectItem value="15">Net 15 (Due in 15 days)</SelectItem>
                      <SelectItem value="30">Net 30 (Due in 30 days)</SelectItem>
                      <SelectItem value="45">Net 45 (Due in 45 days)</SelectItem>
                      <SelectItem value="60">Net 60 (Due in 60 days)</SelectItem>
                      <SelectItem value="90">Net 90 (Due in 90 days)</SelectItem>
                      <SelectItem value="0">Due on Receipt</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Default due date for new invoices
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="late_fee">Late Fee (%)</Label>
                  <Input
                    id="late_fee"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={billingData.late_fee_percentage}
                    onChange={(e) => setBillingData({ ...billingData, late_fee_percentage: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Percentage charged on overdue invoices (0 to disable)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_method">Default Payment Method</Label>
                  <Select
                    value={billingData.default_payment_method}
                    onValueChange={(value) => setBillingData({ ...billingData, default_payment_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any Method</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="card">Credit/Debit Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer (ACH)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Preferred payment method shown on invoices
                  </p>
                </div>

                <Button type="submit" className="gap-2" disabled={updateCompany.isPending}>
                  {updateCompany.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Tax Settings
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
      </Tabs>
    </div>
  );
};

export default Company;