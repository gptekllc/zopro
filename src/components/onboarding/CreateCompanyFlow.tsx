import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CreateCompanyFlowProps {
  onBack: () => void;
  onComplete: () => void;
}

const CreateCompanyFlow = ({ onBack, onComplete }: CreateCompanyFlowProps) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please log in to create a company');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Company name is required');
      return;
    }

    setIsLoading(true);
    console.log('[CreateCompanyFlow] Starting company creation for user:', user.id);

    try {
      // Create company + set current user as admin via secure RPC (bypasses RLS pitfalls)
      const { data, error } = await supabase.rpc('create_company_and_set_admin', {
        _name: formData.name.trim(),
        _email: formData.email.trim() || null,
        _phone: formData.phone.trim() || null,
        _address: formData.address.trim() || null,
        _city: formData.city.trim() || null,
        _state: formData.state.trim() || null,
        _zip: formData.zip.trim() || null,
      });

      console.log('[CreateCompanyFlow] RPC response:', { data, error });

      if (error) {
        console.error('[CreateCompanyFlow] RPC error:', error);
        if (error.code === 'PGRST301') {
          throw new Error('Permission denied. Please try logging out and back in.');
        } else if (error.code === '23505') {
          throw new Error('A company with this information already exists.');
        } else {
          throw new Error(error.message || 'Failed to create company');
        }
      }

      console.log('[CreateCompanyFlow] Company created successfully, new company ID:', data);
      toast.success('Company created successfully!');
      
      // Force a session refresh to pick up the new company_id
      await supabase.auth.refreshSession();
      
      onComplete();
    } catch (error: any) {
      console.error('[CreateCompanyFlow] Error:', error);
      toast.error(error.message || 'Failed to create company. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center gradient-primary p-4"
      style={{
        paddingTop: 'calc(var(--safe-area-top) + 1rem)',
        paddingBottom: 'calc(var(--safe-area-bottom) + 1rem)',
      }}
    >
      <div className="w-full max-w-lg animate-scale-in">
        <Button 
          variant="ghost" 
          className="mb-4 text-primary-foreground hover:bg-primary-foreground/10"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-card mb-4 shadow-lg">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-primary-foreground">Create Your Company</h1>
          <p className="text-primary-foreground/80 mt-2">Set up your service business</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>
              Enter your company information to get started. You'll have limited features until you upgrade to a paid plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your Company Name"
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
                    placeholder="company@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Main Street"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="State"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP</Label>
                  <Input
                    id="zip"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                    placeholder="12345"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Company & Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateCompanyFlow;
