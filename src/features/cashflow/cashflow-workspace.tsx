"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  ReceiptText,
  Shapes,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { internalRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";

interface CashflowWorkspaceProps {
  active: "entries" | "categories" | "report";
  title: string;
  description: string;
  branchLabel?: string;
  branchUuid?: string;
  actions?: ReactNode;
  children: ReactNode;
  compact?: boolean;
}

export function CashflowWorkspace({
  active,
  title,
  description,
  branchLabel,
  branchUuid,
  actions,
  children,
  compact = true,
}: CashflowWorkspaceProps) {
  const { t } = useTranslation();
  const branchName = useAuthStore((state) => state.user?.branch_name);
  const setSelectedBranch = useBranchStore((state) => state.setSelectedBranch);
  const navigation = [
    {
      key: "entries",
      path: "/finance/entries",
      label: t("cashflow.entriesTitle", {
        defaultValue: "Income and expenses",
      }),
      shortLabel: t("cashflow.nav.entries", { defaultValue: "Entries" }),
      icon: ReceiptText,
    },
    {
      key: "categories",
      path: "/finance/categories",
      label: t("cashflow.categoriesTitle", { defaultValue: "Categories" }),
      shortLabel: t("cashflow.nav.categories", { defaultValue: "Categories" }),
      icon: Shapes,
    },
    {
      key: "report",
      path: "/report/income-expenses",
      label: t("cashflow.reportTitle", {
        defaultValue: "Income and expense report",
      }),
      shortLabel: t("cashflow.nav.report", { defaultValue: "Report" }),
      icon: BarChart3,
    },
  ] as const;

  return (
    <div data-testid="cashflow-workspace" className="font-lao mx-auto flex h-full min-h-0 w-full min-w-0 max-w-screen-2xl flex-col gap-5 overflow-x-hidden overflow-y-auto p-3 sm:p-5 lg:p-6 [&>*]:shrink-0">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Wallet className="size-6 shrink-0 text-primary" aria-hidden />
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
            </div>
            {!compact ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p> : null}
            {branchLabel || branchName ? (
              <Badge
                variant="secondary"
                className="h-auto max-w-full gap-1.5 whitespace-normal px-2.5 py-1 text-sm font-normal"
              >
                <Building2 className="size-3.5 shrink-0" aria-hidden />
                {branchLabel || branchName}
              </Badge>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
          ) : null}
        </div>
        <nav
          aria-label={t("cashflow.navigation", {
            defaultValue: "Finance navigation",
          })}
          className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/40 p-1 sm:flex sm:gap-2"
        >
          {navigation.map(({ key, path, label, shortLabel, icon: Icon }) => (
            <Button
              key={key}
              asChild
              variant="ghost"
              className={cn("min-h-11 min-w-0 shrink gap-1.5 px-2 text-sm sm:px-4", active === key ? "bg-card font-semibold text-primary shadow-sm hover:bg-card hover:text-primary" : "text-muted-foreground")}
            >
              <Link
                href={internalRoute(path)}
                aria-current={active === key ? "page" : undefined}
                aria-label={label}
                onClick={() => { if (branchUuid) setSelectedBranch(branchUuid); }}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{shortLabel}</span>
              </Link>
            </Button>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}

export function CashflowAccessDenied() {
  const { t } = useTranslation();
  return (
    <div className="p-4">
      <Alert variant="destructive">
        <AlertTitle>
          {t("cashflow.accessDenied", {
            defaultValue: "Finance access is restricted",
          })}
        </AlertTitle>
        <AlertDescription>
          {t("cashflow.accessDeniedHint", {
            defaultValue:
              "Ask an administrator or accounting staff member to manage income and expenses.",
          })}
        </AlertDescription>
      </Alert>
    </div>
  );
}

interface CashflowSelectFieldProps {
  id: string;
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  description?: string;
}

export function CashflowSelectField({
  id,
  label,
  value,
  options,
  onValueChange,
  disabled,
  description,
}: CashflowSelectFieldProps) {
  return (
    <Field className="min-w-0 gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id={id} className="min-h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description ? (
        <FieldDescription className="text-sm">{description}</FieldDescription>
      ) : null}
    </Field>
  );
}
