"use client";

import type { ReactNode } from "react";
import { Coins } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CurrencyFlag } from "@/features/settings/shared/currency-flag";
import {
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsRowActions,
  SettingsTableScroll
} from "@/features/settings/shared/settings-shell";
import type { Currency } from "@/services/currency";
import { CurrencyCodeBadge, CurrencyIdentity, CurrencyStatusBadge } from "./currency-display";
import {
  currencyIcon,
  currencyId,
  currencyName,
  currencyStatus
} from "./currency-utils";

export function CurrencyListSurface({
  allSelected,
  backgroundLoading,
  page,
  pageEnd,
  pageStart,
  rows,
  selectedRows,
  title,
  toolbar,
  total,
  totalPages,
  onDelete,
  onEdit,
  onToggleAll,
  onToggleSelected
}: {
  allSelected: boolean;
  backgroundLoading: boolean;
  page: number;
  pageEnd: number;
  pageStart: number;
  rows: Currency[];
  selectedRows: Set<string>;
  title: string;
  toolbar: ReactNode;
  total: number;
  totalPages: number;
  onDelete: (row: Currency) => void;
  onEdit: (row: Currency) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur sm:px-4 lg:px-5">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black">{t("settings.currencyList")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("common.showingRange", { start: pageStart, end: pageEnd, total })} - {t("common.page", { current: page, total: totalPages })}
            </p>
          </div>
          <div className="min-w-0 xl:max-w-[48rem]">{toolbar}</div>
        </div>
        {backgroundLoading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner aria-hidden />
            {t("settings.refreshingCurrencyList")}
          </div>
        ) : null}
      </div>
      {rows.length ? (
        <>
          <div className="hidden min-h-0 flex-1 md:flex">
            <CurrencyTable
              allSelected={allSelected}
              pageStart={pageStart}
              rows={rows}
              selectedRows={selectedRows}
              onDelete={onDelete}
              onEdit={onEdit}
              onToggleAll={onToggleAll}
              onToggleSelected={onToggleSelected}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto md:hidden">
            <CurrencyMobileList
              rows={rows}
              selectedRows={selectedRows}
              onDelete={onDelete}
              onEdit={onEdit}
              onToggleSelected={onToggleSelected}
            />
          </div>
        </>
      ) : (
        <div className="flex min-h-72 flex-1 items-center justify-center p-4">
          <Empty className="max-w-md border border-dashed bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Coins aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{t("settings.noRecords", { title: title.toLowerCase() })}</EmptyTitle>
              <EmptyDescription>{t("empty.adjustSearch")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </div>
  );
}

function CurrencyTable({
  allSelected,
  pageStart,
  rows,
  selectedRows,
  onDelete,
  onEdit,
  onToggleAll,
  onToggleSelected
}: {
  allSelected: boolean;
  pageStart: number;
  rows: Currency[];
  selectedRows: Set<string>;
  onDelete: (row: Currency) => void;
  onEdit: (row: Currency) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <SettingsTableScroll>
      <Table className="min-w-[860px]">
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => onToggleAll(event.target.checked)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("fields.no")}</TableHead>
            <TableHead>{t("nav.currency")}</TableHead>
            <TableHead>{t("fields.currency_icon")}</TableHead>
            <TableHead>{t("fields.currency_status")}</TableHead>
            <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const id = currencyId(row);
            const name = currencyName(row);
            const icon = currencyIcon(row);
            const selected = selectedRows.has(id);
            return (
              <TableRow key={id || index} className="h-14" data-state={selected ? "selected" : undefined}>
                <TableCell className="w-10 px-2">
                  <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onChange={(event) => onToggleSelected(id, event.target.checked)} />
                </TableCell>
                <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black text-muted-foreground">{pageStart + index}</TableCell>
                <TableCell className="max-w-[30rem]">
                  <CurrencyIdentity row={row} />
                </TableCell>
                <TableCell>
                  <CurrencyCodeBadge code={icon} />
                </TableCell>
                <TableCell>
                  <CurrencyStatusBadge status={currencyStatus(row)} />
                </TableCell>
                <TableCell className="text-right">
                  <SettingsRowActions row={row} onEdit={onEdit} onDelete={onDelete} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </SettingsTableScroll>
  );
}

function CurrencyMobileList({
  rows,
  selectedRows,
  onDelete,
  onEdit,
  onToggleSelected
}: {
  rows: Currency[];
  selectedRows: Set<string>;
  onDelete: (row: Currency) => void;
  onEdit: (row: Currency) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <SettingsMobileList>
      {rows.map((row, index) => {
        const id = currencyId(row);
        const name = currencyName(row);
        const icon = currencyIcon(row);
        const selected = selectedRows.has(id);
        return (
          <SettingsMobileCard
            key={id || index}
            actions={<SettingsRowActions row={row} onEdit={onEdit} onDelete={onDelete} />}
            badges={<CurrencyCodeBadge code={icon} />}
            checked={selected}
            leading={<CurrencyFlag code={icon} label={name} />}
            selectLabel={t("common.selectRow", { name })}
            selected={selected}
            subtitle={
              <span className="block truncate" translate="no">
                {icon !== "-" ? icon : "-"}
              </span>
            }
            title={name}
            onCheckedChange={(checked) => onToggleSelected(id, checked)}
          >
            <SettingsMobileMetaGrid>
              <SettingsMobileMeta label={t("fields.currency_status")} value={<CurrencyStatusBadge status={currencyStatus(row)} />} />
              <SettingsMobileMeta
                label={t("fields.currency_icon")}
                value={
                  <span translate="no">
                    {icon}
                  </span>
                }
              />
            </SettingsMobileMetaGrid>
          </SettingsMobileCard>
        );
      })}
    </SettingsMobileList>
  );
}
