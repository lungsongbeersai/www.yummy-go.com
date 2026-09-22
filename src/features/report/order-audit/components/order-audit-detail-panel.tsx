"use client";

import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { OrderAuditRow } from "@/services/report";
import type { OrderAuditGroup } from "../order-audit-grouping";
import { groupEntityLabel, groupRowsByEntity } from "../order-audit-grouping";
import { auditChanges, auditDateTime } from "../order-audit-utils";
import { OrderAuditActionBadge } from "./order-audit-action-badge";

interface OrderAuditDetailPanelProps {
  branchLabel: string;
  className?: string;
  group: OrderAuditGroup | null;
  language: string;
}

export function OrderAuditDetailPanel({ branchLabel, className, group, language }: OrderAuditDetailPanelProps) {
  const { t } = useTranslation();
  const cardClass = cn(
    "min-h-0 overflow-hidden rounded-none border-x-0 border-b-0 border-border bg-card py-0 shadow-none xl:flex xl:min-h-0 xl:flex-col",
    className,
  );

  if (!group) {
    return (
      <Card className={cardClass}>
        <div className="flex min-h-96 flex-1 items-center justify-center p-4">
          <EmptyState title={t("orderAudit.noSelection")} description={t("orderAudit.selectEventHint")} />
        </div>
      </Card>
    );
  }

  const entityClusters = groupRowsByEntity(group);

  return (
    <Card className={cardClass}>
      <CardHeader className="flex-col items-stretch gap-1.5 border-b border-border px-3 py-2.5 md:px-4">
        <CardTitle className="truncate text-base font-semibold">
          {group.relatedOrderUuid ? (
            <span className="text-muted-foreground">{group.relatedOrderInvoice || group.relatedOrderUuid} → </span>
          ) : null}
          {group.orderInvoice || group.orderUuid}
        </CardTitle>
        <dl className="grid grid-cols-1 gap-1 text-xs text-muted-foreground min-[430px]:grid-cols-2">
          <div>
            <dt className="inline">{branchLabel} · </dt>
            <dd className="inline text-foreground">{group.actorName || t(`orderAudit.actorTypes.${group.actorType}`)}</dd>
          </div>
          <div>
            <dt className="inline">{t("orderAudit.time")}: </dt>
            <dd className="inline text-foreground">{auditDateTime(group.recordedAt, language)}</dd>
          </div>
        </dl>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-3">
          <div className="flex flex-col gap-3">
            {entityClusters.map((rows) => (
              <OrderAuditEntityCluster key={rows[0].entity_uuid} rows={rows} language={language} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderAuditEntityCluster({ rows, language }: { rows: OrderAuditRow[]; language: string }) {
  const { t } = useTranslation();
  const head = rows[0];
  const label = groupEntityLabel(head, language);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">
          {label || t(`orderAudit.entities.${head.entity_type}`)}
        </p>
        <span className="shrink-0 text-xs text-muted-foreground">{t(`orderAudit.entities.${head.entity_type}`)}</span>
      </div>
      <div className="flex flex-col divide-y divide-border">
        {rows.map((row) => (
          <OrderAuditRowChanges key={row.audit_id} row={row} language={language} />
        ))}
      </div>
    </div>
  );
}

function OrderAuditRowChanges({ row, language }: { row: OrderAuditRow; language: string }) {
  const { t } = useTranslation();
  const changes = auditChanges(row, language, t);

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <OrderAuditActionBadge action={row.action} label={t(`orderAudit.actions.${row.action}`)} />
        <time dateTime={row.recorded_at} className="text-xs tabular-nums text-muted-foreground">
          {auditDateTime(row.recorded_at, language)}
        </time>
      </div>
      {row.reason ? (
        <p className="text-xs text-muted-foreground">
          {t("orderAudit.reason")}: {row.reason}
        </p>
      ) : null}
      {changes.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8">{t("orderAudit.field")}</TableHead>
              <TableHead className="h-8">{t("orderAudit.before")}</TableHead>
              <TableHead className="h-8">{t("orderAudit.after")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {changes.map((change) => (
              <TableRow key={change.field}>
                <TableCell className="py-1.5">{change.label}</TableCell>
                <TableCell className="max-w-48 break-words whitespace-pre-wrap py-1.5 text-muted-foreground line-through decoration-muted-foreground/50">
                  {change.before}
                </TableCell>
                <TableCell className="max-w-48 break-words whitespace-pre-wrap py-1.5 font-medium text-foreground">
                  {change.after}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      <p className="break-all text-2xs text-muted-foreground">
        {t("orderAudit.reference")}: {row.audit_id} · {row.entity_uuid}
      </p>
    </div>
  );
}

interface OrderAuditDetailDrawerProps {
  branchLabel: string;
  group: OrderAuditGroup | null;
  language: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function OrderAuditDetailDrawer({ branchLabel, group, language, onOpenChange, open }: OrderAuditDetailDrawerProps) {
  const { t } = useTranslation();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[calc(100dvh-0.75rem)] max-h-[92dvh] gap-0 overflow-hidden rounded-t-xl xl:hidden">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{t("orderAudit.eventDetail")}</DrawerTitle>
          <DrawerDescription>{t("orderAudit.selectEventHint")}</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-hidden">
          <OrderAuditDetailPanel
            branchLabel={branchLabel}
            className="flex h-full flex-col rounded-none border-0 shadow-none"
            group={group}
            language={language}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
