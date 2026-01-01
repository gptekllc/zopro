import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { Calendar, Users, AlertTriangle, Clock, ChevronRight, UserPlus, Loader2 } from 'lucide-react';
import { format, isToday, parseISO, addHours } from 'date-fns';
import { Job, useUpdateJob } from '@/hooks/useJobs';
import { toast } from 'sonner';

interface SchedulerWidgetProps {
  jobs: Job[];
  technicians: { id: string; full_name: string | null }[];
}

export function SchedulerWidget({ jobs, technicians }: SchedulerWidgetProps) {
  const [assigningJobId, setAssigningJobId] = useState<string | null>(null);
  const updateJob = useUpdateJob();

  // Get today's scheduled jobs
  const todaysJobs = useMemo(() => {
    return jobs.filter(job => {
      if (!job.scheduled_start) return false;
      const jobDate = parseISO(job.scheduled_start);
      return isToday(jobDate);
    }).sort((a, b) => {
      const aTime = a.scheduled_start ? new Date(a.scheduled_start).getTime() : 0;
      const bTime = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
      return aTime - bTime;
    });
  }, [jobs]);

  // Get unassigned jobs
  const unassignedJobs = useMemo(() => {
    return jobs.filter(job => 
      !job.assigned_to && 
      !job.archived_at && 
      job.status !== 'completed' && 
      job.status !== 'invoiced' && 
      job.status !== 'paid'
    );
  }, [jobs]);

  // Get urgent unassigned jobs
  const urgentUnassigned = useMemo(() => {
    return unassignedJobs.filter(job => job.priority === 'urgent' || job.priority === 'high');
  }, [unassignedJobs]);

  // Get technician availability for today
  const technicianSchedule = useMemo(() => {
    return technicians.map(tech => {
      const techJobs = todaysJobs.filter(job => job.assigned_to === tech.id);
      const totalHours = techJobs.reduce((sum, job) => {
        if (job.scheduled_start && job.scheduled_end) {
          const start = new Date(job.scheduled_start);
          const end = new Date(job.scheduled_end);
          return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
        return sum + 1; // Default 1 hour if no end time
      }, 0);

      return {
        ...tech,
        jobCount: techJobs.length,
        hoursScheduled: totalHours,
        nextJob: techJobs[0],
      };
    }).sort((a, b) => b.jobCount - a.jobCount);
  }, [technicians, todaysJobs]);

  // Find available technicians (those with less than 8 hours scheduled)
  const availableTechnicians = useMemo(() => {
    return technicianSchedule.filter(tech => tech.hoursScheduled < 8);
  }, [technicianSchedule]);

  const handleQuickAssign = async (jobId: string, technicianId: string) => {
    setAssigningJobId(jobId);
    
    const job = jobs.find(j => j.id === jobId);
    const duration = job?.estimated_duration || 60;
    
    // Schedule for now + 1 hour (give them time to get there)
    const scheduledStart = addHours(new Date(), 1);
    const scheduledEnd = new Date(scheduledStart.getTime() + duration * 60 * 1000);
    
    try {
      await updateJob.mutateAsync({
        id: jobId,
        assigned_to: technicianId,
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        status: 'scheduled',
      });
      
      const techName = technicians.find(t => t.id === technicianId)?.full_name || 'Technician';
      toast.success(`Assigned to ${techName} for ${format(scheduledStart, 'h:mm a')}`);
    } catch (error) {
      // Error handled by mutation
    } finally {
      setAssigningJobId(null);
    }
  };

  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'in_progress': return 'bg-warning/10 text-warning';
      case 'scheduled': return 'bg-blue-500/10 text-blue-500';
      case 'completed': return 'bg-success/10 text-success';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: Job['priority']) => {
    switch (priority) {
      case 'urgent': return 'text-destructive';
      case 'high': return 'text-orange-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Today's Schedule
        </CardTitle>
        <Link to="/jobs?view=scheduler">
          <Button variant="ghost" size="sm" className="gap-1">
            Open Scheduler
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{todaysJobs.length}</p>
            <p className="text-xs text-muted-foreground">Jobs Today</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{unassignedJobs.length}</p>
            <p className="text-xs text-muted-foreground">Unassigned</p>
          </div>
          <div className={`text-center p-3 rounded-lg ${urgentUnassigned.length > 0 ? 'bg-destructive/10' : 'bg-muted/50'}`}>
            <p className={`text-2xl font-bold ${urgentUnassigned.length > 0 ? 'text-destructive' : ''}`}>
              {urgentUnassigned.length}
            </p>
            <p className="text-xs text-muted-foreground">Urgent</p>
          </div>
        </div>

        {/* Urgent unassigned jobs with quick assign */}
        {urgentUnassigned.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Urgent Jobs Need Assignment
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {urgentUnassigned.slice(0, 5).map(job => (
                <div 
                  key={job.id} 
                  className="flex items-center gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {job.customer?.name}
                      {job.priority === 'urgent' && (
                        <Badge variant="destructive" className="ml-2 text-[10px] px-1 py-0">URGENT</Badge>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 w-36">
                    {assigningJobId === job.id ? (
                      <div className="flex items-center justify-center h-9">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    ) : (
                      <Select onValueChange={(value) => handleQuickAssign(job.id, value)}>
                        <SelectTrigger className="h-9 text-xs">
                          <div className="flex items-center gap-1">
                            <UserPlus className="w-3 h-3" />
                            <SelectValue placeholder="Assign" />
                          </div>
                        </SelectTrigger>
                        <SelectContent className="z-50">
                          {availableTechnicians.length > 0 ? (
                            availableTechnicians.map(tech => (
                              <SelectItem key={tech.id} value={tech.id}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate">{tech.full_name || 'Unnamed'}</span>
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    {(8 - tech.hoursScheduled).toFixed(1)}h free
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>
                              No available technicians
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Technician overview */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Users className="w-4 h-4" />
            Technician Load
          </p>
          <div className="space-y-2">
            {technicianSchedule.slice(0, 4).map(tech => (
              <div key={tech.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tech.full_name || 'Unnamed'}</p>
                  <p className="text-xs text-muted-foreground">
                    {tech.jobCount} job{tech.jobCount !== 1 ? 's' : ''} • {tech.hoursScheduled.toFixed(1)}h scheduled
                  </p>
                </div>
                <div className="shrink-0">
                  {tech.jobCount === 0 ? (
                    <Badge variant="outline" className="bg-success/10 text-success text-xs">
                      Available
                    </Badge>
                  ) : tech.hoursScheduled >= 8 ? (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive text-xs">
                      Full
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {(8 - tech.hoursScheduled).toFixed(1)}h free
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {technicianSchedule.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">No technicians found</p>
            )}
          </div>
        </div>

        {/* Upcoming jobs today */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Upcoming Today
          </p>
          <div className="space-y-2">
            {todaysJobs.slice(0, 3).map(job => (
              <div key={job.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="text-xs text-muted-foreground shrink-0 w-14">
                  {job.scheduled_start && format(new Date(job.scheduled_start), 'h:mm a')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{job.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {job.assignee?.full_name || 'Unassigned'} • {job.customer?.name}
                  </p>
                </div>
                <Badge className={`${getStatusColor(job.status)} text-xs shrink-0`}>
                  {job.status.replace('_', ' ')}
                </Badge>
              </div>
            ))}
            {todaysJobs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">No jobs scheduled for today</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
