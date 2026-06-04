"use client";

import { ChevronLeft, ChevronRight, Menu, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BackButton } from "@/components/common/back-button";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { PageLimit, SortOrder } from "@/services/shared/types";

export interface SettingsColumn<T> {
  key: string;
  label: string;
  className?: string;
  render?: (row: T) => ReactNode;
}

export interface SettingsToolbarState {
  search: string;
  limit: PageLimit;
  orderBy: SortOrder;
  selectedCount?: number;
  limitOptions?: PageLimit[];
  orderOptions?: Array<{ label: string; value: SortOrder }>;
  onSearch: (search: string) => void;
  onLimit: (limit: PageLimit) => void;
  onOrder: (order: SortOrder) => void;
  onApply: () => void;
}

export interface SettingsModuleShellProps {
  title: string;
  description: string;
  addLabel?: string;
  cardTitle: string;
  headerActions?: ReactNode;
  hideCardHeader?: boolean;
  summary?: string;
  toolbarStart?: ReactNode;
  toolbar?: ReactNode;
  table: ReactNode;
  mobileList?: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  onAdd?: () => void;
}

export interface SettingsRowAction<T> {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: (row: T) => void;
}

export function SettingsDialogContent({ className, ...props }: ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      className={cn(
        "max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)] sm:max-w-xl",
        className
      )}
      {...props}
    />
  );
}

export function SettingsDialogForm({ className, ...props }: ComponentProps<"form">) {
  return <form className={cn("flex max-h-[calc(100dvh-1rem)] min-h-0 flex-col sm:max-h-[calc(100dvh-2rem)]", className)} {...props} />;
}

export function SettingsDialogHeader({ className, ...props }: ComponentProps<typeof DialogHeader>) {
  return <DialogHeader className={cn("shrink-0 border-b border-border px-4 py-4 pr-12 text-left sm:px-6", className)} {...props} />;
}

export function SettingsDialogBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6", className)} {...props} />;
}

export function SettingsDialogFooter({ className, ...props }: ComponentProps<typeof DialogFooter>) {
  return (
    <DialogFooter
      className={cn("shrink-0 border-t border-border px-4 py-3 sm:px-6 [&>button]:w-full sm:[&>button]:w-auto", className)}
      {...props}
    />
  );
}

