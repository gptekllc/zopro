import { useState, useMemo } from 'react';
import { Job } from '@/hooks/useJobs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, GripVertical, MapPin, Clock, AlertTriangle } from 'lucide-react';

interface UnassignedJobsSidebarProps {
  jobs: Job[];
  onJobClick: (job: Job) => void;
}

const PRIORITY_OPTIONS = ['all', 'urgent', 'high', 'medium', 'low'] as const;

export default function UnassignedJobsSidebar({ jobs, onJobClick }: UnassignedJobsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Filter unassigned jobs (no assigned_to OR no scheduled_start)
  const unassignedJobs = useMemo(() => {
    return jobs.filter(job => {
      const isUnassigned = !job.assigned_to || !job.scheduled_start;
      const isNotArchived = !job.archived_at;
      const isNotCompleted = !['completed', 'invoiced', 'paid'].includes(job.status);
      return isUnassigned && isNotArchived && isNotCompleted;
    });
  }, [jobs]);

  // Apply search and priority filters
  const filteredJobs = useMemo(() => {
    return unassignedJobs.filter(job => {
      const matchesSearch = 
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.job_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.customer?.zip?.includes(searchQuery);
      
      const matchesPriority = priorityFilter === 'all' || job.priority === priorityFilter;
      
      return matchesSearch && matchesPriority;
    });
  }, [unassignedJobs, searchQuery, priorityFilter]);

  const getPriorityColor = (priority: Job['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'high': return 'bg-warning/10 text-warning border-warning/20';
      case 'medium': return 'bg-primary/10 text-primary border-primary/20';
      case 'low': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getPriorityBorder = (priority: Job['priority']) => {
    switch (priority) {
      case 'urgent': return 'border-l-4 border-l-destructive';
      case 'high': return 'border-l-4 border-l-warning';
      default: return '';
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, job: Job) => {
    e.dataTransfer.setData('application/json', JSON.stringify(job));
    e.dataTransfer.effectAllowed = 'move';
    // Add visual feedback
    const target = e.currentTarget;
    target.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = '1';
  };

  return (
    <div className="flex flex-col h-full border-r bg-card">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Unassigned Jobs
          </h3>
          <Badge variant="secondary" className="text-xs">
            {filteredJobs.length}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs, zip..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        {/* Priority Filter */}
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p === 'all' ? 'All Priorities' : p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Job Cards */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {filteredJobs.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              No unassigned jobs
            </p>
          ) : (
            filteredJobs.map((job) => (
              <div
                key={job.id}
                draggable
                onDragStart={(e) => handleDragStart(e, job)}
                onDragEnd={handleDragEnd}
                onClick={() => onJobClick(job)}
                className={`
                  p-3 rounded-lg border bg-background cursor-grab active:cursor-grabbing
                  hover:shadow-md transition-all group
                  ${getPriorityBorder(job.priority)}
                `}
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground/50 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex-1 min-w-0">
                    {/* Job Title & Number */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{job.title}</p>
                        <p className="text-xs text-muted-foreground">{job.job_number}</p>
                      </div>
                      {job.priority === 'urgent' && (
                        <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                      )}
                    </div>

                    {/* Customer */}
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {job.customer?.name}
                    </p>

                    {/* Meta info */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <Badge variant="outline" className={`text-xs capitalize ${getPriorityColor(job.priority)}`}>
                        {job.priority}
                      </Badge>
                      
                      {job.estimated_duration && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {job.estimated_duration >= 60 
                            ? `${Math.floor(job.estimated_duration / 60)}h ${job.estimated_duration % 60 > 0 ? `${job.estimated_duration % 60}m` : ''}`
                            : `${job.estimated_duration}m`
                          }
                        </span>
                      )}
                      
                      {job.customer?.zip && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {job.customer.zip}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
