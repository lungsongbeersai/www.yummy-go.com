"use client";

import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OrderAuditRow } from "@/services/report";
import { auditChanges, auditDateTime } from "./order-audit-utils";

export function OrderAuditDetailSheet({
  row,
  language,
  branchLabel,
  onOpenChange,
}: {
  row: OrderAuditRow | null;
  language: string;
  branchLabel: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t("orderAudit.compare")} · {row?.order_invoice || "—"}</SheetTitle>
          <SheetDescription>{t("orderAudit.compareNotice")}</SheetDescription>
        </SheetHeader>
        {row && (
          <div className="flex flex-col gap-4 px-6 pb-6">
            <p className="font-medium">
              {branchLabel} · {t(`orderAudit.entities.${row.entity_type}`)} ·{" "}
              {language === "en" ? row.entity_label_eng || row.entity_label_la : row.entity_label_la || row.entity_label_eng}
            </p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">{t("orderAudit.actor")}</dt><dd>{row.actor_name || t(`orderAudit.actorTypes.${row.actor_type}`)}</dd></div>
              <div><dt className="text-muted-foreground">{t("orderAudit.time")}</dt><dd>{auditDateTime(row.recorded_at, language)}</dd></div>
              <div><dt className="text-muted-foreground">{t("orderAudit.action")}</dt><dd>{t(`orderAudit.actions.${row.action}`)}</dd></div>
              <div><dt className="text-muted-foreground">{t("orderAudit.reason")}</dt><dd className="break-words whitespace-pre-wrap">{row.reason || t("orderAudit.notProvided")}</dd></div>
            </dl>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("orderAudit.field")}</TableHead>
                  <TableHead>{t("orderAudit.before")}</TableHead>
                  <TableHead>{t("orderAudit.after")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditChanges(row, language, t).map(change => (
                  <TableRow key={change.field}>
                    <TableCell>{change.label}</TableCell>
                    <TableCell className="max-w-64 break-words whitespace-pre-wrap text-muted-foreground line-through decoration-muted-foreground/50">
                      {change.before}
                    </TableCell>
                    <TableCell className="max-w-64 break-words whitespace-pre-wrap font-medium text-foreground">
                      {change.after}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="break-all text-xs text-muted-foreground">{t("orderAudit.reference")}: {row.audit_id} · {row.entity_uuid}</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