export function SettingsModuleShell({
  addLabel,
  cardTitle,
  description,
  emptyDescription,
  emptyTitle,
  footer,
  headerActions,
  hideCardHeader,
  loading,
  loadingLabel,
  mobileList,
  onAdd,
  table,
  title,
  toolbarStart,
  toolbar
}: SettingsModuleShellProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <SettingsModuleHeader
        addLabel={addLabel}
        description={description}
        headerActions={headerActions}
        title={title}
        onAdd={onAdd}
      />
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-b-0">
        {hideCardHeader ? null : (
          <CardHeader className="flex shrink-0 flex-col items-stretch justify-start gap-3 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-5">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="min-w-0">
                <CardTitle>{cardTitle}</CardTitle>
              </div>
              {toolbarStart}
            </div>
            {toolbar ? <div className="min-w-0">{toolbar}</div> : null}
          </CardHeader>
        )}
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {loading ? (
            <div className="min-h-0 flex-1 p-4">
              <LoadingState label={loadingLabel ?? t("common.loading")} variant="table" />
            </div>
          ) : table || mobileList ? (
            <>
              {mobileList ? (
                <>
                  <div className="hidden min-h-0 flex-1 md:flex">{table}</div>
                  <div className="min-h-0 flex-1 overflow-y-auto md:hidden">{mobileList}</div>
                </>
              ) : (
                table
              )}
              {footer}
            </>
          ) : (
            <div className="flex min-h-72 flex-1 items-center justify-center p-4">
              <EmptyState title={emptyTitle} description={emptyDescription ?? t("empty.adjustSearch")} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function SettingsModuleHeader({
  addLabel,
  description,
  headerActions,
  onAdd,
  title
}: {
  addLabel?: string;
  description: string;
  headerActions?: ReactNode;
  onAdd?: () => void;
  title: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex shrink-0 items-start justify-between gap-3 px-4 py-3 lg:px-5">
      <div className="min-w-0 flex-1">
        <BackButton fallbackHref="/setting" label={t("settings.title")} />
        <h1 className="mt-1 text-xl font-black">{title}</h1>
        <p className="mt-0.5 hidden max-w-2xl truncate text-xs text-muted-foreground sm:block">{description}</p>
      </div>
      {(onAdd && addLabel) || headerActions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {headerActions}
          {onAdd && addLabel ? (
            <Button className="max-w-[52vw] shrink-0" size="sm" onClick={onAdd}>
              <Plus data-icon="inline-start" />
              <span className="min-w-0 truncate">{addLabel}</span>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SettingsToolbar({ state }: { state: SettingsToolbarState }) {
  const { t } = useTranslation();
  const searchLabel = t("actions.search");
  const filterLabel = t("settings.filterTitle");
  const limitOptions = state.limitOptions ?? PAGE_LIMIT_OPTIONS;
  const orderOptions = state.orderOptions ?? [
    { label: t("common.asc"), value: "ASC" as SortOrder },
    { label: t("common.desc"), value: "DESC" as SortOrder }
  ];

  function updateLimit(value: string) {
    state.onLimit(value === "All" ? "All" : Number(value));
  }

  function renderSearchControl(size: "mobile" | "desktop") {
    const inputId = `settings-${size}-search`;
    const isMobile = size === "mobile";

    return (
      <div className="flex min-w-0 overflow-hidden rounded-md border border-input bg-background shadow-sm transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={inputId}
            className={cn(
              "border-0 pl-9 shadow-none focus-visible:ring-0",
              isMobile ? "h-10 text-sm" : "h-8 text-sm"
            )}
            value={state.search}
            placeholder={t("settings.searchPlaceholder")}
            onChange={(event) => state.onSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") state.onApply();
            }}
          />
        </div>
        <Button
          aria-label={searchLabel}
          className={cn("shrink-0 rounded-none border-y-0 border-r-0", isMobile ? "h-10 px-3" : "h-8 px-3")}
          size={isMobile ? "md" : "sm"}
          type="button"
          variant="outline"
          onClick={state.onApply}
        >
          <Search data-icon="inline-start" />
          <span className="truncate">{searchLabel}</span>
        </Button>
      </div>
    );
  }

  function renderLimitSelect(id: string, triggerClassName: string) {
    return (
      <Select value={String(state.limit)} onValueChange={updateLimit}>
        <SelectTrigger id={id} className={cn("w-full font-semibold", triggerClassName)} aria-label={t("common.rowsPerPage")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {limitOptions.map((option) => (
              <SelectItem key={String(option)} value={String(option)}>
                {option === "All" ? t("common.all") : option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  function renderOrderSelect(id: string, triggerClassName: string) {
    return (
      <Select value={String(state.orderBy)} onValueChange={(value) => state.onOrder(value as SortOrder)}>
        <SelectTrigger id={id} className={cn("w-full font-semibold", triggerClassName)} aria-label={t("common.order")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {orderOptions.map((option) => (
              <SelectItem key={String(option.value)} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  return (
    <>
      <div className="grid w-full grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-2 lg:hidden">
        {renderSearchControl("mobile")}
        <Sheet>
          <SheetTrigger asChild>
            <Button aria-label={filterLabel} className="size-10 px-0" type="button" variant="outline">
              <SlidersHorizontal />
            </Button>
          </SheetTrigger>
          <SheetContent className="max-h-[85dvh] gap-0 overflow-hidden rounded-t-lg p-0" side="bottom">
            <SheetHeader className="border-b border-border px-4 py-3 pr-12 text-left">
              <SheetTitle>{filterLabel}</SheetTitle>
              <SheetDescription>{t("settings.filterDescription")}</SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 overflow-y-auto px-4 py-4">
              {state.selectedCount ? (
                <Badge className="h-9 justify-center border-primary/20 bg-primary/10 px-2.5 text-primary">
                  {t("common.selectedCount", { count: state.selectedCount })}
                </Badge>
              ) : null}
              <Field className="gap-2">
                <FieldLabel htmlFor="settings-mobile-limit">{t("common.rowsPerPage")}</FieldLabel>
                {renderLimitSelect("settings-mobile-limit", "h-11")}
              </Field>
              <Field className="gap-2">
                <FieldLabel htmlFor="settings-mobile-order">{t("common.order")}</FieldLabel>
                {renderOrderSelect("settings-mobile-order", "h-11")}
              </Field>
            </div>
            <SheetFooter className="border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row">
              <SheetClose asChild>
                <Button type="button" variant="outline">
                  {t("actions.cancel")}
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button type="button" onClick={state.onApply}>
                  <Search data-icon="inline-start" />
                  {t("actions.apply")}
                </Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden w-full min-w-0 flex-wrap items-center gap-2 lg:flex">
        <div className="w-[28rem] max-w-full flex-none xl:w-[30rem]">{renderSearchControl("desktop")}</div>
        <div className="w-28 flex-none">{renderLimitSelect("settings-desktop-limit", "h-8")}</div>
        <div className="w-28 flex-none">{renderOrderSelect("settings-desktop-order", "h-8")}</div>
        {state.selectedCount ? (
          <Badge className="h-8 justify-center border-primary/20 bg-primary/10 px-2.5 text-primary">
            {t("common.selectedCount", { count: state.selectedCount })}
          </Badge>
        ) : null}
      </div>
    </>
  );
}

export function SettingsTableScroll({ children }: { children: ReactNode }) {
  return <div className="settings-table-scroll min-h-0 flex-1 overflow-auto">{children}</div>;
}

export function SettingsMobileList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-h-full flex-col gap-2 p-3", className)}>{children}</div>;
}

export function SettingsMobileCard({
  actions,
  badges,
  checked,
  children,
  className,
  leading,
  onCheckedChange,
  selectLabel,
  selected,
  subtitle,
  title
}: {
  actions?: ReactNode;
  badges?: ReactNode;
  checked?: boolean;
  children?: ReactNode;
  className?: string;
  leading?: ReactNode;
  onCheckedChange?: (checked: boolean) => void;
  selectLabel?: string;
  selected?: boolean;
  subtitle?: ReactNode;
  title: ReactNode;
}) {
  const content = (
    <>
      {typeof checked === "boolean" ? (
        <Checkbox
          aria-label={selectLabel}
          checked={checked}
          className="mt-1"
          onChange={(event) => onCheckedChange?.(event.target.checked)}
        />
      ) : null}
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="min-w-0 truncate font-black">{title}</p>
          {badges}
        </div>
        {subtitle ? <div className="mt-1 min-w-0 text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
    </>
  );

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3 shadow-sm transition-colors",
        selected && "border-primary/30 bg-primary/5",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {typeof checked === "boolean" ? (
          <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-start gap-3">
            {content}
          </label>
        ) : (
          <div className="flex min-h-11 min-w-0 flex-1 items-start gap-3">{content}</div>
        )}
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export function SettingsMobileMetaGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-2 border-t border-border pt-3 text-xs sm:grid-cols-2", className)}>{children}</div>;
}

export function SettingsMobileMeta({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground">{label}</p>
      <div className="mt-0.5 min-w-0 break-words font-semibold">{value}</div>
    </div>
  );
}

export function SettingsPaginationFooter({
  canGoBack,
  canGoNext,
  onBack,
  onNext,
  page,
  pageEnd,
  pageStart,
  total,
  totalPages
}: {
  canGoBack: boolean;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
  page: number;
  pageEnd: number;
  pageStart: number;
  total: number;
  totalPages: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        {t("common.showingRange", { start: pageStart, end: pageEnd, total })}
      </span>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex">
        <Button className="min-w-0" disabled={!canGoBack} size="xs" type="button" variant="outline" onClick={onBack}>
          <ChevronLeft data-icon="inline-start" />
          {t("actions.back")}
        </Button>
        <Badge className="h-7 px-2 text-xs">
          {t("common.page", { current: page, total: totalPages })}
        </Badge>
        <Button className="min-w-0" disabled={!canGoNext} size="xs" type="button" variant="outline" onClick={onNext}>
          {t("common.nextPage")}
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}

export function SettingsRowActions<T>({
  actions,
  deleteDisabled,
  editDisabled,
  onDelete,
  onEdit,
  row
}: {
  actions?: SettingsRowAction<T>[];
  deleteDisabled?: boolean;
  editDisabled?: boolean;
  onDelete?: (row: T) => void;
  onEdit?: (row: T) => void;
  row: T;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={t("common.actions")} size="iconSm" type="button" variant="ghost">
          <Menu />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          {onEdit ? (
            <DropdownMenuItem disabled={editDisabled} onSelect={() => onEdit(row)}>
              <Pencil />
              {t("actions.edit")}
            </DropdownMenuItem>
          ) : null}
          {actions?.map((action) => (
            <DropdownMenuItem
              key={action.label}
              disabled={action.disabled}
              variant={action.destructive ? "destructive" : "default"}
              onSelect={() => action.onSelect(row)}
            >
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          ))}
          {onDelete ? (
            <DropdownMenuItem disabled={deleteDisabled} variant="destructive" onSelect={() => onDelete(row)}>
              <Trash2 />
              {t("actions.delete")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
