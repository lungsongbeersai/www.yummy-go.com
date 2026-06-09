"use client";

import Image from "next/image";
import { Building2, MapPin, QrCode, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsTableScroll
} from "@/features/settings/shared/settings-shell";
import { cn } from "@/lib/utils";
import {
  branchChargeSummary,
  branchVatSummary,
  isStoreActive,
  isStorePlc,
  storeBranchId,
  storeBranchName,
  storeBranchValue,
  type StoreBranchKind
} from "./store-branch-utils";
import type { StoreBranchLabels, StoreBranchSettingsRow } from "./store-branch-types";

export function StoreBranchListSurface({
  activeId,
  allSelected,
  backgroundLoading,
  imageUrl,
  kind,
  labels,
  listTitle,
  page,
  pageEnd,
  pageStart,
  rowActions,
  rows,
  selectedRows,
  toolbar,
  total,
  totalPages,
  onToggleAllSelected,
  onToggleSelected
}: {
  activeId?: string;
  allSelected: boolean;
  backgroundLoading: boolean;
  imageUrl: (row: StoreBranchSettingsRow, rowKind: StoreBranchKind) => string;
  kind: StoreBranchKind;
  labels: StoreBranchLabels;
  listTitle: string;
  page: number;
  pageEnd: number;
  pageStart: number;
  rowActions: (row: StoreBranchSettingsRow) => ReactNode;
  rows: StoreBranchSettingsRow[];
  selectedRows: Set<string>;
  toolbar: ReactNode;
  total: number;
  totalPages: number;
  onToggleAllSelected: (checked: boolean) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur sm:px-4 lg:px-5">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black">{listTitle}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("common.showingRange", { start: pageStart, end: pageEnd, total })} - {t("common.page", { current: page, total: totalPages })}
            </p>
          </div>
          <div className="min-w-0 xl:max-w-[48rem]">{toolbar}</div>
        </div>
        {backgroundLoading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner aria-hidden />
            {kind === "store" ? labels.refreshStore : labels.refreshBranch}
          </div>
        ) : null}
      </div>
      {rows.length ? (
        <>
          <div className="hidden min-h-0 flex-1 md:flex">
            <StoreBranchTable
              activeId={activeId}
              allSelected={allSelected}
              imageUrl={imageUrl}
              kind={kind}
              labels={labels}
              pageStart={pageStart}
              rowActions={rowActions}
              rows={rows}
              selectedRows={selectedRows}
              onToggleAllSelected={onToggleAllSelected}
              onToggleSelected={onToggleSelected}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto md:hidden">
            <StoreBranchMobileList
              activeId={activeId}
              imageUrl={imageUrl}
              kind={kind}
              labels={labels}
              pageStart={pageStart}
              rowActions={rowActions}
              rows={rows}
              selectedRows={selectedRows}
              onToggleSelected={onToggleSelected}
            />
          </div>
        </>
      ) : (
        <div className="flex min-h-72 flex-1 items-center justify-center p-4">
          <Empty className="max-w-md border border-dashed bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {kind === "store" ? <Store aria-hidden /> : <Building2 aria-hidden />}
              </EmptyMedia>
              <EmptyTitle>{kind === "store" ? labels.noStore : labels.noBranch}</EmptyTitle>
              <EmptyDescription>{labels.selectRecord}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </div>
  );
}

