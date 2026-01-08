import { useState } from 'react';
import { Plus, X, Clock, Package, Wrench, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ItemsPicker } from './ItemsPicker';
import { Item } from '@/hooks/useItems';
import { formatAmount } from '@/lib/formatAmount';
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
  
  const [productsOpen, setProductsOpen] = useState(true);
  const [servicesOpen, setServicesOpen] = useState(true);
  const handleCatalogSelect = (catalogItem: Item) => {
    // Check if item with same name and type already exists
    const existingItem = items.find(
      item => item.description === catalogItem.name && item.type === catalogItem.type
    );
    
    if (existingItem) {
      // Increment quantity of existing item
      onUpdateItem(existingItem.id, 'quantity', existingItem.quantity + 1);
    } else if (onAddFromCatalog) {
      onAddFromCatalog(catalogItem);
    }
  };

  const renderItemRow = (item: LineItem, canRemove: boolean) => {
    const isAutoLabor = item.description.toLowerCase() === 'labor';
    
    return (
      <div key={item.id} className="space-y-1.5">
        {/* Mobile layout */}
        <div className={`sm:hidden space-y-2 p-2.5 rounded-lg ${isAutoLabor ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : 'bg-muted/50'}`}>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                placeholder="Item name"
                value={item.description}
                onChange={e => onUpdateItem(item.id, 'description', e.target.value)}
                className="h-9"
              />
            </div>
            {isAutoLabor && (
              <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 whitespace-nowrap">
                <Clock className="w-3 h-3 mr-1" />
                Auto
              </Badge>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemoveItem(item.id)}
              disabled={!canRemove}
              className="text-destructive h-9 w-9"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={item.quantity}
                onChange={e => onUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 1)}
                className="h-9"
                placeholder={quantityLabel}
              />
            </div>
            <div className="flex-1">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Price"
                value={item.unitPrice === 0 ? '' : item.unitPrice}
                onChange={e => onUpdateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                className="h-9"
              />
            </div>
            <div className="flex items-center text-sm font-medium min-w-[70px] justify-end">
              ${formatAmount(item.quantity * item.unitPrice)}
            </div>
          </div>
          <Textarea
            placeholder="Description (optional)"
            value={item.itemDescription || ''}
            onChange={e => onUpdateItem(item.id, 'itemDescription', e.target.value)}
            className="min-h-[40px] resize-none text-sm"
          />
        </div>
        
        {/* Desktop layout */}
        <div className={`hidden sm:block p-2.5 rounded-lg ${isAutoLabor ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : 'bg-muted/30 border'}`}>
          <div className="flex items-center gap-2">
            <div className={isAutoLabor ? 'flex-[3]' : 'flex-[4]'}>
              <Input
                placeholder="Item name"
                value={item.description}
                onChange={e => onUpdateItem(item.id, 'description', e.target.value)}
                className="h-9"
              />
            </div>
            {isAutoLabor && (
              <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                <Clock className="w-3 h-3 mr-1" />
                Auto
              </Badge>
            )}
            <div className="w-20">
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={item.quantity}
                onChange={e => onUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 1)}
                className="h-9"
                placeholder="Qty"
              />
            </div>
            <div className="w-24">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Price"
                value={item.unitPrice === 0 ? '' : item.unitPrice}
                onChange={e => onUpdateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                className="h-9"
              />
            </div>
            <div className="w-24 text-right text-sm font-medium">
              ${formatAmount(item.quantity * item.unitPrice)}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemoveItem(item.id)}
              disabled={!canRemove}
              className="text-destructive h-9 w-9"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="mt-1.5">
            <Input
              placeholder="Description (optional)"
              value={item.itemDescription || ''}
              onChange={e => onUpdateItem(item.id, 'itemDescription', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>
    );
  };

  const canRemoveItem = items.length > minItems;

  return (
    <div className="space-y-4">
      {/* Products Section */}
      <Collapsible open={productsOpen} onOpenChange={setProductsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-70 transition-opacity w-full">
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${productsOpen ? '' : '-rotate-90'}`} />
          <Label className="text-sm font-semibold flex items-center gap-2 cursor-pointer">
            <Package className="w-4 h-4 text-muted-foreground" />
            Products
            {products.length > 0 && (
              <Badge variant="secondary" className="text-xs">{products.length}</Badge>
            )}
          </Label>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          {products.length > 0 ? (
            <div className="space-y-2">
              {products.map(item => renderItemRow(item, canRemoveItem))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-2 px-3 bg-muted/30 rounded-lg text-center">
              No products added
            </div>
          )}
          <div className="flex items-center justify-center gap-2 pt-1">
            {onAddFromCatalog && <ItemsPicker type="product" onSelect={handleCatalogSelect} />}
            <Button type="button" variant="outline" size="sm" onClick={() => onAddItem('product')} className="h-8">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Product
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Services Section */}
      <Collapsible open={servicesOpen} onOpenChange={setServicesOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-70 transition-opacity w-full">
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${servicesOpen ? '' : '-rotate-90'}`} />
          <Label className="text-sm font-semibold flex items-center gap-2 cursor-pointer">
            <Wrench className="w-4 h-4 text-muted-foreground" />
            Services
            {services.length > 0 && (
              <Badge variant="secondary" className="text-xs">{services.length}</Badge>
            )}
          </Label>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          {services.length > 0 ? (
            <div className="space-y-2">
              {services.map(item => renderItemRow(item, canRemoveItem))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-2 px-3 bg-muted/30 rounded-lg text-center">
              No services added
            </div>
          )}
          <div className="flex items-center justify-center gap-2 pt-1">
            {onAddFromCatalog && <ItemsPicker type="service" onSelect={handleCatalogSelect} />}
            <Button type="button" variant="outline" size="sm" onClick={() => onAddItem('service')} className="h-8">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Service
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
