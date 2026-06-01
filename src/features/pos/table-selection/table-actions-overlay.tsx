"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Check, ChevronRight, CircleHelp, Merge, Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MoveTableZone, PosTable, PosZone } from "@/services/pos";
import { usePosStore } from "@/stores/pos-store";
import { useToastStore } from "@/stores/toast-store";
import type { TableActionMode, TableActionTable } from "./types";
import { filterTableActionZones, normalizeTableActionZones, tableActionFlatTables } from "./utils";

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
  const canSubmit = mode === "move" ? Boolean(moveTarget) : joinSources.length > 0;
  const actionLabel = mode === "move" ? t("pos.moveTable") : t("pos.joinTables");
  const confirmDescription =
    mode === "move"
      ? t("pos.moveTableConfirm", { from: table.table_name, to: moveTarget?.name ?? "" })
      : t("pos.joinTablesConfirm", {
          from: joinSources.map((source) => source.name).join(", "),
          to: table.table_name
        });

  useEffect(() => {
    if (!open) return;

    let ignore = false;
    setMode(initialMode);
    setSearch("");
    setMoveTargetUuid("");
    setJoinSourceUuids([]);

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

  const body = (
    <>
      <TooltipProvider>
        <Tabs value={mode} onValueChange={(value) => setMode(value as TableActionMode)} className="shrink-0 gap-3 px-4 pb-3">
          <TabsList className="grid h-11 w-full grid-cols-2">
            <TabsTrigger value="move">
              <ArrowRightLeft data-icon="inline-start" />
              <span className="min-w-0 truncate">{t("pos.moveTable")}</span>
              <TableActionTabTooltip
                description={t("pos.moveTableDescription")}
                rule={t("pos.moveTableRule")}
              />
            </TabsTrigger>
            <TabsTrigger value="join">
              <Merge data-icon="inline-start" />
              <span className="min-w-0 truncate">{t("pos.joinTables")}</span>
              <TableActionTabTooltip
                description={t("pos.joinTablesDescription")}
                rule={t("pos.joinTablesRule")}
              />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </TooltipProvider>

      <div className="shrink-0 border-y border-border bg-muted/30 px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 rounded-full bg-background pl-9"
            placeholder={t("actions.search")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <TableActionsLoading />
        ) : visibleZones.length ? (
          <div className="flex flex-col gap-4">
            {visibleZones.map((zone) => (
              <section key={zone.uuid} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-black text-muted-foreground">{zone.name}</p>
                  <Badge className="rounded-full px-2 text-xs">
                    {zone.tables.length}
                  </Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
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
          <Empty className="min-h-[220px] border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-muted text-muted-foreground">
                {mode === "move" ? <ArrowRightLeft /> : <Merge />}
              </EmptyMedia>
              <EmptyTitle>{mode === "move" ? t("pos.noMoveTargets") : t("pos.noJoinSources")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-background p-4">
        <div className="mb-3 min-h-5 text-xs font-bold text-muted-foreground">
          {mode === "move" && moveTarget ? t("pos.moveTableConfirm", { from: table.table_name, to: moveTarget.name }) : null}
          {mode === "join" && joinSources.length ? (
            <span>{t("common.selectedCount", { count: joinSources.length })}: {joinSources.map((source) => source.name).join(", ")}</span>
          ) : null}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={pending} onClick={() => updateOpen(false)}>
            {t("actions.cancel")}
          </Button>
          <Button type="button" disabled={!canSubmit || pending} onClick={() => setConfirmOpen(true)}>
            {pending ? <Spinner data-icon="inline-start" /> : mode === "move" ? <ArrowRightLeft data-icon="inline-start" /> : <Merge data-icon="inline-start" />}
            {actionLabel}
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {variant === "sheet" ? (
        <Sheet open={open} onOpenChange={updateOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={!pending}
            className="h-[90dvh] max-h-none gap-0 overflow-hidden rounded-t-2xl p-0"
          >
            <SheetHeader className="shrink-0 border-b border-border p-4 pr-12">
              <SheetTitle className="text-left text-lg font-black">{t("pos.tableActions")}</SheetTitle>
              <SheetDescription className="text-left">
                {t("pos.tableActionsDescription", { table: table.table_name })}
              </SheetDescription>
            </SheetHeader>
            {body}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={updateOpen}>
          <DialogContent className="flex max-h-[min(760px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[760px]">
            <DialogHeader className="shrink-0 border-b border-border p-4 pr-12">
              <DialogTitle className="text-lg font-black">{t("pos.tableActions")}</DialogTitle>
              <DialogDescription>{t("pos.tableActionsDescription", { table: table.table_name })}</DialogDescription>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      )}
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmDisabled={!canSubmit}
        confirmLabel={actionLabel}
        confirmPending={pending}
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

function TableActionTabTooltip({ description, rule }: { description: string; rule: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={`${description} ${rule}`}
          className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted [&_svg]:size-3.5 [&_svg]:shrink-0"
        >
          <CircleHelp aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8} className="max-w-[280px] text-left leading-5">
        <span className="flex flex-col gap-1">
          <span className="font-bold">{description}</span>
          <span>{rule}</span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

function TableActionOptionCard({
  mode,
  onClick,
  selected,
  table
}: {
  mode: TableActionMode;
  onClick: () => void;
  selected: boolean;
  table: TableActionTable;
}) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-auto min-w-0 justify-between rounded-lg border border-border bg-card p-3 text-left shadow-sm hover:border-primary/40 hover:bg-primary/5",
        selected && "border-primary bg-primary/10 ring-2 ring-primary/20"
      )}
      onClick={onClick}
    >
      <span className="min-w-0">
        <span className="block truncate text-base font-black text-foreground">{table.name}</span>
        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge className="rounded-full text-xs">{table.zoneName}</Badge>
          <Badge
            className={cn(
              "rounded-full text-xs",
              table.status === "busy"
                ? "border-transparent bg-destructive/10 text-destructive"
                : "border-transparent bg-primary/10 text-primary"
            )}
          >
            {table.status === "busy" ? t("common.busy") : t("common.free")}
          </Badge>
          {table.seats !== null ? <span className="text-xs font-bold text-muted-foreground">{table.seats} {t("pos.seats")}</span> : null}
        </span>
      </span>
      <span className="ml-3 grid size-7 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground">
        {selected ? <Check /> : mode === "move" ? <ChevronRight /> : <Plus />}
      </span>
    </Button>
  );
}

function TableActionsLoading() {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-[82px] rounded-lg" />
      ))}
    </div>
  );
}
