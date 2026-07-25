"use client";

import { useEffect, useMemo, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { ArrowRightLeft, Info, LayoutGrid, MapPin, Merge, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList } from "@/components/ui/tabs";
import type { MoveTableZone, PosTable, PosZone } from "@/services/pos";
import { usePosStore } from "@/stores/pos-store";
import { useToastStore } from "@/stores/toast-store";
import {
  TableActionOptionCard,
  TableActionSelectionSummary,
  TableActionsLoading,
  TableActionTab
} from "./table-actions-overlay-parts";
import type { TableActionMode } from "./types";
import { filterTableActionZones, normalizeTableActionZones, tableActionFlatTables } from "@/features/pos/table-selection/table-zones";

export function TableActionsOverlay({
  branchUuid,
  fallbackZones,
  initialMode = "move",
  language,
  onCompleted,
  onOpenChange,
  open,
  table,
  variant
}: {
  branchUuid?: string;
  fallbackZones: PosZone[];
  initialMode?: TableActionMode;
  language: string;
  onCompleted: (nextTableUuid?: string) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  table: PosTable;
  variant: "side" | "sheet";
}) {
  const { t } = useTranslation();
  const loadJoinMoveTables = usePosStore((state) => state.loadJoinMoveTables);
  const moveTable = usePosStore((state) => state.moveTable);
  const joinTables = usePosStore((state) => state.joinTables);
  const showToast = useToastStore((state) => state.show);
  const [mode, setMode] = useState<TableActionMode>(initialMode);
  const [search, setSearch] = useState("");
  const [optionsZones, setOptionsZones] = useState<MoveTableZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [moveTargetUuid, setMoveTargetUuid] = useState("");
  const [joinSourceUuids, setJoinSourceUuids] = useState<string[]>([]);
  const sourceZones = optionsZones.length ? optionsZones : fallbackZones;
  const normalizedZones = useMemo(() => normalizeTableActionZones(sourceZones), [sourceZones]);
  const visibleZones = useMemo(
    () => filterTableActionZones(normalizedZones, table.table_uuid, mode, search),
    [mode, normalizedZones, search, table.table_uuid]
  );
  const allOptions = useMemo(() => tableActionFlatTables(normalizedZones), [normalizedZones]);
  const moveTarget = allOptions.find((option) => option.uuid === moveTargetUuid) ?? null;
  const joinSources = allOptions.filter((option) => joinSourceUuids.includes(option.uuid));
  const visibleTableCount = visibleZones.reduce((total, zone) => total + zone.tables.length, 0);
  const canSubmit = mode === "move" ? Boolean(moveTarget) : joinSources.length > 0;
  const actionLabel = mode === "move" ? t("pos.moveTable") : t("pos.joinTables");
  const modeDescription = mode === "move" ? t("pos.moveTableDescription") : t("pos.joinTablesDescription");
  const modeRule = mode === "move" ? t("pos.moveTableRule") : t("pos.joinTablesRule");
  const actionButtonLabel =
    mode === "move" && moveTarget
      ? `${actionLabel}: ${moveTarget.name}`
      : mode === "join" && joinSources.length
        ? `${actionLabel} (${joinSources.length})`
        : actionLabel;
  const confirmDescription =
    mode === "move"
      ? t("pos.moveTableConfirm", { from: table.table_name, to: moveTarget?.name ?? "" })
      : t("pos.joinTablesConfirm", {
          from: joinSources.map((source) => source.name).join(", "),
          to: table.table_name
        });

  // เปิด overlay ใหม่ = เริ่มฟอร์มใหม่ทุกครั้ง (แยกจาก effect ที่ไปโหลดรายการโต๊ะ)
  useResetOnChange(open, () => {
    if (!open) return;
    setMode(initialMode);
    setSearch("");
    setMoveTargetUuid("");
    setJoinSourceUuids([]);
  });

  useEffect(() => {
    if (!open) return;

    let ignore = false;

    async function loadOptions() {
      if (!branchUuid) {
        setOptionsZones([]);
        return;
      }

      setLoading(true);
      try {
        const nextZones = await loadJoinMoveTables({ branch_uuid_fk: branchUuid, lang: language });
        if (!ignore) setOptionsZones(nextZones);
      } catch (error) {
        if (!ignore) {
          setOptionsZones([]);
          showToast({
            title: t("pos.tableActionFailed"),
            description: error instanceof Error ? error.message : "",
            tone: "error"
          });
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadOptions();

    return () => {
      ignore = true;
    };
  }, [branchUuid, initialMode, language, loadJoinMoveTables, open, showToast, t]);

  function updateOpen(nextOpen: boolean) {
    if (pending) return;
    onOpenChange(nextOpen);
  }

  function toggleJoinSource(tableUuid: string) {
    setJoinSourceUuids((current) =>
      current.includes(tableUuid) ? current.filter((uuid) => uuid !== tableUuid) : [...current, tableUuid]
    );
  }

  async function submitTableAction() {
    if (!canSubmit || pending) return;

    setPending(true);
    try {
      if (mode === "move") {
        if (!moveTarget) return;
        await moveTable({ from_table_uuid: table.table_uuid, to_table_uuid: moveTarget.uuid });
        await onCompleted(moveTarget.uuid);
      } else {
        await joinTables({ from_table_uuids: joinSources.map((source) => source.uuid), to_table_uuid: table.table_uuid });
        await onCompleted(table.table_uuid);
      }

      showToast({ title: t("pos.tableActionSuccess"), tone: "success" });
      setConfirmOpen(false);
      onOpenChange(false);
    } catch (error) {
      showToast({
        title: t("pos.tableActionFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    } finally {
      setPending(false);
    }
  }

  const modeTabs = (
    <Tabs value={mode} onValueChange={(value) => setMode(value as TableActionMode)} className="gap-0">
      <TabsList className="grid h-auto min-h-12 w-full grid-cols-2 rounded-xl bg-muted/70 p-1 sm:min-h-14">
        <TableActionTab
          description={t("pos.moveTableDescription")}
          icon={<ArrowRightLeft aria-hidden="true" />}
          label={t("pos.moveTable")}
          value="move"
        />
        <TableActionTab
          description={t("pos.joinTablesDescription")}
          icon={<Merge aria-hidden="true" />}
          label={t("pos.joinTables")}
          value="join"
        />
      </TabsList>
    </Tabs>
  );

  const supportingControls = (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.7fr)]">
      <div className="flex min-h-11 items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>{modeRule}</p>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={`table-actions-search-${variant}`} className="sr-only">
            {t("actions.search")}
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`table-actions-search-${variant}`}
            name="table-action-search"
            autoComplete="off"
            className="h-11 rounded-xl bg-background pl-9"
            placeholder={`${t("actions.search")}\u2026`}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Badge
          aria-live="polite"
          className="h-11 shrink-0 rounded-xl bg-background px-3 tabular-nums text-foreground"
          variant="outline"
        >
          {visibleTableCount} {mode === "move" ? t("common.free") : t("common.busy")}
        </Badge>
      </div>
    </div>
  );

  const tableOptions = loading ? (
    <TableActionsLoading />
  ) : visibleZones.length ? (
    <div className="flex flex-col gap-5">
      {visibleZones.map((zone) => (
        <section key={zone.uuid} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 px-0.5">
            <MapPin aria-hidden="true" className="size-4 text-primary" />
            <h3 className="min-w-0 truncate text-sm font-black text-foreground">{zone.name}</h3>
            <Badge className="rounded-full px-2 text-xs tabular-nums">{zone.tables.length}</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {zone.tables.map((option) => {
              const selected = mode === "move" ? option.uuid === moveTargetUuid : joinSourceUuids.includes(option.uuid);

              return (
                <TableActionOptionCard
                  key={option.uuid}
                  mode={mode}
                  selected={selected}
                  table={option}
                  onClick={() => {
                    if (mode === "move") setMoveTargetUuid(option.uuid);
                    else toggleJoinSource(option.uuid);
                  }}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  ) : (
    <Empty className="min-h-55 border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-muted text-muted-foreground">
          {mode === "move" ? <ArrowRightLeft aria-hidden="true" /> : <Merge aria-hidden="true" />}
        </EmptyMedia>
        <EmptyTitle>
          {search ? t("pos.noTableSearchResults") : mode === "move" ? t("pos.noMoveTargets") : t("pos.noJoinSources")}
        </EmptyTitle>
        {search ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setSearch("")}>
            {t("actions.clear")}
          </Button>
        ) : null}
      </EmptyHeader>
    </Empty>
  );

  const actionFooter = (
    <div className="shrink-0 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-8px_24px_-20px_rgba(0,0,0,0.45)] backdrop-blur-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="min-w-0 flex-1">
          <p className="text-xs font-black text-foreground">{actionLabel}</p>
          <TableActionSelectionSummary
            joinSources={joinSources}
            mode={mode}
            modeDescription={modeDescription}
            moveTarget={moveTarget}
            sourceTableName={table.table_name}
          />
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" size="lg" variant="outline" disabled={pending} onClick={() => updateOpen(false)}>
            {t("actions.cancel")}
          </Button>
          <Button type="button" size="lg" disabled={!canSubmit || pending} onClick={() => setConfirmOpen(true)}>
            {pending ? <Spinner data-icon="inline-start" /> : mode === "move" ? <ArrowRightLeft data-icon="inline-start" /> : <Merge data-icon="inline-start" />}
            <span className="max-w-52 truncate">{actionButtonLabel}</span>
          </Button>
        </div>
      </div>
    </div>
  );

  function renderBody(scrollSupportingControls: boolean) {
    return (
      <>
        <div className="shrink-0 border-b border-border bg-muted/20 p-3 sm:p-4">
          {modeTabs}
          {!scrollSupportingControls ? <div className="mt-3">{supportingControls}</div> : null}
        </div>
        <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto" aria-busy={loading}>
          {scrollSupportingControls ? (
            <div className="border-b border-border bg-muted/20 px-4 pb-4 pt-3">{supportingControls}</div>
          ) : null}
          <div className="px-4 py-4">{tableOptions}</div>
        </div>
        {actionFooter}
      </>
    );
  }

  return (
    <>
      {variant === "sheet" ? (
        <Sheet open={open} onOpenChange={updateOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={!pending}
            className="h-[90dvh] max-h-none gap-0 overflow-hidden rounded-t-2xl p-0"
          >
            <SheetHeader className="shrink-0 border-b border-border p-4 pr-14">
              <div className="flex min-w-0 items-center gap-3 text-left">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <LayoutGrid aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate text-lg font-black">{t("pos.tableActions")}</SheetTitle>
                  <SheetDescription className="mt-1 truncate">
                    {t("pos.tableActionsDescription", { table: table.table_name })}
                  </SheetDescription>
                </div>
                <Badge
                  title={table.table_name}
                  className="max-w-28 shrink-0 truncate rounded-lg border-primary/20 bg-primary/10 px-2.5 py-1 text-sm font-black text-primary"
                >
                  {table.table_name}
                </Badge>
              </div>
            </SheetHeader>
            {renderBody(true)}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={updateOpen}>
          <DialogContent className="flex max-h-[min(820px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[960px]">
            <DialogHeader className="shrink-0 border-b border-border p-5 pr-16">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <LayoutGrid aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate text-xl font-black">{t("pos.tableActions")}</DialogTitle>
                  <DialogDescription className="mt-1 truncate">
                    {t("pos.tableActionsDescription", { table: table.table_name })}
                  </DialogDescription>
                </div>
                <Badge
                  title={table.table_name}
                  className="max-w-40 shrink-0 truncate rounded-lg border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-black text-primary"
                >
                  {table.table_name}
                </Badge>
              </div>
            </DialogHeader>
            {renderBody(false)}
          </DialogContent>
        </Dialog>
      )}
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmDisabled={!canSubmit}
        confirmLabel={actionLabel}
        confirmPending={pending}
        confirmVariant="default"
        description={confirmDescription}
        open={confirmOpen}
        title={actionLabel}
        onConfirm={() => void submitTableAction()}
        onOpenChange={(nextOpen) => {
          if (pending) return;
          setConfirmOpen(nextOpen);
        }}
      />
    </>
  );
}
