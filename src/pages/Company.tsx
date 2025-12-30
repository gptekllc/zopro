import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Save } from 'lucide-react';
import { toast } from 'sonner';

const Company = () => {
  const { company, updateCompany } = useStore();
  const [formData, setFormData] = useState({
    name: company?.name || '',
    address: company?.address || '',
    phone: company?.phone || '',
    email: company?.email || '',
    industry: company?.industry || 'general',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompany(formData);
    toast.success('Company settings saved successfully');
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Company Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your company information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Company Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={formData.industry}
                onValueChange={(value) => setFormData({ ...formData, industry: value as typeof formData.industry })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plumbing">Plumbing</SelectItem>
                  <SelectItem value="hvac">HVAC</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="general">General Services</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <Button type="submit" className="w-full sm:w-auto gap-2">
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Subscription Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Multi-Tenant Ready</h3>
              <p className="text-muted-foreground mt-1">
                Service App supports multiple tenant companies. Each company has isolated data 
                for customers, quotes, invoices, and team members.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Industries supported: Plumbing, HVAC, Electrical, and General Services
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Company;
