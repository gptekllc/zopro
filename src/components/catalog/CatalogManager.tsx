import { useState, useRef } from 'react';
import { useCatalogItems, useCreateCatalogItem, useUpdateCatalogItem, useDeleteCatalogItem, CatalogItem } from '@/hooks/useCatalog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Edit, Trash2, Package, Wrench, Loader2, MoreVertical, Eye, EyeOff, Copy, ArrowUpDown, Download, Upload, FileDown, Check, X } from 'lucide-react';
import { formatAmount } from '@/lib/formatAmount';
import { toast } from 'sonner';

interface CatalogManagerProps {
  searchQuery?: string;
  statusFilter?: 'all' | 'active' | 'inactive';
}

interface ImportPreviewItem {
  name: string;
  description: string | null;
  type: 'product' | 'service';
  unit_price: number;
  is_active: boolean;
  isValid: boolean;
  error?: string;
}

export const CatalogManager = ({ searchQuery = '', statusFilter = 'all' }: CatalogManagerProps) => {
  const { data: items = [], isLoading } = useCatalogItems();
  const createItem = useCreateCatalogItem();
  const updateItem = useUpdateCatalogItem();
  const deleteItem = useDeleteCatalogItem();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<CatalogItem | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'services'>('products');
  
  // Import/Export state
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [exportType, setExportType] = useState<'products' | 'services' | 'both'>('both');
  const [importPreview, setImportPreview] = useState<ImportPreviewItem[]>([]);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'service' as 'product' | 'service',
    unit_price: 0,
    is_active: true,
  });

  // Filter items based on search and filters
  const filteredItems = items.filter(item => {
    const matchesSearch = searchQuery === '' || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && item.is_active) ||
      (statusFilter === 'inactive' && !item.is_active);
    
    return matchesSearch && matchesStatus;
  });

  const products = filteredItems.filter(item => item.type === 'product');
  const services = filteredItems.filter(item => item.type === 'service');

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'service',
      unit_price: 0,
      is_active: true,
    });
    setEditingItem(null);
  };

  const openCreateDialog = (type: 'product' | 'service') => {
    resetForm();
    setFormData(prev => ({ ...prev, type }));
    setDialogOpen(true);
  };

  const openEditDialog = (item: CatalogItem) => {
    setFormData({
      name: item.name,
      description: item.description || '',
      type: item.type,
      unit_price: Number(item.unit_price),
      is_active: item.is_active,
    });
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingItem) {
      await updateItem.mutateAsync({ id: editingItem.id, ...formData });
    } else {
      await createItem.mutateAsync(formData);
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (deleteConfirmItem) {
      await deleteItem.mutateAsync(deleteConfirmItem.id);
      setDeleteConfirmItem(null);
    }
  };

  const handleToggleActive = async (item: CatalogItem) => {
    await updateItem.mutateAsync({ id: item.id, is_active: !item.is_active });
  };

  const handleDuplicate = async (item: CatalogItem) => {
    await createItem.mutateAsync({
      name: `${item.name} (Copy)`,
      description: item.description || null,
      type: item.type,
      unit_price: item.unit_price,
      is_active: true,
    });
  };

  // Import/Export functions
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

      const previewItems: ImportPreviewItem[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const name = values[nameIdx];
        
        if (!name) {
          previewItems.push({
            name: '',
            description: null,
            type: 'service',
            unit_price: 0,
            is_active: true,
            isValid: false,
            error: 'Name is required',
          });
          continue;
        }

        const type = typeIdx !== -1 && ['product', 'service'].includes(values[typeIdx]?.toLowerCase())
          ? (values[typeIdx].toLowerCase() as 'product' | 'service')
          : 'service';

        const unitPrice = priceIdx !== -1 ? parseFloat(values[priceIdx]) || 0 : 0;

        previewItems.push({
          name,
          description: descIdx !== -1 ? values[descIdx] || null : null,
          type,
          unit_price: unitPrice,
          is_active: activeIdx !== -1 ? values[activeIdx]?.toLowerCase() !== 'false' : true,
          isValid: true,
        });
      }

      setImportPreview(previewItems);
      setImportExportOpen(false);
      setPreviewDialogOpen(true);
    } catch (error) {
      toast.error('Failed to parse CSV file');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    const validItems = importPreview.filter(item => item.isValid);
    if (validItems.length === 0) {
      toast.error('No valid items to import');
      return;
    }

    setIsImporting(true);
    try {
      for (const item of validItems) {
        await createItem.mutateAsync({
          name: item.name,
          description: item.description,
          type: item.type,
          unit_price: item.unit_price,
          is_active: item.is_active,
        });
      }
      toast.success(`Imported ${validItems.length} item${validItems.length !== 1 ? 's' : ''}`);
      setPreviewDialogOpen(false);
      setImportPreview([]);
    } catch (error) {
      toast.error('Failed to import items');
    } finally {
      setIsImporting(false);
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

  const renderItemCard = (item: CatalogItem) => (
    <div
      key={item.id}
      className={`flex items-center justify-between p-3 rounded-lg border ${
        item.is_active ? 'bg-background' : 'bg-muted/50 opacity-60'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{item.name}</span>
          {!item.is_active && (
            <Badge variant="secondary" className="text-xs">Inactive</Badge>
          )}
        </div>
        {item.description && (
          <p className="text-sm text-muted-foreground truncate">{item.description}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-semibold text-primary">
          ${formatAmount(item.unit_price)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem onClick={() => openEditDialog(item)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleToggleActive(item)}>
              {item.is_active ? (
                <>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Reactivate
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDuplicate(item)}>
              <Copy className="w-4 h-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setDeleteConfirmItem(item)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const validImportCount = importPreview.filter(i => i.isValid).length;
  const invalidImportCount = importPreview.filter(i => !i.isValid).length;

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Products/Services Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'products' | 'services')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Products ({products.length})
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Services ({services.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <span className="text-sm text-muted-foreground">
                {products.length} product{products.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => openCreateDialog('product')}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Product
                </Button>
                <Button size="sm" variant="outline" onClick={() => setImportExportOpen(true)} className="hidden sm:flex">
                  <ArrowUpDown className="w-4 h-4 mr-1" />
                  Import / Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {products.length > 0 ? (
                <div className="space-y-2">
                  {products.map(item => renderItemCard(item))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  No products added yet. Add products to quickly insert them into quotes, jobs, and invoices.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <span className="text-sm text-muted-foreground">
                {services.length} service{services.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => openCreateDialog('service')}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Service
                </Button>
                <Button size="sm" variant="outline" onClick={() => setImportExportOpen(true)} className="hidden sm:flex">
                  <ArrowUpDown className="w-4 h-4 mr-1" />
                  Import / Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {services.length > 0 ? (
                <div className="space-y-2">
                  {services.map(item => renderItemCard(item))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  No services added yet. Add services to quickly insert them into quotes, jobs, and invoices.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit' : 'Add'} {formData.type === 'product' ? 'Product' : 'Service'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={formData.type === 'product' ? 'e.g., HVAC Filter' : 'e.g., AC Tune-Up'}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'product' | 'service') => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">
                      <span className="flex items-center gap-2">
                        <Package className="w-4 h-4" /> Product
                      </span>
                    </SelectItem>
                    <SelectItem value="service">
                      <span className="flex items-center gap-2">
                        <Wrench className="w-4 h-4" /> Service
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Unit Price ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.unit_price || ''}
                  onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Active (visible in catalog picker)</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
                {(createItem.isPending || updateItem.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingItem ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleImportClick}
              >
                <Upload className="w-4 h-4 mr-2" />
                Select CSV File
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

      {/* Import Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
            <DialogDescription>
              Review the items before importing. {validImportCount} valid, {invalidImportCount} invalid.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-2">
              {importPreview.map((item, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    item.isValid ? 'bg-background' : 'bg-destructive/10 border-destructive/30'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.isValid ? (
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-destructive flex-shrink-0" />
                      )}
                      <span className={`font-medium truncate ${!item.isValid ? 'text-destructive' : ''}`}>
                        {item.name || '(empty name)'}
                      </span>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {item.type}
                      </Badge>
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground truncate ml-6">{item.description}</p>
                    )}
                    {item.error && (
                      <p className="text-xs text-destructive ml-6">{item.error}</p>
                    )}
                  </div>
                  <span className="font-semibold text-primary ml-4">
                    ${formatAmount(item.unit_price)}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setPreviewDialogOpen(false); setImportPreview([]); }}>
              Cancel
            </Button>
            <Button onClick={confirmImport} disabled={isImporting || validImportCount === 0}>
              {isImporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Import {validImportCount} Item{validImportCount !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmItem} onOpenChange={() => setDeleteConfirmItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteConfirmItem?.type === 'product' ? 'Product' : 'Service'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmItem?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
