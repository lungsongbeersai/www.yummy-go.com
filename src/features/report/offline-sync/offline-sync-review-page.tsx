"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, RotateCcw, Trash2 } from "lucide-react";
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
import type { BrowserSyncQueueEntry } from "@/services/offline-db";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useOfflineSyncReviewStore } from "@/stores/offline-sync-review-store";

export function OfflineSyncReviewPage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const entries = useOfflineSyncReviewStore((state) => state.entries);
  const loading = useOfflineSyncReviewStore((state) => state.loading);
  const error = useOfflineSyncReviewStore((state) => state.error);
  const actioningEventUuid = useOfflineSyncReviewStore((state) => state.actioningEventUuid);
  const bulkDiscarding = useOfflineSyncReviewStore((state) => state.bulkDiscarding);
  const agentBlockedCount = useOfflineSyncReviewStore((state) => state.agentBlockedCount);
  const load = useOfflineSyncReviewStore((state) => state.load);
  const retry = useOfflineSyncReviewStore((state) => state.retry);
  const discard = useOfflineSyncReviewStore((state) => state.discard);
  const discardMany = useOfflineSyncReviewStore((state) => state.discardMany);

  const [selectedUuids, setSelectedUuids] = useState<string[]>([]);
  const [discardTargetUuids, setDiscardTargetUuids] = useState<string[] | null>(null);

  const scope = useMemo(
    () => ({
      storeUuid: authStoreUuid(user),
      branchUuid: user?.branch_uuid || "",
    }),
    [user],
  );

  const validSelectedUuids = useMemo(
    () => selectedUuids.filter((uuid) => entries.some((entry) => entry.eventUuid === uuid)),
    [selectedUuids, entries],
  );

  useEffect(() => {
    if (!scope.storeUuid || !scope.branchUuid) return;
    void load(scope);
  }, [load, scope]);

  function toggleRow(eventUuid: string, checked: boolean) {
    setSelectedUuids((current) => {
      if (checked) return current.includes(eventUuid) ? current : [...current, eventUuid];
      return current.filter((uuid) => uuid !== eventUuid);
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedUuids(checked ? entries.map((entry) => entry.eventUuid) : []);
  }

  function confirmDiscard() {
    if (!discardTargetUuids?.length) return;
    const uuids = discardTargetUuids;
    setDiscardTargetUuids(null);
    if (uuids.length === 1) {
      void discard(uuids[0], scope);
    } else {
      void discardMany(uuids, scope);
      setSelectedUuids([]);
    }
  }

  const busy = loading || bulkDiscarding;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20">
      <header className="shrink-0 border-b border-border bg-card px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("report.offlineSync.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("report.offlineSync.description")}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("actions.refresh")}
            disabled={busy}
            onClick={() => void load(scope)}
          >
            <RefreshCcw className={loading ? "animate-spin" : undefined} />
          </Button>
        </div>

        {validSelectedUuids.length ? (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
            <span className="text-sm font-medium">
              {t("report.offlineSync.selectedCount", { count: validSelectedUuids.length })}
            </span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => setDiscardTargetUuids(validSelectedUuids)}
            >
              <Trash2 className={bulkDiscarding ? "animate-spin" : undefined} />
              {t("actions.deleteSelected")}
            </Button>
          </div>
        ) : null}
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-3">
        {error ? (
          <Alert variant="destructive" className="mb-3">
            <AlertTitle>{t("report.offlineSync.loadFailed")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {agentBlockedCount !== null && agentBlockedCount > 0 ? (
          <Alert variant="destructive" className="mb-3">
            <AlertTitle>
              {t("report.offlineSync.agentMismatchTitle", { count: agentBlockedCount })}
            </AlertTitle>
            <AlertDescription>{t("report.offlineSync.agentMismatchDescription")}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <OfflineSyncReviewSkeleton />
        ) : entries.length ? (
          <OfflineSyncReviewTable
            entries={entries}
            selectedUuids={validSelectedUuids}
            actioningEventUuid={actioningEventUuid}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
            onRetry={(entry) => void retry(entry.eventUuid, scope)}
            onDiscard={(entry) => setDiscardTargetUuids([entry.eventUuid])}
            t={t}
          />
        ) : (
          <EmptyState
            title={t("report.offlineSync.empty.title")}
            description={t("report.offlineSync.empty.description")}
          />
        )}
      </main>

      <AlertDialog open={Boolean(discardTargetUuids)} onOpenChange={(open) => !open && setDiscardTargetUuids(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {(discardTargetUuids?.length ?? 0) > 1
                ? t("report.offlineSync.confirmDiscardManyTitle", { count: discardTargetUuids?.length ?? 0 })
                : t("report.offlineSync.confirmDiscardTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(discardTargetUuids?.length ?? 0) > 1
                ? t("report.offlineSync.confirmDiscardManyDescription")
                : t("report.offlineSync.confirmDiscardDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
            <Button variant="destructive" onClick={confirmDiscard}>
              {t("report.offlineSync.discard")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface OfflineSyncReviewTableProps {
  entries: BrowserSyncQueueEntry[];
  selectedUuids: string[];
  actioningEventUuid: string | null;
  onToggleRow: (eventUuid: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onRetry: (entry: BrowserSyncQueueEntry) => void;
  onDiscard: (entry: BrowserSyncQueueEntry) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function OfflineSyncReviewTable(props: OfflineSyncReviewTableProps) {
  const allSelected = props.entries.length > 0 && props.selectedUuids.length === props.entries.length;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => props.onToggleAll(checked as boolean)}
                  aria-label={props.t("common.selectAll")}
                />
              </TableHead>
              <TableHead>{props.t("report.offlineSync.columns.path")}</TableHead>
              <TableHead>{props.t("report.offlineSync.columns.method")}</TableHead>
              <TableHead>{props.t("report.offlineSync.columns.error")}</TableHead>
              <TableHead>{props.t("report.offlineSync.columns.updatedAt")}</TableHead>
              <TableHead className="text-right">{props.t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.entries.map((entry) => {
              const busy = props.actioningEventUuid === entry.eventUuid;
              const selected = props.selectedUuids.includes(entry.eventUuid);
              return (
                <TableRow key={entry.eventUuid} data-state={selected ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected}
                      onCheckedChange={(checked) => props.onToggleRow(entry.eventUuid, checked as boolean)}
                      aria-label={props.t("common.selectRow", { name: entry.path })}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{entry.path}</TableCell>
                  <TableCell><Badge variant="outline">{entry.method}</Badge></TableCell>
                  <TableCell className="max-w-64 truncate text-sm text-destructive" title={entry.lastError ?? ""}>
                    {entry.lastError || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(entry.updatedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => props.onRetry(entry)}
                      >
                        <RotateCcw className={busy ? "animate-spin" : undefined} />
                        {props.t("report.offlineSync.retry")}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={busy}
                        onClick={() => props.onDiscard(entry)}
                      >
                        <Trash2 />
                        {props.t("report.offlineSync.discard")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function OfflineSyncReviewSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
    </div>
  );
}
