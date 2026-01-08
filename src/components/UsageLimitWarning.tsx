import { useUsageLimits } from '@/hooks/useUsageLimits';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Users, Briefcase, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

interface UsageLimitWarningProps {
  type: 'users' | 'jobs' | 'all';
  showProgress?: boolean;
  compact?: boolean;
}

export function UsageLimitWarning({ type, showProgress = false, compact = false }: UsageLimitWarningProps) {
  const {
    currentUsers,
    currentJobsThisMonth,
    maxUsers,
    maxJobsPerMonth,
    isNearUserLimit,
    isNearJobLimit,
    isAtUserLimit,
    isAtJobLimit,
    isLoading,
  } = useUsageLimits();
  
  if (isLoading) return null;
  
  const showUsers = (type === 'users' || type === 'all') && maxUsers !== null;
  const showJobs = (type === 'jobs' || type === 'all') && maxJobsPerMonth !== null;
  
  const hasUserWarning = showUsers && isNearUserLimit;
  const hasJobWarning = showJobs && isNearJobLimit;
  
  if (!hasUserWarning && !hasJobWarning) return null;
  
  const userProgress = maxUsers ? (currentUsers / maxUsers) * 100 : 0;
  const jobProgress = maxJobsPerMonth ? (currentJobsThisMonth / maxJobsPerMonth) * 100 : 0;
  
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {hasUserWarning && (
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isAtUserLimit 
              ? 'bg-destructive/10 text-destructive' 
              : 'bg-warning/10 text-warning'
          }`}>
            <Users className="w-3 h-3" />
            {isAtUserLimit ? 'User limit reached' : `${currentUsers}/${maxUsers} users`}
          </div>
        )}
        {hasJobWarning && (
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isAtJobLimit 
              ? 'bg-destructive/10 text-destructive' 
              : 'bg-warning/10 text-warning'
          }`}>
            <Briefcase className="w-3 h-3" />
            {isAtJobLimit ? 'Job limit reached' : `${currentJobsThisMonth}/${maxJobsPerMonth} jobs`}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <Alert variant={isAtUserLimit || isAtJobLimit ? 'destructive' : 'default'} className="border-warning/50 bg-warning/5">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {isAtUserLimit || isAtJobLimit ? 'Limit Reached' : 'Approaching Limit'}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        {hasUserWarning && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Team Members
              </span>
              <span className="font-medium">{currentUsers} / {maxUsers}</span>
            </div>
            {showProgress && (
              <Progress value={userProgress} className="h-2" />
            )}
          </div>
        )}
        
        {hasJobWarning && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                Jobs This Month
              </span>
              <span className="font-medium">{currentJobsThisMonth} / {maxJobsPerMonth}</span>
            </div>
            {showProgress && (
              <Progress value={jobProgress} className="h-2" />
            )}
          </div>
        )}
        
        <div className="pt-1">
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/company">
              <Sparkles className="w-3.5 h-3.5" />
              Upgrade for more
            </Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/** Simple inline badge showing limit status */
export function UsageLimitBadge({ type }: { type: 'users' | 'jobs' }) {
  const {
    currentUsers,
    currentJobsThisMonth,
    maxUsers,
    maxJobsPerMonth,
    isAtUserLimit,
    isAtJobLimit,
    isLoading,
  } = useUsageLimits();
  
  if (isLoading) return null;
  
  if (type === 'users' && maxUsers !== null) {
    return (
      <span className={`text-xs ${isAtUserLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
        ({currentUsers}/{maxUsers})
      </span>
    );
  }
  
  if (type === 'jobs' && maxJobsPerMonth !== null) {
    return (
      <span className={`text-xs ${isAtJobLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
        ({currentJobsThisMonth}/{maxJobsPerMonth} this month)
      </span>
    );
  }
  
  return null;
}
