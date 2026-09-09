"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OrderAuditRow } from "@/services/report";
import { OrderAuditActionBadge } from "./order-audit-action-badge";
import { auditDateTime } from "./order-audit-utils";

const COLUMNS = ["time", "invoice", "actor", "action", "entity", "details"] as const;

export function OrderAuditTable({
  rows,
  language,
  onSelect,
}: {
  rows: OrderAuditRow[];
  language: string;
  onSelect: (auditId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="hidden shrink-0 overflow-hidden rounded-lg border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map(key => <TableHead key={key}>{t(`orderAudit.${key}`)}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.audit_id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(row.audit_id)}>
              <TableCell className="tabular-nums">{auditDateTime(row.recorded_at, language)}</TableCell>
              <TableCell className="font-medium">
                {row.related_order_uuid_fk && (
                  <span className="text-muted-foreground">{row.related_order_invoice || row.related_order_uuid_fk} → </span>
                )}
                {row.order_invoice || row.order_uuid_fk}
              </TableCell>
              <TableCell>{row.actor_name || t(`orderAudit.actorTypes.${row.actor_type}`)}</TableCell>
              <TableCell><OrderAuditActionBadge action={row.action} label={t(`orderAudit.actions.${row.action}`)} /></TableCell>
              <TableCell>
                {t(`orderAudit.entities.${row.entity_type}`)}
                <p className="text-muted-foreground">
                  {language === "en" ? row.entity_label_eng || row.entity_label_la : row.entity_label_la || row.entity_label_eng}
                </p>
              </TableCell>
              <TableCell>
                <Button variant="outline" className="min-h-10" onClick={event => { event.stopPropagation(); onSelect(row.audit_id); }}>
                  {t("orderAudit.compare")}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
