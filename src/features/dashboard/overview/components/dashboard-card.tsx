import type { ComponentProps } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DashboardCard({ className, ...props }: ComponentProps<typeof Card>) {
  return (
    <Card
      data-dashboard-card="true"
      className={cn(
        "ring-dashboard-card-border shadow-(--dashboard-card-shadow) dark:ring-border dark:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
