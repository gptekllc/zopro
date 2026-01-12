import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, FileUp, Download, Loader2, CheckCircle, XCircle, AlertTriangle, ArrowRight, ArrowLeft, Users, Briefcase, Receipt, FileText, UserCheck } from 'lucide-react';

type ImportEntity = 'customers' | 'jobs' | 'invoices' | 'quotes' | 'technicians';

interface ImportConfig {
  type: ImportEntity;
  label: string;
  icon: React.ReactNode;
  requiredFields: string[];
  optionalFields: string[];
}

const importConfigs: ImportConfig[] = [
  {
    type: 'customers',
    label: 'Customers',
    icon: <Users className="w-5 h-5" />,
    requiredFields: ['first_name'],
    optionalFields: ['last_name', 'email', 'phone', 'address', 'city', 'state', 'zip', 'notes'],
  },
  {
    type: 'jobs',
    label: 'Jobs',
    icon: <Briefcase className="w-5 h-5" />,
    requiredFields: ['title', 'customer_email'],
    optionalFields: ['description', 'status', 'priority', 'scheduled_start', 'scheduled_end', 'notes'],
  },
  {
    type: 'invoices',
    label: 'Invoices',
    icon: <Receipt className="w-5 h-5" />,
    requiredFields: ['customer_email', 'total'],
    optionalFields: ['status', 'due_date', 'notes', 'subtotal', 'tax'],
  },
  {
    type: 'quotes',
    label: 'Quotes',
    icon: <FileText className="w-5 h-5" />,
    requiredFields: ['customer_email', 'total'],
    optionalFields: ['status', 'valid_until', 'notes', 'subtotal', 'tax'],
  },
  {
    type: 'technicians',
    label: 'Technicians',
    icon: <UserCheck className="w-5 h-5" />,
    requiredFields: ['first_name', 'email'],
    optionalFields: ['last_name', 'phone', 'role', 'hourly_rate'],
  },
];

interface ValidationError {
  row: number;
  field: string;
  message: string;
  value: string;
}

interface ParsedRow {
  data: Record<string, string>;
  errors: ValidationError[];
  isValid: boolean;
}

