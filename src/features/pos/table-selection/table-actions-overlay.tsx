"use client";

import { useEffect, useMemo, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { ArrowRightLeft, Info, Merge } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SearchInput } from "@/components/common/search-input";
import type { MoveTableZone, PosTable, PosZone } from "@/services/pos";
import { usePosStore } from "@/stores/pos-store";
import { useToastStore } from "@/stores/toast-store";
import { TableActionFlow, TableActionOptionCard, TableActionsLoading } from "./table-actions-overlay-parts";
import type { TableActionMode } from "./types";
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
  const visibleTableCount = visibleZones.reduce((total, zone) => total + zone.tables.length, 0);
  const canSubmit = mode === "move" ? Boolean(moveTarget) : joinSources.length > 0;
  const actionLabel = mode === "move" ? t("pos.moveTable") : t("pos.joinTables");
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

  // ย้าย/รวม เป็นตัวเลือก 2 ค่า — segmented control (ToggleGroup) กะทัดรัดกว่าแท็บการ์ดใหญ่แบบเดิม
  // คำอธิบายของแต่ละโหมดย้ายไปอยู่ในบรรทัดกฎใต้ช่องค้นหาแทน (เดิมซ้ำกันอยู่ 2 ที่)
  const modeSwitch = (
    <ToggleGroup
      type="single"
      variant="outline"
      spacing={0}
      value={mode}
      aria-label={t("pos.tableActions")}
      className="grid w-full grid-cols-2 sm:w-auto"
      onValueChange={(value) => {
        if (value) setMode(value as TableActionMode);
      }}
    >
      <ToggleGroupItem value="move" className="h-10 px-4 text-sm font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
        <ArrowRightLeft aria-hidden="true" data-icon="inline-start" />
        {t("pos.moveTable")}
      </ToggleGroupItem>
      <ToggleGroupItem value="join" className="h-10 px-4 text-sm font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
        <Merge aria-hidden="true" data-icon="inline-start" />
        {t("pos.joinTables")}
      </ToggleGroupItem>
    </ToggleGroup>
  );

  const supportingControls = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {modeSwitch}
        <SearchInput
          ariaLabel={t("actions.search")}
          className="h-10 flex-1"
          id={`table-actions-search-${variant}`}
          name="table-action-search"
          placeholder={`${t("actions.search")}…`}
          value={search}
          onChange={setSearch}
        />
      </div>
      <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
        <p className="flex min-w-0 items-start gap-1.5">
          <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>{modeRule}</span>
        </p>
        <span aria-live="polite" className="shrink-0 font-medium tabular-nums">
          {visibleTableCount} {mode === "move" ? t("common.free") : t("common.busy")}
        </span>
      </div>
    </div>
  );

  const tableOptions = loading ? (
    <TableActionsLoading />
  ) : visibleZones.length ? (
    <div className="flex flex-col gap-5">
      {visibleZones.map((zone) => (
        <section key={zone.uuid} aria-label={zone.name} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">{zone.name}</h3>
            <Badge variant="secondary" className="tabular-nums">{zone.tables.length}</Badge>
            <div aria-hidden="true" className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
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

  // ท้าย: ภาพ ต้นทาง → ปลายทาง ของสิ่งที่จะเกิดขึ้นจริง ข้างปุ่มยืนยัน
  const actionFooter = (
    <div className="shrink-0 border-t border-border bg-background px-4 py-3 pb-[calc(0.75rem+var(--pos-system-bottom-safe-area,0px))] sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="min-w-0">
          <TableActionFlow
            joinSources={joinSources}
            mode={mode}
            moveTarget={moveTarget}
            sourceTableName={table.table_name}
          />
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
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

  function renderBody() {
    return (
      <>
        <div className="shrink-0 border-b border-border px-4 py-3 sm:px-5">{supportingControls}</div>
        <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto bg-muted/30 px-4 py-4 sm:px-5" aria-busy={loading}>
          {tableOptions}
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
            className="h-[90dvh] max-h-none gap-0 overflow-hidden rounded-t-2xl p-0 data-[side=bottom]:h-[90dvh]"
          >
            <SheetHeader className="shrink-0 border-b border-border px-4 py-3 pr-14 text-left">
              <div className="flex min-w-0 items-center gap-2">
                <SheetTitle className="truncate text-lg font-bold">{t("pos.tableActions")}</SheetTitle>
                <Badge variant="outline" title={table.table_name} className="max-w-28 shrink-0 truncate tabular-nums">
                  {table.table_name}
                </Badge>
              </div>
              <SheetDescription className="truncate">
                {t("pos.tableActionsDescription", { table: table.table_name })}
              </SheetDescription>
            </SheetHeader>
            {renderBody()}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={updateOpen}>
          <DialogContent className="top-6 flex max-h-[min(820px,calc(100dvh-3rem))] translate-y-0 flex-col gap-0 overflow-hidden p-0 duration-200 sm:max-w-[960px]">
            <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-16 text-left">
              <div className="flex min-w-0 items-center gap-2">
                <DialogTitle className="truncate text-xl font-bold">{t("pos.tableActions")}</DialogTitle>
                <Badge variant="outline" title={table.table_name} className="max-w-40 shrink-0 truncate tabular-nums">
                  {table.table_name}
                </Badge>
              </div>
              <DialogDescription className="truncate">
                {t("pos.tableActionsDescription", { table: table.table_name })}
              </DialogDescription>
            </DialogHeader>
            {renderBody()}
          </DialogContent>
        </Dialog>
      )}
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmDisabled={!canSubmit}
        confirmLabel={actionLabel}
        confirmPending={pending}
        confirmVariant="default"
        contentClassName="duration-200"
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