function StoreBranchTable({
  activeId,
  allSelected,
  imageUrl,
  kind,
  labels,
  pageStart,
  rowActions,
  rows,
  selectedRows,
  onToggleAllSelected,
  onToggleSelected
}: {
  activeId?: string;
  allSelected: boolean;
  imageUrl: (row: StoreBranchSettingsRow, rowKind: StoreBranchKind) => string;
  kind: StoreBranchKind;
  labels: StoreBranchLabels;
  pageStart: number;
  rowActions: (row: StoreBranchSettingsRow) => ReactNode;
  rows: StoreBranchSettingsRow[];
  selectedRows: Set<string>;
  onToggleAllSelected: (checked: boolean) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <SettingsTableScroll>
      <Table className={kind === "store" ? "min-w-[940px]" : "min-w-[1080px]"}>
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={labels.selectAll} checked={allSelected} onChange={(event) => onToggleAllSelected(event.target.checked)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("fields.no")}</TableHead>
            <TableHead>{kind === "store" ? labels.store : labels.branch}</TableHead>
            {kind === "store" ? (
              <>
                <TableHead>{labels.email}</TableHead>
                <TableHead>{labels.type}</TableHead>
                <TableHead>{labels.active}</TableHead>
              </>
            ) : (
              <>
                <TableHead>{labels.phone}</TableHead>
                <TableHead>{labels.email}</TableHead>
                <TableHead>{labels.address}</TableHead>
                <TableHead>{labels.taxBilling}</TableHead>
              </>
            )}
            <TableHead className="w-16 text-right">{labels.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIndex) => {
            const id = storeBranchId(row, kind);
            const name = storeBranchName(row, kind);
            const selected = selectedRows.has(id);
            const rowNumber = pageStart + rowIndex;

            return (
              <TableRow key={id || rowIndex} className="h-14" data-state={selected ? "selected" : undefined}>
                <TableCell className="w-10 px-2">
                  <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onChange={(event) => onToggleSelected(id, event.target.checked)} />
                </TableCell>
                <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black tabular-nums text-muted-foreground">
                  {rowNumber}
                </TableCell>
                <TableCell className="max-w-[28rem]">
                  <EntityIdentity activeId={activeId} imageUrl={imageUrl} kind={kind} labels={labels} row={row} />
                </TableCell>
                {kind === "store" ? (
                  <>
                    <TableCell className="max-w-[18rem] text-muted-foreground">
                      <span className="block truncate" translate="no">
                        {storeBranchValue(row, "store_email", "-")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StoreTypeBadge labels={labels} row={row} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge active={isStoreActive(row)} labels={labels} />
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="max-w-[10rem] text-muted-foreground">
                      <span className="block truncate" translate="no">
                        {storeBranchValue(row, "branch_tel", "-")}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[16rem] text-muted-foreground">
                      <span className="block truncate" translate="no">
                        {storeBranchValue(row, "branch_email", "-")}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[22rem] text-muted-foreground">
                      <span className="flex min-w-0 items-center gap-1">
                        <MapPin aria-hidden className="size-3.5 shrink-0" />
                        <span className="truncate">{storeBranchValue(row, "branch_address", "-")}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <BranchTaxBadges labels={labels} row={row} />
                    </TableCell>
                  </>
                )}
                <TableCell className="text-right">{rowActions(row)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </SettingsTableScroll>
  );
}

function StoreBranchMobileList({
  activeId,
  imageUrl,
  kind,
  labels,
  pageStart,
  rowActions,
  rows,
  selectedRows,
  onToggleSelected
}: {
  activeId?: string;
  imageUrl: (row: StoreBranchSettingsRow, rowKind: StoreBranchKind) => string;
  kind: StoreBranchKind;
  labels: StoreBranchLabels;
  pageStart: number;
  rowActions: (row: StoreBranchSettingsRow) => ReactNode;
  rows: StoreBranchSettingsRow[];
  selectedRows: Set<string>;
  onToggleSelected: (id: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <SettingsMobileList>
      {rows.map((row, rowIndex) => {
        const id = storeBranchId(row, kind);
        const selected = selectedRows.has(id);
        const rowNumber = pageStart + rowIndex;
        const name = storeBranchName(row, kind);
        const current = id === activeId;

        return (
          <SettingsMobileCard
            key={id || rowIndex}
            actions={rowActions(row)}
            badges={
              <>
                <Badge className="shrink-0 tabular-nums">{rowNumber}</Badge>
                {current ? <Badge className="border-primary/25 bg-primary/10 text-primary">{labels.current}</Badge> : null}
                {kind === "store" ? <StatusBadge active={isStoreActive(row)} labels={labels} /> : null}
              </>
            }
            checked={selected}
            leading={<MediaPreview alt={name} kind={kind} src={imageUrl(row, kind)} />}
            selectLabel={t("common.selectRow", { name })}
            selected={selected}
            subtitle={
              <span className="block truncate" translate="no">
                {kind === "store" ? storeBranchValue(row, "store_email", "-") : storeBranchValue(row, "branch_tel", "-")}
              </span>
            }
            title={name}
            onCheckedChange={(checked) => onToggleSelected(id, checked)}
          >
            <SettingsMobileMetaGrid>
              {kind === "store" ? (
                <>
                  <SettingsMobileMeta label={labels.email} value={<span translate="no">{storeBranchValue(row, "store_email", "-")}</span>} />
                  <SettingsMobileMeta label={labels.type} value={isStorePlc(row) ? labels.plc : labels.general} />
                  <SettingsMobileMeta label={labels.active} value={isStoreActive(row) ? labels.open : labels.closed} />
                </>
              ) : (
                <>
                  <SettingsMobileMeta label={labels.phone} value={<span translate="no">{storeBranchValue(row, "branch_tel", "-")}</span>} />
                  <SettingsMobileMeta label={labels.email} value={<span translate="no">{storeBranchValue(row, "branch_email", "-")}</span>} />
                  <SettingsMobileMeta label={labels.address} value={storeBranchValue(row, "branch_address", "-")} />
                  <SettingsMobileMeta
                    label={labels.vat}
                    value={`${branchVatSummary(row).active ? labels.active : labels.inactive} / ${branchVatSummary(row).percentLabel}`}
                  />
                  <SettingsMobileMeta
                    label={labels.charge}
                    value={`${branchChargeSummary(row).active ? labels.active : labels.inactive} / ${branchChargeSummary(row).percentLabel}`}
                  />
                </>
              )}
            </SettingsMobileMetaGrid>
          </SettingsMobileCard>
        );
      })}
    </SettingsMobileList>
  );
}

function StatusBadge({ active, labels }: { active: boolean; labels: StoreBranchLabels }) {
  return (
    <Badge className={cn(active ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground")}>
      {active ? labels.open : labels.closed}
    </Badge>
  );
}

function StoreTypeBadge({ labels, row }: { labels: StoreBranchLabels; row: StoreBranchSettingsRow }) {
  return <Badge>{isStorePlc(row) ? labels.plc : labels.general}</Badge>;
}

function SummaryBadge({
  active,
  activeLabel,
  inactiveLabel,
  label,
  percentLabel
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  label: string;
  percentLabel: string;
}) {
  return (
    <Badge className={cn("max-w-full justify-start gap-1", active ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground")}>
      <span className="truncate">{label}</span>
      <span className="tabular-nums" translate="no">
        {active ? activeLabel : inactiveLabel} / {percentLabel}
      </span>
    </Badge>
  );
}

function BranchTaxBadges({ labels, row }: { labels: StoreBranchLabels; row: StoreBranchSettingsRow }) {
  const vat = branchVatSummary(row);
  const charge = branchChargeSummary(row);

  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <SummaryBadge active={vat.active} activeLabel={labels.active} inactiveLabel={labels.inactive} label={labels.vat} percentLabel={vat.percentLabel} />
      <SummaryBadge
        active={charge.active}
        activeLabel={labels.active}
        inactiveLabel={labels.inactive}
        label={labels.charge}
        percentLabel={charge.percentLabel}
      />
    </div>
  );
}

function MediaPreview({ alt, src, kind }: { alt: string; src: string; kind: StoreBranchKind }) {
  return (
    <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted">
      {src ? (
        <Image src={src} alt={alt} width={44} height={44} unoptimized className="size-full object-cover" />
      ) : kind === "store" ? (
        <Store aria-hidden className="size-4 text-muted-foreground" />
      ) : (
        <QrCode aria-hidden className="size-4 text-muted-foreground" />
      )}
    </div>
  );
}

function EntityIdentity({
  activeId,
  imageUrl,
  kind,
  labels,
  row
}: {
  activeId?: string;
  imageUrl: (row: StoreBranchSettingsRow, kind: StoreBranchKind) => string;
  kind: StoreBranchKind;
  labels: StoreBranchLabels;
  row: StoreBranchSettingsRow;
}) {
  const id = storeBranchId(row, kind);
  const name = storeBranchName(row, kind);
  const subtitle = kind === "store" ? storeBranchValue(row, "store_email", "-") : storeBranchValue(row, "branch_tel", "-");

  return (
    <div className="flex min-w-0 items-center gap-3">
      <MediaPreview alt={name} kind={kind} src={imageUrl(row, kind)} />
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="min-w-0 truncate font-black">{name}</p>
          {id && id === activeId ? <Badge className="border-primary/25 bg-primary/10 text-primary">{labels.current}</Badge> : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground" translate="no">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
