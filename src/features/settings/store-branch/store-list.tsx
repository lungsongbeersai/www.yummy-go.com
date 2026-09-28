"use client";

import { FlaskConical, ShieldCheck, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle
} from "@/components/ui/item";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StoreBranchLabels, StoreBranchSettingsRow } from "./store-branch-types";
import {
  annualDaysRemaining,
  isStoreActive,
  storeBranchId,
  storeBranchName,
  storeBranchValue,
  storeType
} from "./store-branch-utils";

// The annual renewal is the one date on this page that needs acting on, so it gets a tone:
// overdue = red, due within a month = amber, otherwise quiet.
const RENEWAL_WARNING_DAYS = 30;

type StoreListProps = {
  activeId: string;
  imageUrl: (row: StoreBranchSettingsRow) => string;
  labels: StoreBranchLabels;
  pageStart: number;
  rowActions: (row: StoreBranchSettingsRow) => ReactNode;
  rows: StoreBranchSettingsRow[];
  selectedRows: Set<string>;
  onToggleSelected: (id: string, checked: boolean) => void;
};

function storeDateLabel(row: StoreBranchSettingsRow, key: string, language: string, labels: StoreBranchLabels) {
  const value = storeBranchValue(row, key, "");
  return value ? formatShortDate(value, language) || value : labels.dateUnavailable;
}

function StoreLogo({ name, src }: { name: string; src: string }) {
  return (
    <Avatar size="lg">
      {src ? <AvatarImage alt={name} src={src} /> : null}
      <AvatarFallback>
        <Store aria-hidden className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}

function StoreTypeBadge({ labels, row }: { labels: StoreBranchLabels; row: StoreBranchSettingsRow }) {
  const type = storeType(row);
  if (type === "plc") {
    return (
      <Badge>
        <ShieldCheck data-icon="inline-start" />
        {labels.plc}
      </Badge>
    );
  }
  if (type === "test") {
    return (
      <Badge variant="outline">
        <FlaskConical data-icon="inline-start" />
        {labels.test}
      </Badge>
    );
  }
  return <Badge variant="secondary">{labels.general}</Badge>;
}

function StoreStatus({ labels, row }: { labels: StoreBranchLabels; row: StoreBranchSettingsRow }) {
  const active = isStoreActive(row);
  return (
    <Badge variant="outline">
      <span aria-hidden className={cn("size-1.5 rounded-full", active ? "bg-success" : "bg-muted-foreground")} />
      {active ? labels.open : labels.closed}
    </Badge>
  );
}

function StoreRenewal({ labels, language, row }: { labels: StoreBranchLabels; language: string; row: StoreBranchSettingsRow }) {
  const days = annualDaysRemaining(row);
  if (days === null) return <span className="text-muted-foreground">{labels.dateUnavailable}</span>;

  const status = days === 0
    ? labels.dueToday
    : days > 0
      ? `${days.toLocaleString("en-US")} ${labels.daysRemaining}`
      : `${Math.abs(days).toLocaleString("en-US")} ${labels.daysOverdue}`;

  return (
    <span className="flex flex-col items-start gap-1">
      <span className="tabular-nums">{storeDateLabel(row, "annual_due_on", language, labels)}</span>
      {days < 0 ? (
        <Badge variant="destructive">{status}</Badge>
      ) : days <= RENEWAL_WARNING_DAYS ? (
        <Badge className="bg-warning/15 text-warning-text">{status}</Badge>
      ) : (
        <span className="text-muted-foreground tabular-nums">{status}</span>
      )}
    </span>
  );
}

export function StoreTable({
  allSelected,
  onToggleAllSelected,
  ...props
}: StoreListProps & { allSelected: boolean; onToggleAllSelected: (checked: boolean) => void }) {
  const { activeId, imageUrl, labels, pageStart, rowActions, rows, selectedRows, onToggleSelected } = props;
  const { i18n, t } = useTranslation();

  return (
    <Table containerClassName="min-h-0 flex-1 overflow-auto">
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow>
          <TableHead className="w-px">
            <Checkbox aria-label={labels.selectAll} checked={allSelected} onCheckedChange={(checked) => onToggleAllSelected(checked === true)} />
          </TableHead>
          {/* w-px: checkbox, number and actions shrink to their content; the name columns take the spare width. */}
          <TableHead className="w-px text-center">{t("fields.no")}</TableHead>
          <TableHead className="min-w-72">{labels.store}</TableHead>
          <TableHead>{labels.type}</TableHead>
          <TableHead>{labels.active}</TableHead>
          <TableHead>{labels.openedOn}</TableHead>
          <TableHead>{labels.annualDue}</TableHead>
          <TableHead className="w-px">
            <span className="sr-only">{labels.actions}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIndex) => {
          const id = storeBranchId(row, "store");
          const name = storeBranchName(row, "store");
          const selected = selectedRows.has(id);

          return (
            <TableRow key={id || rowIndex} data-state={selected ? "selected" : undefined}>
              <TableCell>
                <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onCheckedChange={(checked) => onToggleSelected(id, checked === true)} />
              </TableCell>
              <TableCell className="text-center text-muted-foreground tabular-nums">{pageStart + rowIndex}</TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <StoreLogo name={name} src={imageUrl(row)} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{name}</span>
                      {id === activeId ? <Badge variant="secondary">{labels.current}</Badge> : null}
                    </span>
                    <span className="truncate text-muted-foreground" translate="no">
                      {storeBranchValue(row, "store_email", "-")}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <StoreTypeBadge labels={labels} row={row} />
              </TableCell>
              <TableCell>
                <StoreStatus labels={labels} row={row} />
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                {storeDateLabel(row, "store_opened_on", i18n.language, labels)}
              </TableCell>
              <TableCell>
                <StoreRenewal labels={labels} language={i18n.language} row={row} />
              </TableCell>
              <TableCell className="text-right">{rowActions(row)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// Narrow pages: one Item per store — logo, name and email, then the badges underneath.
// Two columns once there is room for them (e.g. a tablet with the sidebar open).
export function StoreMobileList({ activeId, imageUrl, labels, rowActions, rows, selectedRows, onToggleSelected }: StoreListProps) {
  const { i18n, t } = useTranslation();

  return (
    <ItemGroup className="@xl:grid @xl:grid-cols-2">
      {rows.map((row, rowIndex) => {
        const id = storeBranchId(row, "store");
        const name = storeBranchName(row, "store");

        return (
          <Item key={id || rowIndex} variant="outline">
            <Checkbox
              aria-label={t("common.selectRow", { name })}
              checked={selectedRows.has(id)}
              onCheckedChange={(checked) => onToggleSelected(id, checked === true)}
            />
            <ItemMedia>
              <StoreLogo name={name} src={imageUrl(row)} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                {name}
                {id === activeId ? <Badge variant="secondary">{labels.current}</Badge> : null}
              </ItemTitle>
              <ItemDescription translate="no">{storeBranchValue(row, "store_email", "-")}</ItemDescription>
            </ItemContent>
            <ItemActions>{rowActions(row)}</ItemActions>
            <ItemFooter className="flex-wrap items-start">
              <span className="flex flex-wrap gap-1.5">
                <StoreTypeBadge labels={labels} row={row} />
                <StoreStatus labels={labels} row={row} />
              </span>
              <StoreRenewal labels={labels} language={i18n.language} row={row} />
            </ItemFooter>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
