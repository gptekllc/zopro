import { usePhotoLimits } from '@/hooks/usePhotoLimits';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Camera, Lock, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PhotoLimitWarningProps {
  documentType: 'job' | 'quote' | 'invoice';
  documentId: string | null;
  compact?: boolean;
}

export function PhotoLimitWarning({ documentType, documentId, compact = false }: PhotoLimitWarningProps) {
  const { canUpload, currentCount, limit, remaining, isLoading, planName } = usePhotoLimits(documentType, documentId);

  if (isLoading || limit === null) return null;

  // Free plan - no photos allowed
  if (limit === 0) {
    if (compact) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
          <Lock className="w-3 h-3" />
          Photos not available on Free plan
        </div>
      );
    }

    return (
      <Alert className="border-muted">
        <Lock className="h-4 w-4" />
        <AlertTitle>Photos Not Available</AlertTitle>
        <AlertDescription className="space-y-2">
          <p className="text-sm">Photo uploads are not available on the Free plan. Upgrade to add photos to your {documentType}s.</p>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/company">
              <Sparkles className="w-3.5 h-3.5" />
              Upgrade Plan
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // At limit
  if (!canUpload) {
    if (compact) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
          <Camera className="w-3 h-3" />
          Photo limit reached ({currentCount}/{limit})
        </div>
      );
    }

    return (
      <Alert variant="destructive">
        <Camera className="h-4 w-4" />
        <AlertTitle>Photo Limit Reached</AlertTitle>
        <AlertDescription className="space-y-2">
          <p className="text-sm">
            You've reached the maximum of {limit} photos per {documentType} on your {planName} plan.
          </p>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/company">
              <Sparkles className="w-3.5 h-3.5" />
              Upgrade for more photos
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Near limit (80%+)
  if (remaining !== null && limit > 0 && remaining <= Math.ceil(limit * 0.2)) {
    if (compact) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
          <Camera className="w-3 h-3" />
          {remaining} photo{remaining !== 1 ? 's' : ''} remaining
        </div>
      );
    }

    return (
      <Alert className="border-warning/50 bg-warning/5">
        <Camera className="h-4 w-4 text-warning" />
        <AlertTitle className="text-warning">Almost at Photo Limit</AlertTitle>
        <AlertDescription>
          <p className="text-sm">
            {remaining} photo{remaining !== 1 ? 's' : ''} remaining ({currentCount}/{limit}).
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

/** Simple inline badge showing photo count */
export function PhotoLimitBadge({ documentType, documentId }: { documentType: 'job' | 'quote' | 'invoice'; documentId: string | null }) {
  const { currentCount, limit, isLoading } = usePhotoLimits(documentType, documentId);

  if (isLoading || limit === null) return null;

  const isAtLimit = currentCount >= limit;

  return (
    <span className={`text-xs ${isAtLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
      ({currentCount}/{limit})
    </span>
  );
}
