import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Award } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TechnicianStats {
  id: string;
  name: string;
  avatarUrl: string | null;
  revenue: number;
  completedJobs: number;
  invoicesCount: number;
  score: number;
}

interface TechnicianLeaderboardWidgetProps {
  technicians: TechnicianStats[];
}

export function TechnicianLeaderboardWidget({ technicians }: TechnicianLeaderboardWidgetProps) {
  const sortedTechnicians = [...technicians].sort((a, b) => b.score - a.score);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 1:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 2:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-sm font-medium text-muted-foreground">#{index + 1}</span>;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Technician Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedTechnicians.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No technician data available for this period.
          </p>
        ) : (
          <div className="space-y-3">
            {sortedTechnicians.map((tech, index) => (
              <div
                key={tech.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  index === 0 ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-muted/50"
                }`}
              >
                <div className="flex-shrink-0">{getRankIcon(index)}</div>
                <Avatar className="h-9 w-9">
                  <AvatarImage src={tech.avatarUrl || undefined} alt={tech.name} />
                  <AvatarFallback className="text-xs">{getInitials(tech.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{tech.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ${tech.revenue.toLocaleString()} • {tech.completedJobs} jobs • {tech.invoicesCount} invoices
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
