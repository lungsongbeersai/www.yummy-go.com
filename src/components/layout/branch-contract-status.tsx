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
  responsiveCompact?: boolean;
}

export function BranchContractStatus({ className, compact = false, responsiveCompact = false }: BranchContractStatusProps) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const titleId = useId();
  const contract = currentBranchContractStatus(user);
  if (!contract) return null;

  const date = contract.endOn === null ? t("app.branchContract.expiryNotSet")
    : contractDateLabel(contract.endOn, i18n.resolvedLanguage || i18n.language);
  const branchName = user?.branch_name || t("app.branchContract.currentBranch");
  const status = contract.daysRemaining === null ? t("app.branchContract.expiryNotSet")
    : contract.daysRemaining === 0 ? t("app.branchContract.dueToday")
    : contract.daysRemaining < 0
      ? t("app.branchContract.daysOverdue", { count: Math.abs(contract.daysRemaining) })
      : t("app.branchContract.daysRemaining", { count: contract.daysRemaining });
  const label = contract.daysRemaining === null ? t("app.branchContract.unknownDetails", { branch: branchName })
    : t("app.branchContract.details", { branch: branchName, date, status });
  const Icon = contract.tone === "warning" || contract.tone === "expired" ? TriangleAlert : CalendarClock;
  const statusClassName = cn(
    contract.tone === "normal" && "bg-primary text-primary-foreground",
    contract.tone === "warning" && "bg-warning-text text-warning-foreground dark:bg-warning",
    contract.tone === "expired" && "bg-destructive text-destructive-foreground dark:bg-destructive/15 dark:text-destructive",
    contract.tone === "unknown" && "bg-secondary text-secondary-foreground"
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          aria-label={label}
          data-testid="branch-contract-status"
          data-contract-tone={contract.tone}
          className={cn(
            "h-11 min-w-0 gap-2 rounded-xl border bg-secondary px-2 text-secondary-foreground shadow-sm tabular-nums",
            "hover:bg-secondary hover:text-secondary-foreground aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
            compact ? "size-12 flex-col gap-0 p-1"
              : responsiveCompact ? "size-12 flex-col gap-0 p-1 2xl:h-11 2xl:w-auto 2xl:flex-row 2xl:justify-start 2xl:gap-2 2xl:px-2 2xl:py-0"
              : "w-auto justify-start",
            contract.tone === "normal" && "border-primary/30",
            contract.tone === "unknown" && "border-secondary-foreground/20",
            contract.tone === "warning" && "border-warning/60",
            contract.tone === "expired" && "border-destructive/60",
            compact && statusClassName,
            className
          )}
        >
          {(compact || responsiveCompact) && <span aria-hidden className={cn(
            "flex max-w-full flex-col items-center justify-center",
            responsiveCompact && !compact && "size-full rounded-lg 2xl:hidden",
            responsiveCompact && !compact && statusClassName
          )}>
            {contract.daysRemaining === null || contract.daysRemaining === 0
              ? <Icon aria-hidden className="size-4" />
              : <span aria-hidden className="max-w-full truncate text-base font-bold leading-tight">{contract.daysRemaining.toLocaleString("en-US")}</span>}
            <span aria-hidden className="max-w-full truncate text-[10px] leading-tight">
              {contract.daysRemaining === null ? t("app.branchContract.noDateShort")
                : contract.daysRemaining === 0 ? t("app.branchContract.todayShort")
                : contract.daysRemaining < 0 ? t("app.branchContract.overdueShort") : t("app.branchContract.daysShort")}
            </span>
          </span>}
          {!compact && <>
            <span aria-hidden className={cn("size-8 shrink-0 place-items-center rounded-lg", responsiveCompact ? "hidden 2xl:grid" : "grid", statusClassName)}>
              <Icon className="size-4" />
            </span>
            <span aria-hidden className={cn("min-w-0 flex-col items-start gap-0.5 text-left leading-tight", responsiveCompact ? "hidden 2xl:flex" : "flex")}>
              <span className="w-full truncate text-[10px] font-medium text-secondary-foreground/75">{t("app.branchContract.subscription")}</span>
              {contract.endOn === null
                ? <span className="max-w-full truncate text-xs font-semibold">{date}</span>
                : <time dateTime={contract.endOn} className="text-xs font-semibold">{date}</time>}
            </span>
            {contract.daysRemaining !== null && <span aria-hidden className={cn(
              "ml-auto rounded-lg px-2 py-1.5 text-xs font-semibold leading-tight", responsiveCompact && "hidden 2xl:inline", statusClassName
            )}>{status}</span>}
          </>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" aria-labelledby={titleId} className="max-w-[calc(100vw-2rem)] gap-3 p-4">
        <PopoverHeader>
          <PopoverTitle id={titleId}>{t("app.branchContract.title")}</PopoverTitle>
          <p className="break-words text-sm font-medium">{branchName}</p>
        </PopoverHeader>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground">{t("app.branchContract.endDate")}</span>
          {contract.endOn === null
            ? <span className="text-sm font-medium">{date}</span>
            : <time dateTime={contract.endOn} className="text-sm font-medium tabular-nums">{date}</time>}
          {contract.daysRemaining !== null && <span className={cn("mt-2 w-fit rounded-lg px-3 py-2 font-semibold tabular-nums", statusClassName)}>{status}</span>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
