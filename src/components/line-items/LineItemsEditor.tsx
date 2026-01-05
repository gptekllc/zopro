import { Plus, X, Clock, Package, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ItemsPicker } from './ItemsPicker';
import { Item } from '@/hooks/useItems';

export interface LineItem {
  id: string;
  description: string;
  itemDescription?: string; // Additional description/notes for the item
  quantity: number;
  unitPrice: number;
  type?: 'product' | 'service';
}

interface LineItemsEditorProps {
  items: LineItem[];
  onAddItem: (type: 'product' | 'service') => void;
  onAddFromCatalog?: (item: Item) => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (id: string, field: keyof LineItem, value: string | number) => void;
  showTypeColumn?: boolean;
  quantityLabel?: string;
  minItems?: number;
}

export const LineItemsEditor = ({
  items,
  onAddItem,
  onAddFromCatalog,
  onRemoveItem,
  onUpdateItem,
  showTypeColumn = false,
  quantityLabel = 'Quantity',
  minItems = 0,
}: LineItemsEditorProps) => {
  const products = items.filter(item => item.type === 'product');
  const services = items.filter(item => item.type === 'service');

  const handleCatalogSelect = (catalogItem: Item) => {
    if (onAddFromCatalog) {
      onAddFromCatalog(catalogItem);
    }
  };

  const renderItemRow = (item: LineItem, canRemove: boolean) => {
    const isAutoLabor = item.description.toLowerCase() === 'labor';
    
    return (
      <div key={item.id} className="space-y-2">
        {/* Mobile layout */}
        <div className={`sm:hidden space-y-2 p-3 rounded-lg ${isAutoLabor ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : 'bg-muted/50'}`}>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input
                placeholder="Item name"
                value={item.description}
                onChange={e => onUpdateItem(item.id, 'description', e.target.value)}
              />
            </div>
            {isAutoLabor && (
              <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 whitespace-nowrap mt-4">
                <Clock className="w-3 h-3 mr-1" />
                Auto
              </Badge>
            )}
            <div className="mt-4">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveItem(item.id)}
                disabled={!canRemove}
                className="text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Description (optional)</Label>
            <Textarea
              placeholder="Additional details..."
              value={item.itemDescription || ''}
              onChange={e => onUpdateItem(item.id, 'itemDescription', e.target.value)}
              className="min-h-[60px] resize-none"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">{quantityLabel}</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={item.quantity}
                onChange={e => onUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 1)}
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Unit Price</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={item.unitPrice === 0 ? '' : item.unitPrice}
                onChange={e => onUpdateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="flex justify-end text-sm font-medium">
            Total: ${(item.quantity * item.unitPrice).toLocaleString()}
          </div>
        </div>
        
        {/* Desktop layout */}
        <div className={`hidden sm:block space-y-2 p-3 rounded-lg ${isAutoLabor ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : 'bg-muted/30 border'}`}>
          <div className="grid grid-cols-12 gap-2 items-start">
            <div className={isAutoLabor ? 'col-span-4' : 'col-span-5'}>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input
                placeholder="Item name"
                value={item.description}
                onChange={e => onUpdateItem(item.id, 'description', e.target.value)}
              />
            </div>
            {isAutoLabor && (
              <div className="col-span-1 flex items-center justify-center pt-6">
                <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                  <Clock className="w-3 h-3 mr-1" />
                  Auto
                </Badge>
              </div>
            )}
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">{quantityLabel}</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={item.quantity}
                onChange={e => onUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 1)}
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Unit Price</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={item.unitPrice === 0 ? '' : item.unitPrice}
                onChange={e => onUpdateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="col-span-2 pt-6 text-right text-sm font-medium">
              ${(item.quantity * item.unitPrice).toLocaleString()}
            </div>
            <div className="col-span-1 pt-5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveItem(item.id)}
                disabled={!canRemove}
                className="text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Description (optional)</Label>
            <Textarea
              placeholder="Additional details about this item..."
              value={item.itemDescription || ''}
              onChange={e => onUpdateItem(item.id, 'itemDescription', e.target.value)}
              className="min-h-[50px] resize-none"
            />
          </div>
        </div>
      </div>
    );
  };

  const canRemoveItem = items.length > minItems;

  return (
    <div className="space-y-6">
      {/* Products Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            Products
          </Label>
          <div className="flex items-center gap-1">
            {onAddFromCatalog && <ItemsPicker type="product" onSelect={handleCatalogSelect} />}
            <Button type="button" variant="outline" size="sm" onClick={() => onAddItem('product')}>
              <Plus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Add Product</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>
        
        {products.length > 0 ? (
          <div className="space-y-3">
            {products.map(item => renderItemRow(item, canRemoveItem))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground py-3 px-4 bg-muted/30 rounded-lg text-center">
            No products added
          </div>
        )}
      </div>

      {/* Services Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Wrench className="w-4 h-4 text-muted-foreground" />
            Services
          </Label>
          <div className="flex items-center gap-1">
            {onAddFromCatalog && <ItemsPicker type="service" onSelect={handleCatalogSelect} />}
            <Button type="button" variant="outline" size="sm" onClick={() => onAddItem('service')}>
              <Plus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Add Service</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>
        
        {services.length > 0 ? (
          <div className="space-y-3">
            {services.map(item => renderItemRow(item, canRemoveItem))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground py-3 px-4 bg-muted/30 rounded-lg text-center">
            No services added
          </div>
        )}
      </div>
    </div>
  );
};