const DataImportSection = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedEntity, setSelectedEntity] = useState<ImportEntity | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const downloadTemplate = (entityType: ImportEntity) => {
    const config = importConfigs.find(c => c.type === entityType);
    if (!config) return;

    const headers = [...config.requiredFields, ...config.optionalFields];
    const exampleRow = headers.map(h => {
      switch (h) {
        case 'first_name': return 'John';
        case 'last_name': return 'Doe';
        case 'name': return 'John Doe';
        case 'email':
        case 'customer_email': return 'john@example.com';
        case 'phone': return '555-123-4567';
        case 'address': return '123 Main St';
        case 'city': return 'New York';
        case 'state': return 'NY';
        case 'zip': return '10001';
        case 'title': return 'Repair Service';
        case 'description': return 'Fix broken equipment';
        case 'status': return 'pending';
        case 'priority': return 'medium';
        case 'total': return '500.00';
        case 'subtotal': return '450.00';
        case 'tax': return '50.00';
        case 'due_date': return '2024-12-31';
        case 'valid_until': return '2024-12-31';
        case 'scheduled_start': return '2024-12-15T09:00:00';
        case 'scheduled_end': return '2024-12-15T17:00:00';
        case 'notes': return 'Additional notes here';
        case 'role': return 'technician';
        case 'hourly_rate': return '50.00';
        default: return '';
      }
    });

    const csv = [headers.join(','), exampleRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityType}_import_template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Template downloaded');
  };

  const parseCSV = (text: string): { headers: string[]; rows: string[][] } => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).map(line => parseRow(line));
    return { headers, rows };
  };

  const handleFileUpload = useCallback(async (file: File) => {
    setUploadedFile(file);
    
    const text = await file.text();
    const { headers, rows } = parseCSV(text);
    
    setCsvHeaders(headers);
    
    // Auto-map columns with matching names
    const autoMapping: Record<string, string> = {};
    const config = importConfigs.find(c => c.type === selectedEntity);
    if (config) {
      const allFields = [...config.requiredFields, ...config.optionalFields];
      headers.forEach((header, idx) => {
        const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const matchedField = allFields.find(f => 
          f.toLowerCase() === normalizedHeader ||
          f.toLowerCase().replace(/_/g, '') === normalizedHeader.replace(/_/g, '')
        );
        if (matchedField) {
          autoMapping[idx.toString()] = matchedField;
        }
      });
    }
    setColumnMapping(autoMapping);

    // Parse rows with validation
    const parsed: ParsedRow[] = rows.map((row, rowIdx) => {
      const data: Record<string, string> = {};
      headers.forEach((header, colIdx) => {
        data[header] = row[colIdx] || '';
      });
      
      const errors: ValidationError[] = [];
      
      // Validate required fields after mapping
      if (config) {
        config.requiredFields.forEach(field => {
          const mappedColIdx = Object.entries(autoMapping).find(([, f]) => f === field)?.[0];
          const value = mappedColIdx ? row[parseInt(mappedColIdx)] : '';
          if (!value || !value.trim()) {
            errors.push({
              row: rowIdx + 2, // 1-indexed, +1 for header
              field,
              message: `${field} is required`,
              value: value || '',
            });
          }
        });

        // Validate email format
        ['email', 'customer_email'].forEach(emailField => {
          const mappedColIdx = Object.entries(autoMapping).find(([, f]) => f === emailField)?.[0];
          const value = mappedColIdx ? row[parseInt(mappedColIdx)] : '';
          if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push({
              row: rowIdx + 2,
              field: emailField,
              message: 'Invalid email format',
              value,
            });
          }
        });
      }

      return { data, errors, isValid: errors.length === 0 };
    });

    setParsedData(parsed);
    setCurrentStep(3); // Skip to validation preview since we auto-mapped
  }, [selectedEntity]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.json'))) {
      handleFileUpload(file);
    } else {
      toast.error('Please upload a CSV file');
    }
  }, [handleFileUpload]);

  const handleImport = async () => {
    if (!selectedEntity || !profile?.company_id) return;

    setImporting(true);
    const validRows = parsedData.filter(row => row.isValid);
    let success = 0;
    let failed = 0;
    setImportProgress({ current: 0, total: validRows.length });

    try {
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        setImportProgress({ current: i + 1, total: validRows.length });
        
        try {
          // Map data according to column mapping
          const mappedData: Record<string, any> = {};
          Object.entries(columnMapping).forEach(([colIdx, field]) => {
            const header = csvHeaders[parseInt(colIdx)];
            if (header && row.data[header]) {
              mappedData[field] = row.data[header];
            }
          });

          switch (selectedEntity) {
            case 'customers': {
              const firstName = mappedData.first_name || '';
              const lastName = mappedData.last_name || '';
              const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
              const { error } = await supabase
                .from('customers')
                .insert({
                  company_id: profile.company_id,
                  first_name: firstName || null,
                  last_name: lastName || null,
                  name: fullName,
                  email: mappedData.email || null,
                  phone: mappedData.phone || null,
                  address: mappedData.address || null,
                  city: mappedData.city || null,
                  state: mappedData.state || null,
                  zip: mappedData.zip || null,
                  notes: mappedData.notes || null,
                });
              if (error) throw error;
              success++;
              break;
            }
            case 'jobs': {
              // First find customer by email
              const { data: customer } = await supabase
                .from('customers')
                .select('id')
                .eq('company_id', profile.company_id)
                .eq('email', mappedData.customer_email)
                .maybeSingle();

              if (!customer) {
                failed++;
                continue;
              }

              // Generate job number
              const { data: company } = await supabase
                .from('companies')
                .select('job_next_number, job_number_prefix, job_number_padding')
                .eq('id', profile.company_id)
                .single();

              const nextNum = company?.job_next_number || 1;
              const prefix = company?.job_number_prefix || 'J';
              const padding = company?.job_number_padding || 3;
              const jobNumber = `${prefix}${nextNum.toString().padStart(padding, '0')}`;

              const { error } = await supabase
                .from('jobs')
                .insert({
                  company_id: profile.company_id,
                  customer_id: customer.id,
                  job_number: jobNumber,
                  title: mappedData.title,
                  description: mappedData.description || null,
                  status: mappedData.status || 'pending',
                  priority: mappedData.priority || 'medium',
                  notes: mappedData.notes || null,
                });

              if (!error) {
                await supabase
                  .from('companies')
                  .update({ job_next_number: nextNum + 1 })
                  .eq('id', profile.company_id);
                success++;
              } else {
                failed++;
              }
              break;
            }
            case 'invoices': {
              // First find customer by email
              const { data: customer } = await supabase
                .from('customers')
                .select('id')
                .eq('company_id', profile.company_id)
                .eq('email', mappedData.customer_email)
                .maybeSingle();

              if (!customer) {
                failed++;
                continue;
              }

              // Generate invoice number
              const { data: company } = await supabase
                .from('companies')
                .select('invoice_next_number, invoice_number_prefix, invoice_number_padding')
                .eq('id', profile.company_id)
                .single();

              const nextNum = company?.invoice_next_number || 1;
              const prefix = company?.invoice_number_prefix || 'I';
              const padding = company?.invoice_number_padding || 4;
              const invoiceNumber = `${prefix}${nextNum.toString().padStart(padding, '0')}`;

              const { error } = await supabase
                .from('invoices')
                .insert({
                  company_id: profile.company_id,
                  customer_id: customer.id,
                  invoice_number: invoiceNumber,
                  total: parseFloat(mappedData.total) || 0,
                  subtotal: parseFloat(mappedData.subtotal) || parseFloat(mappedData.total) || 0,
                  tax: parseFloat(mappedData.tax) || 0,
                  status: mappedData.status || 'draft',
                  due_date: mappedData.due_date || null,
                  notes: mappedData.notes || null,
                });

              if (!error) {
                await supabase
                  .from('companies')
                  .update({ invoice_next_number: nextNum + 1 })
                  .eq('id', profile.company_id);
                success++;
              } else {
                failed++;
              }
              break;
            }
            case 'quotes': {
              // First find customer by email
              const { data: customer } = await supabase
                .from('customers')
                .select('id')
                .eq('company_id', profile.company_id)
                .eq('email', mappedData.customer_email)
                .maybeSingle();

              if (!customer) {
                failed++;
                continue;
              }

              // Generate quote number
              const { data: company } = await supabase
                .from('companies')
                .select('quote_next_number, quote_number_prefix, quote_number_padding')
                .eq('id', profile.company_id)
                .single();

              const nextNum = company?.quote_next_number || 1;
              const prefix = company?.quote_number_prefix || 'Q';
              const padding = company?.quote_number_padding || 4;
              const quoteNumber = `${prefix}${nextNum.toString().padStart(padding, '0')}`;

              const { error } = await supabase
                .from('quotes')
                .insert({
                  company_id: profile.company_id,
                  customer_id: customer.id,
                  quote_number: quoteNumber,
                  total: parseFloat(mappedData.total) || 0,
                  subtotal: parseFloat(mappedData.subtotal) || parseFloat(mappedData.total) || 0,
                  tax: parseFloat(mappedData.tax) || 0,
                  status: mappedData.status || 'draft',
                  valid_until: mappedData.valid_until || null,
                  notes: mappedData.notes || null,
                });

              if (!error) {
                await supabase
                  .from('companies')
                  .update({ quote_next_number: nextNum + 1 })
                  .eq('id', profile.company_id);
                success++;
              } else {
                failed++;
              }
              break;
            }
            case 'technicians': {
              const firstName = mappedData.first_name || '';
              const lastName = mappedData.last_name || '';
              const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
              
              // Note: Creating actual auth users requires admin privileges
              // This inserts a profile record for existing auth users or team invitations
              const { error } = await supabase
                .from('profiles')
                .insert({
                  id: crypto.randomUUID(), // This will fail if no auth user exists - use team invitations instead
                  company_id: profile.company_id,
                  first_name: firstName || null,
                  last_name: lastName || null,
                  full_name: fullName,
                  email: mappedData.email,
                  phone: mappedData.phone || null,
                  role: mappedData.role || 'technician',
                  hourly_rate: parseFloat(mappedData.hourly_rate) || null,
                });
              
              if (!error) {
                success++;
              } else {
                // If direct insert fails, the user should use the team invitation flow instead
                console.log('Technician import requires existing auth user or team invitation');
                failed++;
              }
              break;
            }
          }
        } catch (err) {
          console.error('Row import error:', err);
          failed++;
        }
      }

      setImportResult({ success, failed });
      setImportProgress({ current: 0, total: 0 });
      setCurrentStep(5);

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [selectedEntity] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      
      toast.success(`Imported ${success} ${selectedEntity}`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed');
    } finally {
      setImporting(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setSelectedEntity(null);
    setUploadedFile(null);
    setParsedData([]);
    setColumnMapping({});
    setCsvHeaders([]);
    setImportResult(null);
  };

  const validCount = parsedData.filter(r => r.isValid).length;
  const invalidCount = parsedData.filter(r => !r.isValid).length;
  const allErrors = parsedData.flatMap(r => r.errors).slice(0, 10);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Data Import
          </CardTitle>
          <CardDescription>
            Import data from other systems or spreadsheets using our CSV templates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template Downloads */}
          <div className="space-y-2">
            <Label>Download Templates</Label>
            <div className="flex flex-wrap gap-2">
              {importConfigs.map((config) => (
                <Button
                  key={config.type}
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTemplate(config.type)}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  {config.label} CSV
                </Button>
              ))}
            </div>
          </div>

          {/* Start Import Button */}
          <Button
            onClick={() => {
              resetWizard();
              setWizardOpen(true);
            }}
            className="w-full sm:w-auto gap-2"
          >
            <FileUp className="w-4 h-4" />
            Start Import Wizard
          </Button>
        </CardContent>
      </Card>

      {/* Import Wizard Dialog */}
      <Dialog open={wizardOpen} onOpenChange={(open) => {
        setWizardOpen(open);
        if (!open) resetWizard();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import Data - Step {currentStep} of 5</DialogTitle>
            <DialogDescription>
              {currentStep === 1 && 'Select what type of data you want to import'}
              {currentStep === 2 && 'Upload your CSV file'}
              {currentStep === 3 && 'Review column mapping'}
              {currentStep === 4 && 'Validate data before import'}
              {currentStep === 5 && 'Import complete'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-1 space-y-4">
              {/* Step 1: Entity Selection */}
              {currentStep === 1 && (
                <div className="grid gap-3">
                  {importConfigs.map((config) => (
                    <div
                      key={config.type}
                      onClick={() => {
                        setSelectedEntity(config.type);
                        setCurrentStep(2);
                      }}
                      className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-colors`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          {config.icon}
                        </div>
                        <div>
                          <p className="font-medium">{config.label}</p>
                          <p className="text-xs text-muted-foreground">
                            Required: {config.requiredFields.join(', ')}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}

              {/* Step 2: File Upload */}
              {currentStep === 2 && (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    className="hidden"
                  />
                  <FileUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Drop your CSV file here</p>
                  <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                  <Button onClick={() => fileInputRef.current?.click()}>
                    Select File
                  </Button>
                </div>
              )}

              {/* Step 3: Column Mapping */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Map CSV columns to fields</p>
                    <Badge variant="outline">
                      {Object.keys(columnMapping).length} mapped
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {csvHeaders.map((header, idx) => {
                      const config = importConfigs.find(c => c.type === selectedEntity);
                      const allFields = config ? [...config.requiredFields, ...config.optionalFields] : [];
                      
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-1/3 p-2 bg-muted rounded text-sm truncate">
                            {header}
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          <Select
                            value={columnMapping[idx.toString()] || ''}
                            onValueChange={(value) => {
                              setColumnMapping({
                                ...columnMapping,
                                [idx.toString()]: value,
                              });
                            }}
                          >
                            <SelectTrigger className="w-2/3">
                              <SelectValue placeholder="Select field..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Skip this column</SelectItem>
                              {allFields.map((field) => (
                                <SelectItem key={field} value={field}>
                                  {field}
                                  {config?.requiredFields.includes(field) && ' *'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 4: Validation Preview */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">{validCount} valid</span>
                    </div>
                    {invalidCount > 0 && (
                      <div className="flex items-center gap-2 text-red-600">
                        <XCircle className="w-5 h-5" />
                        <span className="font-medium">{invalidCount} with errors</span>
                      </div>
                    )}
                  </div>

                  {allErrors.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-medium flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        Validation Errors (showing first 10)
                      </p>
                      <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                        {allErrors.map((error, idx) => (
                          <p key={idx} className="text-destructive">
                            Row {error.row}: {error.message} ({error.field})
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Status</TableHead>
                        {Object.values(columnMapping).filter(Boolean).slice(0, 4).map((field) => (
                          <TableHead key={field}>{field}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 5).map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            {row.isValid ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                          </TableCell>
                          {Object.entries(columnMapping).filter(([, f]) => f).slice(0, 4).map(([colIdx]) => (
                            <TableCell key={colIdx} className="max-w-[150px] truncate">
                              {row.data[csvHeaders[parseInt(colIdx)]] || '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Step 5: Complete */}
              {currentStep === 5 && importResult && (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
                  <h3 className="text-xl font-semibold mb-2">Import Complete!</h3>
                  <p className="text-muted-foreground mb-4">
                    Successfully imported {importResult.success} records
                    {importResult.failed > 0 && `, ${importResult.failed} failed`}
                  </p>
                  <Button onClick={() => setWizardOpen(false)}>
                    Done
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>

          {currentStep !== 5 && (
            <DialogFooter className="flex-row gap-2 sm:gap-0">
              {currentStep > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              )}
              <div className="flex-1" />
              {currentStep === 3 && (
                <Button onClick={() => {
                  // Re-validate with current mapping
                  const config = importConfigs.find(c => c.type === selectedEntity);
                  const validated = parsedData.map((row, rowIdx) => {
                    const errors: ValidationError[] = [];
                    if (config) {
                      config.requiredFields.forEach(field => {
                        const mappedColIdx = Object.entries(columnMapping).find(([, f]) => f === field)?.[0];
                        const header = mappedColIdx ? csvHeaders[parseInt(mappedColIdx)] : '';
                        const value = header ? row.data[header] : '';
                        if (!value || !value.trim()) {
                          errors.push({
                            row: rowIdx + 2,
                            field,
                            message: `${field} is required`,
                            value: value || '',
                          });
                        }
                      });
                    }
                    return { ...row, errors, isValid: errors.length === 0 };
                  });
                  setParsedData(validated);
                  setCurrentStep(4);
                }} className="gap-2">
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
              {currentStep === 4 && (
                <Button
                  onClick={handleImport}
                  disabled={importing || validCount === 0}
                  className="gap-2"
                >
                  {importing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Import {validCount} Records
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DataImportSection;
