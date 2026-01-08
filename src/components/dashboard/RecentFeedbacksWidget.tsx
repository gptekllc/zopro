import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Star } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useRecentFeedbacks, RecentFeedback } from '@/hooks/useRecentFeedbacks';

export function RecentFeedbacksWidget() {
  const { data: feedbacks = [], isLoading } = useRecentFeedbacks(5);
  const navigate = useNavigate();

  const handleFeedbackClick = (feedback: RecentFeedback) => {
    // Navigate to jobs page with query params to open job detail dialog with feedback tab
    navigate(`/jobs?view=${feedback.job_id}&tab=feedback`);
  };

  const getTechnicianNames = (feedback: RecentFeedback): string => {
    const assignees = feedback.job?.assignees || [];
    if (assignees.length === 0) return 'Unassigned';
    return assignees
      .map(a => a.profile?.full_name || 'Unknown')
      .filter(Boolean)
      .join(', ') || 'Unassigned';
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Recent Feedbacks
        </CardTitle>
        <span 
          onClick={() => navigate('/jobs?statusFilter=completed')}
          className="text-sm text-primary hover:underline cursor-pointer"
        >
          View all
        </span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-4">Loading...</p>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-6">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-muted-foreground">No customer feedback yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Feedback will appear here when customers rate completed jobs
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {feedbacks.map(feedback => (
              <div
                key={feedback.id}
                onClick={() => handleFeedbackClick(feedback)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/80 ${
                  feedback.is_negative 
                    ? 'bg-destructive/5 border-destructive/20 hover:bg-destructive/10' 
                    : 'bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Rating */}
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            className={`w-3 h-3 ${
                              star <= feedback.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-muted-foreground/30'
                            }`}
                          />
                        ))}
                      </div>
                      {feedback.is_negative && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Needs Attention
                        </Badge>
                      )}
                    </div>

                    {/* Job info */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{feedback.job?.job_number}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground truncate">
                        {feedback.customer?.name}
                      </span>
                    </div>

                    {/* Technicians */}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tech: {getTechnicianNames(feedback)}
                    </p>

                    {/* Feedback text */}
                    {feedback.feedback_text && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                        "{feedback.feedback_text}"
                      </p>
                    )}
                  </div>

                  {/* Date */}
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(feedback.created_at), 'MMM d')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
