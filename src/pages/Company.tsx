import { useState, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCompany, useUpdateCompany } from '@/hooks/useCompany';
import { useDocumentMinNumbers } from '@/hooks/useDocumentMinNumbers';
import { usePaymentProviders } from '@/hooks/usePaymentProviders';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Building2, Save, Loader2, Globe, Receipt, CreditCard, Settings, FileText, Briefcase, FileCheck, Mail, Palette, Play, Zap, Send, Link as LinkIcon, Clock, BookTemplate, CalendarClock, Shield, ShieldCheck, Hash, ExternalLink, AlertCircle, Lock, Database } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import LogoUpload from '@/components/company/LogoUpload';
import StripeConnectSection from '@/components/company/StripeConnectSection';
import SocialLinksManager, { SocialLinksManagerRef } from '@/components/company/SocialLinksManager';
import { ComingSoonPaymentCard } from '@/components/company/ComingSoonPaymentCard';
import { TIMEZONES } from '@/lib/timezones';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/PageContainer';

// Import template components
import { JobTemplatesTab, QuoteTemplatesTab } from '@/pages/Templates';
import { EmailTemplatesTab } from '@/components/templates/EmailTemplatesTab';
import SecuritySettingsContent from '@/components/settings/SecuritySettingsContent';
import DataExportSection from '@/components/company/DataExportSection';
import DataImportSection from '@/components/company/DataImportSection';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

