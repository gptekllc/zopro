import { useState, useRef } from 'react';
import { Package, Search, X, ArrowUpDown, Download, Upload, FileDown, Loader2 } from 'lucide-react';
import { CatalogManager } from '@/components/catalog/CatalogManager';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useCatalogItems, useCreateCatalogItem } from '@/hooks/useCatalog';
import { toast } from 'sonner';

const Catalog = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [exportType, setExportType] = useState<'products' | 'services' | 'both'>('both');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: items = [] } = useCatalogItems();
  const createItem = useCreateCatalogItem();

  const downloadSampleCSV = () => {
    const headers = ['name', 'description', 'type', 'unit_price', 'is_active'];
    const sampleData = [
      ['AC Filter 16x25', 'Standard HVAC filter', 'product', '24.99', 'true'],
      ['Furnace Tune-Up', 'Annual maintenance service', 'service', '129.00', 'true'],
    ];
    const csvContent = [headers.join(','), ...sampleData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'catalog_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        toast.error('CSV file must have headers and at least one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIdx = headers.indexOf('name');
      const descIdx = headers.indexOf('description');
      const typeIdx = headers.indexOf('type');
      const priceIdx = headers.indexOf('unit_price');
      const activeIdx = headers.indexOf('is_active');

      if (nameIdx === -1) {
        toast.error('CSV must have a "name" column');
        return;
      }

      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const name = values[nameIdx];
        if (!name) continue;

        const type = typeIdx !== -1 && ['product', 'service'].includes(values[typeIdx]?.toLowerCase())
          ? (values[typeIdx].toLowerCase() as 'product' | 'service')
          : 'service';

        await createItem.mutateAsync({
          name,
          description: descIdx !== -1 ? values[descIdx] || null : null,
          type,
          unit_price: priceIdx !== -1 ? parseFloat(values[priceIdx]) || 0 : 0,
          is_active: activeIdx !== -1 ? values[activeIdx]?.toLowerCase() !== 'false' : true,
        });
        imported++;
      }

      toast.success(`Imported ${imported} item${imported !== 1 ? 's' : ''}`);
      setImportExportOpen(false);
    } catch (error) {
      toast.error('Failed to import CSV');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    let exportItems = items;
    if (exportType === 'products') {
      exportItems = items.filter(i => i.type === 'product');
    } else if (exportType === 'services') {
      exportItems = items.filter(i => i.type === 'service');
    }

    if (exportItems.length === 0) {
      toast.error('No items to export');
      return;
    }

    const headers = ['name', 'description', 'type', 'unit_price', 'is_active'];
    const rows = exportItems.map(item => [
      `"${item.name.replace(/"/g, '""')}"`,
      `"${(item.description || '').replace(/"/g, '""')}"`,
      item.type,
      item.unit_price.toString(),
      item.is_active.toString(),
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalog_${exportType}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${exportItems.length} item${exportItems.length !== 1 ? 's' : ''}`);
    setImportExportOpen(false);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6" />
            Catalog
          </h1>
          <p className="text-muted-foreground">Manage your products and services</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={() => setImportExportOpen(true)}>
            <ArrowUpDown className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Import / Export</span>
            <span className="sm:hidden">I/E</span>
          </Button>
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={(v: 'all' | 'active' | 'inactive') => setStatusFilter(v)}>
            <SelectTrigger className="w-[100px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <CatalogManager searchQuery={searchQuery} statusFilter={statusFilter} />

      {/* Import/Export Dialog */}
      <Dialog open={importExportOpen} onOpenChange={setImportExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import / Export Catalog</DialogTitle>
            <DialogDescription>
              Import items from a CSV file or export your catalog.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Sample Download */}
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
              <div>
                <p className="font-medium text-sm">CSV Template</p>
                <p className="text-xs text-muted-foreground">Download sample format</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadSampleCSV}>
                <FileDown className="w-4 h-4 mr-1" />
                Download
              </Button>
            </div>

            {/* Import Section */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Import</Label>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleImportClick}
                disabled={isImporting}
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {isImporting ? 'Importing...' : 'Select CSV File'}
              </Button>
            </div>

            {/* Export Section */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Export</Label>
              <RadioGroup value={exportType} onValueChange={(v) => setExportType(v as 'products' | 'services' | 'both')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="products" id="products" />
                  <Label htmlFor="products" className="font-normal">Products only</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="services" id="services" />
                  <Label htmlFor="services" className="font-normal">Services only</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="both" id="both" />
                  <Label htmlFor="both" className="font-normal">Both (all items)</Label>
                </div>
              </RadioGroup>
              <Button variant="outline" className="w-full" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export as CSV
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportExportOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Catalog;
