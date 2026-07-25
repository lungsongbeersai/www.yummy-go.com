"use client";

import { Card, CardContent } from "@/components/ui/card";

export function ReportError({ message }: { message: string }) {
  return (
    <Card className="border-destructive/25 bg-destructive/5">
      <CardContent className="p-3 text-sm font-medium text-destructive">
        {message}
      </CardContent>
    </Card>
  );
}
