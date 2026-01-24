import { CheckCircle2, Loader2, XCircle, ImageIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export type UploadStatus = 'pending' | 'compressing' | 'uploading' | 'success' | 'error';

export interface QueuedFile {
  id: string;
  name: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  previewUrl?: string;
}

interface PhotoUploadQueueProps {
  files: QueuedFile[];
  className?: string;
}

export function PhotoUploadQueue({ files, className }: PhotoUploadQueueProps) {
  if (files.length === 0) return null;

  const completedCount = files.filter(f => f.status === 'success').length;
  const totalCount = files.length;
  const overallProgress = Math.round((completedCount / totalCount) * 100);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Overall progress */}
      <div className="flex items-center gap-3">
        <Progress value={overallProgress} className="flex-1 h-2" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Individual file status */}
      <div className="max-h-40 overflow-y-auto space-y-2">
        {files.map((file) => (
          <div 
            key={file.id}
            className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
          >
            {/* Thumbnail or icon */}
            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
              {file.previewUrl ? (
                <img 
                  src={file.previewUrl} 
                  alt="" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
              )}
            </div>

            {/* File name and status */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{file.name}</p>
              <div className="flex items-center gap-1">
                {file.status === 'pending' && (
                  <span className="text-xs text-muted-foreground">Waiting...</span>
                )}
                {file.status === 'compressing' && (
                  <span className="text-xs text-primary/70">Compressing...</span>
                )}
                {file.status === 'uploading' && (
                  <span className="text-xs text-primary">Uploading...</span>
                )}
                {file.status === 'success' && (
                  <span className="text-xs text-primary">Done</span>
                )}
                {file.status === 'error' && (
                  <span className="text-xs text-destructive truncate" title={file.error}>
                    {file.error || 'Failed'}
                  </span>
                )}
              </div>
            </div>

            {/* Status icon */}
            <div className="flex-shrink-0">
              {file.status === 'pending' && (
                <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
              )}
              {(file.status === 'compressing' || file.status === 'uploading') && (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              )}
              {file.status === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-primary" />
              )}
              {file.status === 'error' && (
                <XCircle className="w-4 h-4 text-destructive" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
