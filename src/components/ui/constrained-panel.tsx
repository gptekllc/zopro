import { cn } from "@/lib/utils";

interface ConstrainedPanelProps {
  children: React.ReactNode;
  className?: string;
}

export function ConstrainedPanel({ children, className }: ConstrainedPanelProps) {
  return (
    <div className={cn("sm:max-w-sm", className)}>
      {children}
    </div>
  );
}
