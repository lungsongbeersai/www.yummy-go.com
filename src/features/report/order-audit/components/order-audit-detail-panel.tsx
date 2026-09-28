"use client";

import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
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

// แผงรายละเอียดเหตุการณ์ (ขวา / drawer บนจอเล็ก): หัวบิล + ผู้แก้ + เวลา แล้วตามด้วยการ์ดต่อรายการที่ถูกแก้
export function OrderAuditDetailPanel({ branchLabel, className, group, language }: OrderAuditDetailPanelProps) {
  const { t } = useTranslation();

  if (!group) {
    return (
      <section className={cn("min-h-0 flex-col p-3", className)}>
        <EmptyState title={t("orderAudit.noSelection")} description={t("orderAudit.selectEventHint")} />
      </section>
    );
  }

  const entityClusters = groupRowsByEntity(group);

  return (
    <section className={cn("min-h-0 flex-col", className)}>
      <div className="flex shrink-0 flex-col gap-1 border-b p-3">
        {/* Sized like a CardTitle / description: unset, the meta line inherits the 16px document
            size and dwarfs the 12px tables below it. */}
        <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {group.relatedOrderUuid ? (
            <>
              <span className="text-muted-foreground">{group.relatedOrderInvoice || group.relatedOrderUuid}</span>
              <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
            </>
          ) : null}
          {group.orderInvoice || group.orderUuid}
        </h3>
        <p className="text-xs text-muted-foreground">
          {branchLabel} · <span className="text-foreground">{group.actorName || t(`orderAudit.actorTypes.${group.actorType}`)}</span>
          {" · "}
          {t("orderAudit.time")}: <span className="text-foreground">{auditDateTime(group.recordedAt)}</span>
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-3">
        {entityClusters.map((rows) => (
          <OrderAuditEntityCluster key={rows[0].entity_uuid} rows={rows} language={language} />
        ))}
      </div>
    </section>
  );
}

function OrderAuditEntityCluster({ rows, language }: { rows: OrderAuditRow[]; language: string }) {
  const { t } = useTranslation();
  const head = rows[0];
  const entityType = t(`orderAudit.entities.${head.entity_type}`);

  return (
    // shrink-0: Card มี overflow-hidden (min-height ของ flex item = 0) — ไม่งั้นถูกบีบให้พอดีกล่อง
    // แล้วเนื้อหาโดนตัดทิ้งแทนที่กล่องแม่จะสกรอล
    <Card size="sm" className="shrink-0">
      <CardHeader>
        <CardTitle>{groupEntityLabel(head, language) || entityType}</CardTitle>
        <CardAction>
          <Badge variant="outline">{entityType}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <div key={row.audit_id} className="flex flex-col gap-3">
            {index ? <Separator /> : null}
            <OrderAuditRowChanges row={row} language={language} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function OrderAuditRowChanges({ row, language }: { row: OrderAuditRow; language: string }) {
  const { t } = useTranslation();
  const changes = auditChanges(row, language, t);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <OrderAuditActionBadge action={row.action} label={t(`orderAudit.actions.${row.action}`)} />
        <time dateTime={row.recorded_at} className="tabular-nums text-muted-foreground">
          {auditDateTime(row.recorded_at)}
        </time>
      </div>
      {row.reason ? (
        <p className="text-muted-foreground">
          {t("orderAudit.reason")}: <span className="text-foreground">{row.reason}</span>
        </p>
      ) : null}
      {changes.length ? (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>{t("orderAudit.field")}</TableHead>
                <TableHead>{t("orderAudit.before")}</TableHead>
                <TableHead>{t("orderAudit.after")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changes.map((change) => (
                <TableRow key={change.field}>
                  <TableCell className="text-muted-foreground">{change.label}</TableCell>
                  {/* ก่อนแก้ = แดงขีดฆ่า, หลังแก้ = เขียว — อ่านแบบ diff ได้ในแวบเดียว */}
                  <TableCell className="max-w-48 break-words whitespace-pre-wrap text-destructive line-through decoration-destructive/40">
                    {change.before}
                  </TableCell>
                  <TableCell className="max-w-48 break-words whitespace-pre-wrap font-medium text-success">
                    {change.after}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      <p className="break-all text-muted-foreground">
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
      <DrawerContent className="h-[calc(100dvh-0.75rem)] max-h-[92dvh] xl:hidden">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{t("orderAudit.eventDetail")}</DrawerTitle>
          <DrawerDescription>{t("orderAudit.selectEventHint")}</DrawerDescription>
        </DrawerHeader>
        <OrderAuditDetailPanel branchLabel={branchLabel} className="flex flex-1" group={group} language={language} />
      </DrawerContent>
    </Drawer>
  );
}
