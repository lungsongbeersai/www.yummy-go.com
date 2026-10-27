"use client";

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { contractDateLabel, currentBranchContractStatus } from "@/lib/branch-contract";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

interface BranchContractStatusProps {
  className?: string;
  compact?: boolean;
}

export function BranchContractStatus({ className, compact = false }: BranchContractStatusProps) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const titleId = useId();
  const contract = currentBranchContractStatus(user);
  if (!contract) return null;

  const date = contractDateLabel(contract.endOn, i18n.resolvedLanguage || i18n.language);
  const branchName = user?.branch_name || t("app.branchContract.currentBranch");
  const status = contract.daysRemaining === 0 ? t("app.branchContract.dueToday")
    : contract.daysRemaining < 0
      ? t("app.branchContract.daysOverdue", { count: Math.abs(contract.daysRemaining) })
      : t("app.branchContract.daysRemaining", { count: contract.daysRemaining });
  const label = t("app.branchContract.details", { branch: branchName, date, status });
  const Icon = contract.tone === "normal" ? CalendarClock : TriangleAlert;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={label}
          data-testid="branch-contract-status"
          data-contract-tone={contract.tone}
          className={cn(
            "size-11 flex-col gap-0.5 p-0 tabular-nums",
            compact ? "sm:size-9" : "sm:h-9 sm:w-auto sm:flex-row sm:gap-1.5 sm:px-2",
            contract.tone === "normal" && "border-secondary bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:text-secondary-foreground",
            contract.tone === "warning" && "border-warning/40 bg-background text-warning-text hover:bg-background hover:text-warning-text",
            contract.tone === "expired" && "border-destructive/40 bg-background text-destructive hover:bg-background hover:text-destructive",
            className
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          <span aria-hidden className={cn("max-w-full truncate text-xs leading-none", !compact && "sm:hidden")}>
            {Math.abs(contract.daysRemaining).toLocaleString("en-US")}
          </span>
          {!compact ? <>
            <time aria-hidden dateTime={contract.endOn} className="hidden sm:inline">{date}</time>
            <span aria-hidden className="hidden border-l border-current/25 pl-1.5 lg:inline">{status}</span>
          </> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" aria-labelledby={titleId} className="max-w-[calc(100vw-2rem)] gap-3 p-4">
        <PopoverHeader>
          <PopoverTitle id={titleId}>{t("app.branchContract.title")}</PopoverTitle>
          <p className="break-words text-sm font-medium">{branchName}</p>
        </PopoverHeader>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground">{t("app.branchContract.endDate")}</span>
          <time dateTime={contract.endOn} className="text-sm font-medium tabular-nums">{date}</time>
          <span className={cn(
            "font-medium tabular-nums",
            contract.tone === "normal" && "text-muted-foreground",
            contract.tone === "warning" && "text-warning-text",
            contract.tone === "expired" && "text-destructive"
          )}>{status}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