const Company = () => {
  const { isAdmin, profile } = useAuth();
  const { data: company, isLoading } = useCompany();
  const { data: minNumbers } = useDocumentMinNumbers();
  const { providers, comingSoonProviders, isLoading: providersLoading } = usePaymentProviders();
  const { isFeatureEnabled } = useFeatureFlags();
  const updateCompany = useUpdateCompany();
  const queryClient = useQueryClient();
  
  const isCustomDomainEnabled = isFeatureEnabled('custom_domain');
  const [customDomainError, setCustomDomainError] = useState<string | null>(null);
  const [sendingDomainNotification, setSendingDomainNotification] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    timezone: 'America/New_York',
  });
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
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
    pdf_show_job_photos: true,
    pdf_show_quote_photos: false,
    pdf_show_invoice_photos: false,
    pdf_terms_conditions: '',
    pdf_footer_text: '',
    // Email Templates
    email_job_body: 'Please find your job summary attached. We appreciate your business and look forward to serving you.',
    email_quote_body: 'Please find your quote attached. We appreciate the opportunity to serve you. This quote is valid for the period indicated.',
    email_invoice_body: 'Please find your invoice attached. We appreciate your business. Payment is due by the date indicated on the invoice.',
    // Job Settings
    default_job_duration: 60,
    default_job_priority: 'medium',
    require_job_completion_signature: false,
    auto_send_job_scheduled_email: true,
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
    notify_on_automation_run: true,
    // Branding
    brand_primary_color: '#0066CC',
    customer_portal_welcome_message: '',
    custom_domain: '',
    // Time Clock Preferences
    timeclock_enforce_job_labor: false,
    timeclock_allow_manual_labor_edit: true,
    timeclock_require_job_selection: false,
    timeclock_auto_start_break_reminder: 240,
    timeclock_max_shift_hours: 12,
    // Security
    require_mfa: false,
  });
  const [documentNumbering, setDocumentNumbering] = useState({
    job_number_prefix: 'J',
    job_number_padding: 3,
    job_number_include_year: true,
    job_next_number: 1,
    job_number_use_hyphens: true,
    quote_number_prefix: 'Q',
    quote_number_padding: 4,
    quote_number_include_year: true,
    quote_next_number: 1,
    quote_number_use_hyphens: true,
    invoice_number_prefix: 'I',
    invoice_number_padding: 4,
    invoice_number_include_year: true,
    invoice_next_number: 1,
    invoice_number_use_hyphens: true,
  });
  const [runningAutomations, setRunningAutomations] = useState(false);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [formInitialized, setFormInitialized] = useState(false);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    const validTabs = ['details', 'security', 'billing', 'preferences', 'templates', 'payments', 'data'];
    return tabParam && validTabs.includes(tabParam) ? tabParam : 'details';
  });
  const socialLinksRef = useRef<SocialLinksManagerRef>(null);
  
  const defaultBusinessHours = {
    monday: { open: '09:00', close: '17:00', closed: false },
    tuesday: { open: '09:00', close: '17:00', closed: false },
    wednesday: { open: '09:00', close: '17:00', closed: false },
    thursday: { open: '09:00', close: '17:00', closed: false },
    friday: { open: '09:00', close: '17:00', closed: false },
    saturday: { open: '09:00', close: '13:00', closed: true },
    sunday: { open: '09:00', close: '13:00', closed: true },
  };
  
  const [businessHours, setBusinessHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>(defaultBusinessHours);

  // Initialize form when company loads
  if (company && !formInitialized) {
    setFormData({
      name: company.name || '',
      email: company.email || '',
      phone: company.phone || '',
      website: (company as any).website || '',
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
      pdf_show_job_photos: (company as any).pdf_show_job_photos ?? true,
      pdf_show_quote_photos: (company as any).pdf_show_quote_photos ?? false,
      pdf_show_invoice_photos: (company as any).pdf_show_invoice_photos ?? false,
      pdf_terms_conditions: company.pdf_terms_conditions ?? '',
      pdf_footer_text: company.pdf_footer_text ?? '',
      email_job_body: (company as any).email_job_body ?? 'Please find your job summary attached. We appreciate your business and look forward to serving you.',
      email_quote_body: (company as any).email_quote_body ?? 'Please find your quote attached. We appreciate the opportunity to serve you. This quote is valid for the period indicated.',
      email_invoice_body: (company as any).email_invoice_body ?? 'Please find your invoice attached. We appreciate your business. Payment is due by the date indicated on the invoice.',
      default_job_duration: company.default_job_duration ?? 60,
      default_job_priority: company.default_job_priority ?? 'medium',
      require_job_completion_signature: company.require_job_completion_signature ?? false,
      auto_send_job_scheduled_email: (company as any).auto_send_job_scheduled_email ?? true,
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
      notify_on_automation_run: company.notify_on_automation_run ?? true,
      brand_primary_color: company.brand_primary_color ?? '#0066CC',
      customer_portal_welcome_message: company.customer_portal_welcome_message ?? '',
      custom_domain: (company as any).custom_domain ?? '',
      timeclock_enforce_job_labor: (company as any).timeclock_enforce_job_labor ?? false,
      timeclock_allow_manual_labor_edit: (company as any).timeclock_allow_manual_labor_edit ?? true,
      timeclock_require_job_selection: (company as any).timeclock_require_job_selection ?? false,
      timeclock_auto_start_break_reminder: (company as any).timeclock_auto_start_break_reminder ?? 240,
      timeclock_max_shift_hours: (company as any).timeclock_max_shift_hours ?? 12,
      require_mfa: company.require_mfa ?? false,
    });
    setBusinessHours((company as any).business_hours ?? defaultBusinessHours);
    setLogoUrl(company.logo_url || null);
    setDocumentNumbering({
      job_number_prefix: (company as any).job_number_prefix ?? 'J',
      job_number_padding: (company as any).job_number_padding ?? 3,
      job_number_include_year: (company as any).job_number_include_year ?? true,
      job_next_number: (company as any).job_next_number ?? 1,
      job_number_use_hyphens: (company as any).job_number_use_hyphens ?? true,
      quote_number_prefix: (company as any).quote_number_prefix ?? 'Q',
      quote_number_padding: (company as any).quote_number_padding ?? 4,
      quote_number_include_year: (company as any).quote_number_include_year ?? true,
      quote_next_number: (company as any).quote_next_number ?? 1,
      quote_number_use_hyphens: (company as any).quote_number_use_hyphens ?? true,
      invoice_number_prefix: (company as any).invoice_number_prefix ?? 'I',
      invoice_number_padding: (company as any).invoice_number_padding ?? 4,
      invoice_number_include_year: (company as any).invoice_number_include_year ?? true,
      invoice_next_number: (company as any).invoice_next_number ?? 1,
      invoice_number_use_hyphens: (company as any).invoice_number_use_hyphens ?? true,
    });
    setFormInitialized(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    
    // Save social links first
    if (socialLinksRef.current) {
      const socialLinksSuccess = await socialLinksRef.current.save();
      if (!socialLinksSuccess) return; // Stop if social links save failed
    }
    
    await updateCompany.mutateAsync({ 
      id: company.id, 
      ...formData,
      website: formData.website || null,
      business_hours: businessHours,
    } as any);
  };

  const handleSendTestEmail = async () => {
    if (!company || !formData.email) {
      toast.error('Company email is required to send a test email');
      return;
    }
    setSendingTestEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: { companyId: company.id, recipientEmail: formData.email },
      });
      
      if (error) throw error;
      
      toast.success(`Test email sent to ${formData.email}`);
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast.error('Failed to send test email: ' + error.message);
    } finally {
      setSendingTestEmail(false);
    }
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
      custom_domain: preferences.custom_domain || null,
      email_job_body: preferences.email_job_body || null,
      email_quote_body: preferences.email_quote_body || null,
      email_invoice_body: preferences.email_invoice_body || null,
    } as any);
  };

  const handleSaveSection = async (sectionKey: string, sectionFields: Partial<typeof preferences>) => {
    if (!company) return;
    setSavingSection(sectionKey);
    try {
      await updateCompany.mutateAsync({
        id: company.id,
        ...sectionFields,
      } as any);
    } finally {
      setSavingSection(null);
    }
  };

  const handleRunAutomations = async () => {
    if (!company) return;
    setRunningAutomations(true);
    try {
      const { data, error } = await supabase.functions.invoke('scheduled-automations', {
        body: { companyId: company.id },
      });
      
      if (error) throw error;
      
      const results = data?.results;
      if (results) {
        const messages = [];
        if (results.expiredQuotes > 0) messages.push(`${results.expiredQuotes} quotes expired`);
        if (results.remindersSent > 0) messages.push(`${results.remindersSent} reminders sent`);
        if (results.lateFeesApplied > 0) messages.push(`${results.lateFeesApplied} late fees applied`);
        
        if (messages.length > 0) {
          toast.success(`Automations completed: ${messages.join(', ')}`);
        } else {
          toast.info('No automations needed at this time');
        }
      } else {
        toast.success('Automations completed');
      }
    } catch (error: any) {
      console.error('Error running automations:', error);
      toast.error('Failed to run automations: ' + error.message);
    } finally {
      setRunningAutomations(false);
    }
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
    <PageContainer className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Header with tabs */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="shrink-0">
            <h1 className="text-2xl sm:text-3xl font-bold">Company Settings</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage your company details and preferences</p>
          </div>

          {/* Mobile/Tablet: Horizontal scrollable tabs */}
          <div className="lg:hidden -mx-4 px-4 overflow-x-auto scrollbar-hide">
            <TabsList className="inline-flex w-auto min-w-max gap-1">
              <TabsTrigger value="details" className="flex items-center gap-1.5 px-3 py-2">
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Details</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-1.5 px-3 py-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Security</span>
              </TabsTrigger>
              <TabsTrigger value="billing" className="flex items-center gap-1.5 px-3 py-2">
                <Receipt className="w-4 h-4 shrink-0" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Billing</span>
              </TabsTrigger>
              <TabsTrigger value="preferences" className="flex items-center gap-1.5 px-3 py-2">
                <Settings className="w-4 h-4 shrink-0" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Preferences</span>
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center gap-1.5 px-3 py-2">
                <BookTemplate className="w-4 h-4 shrink-0" />
                <span className="text-xs sm:text-sm whitespace-nowrap">Templates</span>
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="payments" className="flex items-center gap-1.5 px-3 py-2">
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span className="text-xs sm:text-sm whitespace-nowrap">Payments</span>
                </TabsTrigger>
              )}
              {isAdmin && (
                <TabsTrigger value="data" className="flex items-center gap-1.5 px-3 py-2">
                  <Database className="w-4 h-4 shrink-0" />
                  <span className="text-xs sm:text-sm whitespace-nowrap">Data</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>
          
          {/* Desktop: Full tabs with icons */}
          <TabsList className="hidden lg:inline-flex shrink-0">
            <TabsTrigger value="details" className="gap-2">
              <Building2 className="w-4 h-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <ShieldCheck className="w-4 h-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <Receipt className="w-4 h-4" />
              Billing & Tax
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2">
              <Settings className="w-4 h-4" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <BookTemplate className="w-4 h-4" />
              Templates
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="payments" className="gap-2">
                <CreditCard className="w-4 h-4" />
                Payments
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="data" className="gap-2">
                <Database className="w-4 h-4" />
                Data
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="details">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
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

                {/* Website */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-medium flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" />
                    Website
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website URL</Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://www.example.com"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    />
                    <p className="text-sm text-muted-foreground">
                      Your website will be displayed on invoices, quotes, and customer emails
                    </p>
                  </div>
                </div>

                {/* Social Links Manager */}
                <div className="pt-4 border-t">
                  <SocialLinksManager ref={socialLinksRef} companyId={company.id} />
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

                {/* Business Hours */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-medium flex items-center gap-2">
                    <CalendarClock className="w-4 h-4" />
                    Business Hours
                  </h3>
                  <div className="space-y-3">
                    {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => (
                      <div key={day} className="flex items-center gap-3">
                        <div className="w-24 shrink-0">
                          <Label className="capitalize text-sm">{day}</Label>
                        </div>
                        <Switch
                          checked={!businessHours[day]?.closed}
                          onCheckedChange={(checked) => 
                            setBusinessHours(prev => ({
                              ...prev,
                              [day]: { ...prev[day], closed: !checked }
                            }))
                          }
                        />
                        {!businessHours[day]?.closed ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              type="time"
                              value={businessHours[day]?.open || '09:00'}
                              onChange={(e) => 
                                setBusinessHours(prev => ({
                                  ...prev,
                                  [day]: { ...prev[day], open: e.target.value }
                                }))
                              }
                              className="w-auto"
                            />
                            <span className="text-muted-foreground text-sm">to</span>
                            <Input
                              type="time"
                              value={businessHours[day]?.close || '17:00'}
                              onChange={(e) => 
                                setBusinessHours(prev => ({
                                  ...prev,
                                  [day]: { ...prev[day], close: e.target.value }
                                }))
                              }
                              className="w-auto"
                            />
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Closed</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Set your company's operating hours for each day of the week
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button type="submit" className="gap-2" disabled={updateCompany.isPending}>
                    {updateCompany.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Changes
                  </Button>
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="gap-2" 
                    onClick={handleSendTestEmail}
                    disabled={sendingTestEmail || !formData.email}
                  >
                    {sendingTestEmail ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Send Test Email
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <SecuritySettingsContent mode="admin" />
        </TabsContent>

        <TabsContent value="billing">
          <div className="space-y-6 max-w-2xl mx-auto">
            {/* Subscription Link Card */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Subscription & Billing</p>
                    <p className="text-sm text-muted-foreground">Manage your plan, usage, and payment methods</p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/subscription">Manage</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Tax Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBillingSubmit} className="space-y-6">
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
          </div>
        </TabsContent>

        <TabsContent value="preferences">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Company Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePreferencesSubmit} className="space-y-6">
                <Accordion type="multiple" defaultValue={[]} className="w-full">
                  {/* Document Numbering */}
                  <AccordionItem value="document-numbering">
                    <AccordionTrigger className="text-base font-medium">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        Document Numbering
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 pt-4">
                      <p className="text-sm text-muted-foreground">
                        Customize the format of job, quote, and invoice numbers. Changes only affect new documents.
                      </p>
                      
                      {/* Job Numbers */}
                      <div className="space-y-3 p-4 border rounded-lg">
                        <Label className="font-medium">Job Numbers</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Prefix</Label>
                            <Input
                              value={documentNumbering.job_number_prefix}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 10);
                                setDocumentNumbering({ ...documentNumbering, job_number_prefix: value });
                              }}
                              placeholder="J"
                              maxLength={10}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Include Year</Label>
                            <Select
                              value={documentNumbering.job_number_include_year ? 'yes' : 'no'}
                              onValueChange={(value) => setDocumentNumbering({ ...documentNumbering, job_number_include_year: value === 'yes' })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Hyphens</Label>
                            <Select
                              value={documentNumbering.job_number_use_hyphens ? 'yes' : 'no'}
                              onValueChange={(value) => setDocumentNumbering({ ...documentNumbering, job_number_use_hyphens: value === 'yes' })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Digits</Label>
                            <Select
                              value={documentNumbering.job_number_padding.toString()}
                              onValueChange={(value) => setDocumentNumbering({ ...documentNumbering, job_number_padding: parseInt(value) })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="2">2</SelectItem>
                                <SelectItem value="3">3</SelectItem>
                                <SelectItem value="4">4</SelectItem>
                                <SelectItem value="5">5</SelectItem>
                                <SelectItem value="6">6</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Start From</Label>
                            <Input
                              type="number"
                              min={minNumbers?.job || 1}
                              value={documentNumbering.job_next_number}
                              onChange={(e) => {
                                const value = Math.max(1, parseInt(e.target.value) || 1);
                                setDocumentNumbering({ ...documentNumbering, job_next_number: value });
                              }}
                              placeholder="1"
                              className={documentNumbering.job_next_number < (minNumbers?.job || 1) ? 'border-amber-500' : ''}
                            />
                            {minNumbers && documentNumbering.job_next_number < minNumbers.job && (
                              <p className="text-xs text-amber-600">Will auto-skip existing (highest: {minNumbers.job - 1})</p>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                          Next number: <span className="font-mono font-medium text-foreground">
                            {documentNumbering.job_number_prefix}{documentNumbering.job_number_use_hyphens ? '-' : ''}
                            {documentNumbering.job_number_include_year ? `${new Date().getFullYear()}${documentNumbering.job_number_use_hyphens ? '-' : ''}` : ''}
                            {documentNumbering.job_next_number.toString().padStart(documentNumbering.job_number_padding, '0')}
                          </span>
                        </div>
                      </div>

                      {/* Quote Numbers */}
                      <div className="space-y-3 p-4 border rounded-lg">
                        <Label className="font-medium">Quote Numbers</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Prefix</Label>
                            <Input
                              value={documentNumbering.quote_number_prefix}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 10);
                                setDocumentNumbering({ ...documentNumbering, quote_number_prefix: value });
                              }}
                              placeholder="Q"
                              maxLength={10}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Include Year</Label>
                            <Select
                              value={documentNumbering.quote_number_include_year ? 'yes' : 'no'}
                              onValueChange={(value) => setDocumentNumbering({ ...documentNumbering, quote_number_include_year: value === 'yes' })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Hyphens</Label>
                            <Select
                              value={documentNumbering.quote_number_use_hyphens ? 'yes' : 'no'}
                              onValueChange={(value) => setDocumentNumbering({ ...documentNumbering, quote_number_use_hyphens: value === 'yes' })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Digits</Label>
                            <Select
                              value={documentNumbering.quote_number_padding.toString()}
                              onValueChange={(value) => setDocumentNumbering({ ...documentNumbering, quote_number_padding: parseInt(value) })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="2">2</SelectItem>
                                <SelectItem value="3">3</SelectItem>
                                <SelectItem value="4">4</SelectItem>
                                <SelectItem value="5">5</SelectItem>
                                <SelectItem value="6">6</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Start From</Label>
                            <Input
                              type="number"
                              min={minNumbers?.quote || 1}
                              value={documentNumbering.quote_next_number}
                              onChange={(e) => {
                                const value = Math.max(1, parseInt(e.target.value) || 1);
                                setDocumentNumbering({ ...documentNumbering, quote_next_number: value });
                              }}
                              placeholder="1"
                              className={documentNumbering.quote_next_number < (minNumbers?.quote || 1) ? 'border-amber-500' : ''}
                            />
                            {minNumbers && documentNumbering.quote_next_number < minNumbers.quote && (
                              <p className="text-xs text-amber-600">Will auto-skip existing (highest: {minNumbers.quote - 1})</p>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                          Next number: <span className="font-mono font-medium text-foreground">
                            {documentNumbering.quote_number_prefix}{documentNumbering.quote_number_use_hyphens ? '-' : ''}
                            {documentNumbering.quote_number_include_year ? `${new Date().getFullYear()}${documentNumbering.quote_number_use_hyphens ? '-' : ''}` : ''}
                            {documentNumbering.quote_next_number.toString().padStart(documentNumbering.quote_number_padding, '0')}
                          </span>
                        </div>
                      </div>

                      {/* Invoice Numbers */}
                      <div className="space-y-3 p-4 border rounded-lg">
                        <Label className="font-medium">Invoice Numbers</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Prefix</Label>
                            <Input
                              value={documentNumbering.invoice_number_prefix}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 10);
                                setDocumentNumbering({ ...documentNumbering, invoice_number_prefix: value });
                              }}
                              placeholder="I"
                              maxLength={10}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Include Year</Label>
                            <Select
                              value={documentNumbering.invoice_number_include_year ? 'yes' : 'no'}
                              onValueChange={(value) => setDocumentNumbering({ ...documentNumbering, invoice_number_include_year: value === 'yes' })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Hyphens</Label>
                            <Select
                              value={documentNumbering.invoice_number_use_hyphens ? 'yes' : 'no'}
                              onValueChange={(value) => setDocumentNumbering({ ...documentNumbering, invoice_number_use_hyphens: value === 'yes' })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Digits</Label>
                            <Select
                              value={documentNumbering.invoice_number_padding.toString()}
                              onValueChange={(value) => setDocumentNumbering({ ...documentNumbering, invoice_number_padding: parseInt(value) })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="2">2</SelectItem>
                                <SelectItem value="3">3</SelectItem>
                                <SelectItem value="4">4</SelectItem>
                                <SelectItem value="5">5</SelectItem>
                                <SelectItem value="6">6</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Start From</Label>
                            <Input
                              type="number"
                              min={minNumbers?.invoice || 1}
                              value={documentNumbering.invoice_next_number}
                              onChange={(e) => {
                                const value = Math.max(1, parseInt(e.target.value) || 1);
                                setDocumentNumbering({ ...documentNumbering, invoice_next_number: value });
                              }}
                              placeholder="1"
                              className={documentNumbering.invoice_next_number < (minNumbers?.invoice || 1) ? 'border-amber-500' : ''}
                            />
                            {minNumbers && documentNumbering.invoice_next_number < minNumbers.invoice && (
                              <p className="text-xs text-amber-600">Will auto-skip existing (highest: {minNumbers.invoice - 1})</p>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                          Next number: <span className="font-mono font-medium text-foreground">
                            {documentNumbering.invoice_number_prefix}{documentNumbering.invoice_number_use_hyphens ? '-' : ''}
                            {documentNumbering.invoice_number_include_year ? `${new Date().getFullYear()}${documentNumbering.invoice_number_use_hyphens ? '-' : ''}` : ''}
                            {documentNumbering.invoice_next_number.toString().padStart(documentNumbering.invoice_number_padding, '0')}
                          </span>
                        </div>
                      </div>

                      <div className="pt-4 border-t">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={
                            savingSection === 'numbering' || 
                            !documentNumbering.job_number_prefix || 
                            !documentNumbering.quote_number_prefix || 
                            !documentNumbering.invoice_number_prefix
                          }
                          onClick={() => {
                            handleSaveSection('numbering', {
                              job_number_prefix: documentNumbering.job_number_prefix,
                              job_number_padding: documentNumbering.job_number_padding,
                              job_number_include_year: documentNumbering.job_number_include_year,
                              job_next_number: documentNumbering.job_next_number,
                              job_number_use_hyphens: documentNumbering.job_number_use_hyphens,
                              quote_number_prefix: documentNumbering.quote_number_prefix,
                              quote_number_padding: documentNumbering.quote_number_padding,
                              quote_number_include_year: documentNumbering.quote_number_include_year,
                              quote_next_number: documentNumbering.quote_next_number,
                              quote_number_use_hyphens: documentNumbering.quote_number_use_hyphens,
                              invoice_number_prefix: documentNumbering.invoice_number_prefix,
                              invoice_number_padding: documentNumbering.invoice_number_padding,
                              invoice_number_include_year: documentNumbering.invoice_number_include_year,
                              invoice_next_number: documentNumbering.invoice_next_number,
                              invoice_number_use_hyphens: documentNumbering.invoice_number_use_hyphens,
                            } as any);
                          }}
                        >
                          {savingSection === 'numbering' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Numbering Settings
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

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
                      
                      {/* Photo Settings */}
                      <div className="space-y-3 pt-3 border-t">
                        <Label className="text-sm font-medium text-muted-foreground">Photo Settings</Label>
                        <div className="flex items-center justify-between space-x-4">
                          <div className="space-y-0.5">
                            <Label className="font-medium">Include Photos in Job PDFs</Label>
                            <p className="text-sm text-muted-foreground">Show before/after photos in job summary PDFs</p>
                          </div>
                          <Switch
                            checked={preferences.pdf_show_job_photos}
                            onCheckedChange={(checked) => setPreferences({ ...preferences, pdf_show_job_photos: checked })}
                          />
                        </div>
                        <div className="flex items-center justify-between space-x-4">
                          <div className="space-y-0.5">
                            <Label className="font-medium">Include Photos in Quote PDFs</Label>
                            <p className="text-sm text-muted-foreground">Show job photos in quote PDFs (when linked to a job)</p>
                          </div>
                          <Switch
                            checked={preferences.pdf_show_quote_photos}
                            onCheckedChange={(checked) => setPreferences({ ...preferences, pdf_show_quote_photos: checked })}
                          />
                        </div>
                        <div className="flex items-center justify-between space-x-4">
                          <div className="space-y-0.5">
                            <Label className="font-medium">Include Photos in Invoice PDFs</Label>
                            <p className="text-sm text-muted-foreground">Show job photos in invoice PDFs (when linked to a job)</p>
                          </div>
                          <Switch
                            checked={preferences.pdf_show_invoice_photos}
                            onCheckedChange={(checked) => setPreferences({ ...preferences, pdf_show_invoice_photos: checked })}
                          />
                        </div>
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
                      <div className="pt-4 border-t">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={savingSection === 'pdf'}
                          onClick={() => handleSaveSection('pdf', {
                            pdf_show_logo: preferences.pdf_show_logo,
                            pdf_show_notes: preferences.pdf_show_notes,
                            pdf_show_signature: preferences.pdf_show_signature,
                            pdf_show_line_item_details: preferences.pdf_show_line_item_details,
                            pdf_show_job_photos: preferences.pdf_show_job_photos,
                            pdf_show_quote_photos: preferences.pdf_show_quote_photos,
                            pdf_show_invoice_photos: preferences.pdf_show_invoice_photos,
                            pdf_terms_conditions: preferences.pdf_terms_conditions || null,
                            pdf_footer_text: preferences.pdf_footer_text || null,
                          } as any)}
                        >
                          {savingSection === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save PDF Settings
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Email Templates */}
                  <AccordionItem value="email-templates">
                    <AccordionTrigger className="text-base font-medium">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email Templates
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <p className="text-sm text-muted-foreground">
                        Customize the email body text that is sent when you email jobs, quotes, or invoices to customers. The document will be attached to the email.
                      </p>
                      <div className="space-y-2">
                        <Label>Job Email Body</Label>
                        <Textarea
                          placeholder="Enter the email body for job emails..."
                          value={preferences.email_job_body}
                          onChange={(e) => setPreferences({ ...preferences, email_job_body: e.target.value })}
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground">This text will appear when you send job summaries to customers.</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Quote Email Body</Label>
                        <Textarea
                          placeholder="Enter the email body for quote emails..."
                          value={preferences.email_quote_body}
                          onChange={(e) => setPreferences({ ...preferences, email_quote_body: e.target.value })}
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground">This text will appear when you send quotes to customers.</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Invoice Email Body</Label>
                        <Textarea
                          placeholder="Enter the email body for invoice emails..."
                          value={preferences.email_invoice_body}
                          onChange={(e) => setPreferences({ ...preferences, email_invoice_body: e.target.value })}
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground">This text will appear when you send invoices to customers.</p>
                      </div>
                      <div className="pt-4 border-t">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={savingSection === 'email'}
                          onClick={() => handleSaveSection('email', {
                            email_job_body: preferences.email_job_body || null,
                            email_quote_body: preferences.email_quote_body || null,
                            email_invoice_body: preferences.email_invoice_body || null,
                          } as any)}
                        >
                          {savingSection === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Email Settings
                        </Button>
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
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Auto-send Email When Job Scheduled</Label>
                          <p className="text-sm text-muted-foreground">Automatically email customer when job status changes to scheduled</p>
                        </div>
                        <Switch
                          checked={preferences.auto_send_job_scheduled_email}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, auto_send_job_scheduled_email: checked })}
                        />
                      </div>
                      <div className="pt-4 border-t">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={savingSection === 'jobs'}
                          onClick={() => handleSaveSection('jobs', {
                            default_job_duration: preferences.default_job_duration,
                            default_job_priority: preferences.default_job_priority,
                            require_job_completion_signature: preferences.require_job_completion_signature,
                            notify_on_job_assignment: preferences.notify_on_job_assignment,
                            auto_send_job_scheduled_email: preferences.auto_send_job_scheduled_email,
                          } as any)}
                        >
                          {savingSection === 'jobs' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Job Settings
                        </Button>
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
                      <div className="pt-4 border-t">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={savingSection === 'quotes'}
                          onClick={() => handleSaveSection('quotes', {
                            default_quote_validity_days: preferences.default_quote_validity_days,
                            auto_expire_quotes: preferences.auto_expire_quotes,
                            require_quote_signature: preferences.require_quote_signature,
                          } as any)}
                        >
                          {savingSection === 'quotes' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Quote Settings
                        </Button>
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
                      <div className="pt-4 border-t">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={savingSection === 'invoices'}
                          onClick={() => handleSaveSection('invoices', {
                            auto_send_invoice_reminders: preferences.auto_send_invoice_reminders,
                            invoice_reminder_days: preferences.invoice_reminder_days,
                            auto_apply_late_fees: preferences.auto_apply_late_fees,
                          } as any)}
                        >
                          {savingSection === 'invoices' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Invoice Settings
                        </Button>
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
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Notify on Automation Run</Label>
                          <p className="text-sm text-muted-foreground">Get notified when automated tasks complete (expired quotes, reminders, late fees)</p>
                        </div>
                        <Switch
                          checked={preferences.notify_on_automation_run}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, notify_on_automation_run: checked })}
                        />
                      </div>
                      <div className="pt-4 border-t">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={savingSection === 'notifications'}
                          onClick={() => handleSaveSection('notifications', {
                            email_on_new_job: preferences.email_on_new_job,
                            email_on_payment_received: preferences.email_on_payment_received,
                            send_weekly_summary: preferences.send_weekly_summary,
                            notify_on_automation_run: preferences.notify_on_automation_run,
                          } as any)}
                        >
                          {savingSection === 'notifications' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Notification Settings
                        </Button>
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
                      {/* Custom Domain URL - Feature Gated */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Label className={!isCustomDomainEnabled ? 'text-muted-foreground' : ''}>
                            Custom Domain URL
                          </Label>
                          <Badge variant="secondary" className="text-xs">Professional+</Badge>
                          {!isCustomDomainEnabled && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                        
                        <div className="relative">
                          <Input
                            placeholder="https://portal.yourdomain.com"
                            value={preferences.custom_domain}
                            onChange={(e) => {
                              const value = e.target.value;
                              setPreferences({ ...preferences, custom_domain: value });
                              
                              // Validate URL format
                              if (value && value.trim() !== '') {
                                try {
                                  const url = new URL(value);
                                  if (url.protocol !== 'https:') {
                                    setCustomDomainError('URL must use HTTPS protocol');
                                  } else if (!url.hostname.includes('.')) {
                                    setCustomDomainError('Please enter a valid domain (e.g., portal.yourdomain.com)');
                                  } else {
                                    setCustomDomainError(null);
                                  }
                                } catch {
                                  setCustomDomainError('Please enter a valid URL (e.g., https://portal.yourdomain.com)');
                                }
                              } else {
                                setCustomDomainError(null);
                              }
                            }}
                            disabled={!isCustomDomainEnabled}
                            className={!isCustomDomainEnabled ? 'bg-muted cursor-not-allowed' : ''}
                          />
                        </div>
                        
                        {customDomainError && (
                          <div className="flex items-center gap-2 text-sm text-destructive">
                            <AlertCircle className="w-4 h-4" />
                            {customDomainError}
                          </div>
                        )}
                        
                        {!isCustomDomainEnabled ? (
                          <div className="p-3 bg-muted/50 border border-border rounded-lg">
                            <p className="text-sm text-muted-foreground">
                              Custom domains are available on Professional and Enterprise plans.{' '}
                              <a href="/subscription" className="text-primary hover:underline">
                                Upgrade your plan
                              </a>{' '}
                              to use this feature.
                            </p>
                          </div>
                        ) : (
                          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
                            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                              Setup Required
                            </p>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              Before using a custom domain, you need to configure DNS settings:
                            </p>
                            <ul className="text-sm text-blue-700 dark:text-blue-300 list-disc list-inside space-y-1">
                              <li>Contact support to initiate custom domain setup</li>
                              <li>Add an A record pointing to our servers (185.158.133.1)</li>
                              <li>SSL certificate will be provisioned automatically</li>
                            </ul>
                            <a 
                              href="https://docs.lovable.dev/features/custom-domain"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View documentation
                            </a>
                          </div>
                        )}
                        
                        <p className="text-sm text-muted-foreground">
                          The base URL for customer portal links in emails (e.g., https://portal.yourdomain.com). Leave blank to use the default.
                        </p>
                      </div>
                      
                      <div className="pt-4 border-t">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={savingSection === 'branding' || !!customDomainError || sendingDomainNotification}
                          onClick={async () => {
                            const previousDomain = company?.custom_domain || '';
                            const newDomain = preferences.custom_domain || '';
                            
                            // Check if custom domain was added (wasn't set before, but is now)
                            const domainWasAdded = !previousDomain && newDomain && isCustomDomainEnabled;
                            
                            await handleSaveSection('branding', {
                              brand_primary_color: preferences.brand_primary_color,
                              customer_portal_welcome_message: preferences.customer_portal_welcome_message || null,
                              custom_domain: newDomain || null,
                            } as any);
                            
                            // Send notification to admins if custom domain was set up
                            if (domainWasAdded && company?.id) {
                              setSendingDomainNotification(true);
                              try {
                                await supabase.functions.invoke('send-notification', {
                                  body: {
                                    type: 'custom_domain_setup',
                                    companyId: company.id,
                                    companyName: company.name,
                                    customDomain: newDomain,
                                    requestedBy: profile?.email || 'Unknown user',
                                  }
                                });
                                toast.info('Our team has been notified about your custom domain setup request.');
                              } catch (error) {
                                console.error('Failed to send custom domain notification:', error);
                              } finally {
                                setSendingDomainNotification(false);
                              }
                            }
                          }}
                        >
                          {(savingSection === 'branding' || sendingDomainNotification) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Branding Settings
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Time Clock Preferences */}
                  <AccordionItem value="timeclock">
                    <AccordionTrigger className="text-base font-medium">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Time Clock
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Require Job Selection</Label>
                          <p className="text-sm text-muted-foreground">Technicians must select a job when clocking in</p>
                        </div>
                        <Switch
                          checked={preferences.timeclock_require_job_selection}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, timeclock_require_job_selection: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Enforce Time Entries on Job Labor</Label>
                          <p className="text-sm text-muted-foreground">Automatically sync time clock hours to job labor line items</p>
                        </div>
                        <Switch
                          checked={preferences.timeclock_enforce_job_labor}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, timeclock_enforce_job_labor: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between space-x-4">
                        <div className="space-y-0.5">
                          <Label className="font-medium">Allow Manual Labor Hour Editing</Label>
                          <p className="text-sm text-muted-foreground">Allow editing labor hours on jobs (if disabled, only time clock entries count)</p>
                        </div>
                        <Switch
                          checked={preferences.timeclock_allow_manual_labor_edit}
                          onCheckedChange={(checked) => setPreferences({ ...preferences, timeclock_allow_manual_labor_edit: checked })}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Break Reminder (minutes)</Label>
                          <Select
                            value={String(preferences.timeclock_auto_start_break_reminder)}
                            onValueChange={(value) => setPreferences({ ...preferences, timeclock_auto_start_break_reminder: parseInt(value) })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Disabled</SelectItem>
                              <SelectItem value="120">After 2 hours</SelectItem>
                              <SelectItem value="180">After 3 hours</SelectItem>
                              <SelectItem value="240">After 4 hours</SelectItem>
                              <SelectItem value="300">After 5 hours</SelectItem>
                              <SelectItem value="360">After 6 hours</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-muted-foreground">Remind technicians to take a break</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Max Shift Length (hours)</Label>
                          <Select
                            value={String(preferences.timeclock_max_shift_hours)}
                            onValueChange={(value) => setPreferences({ ...preferences, timeclock_max_shift_hours: parseInt(value) })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="8">8 hours</SelectItem>
                              <SelectItem value="10">10 hours</SelectItem>
                              <SelectItem value="12">12 hours</SelectItem>
                              <SelectItem value="14">14 hours</SelectItem>
                              <SelectItem value="16">16 hours</SelectItem>
                              <SelectItem value="24">24 hours</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-muted-foreground">Auto clock-out after this duration</p>
                        </div>
                      </div>
                      <div className="pt-4 border-t">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={savingSection === 'timeclock'}
                          onClick={() => handleSaveSection('timeclock', {
                            timeclock_require_job_selection: preferences.timeclock_require_job_selection,
                            timeclock_enforce_job_labor: preferences.timeclock_enforce_job_labor,
                            timeclock_allow_manual_labor_edit: preferences.timeclock_allow_manual_labor_edit,
                            timeclock_auto_start_break_reminder: preferences.timeclock_auto_start_break_reminder,
                            timeclock_max_shift_hours: preferences.timeclock_max_shift_hours,
                          } as any)}
                        >
                          {savingSection === 'timeclock' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Time Clock Settings
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Automations */}
                  <AccordionItem value="automations">
                    <AccordionTrigger className="text-base font-medium">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Automations
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Automations run daily at 6 AM UTC and handle:
                        </p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                          <li>Auto-expire quotes past their validity date</li>
                          <li>Send payment reminders for overdue invoices</li>
                          <li>Apply late fees to overdue invoices</li>
                        </ul>
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="gap-2 mt-2"
                          onClick={handleRunAutomations}
                          disabled={runningAutomations}
                        >
                          {runningAutomations ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          Run Automations Now
                        </Button>
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

        {/* Templates Tab */}
        <TabsContent value="templates">
          <div className="max-w-2xl mx-auto space-y-6">
            <Tabs defaultValue="jobs" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="jobs" className="gap-2">
                  <Briefcase className="w-4 h-4" />
                  <span className="hidden sm:inline">Job Templates</span>
                  <span className="sm:hidden">Jobs</span>
                </TabsTrigger>
                <TabsTrigger value="quotes" className="gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Quote Templates</span>
                  <span className="sm:hidden">Quotes</span>
                </TabsTrigger>
                <TabsTrigger value="emails" className="gap-2">
                  <Mail className="w-4 h-4" />
                  <span className="hidden sm:inline">Email Templates</span>
                  <span className="sm:hidden">Emails</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="jobs">
                <JobTemplatesTab />
              </TabsContent>

              <TabsContent value="quotes">
                <QuoteTemplatesTab />
              </TabsContent>

              <TabsContent value="emails">
                <EmailTemplatesTab />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="payments">
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Stripe Section - Always show if enabled */}
              {providers.find(p => p.provider_key === 'stripe' && p.is_enabled) && (
                <StripeConnectSection company={company} />
              )}
              
              {/* Coming Soon Providers */}
              {comingSoonProviders.map((provider) => (
                <ComingSoonPaymentCard key={provider.id} provider={provider} />
              ))}

              {/* If no providers at all */}
              {providers.length === 0 && !providersLoading && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No payment providers are currently available. Contact your administrator.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        )}

        {/* Data Tab */}
        {isAdmin && (
          <TabsContent value="data">
            <div className="max-w-4xl mx-auto space-y-6">
              <DataExportSection />
              <DataImportSection />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </PageContainer>
  );
};

export default Company;
