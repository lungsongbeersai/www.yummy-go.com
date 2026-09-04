"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Printer, RefreshCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money } from "@/lib/format";
import type { StuckSyncEvent } from "@/services/offline-sync";
import { useStuckOrderStore } from "@/stores/stuck-order-store";
import {
  closureCarriesMoney,
  countFinancialGroups,
  countStuckEvents,
  groupStuckEvents,
  type StuckOrderGroup,
} from "./stuck-order-groups";

/** What a confirm dialog is about to cancel. */
interface DiscardTarget {
  key: string;
  eventUuids: string[];
  hasFinancial: boolean;
  /** Every stuck bill at once, rather than one row. */
  all: boolean;
  label: string;
}

export function StuckOrdersPage() {
  const { t } = useTranslation();
  const events = useStuckOrderStore((state) => state.events);
  const loading = useStuckOrderStore((state) => state.loading);
  const error = useStuckOrderStore((state) => state.error);
  const discardingKey = useStuckOrderStore((state) => state.discardingKey);
  const discardingAll = useStuckOrderStore((state) => state.discardingAll);
  const lastResult = useStuckOrderStore((state) => state.lastResult);
  const load = useStuckOrderStore((state) => state.load);
  const discard = useStuckOrderStore((state) => state.discard);
  const discardAll = useStuckOrderStore((state) => state.discardAll);

  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [target, setTarget] = useState<DiscardTarget | null>(null);
  const [includeFinancial, setIncludeFinancial] = useState(false);

  const groups = useMemo(() => groupStuckEvents(events), [events]);
  const eventCount = countStuckEvents(groups);
  const financialGroupCount = countFinancialGroups(groups);
  const printGroupCount = groups.filter((group) => group.waitingOnPrint).length;
  const busy = loading || discardingAll || Boolean(discardingKey);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleExpanded(key: string) {
    setExpandedKeys((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );
  }

  function openDiscard(next: DiscardTarget) {
    // Money is opt-in every time: the checkbox never carries over from the last
    // confirmation to the next one.
    setIncludeFinancial(false);
    setTarget(next);
  }

  function confirmDiscard() {
    if (!target) return;
    const pending = target;
    setTarget(null);
    if (pending.all) void discardAll(includeFinancial);
    else void discard(pending.key, pending.eventUuids, includeFinancial);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20">
      <header className="shrink-0 border-b border-border bg-card px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("report.stuckOrders.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("report.stuckOrders.description")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("actions.refresh")}
              disabled={busy}
              onClick={() => void load()}
            >
              <RefreshCcw className={loading ? "animate-spin" : undefined} />
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy || !groups.length}
              onClick={() =>
                openDiscard({
                  key: "__all__",
                  eventUuids: [],
                  hasFinancial: financialGroupCount > 0,
                  all: true,
                  label: t("report.stuckOrders.summary", { orders: groups.length, events: eventCount }),
                })
              }
            >
              <Trash2 className={discardingAll ? "animate-spin" : undefined} />
              {t("report.stuckOrders.cancelAll")}
            </Button>
          </div>
        </div>

        {groups.length ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">{t("report.stuckOrders.summary", { orders: groups.length, events: eventCount })}</Badge>
            {printGroupCount ? (
              <Badge variant="outline" className="gap-1">
                <Printer className="size-3" />
                {t("report.stuckOrders.waitingOnPrintCount", { count: printGroupCount })}
              </Badge>
            ) : null}
            {financialGroupCount ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-3" />
                {t("report.stuckOrders.financialCount", { count: financialGroupCount })}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-3">
        <Alert className="mb-3">
          <AlertTitle>{t("report.stuckOrders.stockSafeTitle")}</AlertTitle>
          <AlertDescription>{t("report.stuckOrders.stockSafeDescription")}</AlertDescription>
        </Alert>

        {error ? (
          <Alert variant="destructive" className="mb-3">
            <AlertTitle>{t("report.stuckOrders.loadFailed")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {lastResult ? <DiscardOutcome result={lastResult} t={t} /> : null}

        {loading ? (
          <StuckOrdersSkeleton />
        ) : groups.length ? (
          <StuckOrdersTable
            groups={groups}
            expandedKeys={expandedKeys}
            discardingKey={discardingKey}
            busy={busy}
            onToggleExpanded={toggleExpanded}
            onDiscardGroup={(group) =>
              openDiscard({
                key: group.key,
                eventUuids: group.events.map((event) => event.event_uuid),
                hasFinancial: group.hasFinancial,
                all: false,
                label: describeGroup(group, t),
              })
            }
            onDiscardEvent={(group, event) =>
              openDiscard({
                key: event.event_uuid,
                eventUuids: [event.event_uuid],
                // Not `event.is_financial`: the Agent cancels everything
                // downstream of this row too, so the dialog has to warn about a
                // payment that depends on it, not only about this row itself.
                hasFinancial: closureCarriesMoney(group.events, event.event_uuid),
                all: false,
                label: `${describeGroup(group, t)} · ${event.operation}`,
              })
            }
            t={t}
          />
        ) : (
          <EmptyState
            title={t("report.stuckOrders.empty.title")}
            description={t("report.stuckOrders.empty.description")}
          />
        )}
      </main>

      <AlertDialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {target?.all
                ? t("report.stuckOrders.confirmAllTitle", { count: groups.length })
                : t("report.stuckOrders.confirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {target?.label ? `${target.label} — ` : ""}
              {t("report.stuckOrders.confirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {target?.hasFinancial ? (
            <Alert variant="destructive">
              <AlertTitle>{t("report.stuckOrders.financialWarningTitle")}</AlertTitle>
              <AlertDescription>
                <p>{t("report.stuckOrders.financialWarningDescription")}</p>
                <label className="mt-2 flex items-center gap-2 font-medium">
                  <Checkbox
                    checked={includeFinancial}
                    onCheckedChange={(checked) => setIncludeFinancial(checked as boolean)}
                  />
                  {t("report.stuckOrders.includeFinancial")}
                </label>
              </AlertDescription>
            </Alert>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={Boolean(target?.hasFinancial) && !includeFinancial}
              onClick={confirmDiscard}
            >
              {t("report.stuckOrders.cancelOrder")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

function describeGroup(group: StuckOrderGroup, t: Translate) {
  if (group.order?.table_name) return t("report.stuckOrders.tableLabel", { name: group.order.table_name });
  if (group.order?.order_invoice) return group.order.order_invoice;
  return group.key.slice(0, 8);
}

interface StuckOrdersTableProps {
  groups: StuckOrderGroup[];
  expandedKeys: string[];
  discardingKey: string | null;
  busy: boolean;
  onToggleExpanded: (key: string) => void;
  onDiscardGroup: (group: StuckOrderGroup) => void;
  onDiscardEvent: (group: StuckOrderGroup, event: StuckSyncEvent) => void;
  t: Translate;
}

function StuckOrdersTable(props: StuckOrdersTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>{props.t("report.stuckOrders.columns.order")}</TableHead>
              <TableHead>{props.t("report.stuckOrders.columns.total")}</TableHead>
              <TableHead>{props.t("report.stuckOrders.columns.events")}</TableHead>
              <TableHead>{props.t("report.stuckOrders.columns.stuckSince")}</TableHead>
              <TableHead>{props.t("report.stuckOrders.columns.reason")}</TableHead>
              <TableHead className="text-right">{props.t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.groups.map((group) => {
              const expanded = props.expandedKeys.includes(group.key);
              const rowBusy = props.discardingKey === group.key;
              return [
                <TableRow key={group.key}>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={props.t(expanded ? "report.stuckOrders.collapse" : "report.stuckOrders.expand")}
                      aria-expanded={expanded}
                      onClick={() => props.onToggleExpanded(group.key)}
                    >
                      {expanded ? <ChevronDown /> : <ChevronRight />}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{describeGroup(group, props.t)}</span>
                      {group.order?.order_invoice ? (
                        <span className="font-mono text-xs text-muted-foreground">{group.order.order_invoice}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {group.order?.order_grand_total ? money(group.order.order_grand_total) : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="outline">{group.events.length}</Badge>
                      {group.waitingOnPrint ? (
                        <Badge variant="outline" className="gap-1">
                          <Printer className="size-3" />
                          {props.t("report.stuckOrders.waitingOnPrint")}
                        </Badge>
                      ) : null}
                      {group.hasFinancial ? (
                        <Badge variant="destructive">{props.t("report.stuckOrders.financial")}</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(group.oldestAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-sm text-destructive" title={group.reason}>
                    {group.reason || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={props.busy}
                      onClick={() => props.onDiscardGroup(group)}
                    >
                      <Trash2 className={rowBusy ? "animate-spin" : undefined} />
                      {props.t("report.stuckOrders.cancelOrder")}
                    </Button>
                  </TableCell>
                </TableRow>,
                expanded ? (
                  <TableRow key={`${group.key}-events`}>
                    <TableCell colSpan={7} className="bg-muted/40 p-0">
                      <StuckEventList
                        group={group}
                        discardingKey={props.discardingKey}
                        busy={props.busy}
                        onDiscardEvent={props.onDiscardEvent}
                        t={props.t}
                      />
                    </TableCell>
                  </TableRow>
                ) : null,
              ];
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface StuckEventListProps {
  group: StuckOrderGroup;
  discardingKey: string | null;
  busy: boolean;
  onDiscardEvent: (group: StuckOrderGroup, event: StuckSyncEvent) => void;
  t: Translate;
}

function StuckEventList(props: StuckEventListProps) {
  return (
    <ul className="divide-y divide-border">
      {props.group.events.map((event) => (
        <li key={event.event_uuid} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{event.operation}</span>
              <Badge variant="outline">{event.sync_status}</Badge>
              {event.waiting_on_print ? (
                <Badge variant="outline" className="gap-1">
                  <Printer className="size-3" />
                  {props.t("report.stuckOrders.waitingOnPrint")}
                </Badge>
              ) : null}
              {event.waiting_on_dependency ? (
                <Badge variant="outline">{props.t("report.stuckOrders.waitingOnDependency")}</Badge>
              ) : null}
              {event.is_financial ? (
                <Badge variant="destructive">{props.t("report.stuckOrders.financial")}</Badge>
              ) : null}
            </div>
            <p className="truncate font-mono text-xs text-muted-foreground">{event.event_uuid}</p>
            {event.last_error ? (
              <p className="text-xs text-destructive" title={event.last_error}>{event.last_error}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={props.busy}
            onClick={() => props.onDiscardEvent(props.group, event)}
          >
            <Trash2 className={props.discardingKey === event.event_uuid ? "animate-spin" : undefined} />
            {props.t("report.stuckOrders.cancelEvent")}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function DiscardOutcome({
  result,
  t,
}: {
  result: { discarded: string[]; cascaded: string[]; skipped: { event_uuid: string; reason: string }[] };
  t: Translate;
}) {
  const blockedByMoney = result.skipped.filter(
    (entry) => entry.reason === "FINANCIAL_EVENT_REQUIRES_CONFIRMATION",
  ).length;
  if (!result.discarded.length && !result.skipped.length) return null;

  return (
    <Alert variant={blockedByMoney ? "destructive" : "default"} className="mb-3">
      <AlertTitle>
        {t("report.stuckOrders.resultTitle", {
          count: result.discarded.length + result.cascaded.length,
        })}
      </AlertTitle>
      <AlertDescription>
        {blockedByMoney
          ? t("report.stuckOrders.resultSkippedFinancial", { count: blockedByMoney })
          : t("report.stuckOrders.resultDescription")}
      </AlertDescription>
    </Alert>
  );
}

function StuckOrdersSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
    </div>
  );
}
