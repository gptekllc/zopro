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
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Building2, Save, Loader2, Globe, Receipt, CreditCard, Settings, FileText, Briefcase, FileCheck, Mail, Palette } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import LogoUpload from '@/components/company/LogoUpload';
import StripeConnectSection from '@/components/company/StripeConnectSection';
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
  const [preferences, setPreferences] = useState({
    // PDF Preferences
    pdf_show_logo: true,
    pdf_show_notes: true,
    pdf_show_signature: true,
    pdf_show_line_item_details: true,
    pdf_terms_conditions: '',
    pdf_footer_text: '',
    // Job Settings
    default_job_duration: 60,
    default_job_priority: 'medium',
    require_job_completion_signature: false,
    auto_archive_days: 365,
    notify_on_job_assignment: true,
    // Quote Settings
    default_quote_validity_days: 30,
    auto_expire_quotes: true,
    require_quote_signature: false,
    // Invoice Settings
    auto_send_invoice_reminders: false,
    invoice_reminder_days: 7,
    auto_apply_late_fees: false,
    // Notification Preferences
    email_on_new_job: true,
    email_on_payment_received: true,
    send_weekly_summary: false,
    // Branding
    brand_primary_color: '#0066CC',
    customer_portal_welcome_message: '',
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [formInitialized, setFormInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

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
    setPreferences({
      pdf_show_logo: company.pdf_show_logo ?? true,
      pdf_show_notes: company.pdf_show_notes ?? true,
      pdf_show_signature: company.pdf_show_signature ?? true,
      pdf_show_line_item_details: company.pdf_show_line_item_details ?? true,
      pdf_terms_conditions: company.pdf_terms_conditions ?? '',
      pdf_footer_text: company.pdf_footer_text ?? '',
      default_job_duration: company.default_job_duration ?? 60,
      default_job_priority: company.default_job_priority ?? 'medium',
      require_job_completion_signature: company.require_job_completion_signature ?? false,
      auto_archive_days: company.auto_archive_days ?? 365,
      notify_on_job_assignment: company.notify_on_job_assignment ?? true,
      default_quote_validity_days: company.default_quote_validity_days ?? 30,
      auto_expire_quotes: company.auto_expire_quotes ?? true,
      require_quote_signature: company.require_quote_signature ?? false,
      auto_send_invoice_reminders: company.auto_send_invoice_reminders ?? false,
      invoice_reminder_days: company.invoice_reminder_days ?? 7,
      auto_apply_late_fees: company.auto_apply_late_fees ?? false,
      email_on_new_job: company.email_on_new_job ?? true,
      email_on_payment_received: company.email_on_payment_received ?? true,
      send_weekly_summary: company.send_weekly_summary ?? false,
      brand_primary_color: company.brand_primary_color ?? '#0066CC',
      customer_portal_welcome_message: company.customer_portal_welcome_message ?? '',
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

  const handlePreferencesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    await updateCompany.mutateAsync({ 
      id: company.id, 
      ...preferences,
      pdf_terms_conditions: preferences.pdf_terms_conditions || null,
      pdf_footer_text: preferences.pdf_footer_text || null,
      customer_portal_welcome_message: preferences.customer_portal_welcome_message || null,
    } as any);
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
        <p className="text-muted-foreground mt-1">Manage your company details and preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Mobile: Icon-only tabs */}
        <TabsList className="sm:hidden w-full grid grid-cols-4">
          <TabsTrigger value="details" className="flex-col gap-1 py-2">
            <Building2 className="w-5 h-5" />
            <span className="text-xs">Details</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex-col gap-1 py-2">
            <Receipt className="w-5 h-5" />
            <span className="text-xs">Billing</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex-col gap-1 py-2">
            <Settings className="w-5 h-5" />
            <span className="text-xs">Prefs</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="payments" className="flex-col gap-1 py-2">
              <CreditCard className="w-5 h-5" />
              <span className="text-xs">Payments</span>
            </TabsTrigger>
          )}
        </TabsList>
        
        {/* Desktop: Full tabs with icons */}
        <TabsList className="hidden sm:inline-flex">
          <TabsTrigger value="details" className="gap-2">
            <Building2 className="w-4 h-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <Receipt className="w-4 h-4" />
            Billing & Tax
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Settings className="w-4 h-4" />
            Preferences
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Payments
            </TabsTrigger>
          )}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Company Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePreferencesSubmit} className="space-y-6">
                <Accordion type="multiple" defaultValue={['pdf', 'jobs']} className="w-full">
                  {/* PDF Preferences */}
                  <AccordionItem value="pdf">
                    <AccordionTrigger className="text-base font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        PDF Preferences
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Show Logo in PDF</Label>
                          <p className="text-sm text-muted-foreground">Display company logo at the top of PDFs</p>
                        </div>
                        <Switch
                          checked={preferences.pdf_show_logo}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, pdf_show_logo: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Show Notes in PDF</Label>
                          <p className="text-sm text-muted-foreground">Display notes section in PDFs</p>
                        </div>
                        <Switch
                          checked={preferences.pdf_show_notes}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, pdf_show_notes: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Show Signature Section in PDF</Label>
                          <p className="text-sm text-muted-foreground">Display signature or signature field in PDFs</p>
                        </div>
                        <Switch
                          checked={preferences.pdf_show_signature}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, pdf_show_signature: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Show Line Item Details</Label>
                          <p className="text-sm text-muted-foreground">Show quantity and unit price for each item</p>
                        </div>
                        <Switch
                          checked={preferences.pdf_show_line_item_details}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, pdf_show_line_item_details: checked })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Terms & Conditions</Label>
                        <Textarea
                          placeholder="Enter your terms and conditions to display on PDFs..."
                          value={preferences.pdf_terms_conditions}
                          onChange={(e) => setPreferences({ ...preferences, pdf_terms_conditions: e.target.value })}
                          rows={4}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Footer Text</Label>
                        <Input
                          placeholder="Custom footer text for PDFs"
                          value={preferences.pdf_footer_text}
                          onChange={(e) => setPreferences({ ...preferences, pdf_footer_text: e.target.value })}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Job Settings */}
                  <AccordionItem value="jobs">
                    <AccordionTrigger className="text-base font-medium">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4" />
                        Job Settings
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Default Job Duration</Label>
                          <Select
                            value={String(preferences.default_job_duration)}
                            onValueChange={(value) => setPreferences({ ...preferences, default_job_duration: parseInt(value) })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="30">30 minutes</SelectItem>
                              <SelectItem value="60">1 hour</SelectItem>
                              <SelectItem value="90">1.5 hours</SelectItem>
                              <SelectItem value="120">2 hours</SelectItem>
                              <SelectItem value="180">3 hours</SelectItem>
                              <SelectItem value="240">4 hours</SelectItem>
                              <SelectItem value="480">8 hours</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Default Job Priority</Label>
                          <Select
                            value={preferences.default_job_priority}
                            onValueChange={(value) => setPreferences({ ...preferences, default_job_priority: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Require Customer Signature for Completion</Label>
                          <p className="text-sm text-muted-foreground">Jobs cannot be completed without a signature</p>
                        </div>
                        <Switch
                          checked={preferences.require_job_completion_signature}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, require_job_completion_signature: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Notify Technician on Assignment</Label>
                          <p className="text-sm text-muted-foreground">Send notification when a job is assigned</p>
                        </div>
                        <Switch
                          checked={preferences.notify_on_job_assignment}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, notify_on_job_assignment: checked })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Auto-archive After (days)</Label>
                        <Input
                          type="number"
                          min="30"
                          max="1825"
                          value={preferences.auto_archive_days}
                          onChange={(e) => setPreferences({ ...preferences, auto_archive_days: parseInt(e.target.value) || 365 })}
                        />
                        <p className="text-sm text-muted-foreground">Completed jobs will be archived after this many days</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Quote Settings */}
                  <AccordionItem value="quotes">
                    <AccordionTrigger className="text-base font-medium">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4" />
                        Quote Settings
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Default Quote Validity (days)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="365"
                          value={preferences.default_quote_validity_days}
                          onChange={(e) => setPreferences({ ...preferences, default_quote_validity_days: parseInt(e.target.value) || 30 })}
                        />
                        <p className="text-sm text-muted-foreground">How long quotes remain valid by default</p>
                      </div>
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Auto-expire Quotes</Label>
                          <p className="text-sm text-muted-foreground">Automatically mark quotes as expired past validity</p>
                        </div>
                        <Switch
                          checked={preferences.auto_expire_quotes}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, auto_expire_quotes: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Require Signature for Quote Approval</Label>
                          <p className="text-sm text-muted-foreground">Customers must sign to approve quotes</p>
                        </div>
                        <Switch
                          checked={preferences.require_quote_signature}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, require_quote_signature: checked })}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Invoice Settings */}
                  <AccordionItem value="invoices">
                    <AccordionTrigger className="text-base font-medium">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4" />
                        Invoice Settings
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Auto-send Payment Reminders</Label>
                          <p className="text-sm text-muted-foreground">Automatically send reminders for overdue invoices</p>
                        </div>
                        <Switch
                          checked={preferences.auto_send_invoice_reminders}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, auto_send_invoice_reminders: checked })}
                        />
                      </div>
                      {preferences.auto_send_invoice_reminders && (
                        <div className="space-y-2">
                          <Label>Days After Due Date to Send Reminder</Label>
                          <Input
                            type="number"
                            min="1"
                            max="90"
                            value={preferences.invoice_reminder_days}
                            onChange={(e) => setPreferences({ ...preferences, invoice_reminder_days: parseInt(e.target.value) || 7 })}
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Auto-apply Late Fees</Label>
                          <p className="text-sm text-muted-foreground">Automatically apply late fees to overdue invoices</p>
                        </div>
                        <Switch
                          checked={preferences.auto_apply_late_fees}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, auto_apply_late_fees: checked })}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Notification Preferences */}
                  <AccordionItem value="notifications">
                    <AccordionTrigger className="text-base font-medium">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Notification Preferences
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Email on New Job</Label>
                          <p className="text-sm text-muted-foreground">Receive email when a new job is created</p>
                        </div>
                        <Switch
                          checked={preferences.email_on_new_job}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, email_on_new_job: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Email on Payment Received</Label>
                          <p className="text-sm text-muted-foreground">Receive email when a payment is received</p>
                        </div>
                        <Switch
                          checked={preferences.email_on_payment_received}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, email_on_payment_received: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Send Weekly Summary</Label>
                          <p className="text-sm text-muted-foreground">Receive a weekly summary of business activity</p>
                        </div>
                        <Switch
                          checked={preferences.send_weekly_summary}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, send_weekly_summary: checked })}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Branding */}
                  <AccordionItem value="branding">
                    <AccordionTrigger className="text-base font-medium">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4" />
                        Branding
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Primary Brand Color</Label>
                        <div className="flex items-center gap-3">
                          <Input
                            type="color"
                            value={preferences.brand_primary_color}
                            onChange={(e) => setPreferences({ ...preferences, brand_primary_color: e.target.value })}
                            className="w-16 h-10 p-1 cursor-pointer"
                          />
                          <Input
                            value={preferences.brand_primary_color}
                            onChange={(e) => setPreferences({ ...preferences, brand_primary_color: e.target.value })}
                            placeholder="#0066CC"
                            className="flex-1"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">Used in customer-facing documents and portal</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Customer Portal Welcome Message</Label>
                        <Textarea
                          placeholder="Welcome to our customer portal! Here you can view your quotes, invoices, and job history."
                          value={preferences.customer_portal_welcome_message}
                          onChange={(e) => setPreferences({ ...preferences, customer_portal_welcome_message: e.target.value })}
                          rows={3}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <Button type="submit" className="gap-2" disabled={updateCompany.isPending}>
                  {updateCompany.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save All Preferences
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="payments">
            <StripeConnectSection company={company} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Company;
