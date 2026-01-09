import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PaymentProvider } from '@/hooks/usePaymentProviders';

interface ComingSoonPaymentCardProps {
  provider: PaymentProvider;
}

export function ComingSoonPaymentCard({ provider }: ComingSoonPaymentCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-3 right-3">
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          Coming Soon
        </Badge>
      </div>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: provider.icon_bg_color || '#6b7280' }}
          >
            <span className="text-white font-bold text-sm">{provider.icon_text || '?'}</span>
          </div>
          <div>
            <CardTitle className="text-lg">{provider.name}</CardTitle>
            <CardDescription>{provider.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          We're working on {provider.name.toLowerCase().replace(' payments', '')} integration to give your customers more payment options. 
          Stay tuned for updates!
        </p>
      </CardContent>
    </Card>
  );
}
