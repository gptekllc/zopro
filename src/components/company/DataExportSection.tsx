import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Download, Loader2, Users, Briefcase, FileText, Receipt, Package, UserCheck, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';

type ExportFormat = 'csv' | 'xlsx' | 'json';
type EntityType = 'customers' | 'jobs' | 'quotes' | 'invoices' | 'products' | 'technicians' | 'timesheets';

interface ExportConfig {
  type: EntityType;
  label: string;
  icon: React.ReactNode;
  hasPhotos?: boolean;
}

const exportConfigs: ExportConfig[] = [
  { type: 'customers', label: 'Customers', icon: <Users className="w-5 h-5" /> },
  { type: 'jobs', label: 'Jobs', icon: <Briefcase className="w-5 h-5" />, hasPhotos: true },
  { type: 'quotes', label: 'Quotes', icon: <FileText className="w-5 h-5" />, hasPhotos: true },
  { type: 'invoices', label: 'Invoices', icon: <Receipt className="w-5 h-5" />, hasPhotos: true },
  { type: 'products', label: 'Products & Pricing', icon: <Package className="w-5 h-5" /> },
  { type: 'technicians', label: 'Technicians', icon: <UserCheck className="w-5 h-5" /> },
  { type: 'timesheets', label: 'Timesheets', icon: <Clock className="w-5 h-5" /> },
];

