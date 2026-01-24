import { Skeleton } from '@/components/ui/skeleton';
import { ImageIcon } from 'lucide-react';

interface PhotoSkeletonProps {
  count?: number;
  className?: string;
}

export function PhotoSkeleton({ count = 1, className }: PhotoSkeletonProps) {
  return (
    <div className={`grid grid-cols-3 sm:grid-cols-4 gap-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i}
          className="aspect-square relative rounded-md overflow-hidden"
        >
          <Skeleton className="absolute inset-0" />
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-muted-foreground/50 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface PhotoThumbnailSkeletonProps {
  isLoading: boolean;
  children: React.ReactNode;
}

export function PhotoThumbnailSkeleton({ isLoading, children }: PhotoThumbnailSkeletonProps) {
  if (isLoading) {
    return (
      <div className="aspect-square relative rounded-md overflow-hidden">
        <Skeleton className="absolute inset-0" />
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageIcon className="w-6 h-6 text-muted-foreground/50 animate-pulse" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
