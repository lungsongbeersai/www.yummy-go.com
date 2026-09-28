"use client";

import { Plus, Search, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { AppPagination } from "@/components/common/app-pagination";
import { LoadingState } from "@/components/common/loading-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import { SettingsPageHeader } from "./settings-page-header";

type SettingsListPageLayoutProps = {
  /** Prefix for element ids, so two settings pages never share one. */
  id: string;
  title: string;
  description: string;
  /** The module's icon, shown on the header card in the theme colour. */
  icon: LucideIcon;
  addLabel: string;
  /** Omitted when the user may not create records: the add button is hidden. */
  onAdd?: () => void;
  /** Extra header buttons, placed before the add button (e.g. import, bulk create). */
  headerActions?: ReactNode;
  loading: boolean;
  loadingLabel: string;
  /** Optional block between the title and the toolbar (e.g. summary cards). */
  summary?: ReactNode;
  search: string;
  searching: boolean;
  searchingLabel: string;
  onSearchChange: (value: string) => void;
  onSearchApply: () => void;
  orderBy: SortOrder;
  onOrderChange: (value: SortOrder) => void;
  /** Sort choices; defaults to oldest/newest first (ASC/DESC). Some APIs use "1"/"-1" instead. */
  orderOptions?: { label: string; value: SortOrder }[];
  /** Extra toolbar controls after the order select (e.g. a filter chip or expand-all). */
  toolbarExtra?: ReactNode;
  allSelected: boolean;
  selectAllLabel: string;
  selectedCount: number;
  onToggleAll: (checked: boolean) => void;
  hasRows: boolean;
  table: ReactNode;
  mobileList: ReactNode;
  empty: ReactNode;
  page: number;
  pageStart: number;
  pageEnd: number;
  total: number;
  totalPages: number;
  limit: PageLimit;
  onLimitChange: (value: PageLimit) => void;
  onPageChange: (page: number) => void;
  /** Dialogs (form, delete confirmation) rendered alongside the page. */
  children?: ReactNode;
};

// Shared frame of the settings list pages (store, branch, province, district and the option
// pages): header card → optional summary → toolbar → table (wide) or cards (narrow) →
// rows-per-page + pagination.
//
// Breakpoints follow the page's own width (container queries), not the viewport: the sidebar eats
// 16rem on tablets, so a 768px screen leaves the page ~480px — too narrow for the table.
// @3xl (48rem of page): the table scrolls inside its own frame and the title, toolbar and
// pagination stay put. Narrower: cards, and the whole page scrolls together.
export function SettingsListPageLayout({
  id,
  title,
  description,
  icon: Icon,
  addLabel,
  onAdd,
  headerActions,
  loading,
  loadingLabel,
  summary,
  search,
  searching,
  searchingLabel,
  onSearchChange,
  onSearchApply,
  orderBy,
  onOrderChange,
  orderOptions,
  toolbarExtra,
  allSelected,
  selectAllLabel,
  selectedCount,
  onToggleAll,
  hasRows,
  table,
  mobileList,
  empty,
  page,
  pageStart,
  pageEnd,
  total,
  totalPages,
  limit,
  onLimitChange,
  onPageChange,
  children
}: SettingsListPageLayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="@container h-full min-h-0">
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 @3xl:overflow-hidden">
        <SettingsPageHeader
          icon={Icon}
          title={title}
          description={description}
          count={loading ? null : total}
          actions={
            headerActions || onAdd ? (
              <>
                {headerActions}
                {onAdd ? (
                  <Button onClick={onAdd}>
                    <Plus data-icon="inline-start" />
                    {addLabel}
                  </Button>
                ) : null}
              </>
            ) : null
          }
        />

        {loading ? (
          <LoadingState label={loadingLabel} variant="settingsTable" />
        ) : (
          <>
            {summary}

            <div className="flex flex-wrap items-center gap-2">
              <InputGroup className="@xl:max-w-xs">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  id={`${id}-search`}
                  aria-label={t("actions.search")}
                  placeholder={t("settings.searchPlaceholder")}
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onSearchApply();
                  }}
                />
                <InputGroupAddon align="inline-end">
                  {searching ? (
                    <Spinner aria-label={searchingLabel} />
                  ) : (
                    <InputGroupButton onClick={onSearchApply}>{t("actions.search")}</InputGroupButton>
                  )}
                </InputGroupAddon>
              </InputGroup>
              <Select value={orderBy} onValueChange={(value) => onOrderChange(value as SortOrder)}>
                <SelectTrigger aria-label={t("common.order")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    {(orderOptions ?? [
                      { label: t("common.oldestFirst"), value: "ASC" as const },
                      { label: t("common.newestFirst"), value: "DESC" as const }
                    ]).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {toolbarExtra}
              {/* Narrow pages have no table header, so select-all lives in this bar instead. */}
              {hasRows ? (
                <Field orientation="horizontal" className="w-auto @3xl:hidden">
                  <Checkbox
                    id={`${id}-select-all-mobile`}
                    checked={allSelected}
                    onCheckedChange={(checked) => onToggleAll(checked === true)}
                  />
                  <FieldLabel htmlFor={`${id}-select-all-mobile`}>{selectAllLabel}</FieldLabel>
                </Field>
              ) : null}
              {selectedCount ? (
                <span className="text-muted-foreground @3xl:ml-auto">{t("common.selectedCount", { count: selectedCount })}</span>
              ) : null}
            </div>

            {hasRows ? (
              <>
                <div className="hidden min-h-0 flex-1 flex-col overflow-hidden rounded-lg border @3xl:flex">{table}</div>
                <div className="@3xl:hidden">{mobileList}</div>
              </>
            ) : (
              empty
            )}

            {/* Narrow page: range + rows-per-page share the first row and the page controls get a
                full row of their own underneath. Wide page: one row, controls pushed right.
                The range is rendered here rather than by AppPagination, which would otherwise be
                squeezed next to the rows-per-page field and break into a ragged two-line block. */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-[max(var(--pos-system-bottom-safe-area,0px),var(--app-shell-bottom-nav-height,0px))]">
              {/* text-xs: same size as the rows-per-page label beside it and AppPagination's own range. */}
              <p className="text-xs text-muted-foreground tabular-nums">{t("common.showingRange", { start: pageStart, end: pageEnd, total })}</p>
              <Field orientation="horizontal" className="w-auto @3xl:order-first">
                <FieldLabel htmlFor={`${id}-limit`}>{t("common.rowsPerPage")}</FieldLabel>
                <Select value={String(limit)} onValueChange={(value) => onLimitChange(value === "All" ? "All" : Number(value))}>
                  <SelectTrigger id={`${id}-limit`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {PAGE_LIMIT_OPTIONS.map((option) => (
                        <SelectItem key={String(option)} value={String(option)}>
                          {option === "All" ? t("common.all") : option}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {/* A single page needs no controls — and an empty full-width item would add a blank row. */}
              {totalPages > 1 ? (
                <AppPagination
                  className="basis-full justify-center @3xl:ml-auto @3xl:basis-auto"
                  page={page}
                  totalPages={totalPages}
                  onPageChange={onPageChange}
                />
              ) : null}
            </div>
          </>
        )}

        {children}
      </div>
    </div>
  );
}
