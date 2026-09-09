"use client";

import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import type { OrderAuditRow } from "@/services/report";
import { OrderAuditActionBadge } from "./order-audit-action-badge";
import { auditDateTime } from "./order-audit-utils";

export function OrderAuditRowCard({
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
    <div className="flex flex-col gap-2 md:hidden">
      {rows.map(row => (
        <Card
          key={row.audit_id}
          role="button"
          tabIndex={0}
          className="min-h-10 gap-2 px-4 py-3 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onClick={() => onSelect(row.audit_id)}
          onKeyDown={event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onSelect(row.audit_id);
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="tabular-nums text-sm text-muted-foreground">{auditDateTime(row.recorded_at, language)}</span>
            <OrderAuditActionBadge action={row.action} label={t(`orderAudit.actions.${row.action}`)} />
          </div>
          <p className="font-medium">
            {row.related_order_uuid_fk && (
              <span className="text-muted-foreground">{row.related_order_invoice || row.related_order_uuid_fk} → </span>
            )}
            {row.order_invoice || row.order_uuid_fk}
          </p>
          <p className="text-sm">{row.actor_name || t(`orderAudit.actorTypes.${row.actor_type}`)}</p>
          <p className="text-sm text-muted-foreground">
            {t(`orderAudit.entities.${row.entity_type}`)} ·{" "}
            {language === "en" ? row.entity_label_eng || row.entity_label_la : row.entity_label_la || row.entity_label_eng}
          </p>
        </Card>
      ))}
    </div>
  );
}
