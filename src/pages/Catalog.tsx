import { Package } from 'lucide-react';
import { CatalogManager } from '@/components/catalog/CatalogManager';

const Catalog = () => {
  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="w-6 h-6" />
          Catalog
        </h1>
        <p className="text-muted-foreground">Manage your products and services</p>
      </div>

      <CatalogManager />
    </div>
  );
};

export default Catalog;
