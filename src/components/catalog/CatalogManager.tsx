import { useState } from 'react';
import { useCatalogItems, useCreateCatalogItem, useUpdateCatalogItem, useDeleteCatalogItem, CatalogItem } from '@/hooks/useCatalog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Package, Wrench, Loader2 } from 'lucide-react';
import { formatAmount } from '@/lib/formatAmount';

export const CatalogManager = () => {
  const { data: items = [], isLoading } = useCatalogItems();
  const createItem = useCreateCatalogItem();
  const updateItem = useUpdateCatalogItem();
  const deleteItem = useDeleteCatalogItem();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<CatalogItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'service' as 'product' | 'service',
    unit_price: 0,
    is_active: true,
  });

  const products = items.filter(item => item.type === 'product');
  const services = items.filter(item => item.type === 'service');

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

  return (
    <div className="space-y-6">
      {/* Products Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="w-5 h-5" />
            Products
          </CardTitle>
          <Button size="sm" onClick={() => openCreateDialog('product')}>
            <Plus className="w-4 h-4 mr-1" />
            Add Product
          </Button>
        </CardHeader>
        <CardContent>
          {products.length > 0 ? (
            <div className="space-y-2">
              {products.map(renderItemCard)}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No products added yet. Add products to quickly insert them into quotes, jobs, and invoices.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Services Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wrench className="w-5 h-5" />
            Services
          </CardTitle>
          <Button size="sm" onClick={() => openCreateDialog('service')}>
            <Plus className="w-4 h-4 mr-1" />
            Add Service
          </Button>
        </CardHeader>
        <CardContent>
          {services.length > 0 ? (
            <div className="space-y-2">
              {services.map(renderItemCard)}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No services added yet. Add services to quickly insert them into quotes, jobs, and invoices.
            </p>
          )}
        </CardContent>
      </Card>

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