const DataExportSection = () => {
  const { profile } = useAuth();
  const [exporting, setExporting] = useState<string | null>(null);
  const [includePhotos, setIncludePhotos] = useState<Record<string, boolean>>({
    jobs: true,
    quotes: true,
    invoices: true,
  });

  const fetchEntityData = async (entityType: EntityType): Promise<any[]> => {
    const companyId = profile?.company_id;
    if (!companyId) throw new Error('No company ID');

    switch (entityType) {
      case 'customers': {
        const { data, error } = await supabase
          .from('customers')
          .select('id, name, email, phone, address, city, state, zip, notes, created_at')
          .eq('company_id', companyId)
          .is('deleted_at', null);
        if (error) throw error;
        return data || [];
      }
      case 'jobs': {
        const { data, error } = await supabase
          .from('jobs')
          .select(`
            id, job_number, title, description, status, priority, 
            scheduled_start, scheduled_end, actual_start, actual_end,
            subtotal, tax, total, notes, created_at,
            customers(name, email, phone)
          `)
          .eq('company_id', companyId)
          .is('deleted_at', null);
        if (error) throw error;
        return (data || []).map(j => ({
          ...j,
          customer_name: (j.customers as any)?.name,
          customer_email: (j.customers as any)?.email,
          customer_phone: (j.customers as any)?.phone,
          customers: undefined,
        }));
      }
      case 'quotes': {
        const { data, error } = await supabase
          .from('quotes')
          .select(`
            id, quote_number, status, subtotal, tax, total, notes,
            valid_until, created_at,
            customers(name, email, phone)
          `)
          .eq('company_id', companyId)
          .is('deleted_at', null);
        if (error) throw error;
        return (data || []).map(q => ({
          ...q,
          customer_name: (q.customers as any)?.name,
          customer_email: (q.customers as any)?.email,
          customer_phone: (q.customers as any)?.phone,
          customers: undefined,
        }));
      }
      case 'invoices': {
        const { data, error } = await supabase
          .from('invoices')
          .select(`
            id, invoice_number, status, subtotal, tax, total, notes,
            due_date, paid_at, created_at,
            customers(name, email, phone)
          `)
          .eq('company_id', companyId)
          .is('deleted_at', null);
        if (error) throw error;
        return (data || []).map(i => ({
          ...i,
          customer_name: (i.customers as any)?.name,
          customer_email: (i.customers as any)?.email,
          customer_phone: (i.customers as any)?.phone,
          customers: undefined,
        }));
      }
      case 'products': {
        const { data, error } = await supabase
          .from('catalog_items')
          .select('id, name, description, type, unit_price, is_active, created_at')
          .eq('company_id', companyId);
        if (error) throw error;
        return data || [];
      }
      case 'technicians': {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, role, hourly_rate, employment_status, hire_date, created_at')
          .eq('company_id', companyId)
          .is('deleted_at', null);
        if (error) throw error;
        return data || [];
      }
      case 'timesheets': {
        const { data, error } = await supabase
          .from('time_entries')
          .select(`
            id, clock_in, clock_out, break_minutes, notes, created_at,
            profiles(full_name, email),
            jobs(job_number, title)
          `)
          .eq('company_id', companyId);
        if (error) throw error;
        return (data || []).map((t: any) => ({
          id: t.id,
          clock_in: t.clock_in,
          clock_out: t.clock_out,
          break_minutes: t.break_minutes,
          notes: t.notes,
          created_at: t.created_at,
          technician_name: t.profiles?.full_name,
          technician_email: t.profiles?.email,
          job_number: t.jobs?.job_number,
          job_title: t.jobs?.title,
        }));
      }
      default:
        return [];
    }
  };

  const fetchPhotos = async (entityType: EntityType, entityIds: string[]): Promise<Record<string, string[]>> => {
    if (entityIds.length === 0) return {};
    
    const tableName = entityType === 'jobs' ? 'job_photos' 
      : entityType === 'quotes' ? 'quote_photos' 
      : 'invoice_photos';
    const idColumn = entityType === 'jobs' ? 'job_id' 
      : entityType === 'quotes' ? 'quote_id' 
      : 'invoice_id';

    const { data, error } = await supabase
      .from(tableName as any)
      .select(`id, ${idColumn}, photo_url, photo_type, caption`)
      .in(idColumn, entityIds)
      .is('deleted_at', null);

    if (error) {
      console.error('Error fetching photos:', error);
      return {};
    }

    const photoMap: Record<string, string[]> = {};
    (data || []).forEach((photo: any) => {
      const entityId = photo[idColumn];
      if (!photoMap[entityId]) photoMap[entityId] = [];
      photoMap[entityId].push(photo.photo_url);
    });

    return photoMap;
  };

  const generateCSV = (data: any[]): string => {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(',')
      )
    ];
    return csvRows.join('\n');
  };

  const downloadFile = (content: string | Blob, filename: string, mimeType: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = async (entityType: EntityType, format: ExportFormat) => {
    const exportKey = `${entityType}-${format}`;
    setExporting(exportKey);

    try {
      let data = await fetchEntityData(entityType);

      // Add photo URLs if enabled
      if (includePhotos[entityType] && ['jobs', 'quotes', 'invoices'].includes(entityType)) {
        const entityIds = data.map(d => d.id);
        const photoMap = await fetchPhotos(entityType, entityIds);
        data = data.map(d => ({
          ...d,
          photo_urls: photoMap[d.id]?.join('; ') || '',
        }));
      }

      if (data.length === 0) {
        toast.error(`No ${entityType} data to export`);
        return;
      }

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${entityType}_export_${timestamp}`;

      switch (format) {
        case 'csv': {
          const csv = generateCSV(data);
          downloadFile(csv, `${filename}.csv`, 'text/csv');
          break;
        }
        case 'xlsx': {
          const ws = XLSX.utils.json_to_sheet(data);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, entityType);
          const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          downloadFile(new Blob([xlsxBuffer]), `${filename}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          break;
        }
        case 'json': {
          const json = JSON.stringify(data, null, 2);
          downloadFile(json, `${filename}.json`, 'application/json');
          break;
        }
      }

      toast.success(`${entityType} exported successfully`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Data Export
        </CardTitle>
        <CardDescription>
          Download your business data in various formats for backup or migration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {exportConfigs.map((config) => (
            <div
              key={config.type}
              className="border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {config.icon}
                </div>
                <span className="font-medium">{config.label}</span>
              </div>

              {config.hasPhotos && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={includePhotos[config.type] ?? false}
                    onCheckedChange={(checked) =>
                      setIncludePhotos({ ...includePhotos, [config.type]: checked === true })
                    }
                  />
                  Include photo URLs
                </label>
              )}

              <div className="flex flex-wrap gap-2">
                {(['csv', 'xlsx', 'json'] as ExportFormat[]).map((format) => {
                  const isExporting = exporting === `${config.type}-${format}`;
                  return (
                    <Button
                      key={format}
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(config.type, format)}
                      disabled={!!exporting}
                      className="flex-1 min-w-[60px]"
                    >
                      {isExporting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Badge variant="secondary" className="uppercase text-xs">
                          {format}
                        </Badge>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default DataExportSection;
