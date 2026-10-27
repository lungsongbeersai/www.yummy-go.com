"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SimField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid min-w-0 gap-2"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

export function SimSelect({ label, value, onChange, options, disabled, className }: {
  label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>;
  disabled?: boolean; className?: string;
}) {
  return <Select value={value} onValueChange={onChange} disabled={disabled}>
    <SelectTrigger aria-label={label} className={className ?? "h-10 w-full"}><SelectValue placeholder={label} /></SelectTrigger>
    <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
  </Select>;
}
