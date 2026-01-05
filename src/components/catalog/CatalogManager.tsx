import { useState, useRef } from 'react';
import { useCatalogItems, useCreateCatalogItem, useUpdateCatalogItem, useDeleteCatalogItem, CatalogItem } from '@/hooks/useCatalog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Edit, Trash2, Package, Wrench, Loader2, Upload, Download, FileText, EyeOff, Search, X, ChevronDown } from 'lucide-react';
import { formatAmount } from '@/lib/formatAmount';
import { toast } from 'sonner';

interface ParsedImportItem {
  name: string;
  description: string;
  type: 'product' | 'service';
  unit_price: number;
  is_active: boolean;
  existingId?: string;
}

export const CatalogManager = () => {
  const { data: items = [], isLoading } = useCatalogItems();
  const createItem = useCreateCatalogItem();
  const updateItem = useUpdateCatalogItem();
  const deleteItem = useDeleteCatalogItem();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<CatalogItem | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Import preview state
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [parsedImportItems, setParsedImportItems] = useState<ParsedImportItem[]>([]);
  
  // Bulk selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkDeactivateOpen, setBulkDeactivateOpen] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  
  // Search/filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'product' | 'service'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [activeTab, setActiveTab] = useState<'products' | 'services'>('products');
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
    
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && item.is_active) ||
      (statusFilter === 'inactive' && !item.is_active);
    
    return matchesSearch && matchesType && matchesStatus;
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

  // Bulk selection handlers
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = (itemList: CatalogItem[]) => {
    const allSelected = itemList.every(item => selectedItems.has(item.id));
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        itemList.forEach(item => newSet.delete(item.id));
      } else {
        itemList.forEach(item => newSet.add(item.id));
      }
      return newSet;
    });
  };

  const handleBulkDeactivate = async () => {
    setBulkProcessing(true);
    try {
      const promises = Array.from(selectedItems).map(id =>
        updateItem.mutateAsync({ id, is_active: false })
      );
      await Promise.all(promises);
      toast.success(`Deactivated ${selectedItems.size} items`);
      setSelectedItems(new Set());
      setBulkDeactivateOpen(false);
    } catch (error) {
      toast.error('Failed to deactivate some items');
    } finally {
      setBulkProcessing(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (items.length === 0) {
      toast.error('No items to export');
      return;
    }

    const headers = ['name', 'description', 'type', 'unit_price', 'is_active'];
    const csvRows = [
      headers.join(','),
      ...items.map(item => [
        `"${(item.name || '').replace(/"/g, '""')}"`,
        `"${(item.description || '').replace(/"/g, '""')}"`,
        item.type,
        item.unit_price,
        item.is_active ? 'true' : 'false'
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `catalog-items-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${items.length} items`);
  };

  // Download sample CSV template
  const handleDownloadTemplate = () => {
    const headers = ['name', 'description', 'type', 'unit_price', 'is_active'];
    const sampleRows = [
      ['HVAC Filter 16x20', 'High-efficiency MERV 13 filter', 'product', '24.99', 'true'],
      ['AC Tune-Up', 'Complete system inspection and cleaning', 'service', '129.00', 'true'],
      ['Thermostat Installation', 'Install and configure new thermostat', 'service', '89.00', 'true'],
    ];

    const csvContent = [
      headers.join(','),
      ...sampleRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'catalog-import-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  // Parse CSV row helper
  const parseCSVRow = (row: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
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

  // CSV Import - Parse and show preview
  const handleSelectCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('CSV file is empty or has no data rows');
        return;
      }

      // Parse header
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
      const nameIdx = headers.indexOf('name');
      const descIdx = headers.indexOf('description');
      const typeIdx = headers.indexOf('type');
      const priceIdx = headers.indexOf('unit_price');
      const activeIdx = headers.indexOf('is_active');

      if (nameIdx === -1) {
        toast.error('CSV must have a "name" column');
        return;
      }

      // Build a map of existing items by name (case-insensitive)
      const existingByName = new Map<string, CatalogItem>();
      items.forEach(item => {
        existingByName.set(item.name.toLowerCase().trim(), item);
      });

      const parsed: ParsedImportItem[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVRow(lines[i]);
        const name = values[nameIdx]?.trim();
        
        if (!name) continue;

        const description = descIdx !== -1 ? values[descIdx]?.trim() || '' : '';
        const typeValue = typeIdx !== -1 ? values[typeIdx]?.trim().toLowerCase() : 'service';
        const type = (typeValue === 'product' ? 'product' : 'service') as 'product' | 'service';
        const unit_price = priceIdx !== -1 ? parseFloat(values[priceIdx]) || 0 : 0;
        const is_active = activeIdx !== -1 ? values[activeIdx]?.trim().toLowerCase() !== 'false' : true;

        const existingItem = existingByName.get(name.toLowerCase().trim());

        parsed.push({
          name,
          description,
          type,
          unit_price,
          is_active,
          existingId: existingItem?.id,
        });
      }

      if (parsed.length === 0) {
        toast.error('No valid items found in CSV');
        return;
      }

      setParsedImportItems(parsed);
      setImportPreviewOpen(true);
    } catch (error) {
      console.error('CSV parse error:', error);
      toast.error('Failed to parse CSV file');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Execute the actual import
  const handleConfirmImport = async () => {
    setImporting(true);
    let created = 0;
    let updated = 0;
    let skipped = 0;

    try {
      for (const item of parsedImportItems) {
        try {
          if (item.existingId) {
            await updateItem.mutateAsync({
              id: item.existingId,
              name: item.name,
              description: item.description || null,
              type: item.type,
              unit_price: item.unit_price,
              is_active: item.is_active,
            });
            updated++;
          } else {
            await createItem.mutateAsync({
              name: item.name,
              description: item.description || null,
              type: item.type,
              unit_price: item.unit_price,
              is_active: item.is_active,
            });
            created++;
          }
        } catch (error) {
          console.error('Failed to import item:', item.name, error);
          skipped++;
        }
      }

      const messages: string[] = [];
      if (created > 0) messages.push(`${created} created`);
      if (updated > 0) messages.push(`${updated} updated`);
      if (skipped > 0) messages.push(`${skipped} skipped`);
      toast.success(`Import complete: ${messages.join(', ')}`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed');
    } finally {
      setImporting(false);
      setImportPreviewOpen(false);
      setParsedImportItems([]);
    }
  };

  const newItemsCount = parsedImportItems.filter(i => !i.existingId).length;
  const updateItemsCount = parsedImportItems.filter(i => i.existingId).length;

  const renderItemCard = (item: CatalogItem, showCheckbox: boolean = false) => (
    <div
      key={item.id}
      className={`flex items-center justify-between p-3 rounded-lg border ${
        item.is_active ? 'bg-background' : 'bg-muted/50 opacity-60'
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {showCheckbox && (
          <Checkbox
            checked={selectedItems.has(item.id)}
            onCheckedChange={() => toggleItemSelection(item.id)}
          />
        )}
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
      </div>
      <div className="flex items-center gap-3">
        <span className="font-semibold text-primary">
          ${formatAmount(item.unit_price)}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteConfirmItem(item)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
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

  const activeSelectedCount = Array.from(selectedItems).filter(id => 
    items.find(i => i.id === id)?.is_active
  ).length;

  return (
    <div className="space-y-6">
      {/* Search/Filter Section */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={(v: 'all' | 'product' | 'service') => setTypeFilter(v)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="product">
                    <span className="flex items-center gap-2">
                      <Package className="w-4 h-4" /> Products
                    </span>
                  </SelectItem>
                  <SelectItem value="service">
                    <span className="flex items-center gap-2">
                      <Wrench className="w-4 h-4" /> Services
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v: 'all' | 'active' | 'inactive') => setStatusFilter(v)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all') && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <span>Showing {filteredItems.length} of {items.length} items</span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => { setSearchQuery(''); setTypeFilter('all'); setStatusFilter('all'); }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import/Export Accordion */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="import-export" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <span className="flex items-center gap-2 text-base font-semibold">
              <Upload className="w-4 h-4" />
              Import / Export
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex flex-wrap gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleSelectCSV}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Import CSV
              </Button>
              <Button variant="outline" onClick={handleExportCSV} disabled={items.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="ghost" onClick={handleDownloadTemplate}>
                <FileText className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              CSV format: name, description, type (product/service), unit_price, is_active (true/false).
              Duplicate items (by name) will be updated instead of creating duplicates.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <Card className="border-primary">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedItems(new Set())}
                >
                  Clear Selection
                </Button>
                {activeSelectedCount > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setBulkDeactivateOpen(true)}
                  >
                    <EyeOff className="w-4 h-4 mr-1" />
                    Deactivate ({activeSelectedCount})
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
              <div className="flex items-center gap-3">
                {products.length > 0 && (
                  <Checkbox
                    checked={products.every(p => selectedItems.has(p.id)) && products.length > 0}
                    onCheckedChange={() => toggleSelectAll(products)}
                  />
                )}
                <span className="text-sm text-muted-foreground">
                  {products.length > 0 ? 'Select all' : 'No products'}
                </span>
              </div>
              <Button size="sm" onClick={() => openCreateDialog('product')}>
                <Plus className="w-4 h-4 mr-1" />
                Add Product
              </Button>
            </CardHeader>
            <CardContent>
              {products.length > 0 ? (
                <div className="space-y-2">
                  {products.map(item => renderItemCard(item, true))}
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
              <div className="flex items-center gap-3">
                {services.length > 0 && (
                  <Checkbox
                    checked={services.every(s => selectedItems.has(s.id)) && services.length > 0}
                    onCheckedChange={() => toggleSelectAll(services)}
                  />
                )}
                <span className="text-sm text-muted-foreground">
                  {services.length > 0 ? 'Select all' : 'No services'}
                </span>
              </div>
              <Button size="sm" onClick={() => openCreateDialog('service')}>
                <Plus className="w-4 h-4 mr-1" />
                Add Service
              </Button>
            </CardHeader>
            <CardContent>
              {services.length > 0 ? (
                <div className="space-y-2">
                  {services.map(item => renderItemCard(item, true))}
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

      {/* Import Preview Dialog */}
      <Dialog open={importPreviewOpen} onOpenChange={(open) => { if (!importing) setImportPreviewOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="text-2xl font-bold text-green-600">{newItemsCount}</div>
                <div className="text-sm text-muted-foreground">New items to create</div>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="text-2xl font-bold text-blue-600">{updateItemsCount}</div>
                <div className="text-sm text-muted-foreground">Existing items to update</div>
              </div>
            </div>

            {parsedImportItems.length > 0 && (
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">Name</th>
                      <th className="text-left p-2 font-medium">Type</th>
                      <th className="text-right p-2 font-medium">Price</th>
                      <th className="text-center p-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedImportItems.map((item, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2 truncate max-w-[150px]">{item.name}</td>
                        <td className="p-2 capitalize">{item.type}</td>
                        <td className="p-2 text-right">${formatAmount(item.unit_price)}</td>
                        <td className="p-2 text-center">
                          <Badge variant={item.existingId ? "secondary" : "default"} className="text-xs">
                            {item.existingId ? 'Update' : 'Create'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Items with matching names will be updated. New items will be created.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportPreviewOpen(false)} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={handleConfirmImport} disabled={importing}>
              {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Import {parsedImportItems.length} Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Deactivate Confirmation */}
      <AlertDialog open={bulkDeactivateOpen} onOpenChange={setBulkDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Items</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate {activeSelectedCount} item{activeSelectedCount > 1 ? 's' : ''}? 
              Inactive items won't appear in the catalog picker but can be reactivated later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeactivate} disabled={bulkProcessing}>
              {bulkProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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