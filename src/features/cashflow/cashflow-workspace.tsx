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

interface CashflowWorkspaceProps {
  active: "entries" | "categories" | "report";
  title: string;
  description: string;
  branchLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
  compact?: boolean;
}

export function CashflowWorkspace({
  active,
  title,
  description,
  branchLabel,
  actions,
  children,
  compact = false,
}: CashflowWorkspaceProps) {
  const { t } = useTranslation();
  const branchName = useAuthStore((state) => state.user?.branch_name);
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
    <div className="font-lao flex min-w-0 flex-col gap-4 p-3 sm:p-5 lg:p-6">
      <header className={cn("flex flex-col rounded-xl border border-border bg-card", compact ? "gap-3 p-3 sm:p-4" : "gap-4 p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className={cn("flex min-w-0 gap-2", compact ? "flex-row flex-wrap items-center" : "flex-col")}>
            <div className="flex flex-wrap items-center gap-2">
              <Wallet className="size-5 shrink-0 text-primary" aria-hidden />
              <h1 className={compact ? "text-lg font-bold" : "text-xl font-black sm:text-2xl"}>{title}</h1>
            </div>
            {!compact ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p> : null}
            {branchLabel || branchName ? (
              <Badge
                variant="secondary"
                className="max-w-full gap-1.5 whitespace-normal text-sm"
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
          className="flex gap-2 border-t border-border pt-4 sm:flex-wrap"
        >
          {navigation.map(({ key, path, label, shortLabel, icon: Icon }) => (
            <Button
              key={key}
              asChild
              variant={active === key ? "default" : "outline"}
              className="min-h-11 min-w-0 flex-1 basis-0 gap-1 px-2 text-sm sm:basis-auto sm:flex-none sm:gap-2 sm:px-3"
            >
              <Link
                href={internalRoute(path)}
                aria-current={active === key ? "page" : undefined}
                aria-label={label}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {compact ? <span className="truncate">{shortLabel}</span> : <><span className="truncate sm:hidden">{shortLabel}</span><span className="hidden sm:inline">{label}</span></>}
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
