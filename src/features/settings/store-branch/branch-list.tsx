"use client";

import Image from "next/image";
import { MapPin, QrCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
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
import type { StoreBranchLabels, StoreBranchSettingsRow } from "./store-branch-types";
import {
  VAT_EXEMPT,
  VAT_INCLUDED,
  branchChargeSummary,
  branchVatSummary,
  storeBranchId,
  storeBranchName,
  storeBranchValue
} from "./store-branch-utils";

type BranchListProps = {
  activeId: string;
  imageUrl: (row: StoreBranchSettingsRow) => string;
  labels: StoreBranchLabels;
  pageStart: number;
  rowActions: (row: StoreBranchSettingsRow) => ReactNode;
  rows: StoreBranchSettingsRow[];
  selectedRows: Set<string>;
  onToggleSelected: (id: string, checked: boolean) => void;
};

// The branch's payment QR: a square thumbnail (a QR in a circle would crop its corners),
// or a muted QR icon when the branch has none yet.
function BranchQr({ name, src }: { name: string; src: string }) {
  return (
    <ItemMedia variant="image" className="size-10 bg-muted text-muted-foreground">
      {src ? <Image src={src} alt={name} width={40} height={40} unoptimized /> : <QrCode aria-hidden />}
    </ItemMedia>
  );
}

// Off states are outline badges and on states filled ones: each setting stays its own chip (two
// runs of grey text side by side on the cards read as one sentence), and the ones that change
// the bill still stand out.
// VAT has three modes, so the badge names the mode rather than just on/off.
function BranchVat({ labels, row }: { labels: StoreBranchLabels; row: StoreBranchSettingsRow }) {
  const vat = branchVatSummary(row);
  if (!vat.active || vat.status === VAT_EXEMPT) return <Badge variant="outline">{labels.vatExempt}</Badge>;
  return (
    <Badge variant="secondary" className="tabular-nums">
      {vat.status === VAT_INCLUDED ? labels.vatIncluded : labels.vatExcluded} · {vat.percentLabel}
    </Badge>
  );
}

function BranchCharge({ labels, row }: { labels: StoreBranchLabels; row: StoreBranchSettingsRow }) {
  const charge = branchChargeSummary(row);
  // Named even when off: on the cards there is no column header to say what "inactive" refers to.
  if (!charge.active) {
    return (
      <Badge variant="outline">
        {labels.charge} · {labels.inactive}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="tabular-nums">
      {labels.charge} · {charge.percentLabel}
    </Badge>
  );
}

function BranchAddress({ row }: { row: StoreBranchSettingsRow }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
      <MapPin aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{storeBranchValue(row, "branch_address", "-")}</span>
    </span>
  );
}

export function BranchTable({
  allSelected,
  onToggleAllSelected,
  ...props
}: BranchListProps & { allSelected: boolean; onToggleAllSelected: (checked: boolean) => void }) {
  const { activeId, imageUrl, labels, pageStart, rowActions, rows, selectedRows, onToggleSelected } = props;
  const { t } = useTranslation();

  return (
    <Table containerClassName="min-h-0 flex-1 overflow-auto">
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow>
          <TableHead className="w-px">
            <Checkbox aria-label={labels.selectAll} checked={allSelected} onCheckedChange={(checked) => onToggleAllSelected(checked === true)} />
          </TableHead>
          {/* w-px: checkbox, number and actions shrink to their content; the name columns take the spare width. */}
          <TableHead className="w-px text-center">{t("fields.no")}</TableHead>
          <TableHead className="min-w-56">{labels.branch}</TableHead>
          <TableHead>{labels.email}</TableHead>
          <TableHead>{labels.address}</TableHead>
          <TableHead>{labels.vat}</TableHead>
          <TableHead>{labels.charge}</TableHead>
          <TableHead className="w-px">
            <span className="sr-only">{labels.actions}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIndex) => {
          const id = storeBranchId(row, "branch");
          const name = storeBranchName(row, "branch");
          const selected = selectedRows.has(id);

          return (
            <TableRow key={id || rowIndex} data-state={selected ? "selected" : undefined}>
              <TableCell>
                <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onCheckedChange={(checked) => onToggleSelected(id, checked === true)} />
              </TableCell>
              <TableCell className="text-center text-muted-foreground tabular-nums">{pageStart + rowIndex}</TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <BranchQr name={name} src={imageUrl(row)} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{name}</span>
                      {id === activeId ? <Badge variant="secondary">{labels.current}</Badge> : null}
                    </span>
                    <span className="truncate text-muted-foreground tabular-nums" translate="no">
                      {storeBranchValue(row, "branch_tel", "-")}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="max-w-56 truncate text-muted-foreground" translate="no">
                {storeBranchValue(row, "branch_email", "-")}
              </TableCell>
              <TableCell className="max-w-64">
                <BranchAddress row={row} />
              </TableCell>
              <TableCell>
                <BranchVat labels={labels} row={row} />
              </TableCell>
              <TableCell>
                <BranchCharge labels={labels} row={row} />
              </TableCell>
              <TableCell className="text-right">{rowActions(row)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// Narrow pages: one Item per branch — QR, name and phone, the address, then VAT/charge badges.
// Two columns once there is room for them.
export function BranchMobileList({ activeId, imageUrl, labels, rowActions, rows, selectedRows, onToggleSelected }: BranchListProps) {
  const { t } = useTranslation();

  return (
    <ItemGroup className="@xl:grid @xl:grid-cols-2">
      {rows.map((row, rowIndex) => {
        const id = storeBranchId(row, "branch");
        const name = storeBranchName(row, "branch");

        return (
          <Item key={id || rowIndex} variant="outline">
            <Checkbox
              aria-label={t("common.selectRow", { name })}
              checked={selectedRows.has(id)}
              onCheckedChange={(checked) => onToggleSelected(id, checked === true)}
            />
            <BranchQr name={name} src={imageUrl(row)} />
            <ItemContent>
              <ItemTitle>
                {name}
                {id === activeId ? <Badge variant="secondary">{labels.current}</Badge> : null}
              </ItemTitle>
              <ItemDescription className="tabular-nums" translate="no">
                {storeBranchValue(row, "branch_tel", "-")}
              </ItemDescription>
            </ItemContent>
            <ItemActions>{rowActions(row)}</ItemActions>
            <ItemFooter className="flex-col items-start gap-2">
              <BranchAddress row={row} />
              <span className="flex flex-wrap items-center gap-1.5">
                <BranchVat labels={labels} row={row} />
                <BranchCharge labels={labels} row={row} />
              </span>
            </ItemFooter>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
