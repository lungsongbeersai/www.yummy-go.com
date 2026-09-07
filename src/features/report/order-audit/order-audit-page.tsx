"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportBranchField, ReportDateRangeFields, ReportSelectField } from "@/features/report/shared/report-filter-fields";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import { ORDER_AUDIT_ACTIONS } from "@/config/order-audit";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useOrderAuditReportStore } from "@/stores/report-store";
import { auditChanges, auditDateTime, auditToday, validAuditDateRange } from "./order-audit-utils";

export function OrderAuditPage() {
  const user = useAuthStore(state => state.user);
  // Recreate filter/detail state when the authenticated store, branch or role changes.
  return <OrderAuditReport key={`${authStoreUuid(user)}:${user?.branch_uuid}:${user?.status}`} />;
}

function OrderAuditReport() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const scope = useReportBranchSelection();
  const { load, reset, loading, error, report } = useOrderAuditReportStore();
  const [draft, setDraft] = useState(() => ({ branchUuid: scope.defaultBranchUuid,
    dateFrom: auditToday(), dateTo: auditToday(), search: "", action: "all", entity: "all" }));
  const [applied, setApplied] = useState(draft);
  const [paging, setPaging] = useState({ page: 1, snapshot: "", refresh: 0, scope: scope.defaultBranchUuid });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const branchUuid = scope.normalizeBranchFilters(applied).branchUuid;
  const draftBranch = scope.normalizeBranchFilters(draft).branchUuid;
  const valid = Boolean(draftBranch) && validAuditDateRange(draft.dateFrom, draft.dateTo);

  useEffect(() => {
    if (!branchUuid) return;
    void load({ branch_uuid_fk: branchUuid, date_from: applied.dateFrom, date_to: applied.dateTo,
      search: applied.search, action: applied.action === "all" ? "" : applied.action,
      entity_type: applied.entity === "all" ? "" : applied.entity,
      page: paging.scope === branchUuid ? paging.page : 1, limit: 20,
      snapshot_id: paging.scope === branchUuid ? paging.snapshot || undefined : undefined,
      lang: language }).catch(() => undefined);
    return reset;
  }, [load, reset, branchUuid, applied.dateFrom, applied.dateTo, applied.search,
    applied.action, applied.entity, paging.page, paging.snapshot, paging.refresh, paging.scope, language]);

  // Do not expose stale details from another scope while a replacement request starts.
  const current = report?.filters.branch_uuid_fk === branchUuid &&
    report.filters.date_from === applied.dateFrom && report.filters.date_to === applied.dateTo &&
    report.rows.every(row => row.store_uuid_fk === scope.storeUuid) ? report : null;
  const selected = current?.rows.find(row => row.audit_id === selectedId);
  const actionOptions = [{ value: "all", label: t("orderAudit.all") },
    ...ORDER_AUDIT_ACTIONS.map(value => ({ value, label: t(`orderAudit.actions.${value}`) }))];

  function apply() {
    if (!valid) return;
    setSelectedId(null);
    setApplied({ ...draft, branchUuid: draftBranch });
    setPaging(previous => ({ page: 1, snapshot: "", refresh: previous.refresh + 1, scope: draftBranch }));
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-background font-lao">
      <header className="flex max-h-[55dvh] shrink-0 flex-col gap-3 overflow-y-auto border-b p-3 md:p-4">
        <h1 className="text-xl font-semibold">{t("orderAudit.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("orderAudit.description")}</p>
        <form className="grid grid-cols-2 items-end gap-3 lg:grid-cols-4" onSubmit={event => { event.preventDefault(); apply(); }}>
          <ReportBranchField id="audit-branch" branchLoading={scope.branchLoading}
            branchLocked={!scope.canSelectBranch} options={scope.branchOptions} value={draftBranch}
            onValueChange={branchUuid => setDraft(previous => ({ ...previous, branchUuid }))} />
          <ReportDateRangeFields idPrefix="audit" dateFrom={draft.dateFrom} dateTo={draft.dateTo}
            onDateFromChange={dateFrom => setDraft(previous => ({ ...previous, dateFrom }))}
            onDateToChange={dateTo => setDraft(previous => ({ ...previous, dateTo }))} />
          <Field className="gap-1.5">
            <FieldLabel htmlFor="audit-search">{t("orderAudit.search")}</FieldLabel>
            <Input id="audit-search" value={draft.search} maxLength={120}
              onChange={event => setDraft(previous => ({ ...previous, search: event.target.value }))} />
          </Field>
          <ReportSelectField id="audit-action" label={t("orderAudit.action")} value={draft.action}
            options={actionOptions} onValueChange={action => setDraft(previous => ({ ...previous, action }))} />
          <ReportSelectField id="audit-entity" label={t("orderAudit.entity")} value={draft.entity}
            options={[{ value: "all", label: t("orderAudit.all") }, ...["ORDER", "ITEM", "TOPPING", "PAYMENT"].map(value => ({ value, label: t(`orderAudit.entities.${value}`) }))]}
            onValueChange={entity => setDraft(previous => ({ ...previous, entity }))} />
          <Button type="submit" disabled={!valid || loading}>{t("actions.search")}</Button>
          <Button type="button" variant="outline" disabled={loading || !branchUuid} onClick={() => {
            setSelectedId(null); setPaging(previous => ({ page: 1, snapshot: "", refresh: previous.refresh + 1, scope: branchUuid }));
          }}>{t("actions.refresh")}</Button>
        </form>
        {!validAuditDateRange(draft.dateFrom, draft.dateTo) && <p className="text-sm text-destructive" role="alert">{t("orderAudit.invalidDates")}</p>}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 md:p-4">
        <Alert><AlertDescription>{t("orderAudit.historyNotice")}</AlertDescription></Alert>
        {(error || scope.branchError) && <Alert variant="destructive"><AlertDescription>{error || scope.branchError}</AlertDescription></Alert>}
        {loading ? <Skeleton className="h-64 w-full" /> : current ? <>
          <p className="text-sm text-muted-foreground">
            {scope.branchLabelFor(branchUuid)} · {t("orderAudit.summary", current.summary)}
          </p>
          {current.rows.length ? <div className="shrink-0 rounded-lg border bg-card">
            <Table>
              <TableHeader><TableRow>
                {["time", "invoice", "actor", "action", "entity", "details"].map(key => <TableHead key={key}>{t(`orderAudit.${key}`)}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>{current.rows.map(row => <TableRow key={row.audit_id}>
                <TableCell>{auditDateTime(row.recorded_at, language)}</TableCell>
                <TableCell className="font-medium">
                  {row.related_order_uuid_fk && <span className="text-muted-foreground">{row.related_order_invoice || row.related_order_uuid_fk} → </span>}
                  {row.order_invoice || row.order_uuid_fk}
                </TableCell>
                <TableCell>{row.actor_name || t(`orderAudit.actorTypes.${row.actor_type}`)}</TableCell>
                <TableCell><Badge variant="secondary">{t(`orderAudit.actions.${row.action}`)}</Badge></TableCell>
                <TableCell>
                  {t(`orderAudit.entities.${row.entity_type}`)}
                  <p className="text-muted-foreground">{language === "en" ? row.entity_label_eng || row.entity_label_la : row.entity_label_la || row.entity_label_eng}</p>
                </TableCell>
                <TableCell><Button variant="outline" className="min-h-10" onClick={() => setSelectedId(row.audit_id)}>{t("orderAudit.compare")}</Button></TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </div> : <EmptyState title={t("orderAudit.empty")} description={t("orderAudit.emptyDescription")} />}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-sm">{t("orderAudit.page", { page: current.pagination.page, total: current.pagination.total_pages })}</span>
            <Button variant="outline" disabled={current.pagination.page <= 1} onClick={() => {
              setSelectedId(null); setPaging(previous => ({ ...previous, page: current.pagination.page - 1, snapshot: current.pagination.snapshot_id, scope: branchUuid }));
            }}>{t("orderAudit.previous")}</Button>
            <Button variant="outline" disabled={current.pagination.page >= current.pagination.total_pages} onClick={() => {
              setSelectedId(null); setPaging(previous => ({ ...previous, page: current.pagination.page + 1, snapshot: current.pagination.snapshot_id, scope: branchUuid }));
            }}>{t("orderAudit.next")}</Button>
          </div>
        </> : null}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelectedId(null); }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("orderAudit.compare")} · {selected?.order_invoice || "—"}</DialogTitle>
            <DialogDescription>{t("orderAudit.compareNotice")}</DialogDescription>
          </DialogHeader>
          {selected && <>
            <p className="font-medium">{scope.branchLabelFor(branchUuid)} · {t(`orderAudit.entities.${selected.entity_type}`)} · {language === "en" ? selected.entity_label_eng || selected.entity_label_la : selected.entity_label_la || selected.entity_label_eng}</p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">{t("orderAudit.actor")}</dt><dd>{selected.actor_name || t(`orderAudit.actorTypes.${selected.actor_type}`)}</dd></div>
              <div><dt className="text-muted-foreground">{t("orderAudit.time")}</dt><dd>{auditDateTime(selected.recorded_at, language)}</dd></div>
              <div><dt className="text-muted-foreground">{t("orderAudit.action")}</dt><dd>{t(`orderAudit.actions.${selected.action}`)}</dd></div>
              <div><dt className="text-muted-foreground">{t("orderAudit.reason")}</dt><dd className="break-words whitespace-pre-wrap">{selected.reason || t("orderAudit.notProvided")}</dd></div>
            </dl>
            <Table><TableHeader><TableRow>
              <TableHead>{t("orderAudit.field")}</TableHead><TableHead>{t("orderAudit.before")}</TableHead><TableHead>{t("orderAudit.after")}</TableHead>
            </TableRow></TableHeader><TableBody>
              {auditChanges(selected, language, t).map(change => <TableRow key={change.field}>
                <TableCell>{change.label}</TableCell><TableCell className="max-w-64 break-words whitespace-pre-wrap">{change.before}</TableCell>
                <TableCell className="max-w-64 break-words whitespace-pre-wrap font-medium">{change.after}</TableCell>
              </TableRow>)}
            </TableBody></Table>
            <p className="break-all text-xs text-muted-foreground">{t("orderAudit.reference")}: {selected.audit_id} · {selected.entity_uuid}</p>
          </>}
        </DialogContent>
      </Dialog>
    </section>
  );
}
