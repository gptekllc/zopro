import { useStorageUsage, formatBytes } from '@/hooks/useStorageUsage';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { HardDrive, Sparkles, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface StorageLimitWarningProps {
  showProgress?: boolean;
  compact?: boolean;
}

export function StorageLimitWarning({ showProgress = true, compact = false }: StorageLimitWarningProps) {
  const {
    totalBytesUsed,
    limitBytes,
    percentageUsed,
    isNearLimit,
    isCritical,
    isAtLimit,
    addonPricePerGb,
    isLoading,
  } = useStorageUsage();

  if (isLoading || limitBytes === null) return null;
  if (!isNearLimit) return null;

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        isAtLimit 
          ? 'bg-destructive/10 text-destructive' 
          : isCritical
          ? 'bg-destructive/10 text-destructive'
          : 'bg-warning/10 text-warning'
      }`}>
        <HardDrive className="w-3 h-3" />
        {isAtLimit 
          ? 'Storage full' 
          : `${Math.round(percentageUsed)}% storage used`
        }
      </div>
    );
  }

  return (
    <Alert variant={isAtLimit || isCritical ? 'destructive' : 'default'} className={
      isAtLimit || isCritical ? '' : 'border-warning/50 bg-warning/5'
    }>
      {isAtLimit || isCritical ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <HardDrive className="h-4 w-4 text-warning" />
      )}
      <AlertTitle>
        {isAtLimit 
          ? 'Storage Full' 
          : isCritical 
          ? 'Storage Almost Full' 
          : 'Running Low on Storage'
        }
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span>{formatBytes(totalBytesUsed)} used</span>
            <span className="font-medium">{formatBytes(limitBytes)} limit</span>
          </div>
          {showProgress && (
            <Progress 
              value={Math.min(percentageUsed, 100)} 
              className="h-2" 
            />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/company">
              <Sparkles className="w-3.5 h-3.5" />
              {addonPricePerGb 
                ? `Expand storage ($${addonPricePerGb}/GB)`
                : 'Upgrade for more storage'
              }
            </Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/** Storage usage display for settings/company page */
export function StorageUsageDisplay() {
  const {
    totalBytesUsed,
    jobPhotosBytes,
    quotePhotosBytes,
    invoicePhotosBytes,
    limitBytes,
    percentageUsed,
    addonPricePerGb,
    isLoading,
  } = useStorageUsage();

  if (isLoading) {
    return <div className="animate-pulse h-24 bg-muted rounded-lg" />;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Storage Used</span>
          <span className="font-medium">
            {formatBytes(totalBytesUsed)} / {limitBytes ? formatBytes(limitBytes) : 'Unlimited'}
          </span>
        </div>
        {limitBytes && (
          <Progress value={Math.min(percentageUsed, 100)} className="h-2" />
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 text-xs">
        <div className="space-y-1">
          <div className="text-muted-foreground">Jobs</div>
          <div className="font-medium">{formatBytes(jobPhotosBytes)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground">Quotes</div>
          <div className="font-medium">{formatBytes(quotePhotosBytes)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground">Invoices</div>
          <div className="font-medium">{formatBytes(invoicePhotosBytes)}</div>
        </div>
      </div>

      {addonPricePerGb && (
        <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
          <Link to="/company">
            <Sparkles className="w-3.5 h-3.5" />
            Buy More Storage (${addonPricePerGb}/GB)
          </Link>
        </Button>
      )}
    </div>
  );
}
