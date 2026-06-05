"use client";

import { useEffect, useMemo, useState } from "react";
import { Map } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader,
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsRowActions,
  SettingsTableScroll,
  SettingsToolbar
} from "@/features/settings/shared/settings-shell";
import { buildZonePayload, missingZoneField, zoneId, zoneName, zoneValue } from "@/features/settings/zone/zone-utils";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { FetchZonesParams, Zone } from "@/services/zone";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useToastStore } from "@/stores/toast-store";
import { useZoneStore } from "@/stores/zone-store";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;

function ZoneIcon() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
      <Map aria-hidden />
    </span>
  );
}

function ZoneIdentity({ row }: { row: Zone }) {
  const id = zoneId(row);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <ZoneIcon />
      <div className="min-w-0">
        <p className="truncate font-black">{zoneName(row)}</p>
        {id ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground" translate="no">
            {id}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ZoneSettingsPage() {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const branchUuid = user?.branch_uuid ?? "";
  const showToast = useToastStore((state) => state.show);
  const rows = useZoneStore((state) => state.rows);
  const total = useZoneStore((state) => state.total);
  const storeTotalPages = useZoneStore((state) => state.totalPages);
  const search = useZoneStore((state) => state.search);
  const hasLoaded = useZoneStore((state) => state.hasLoaded);
  const loading = useZoneStore((state) => state.loading);
  const refreshing = useZoneStore((state) => state.refreshing);
  const saving = useZoneStore((state) => state.saving);
  const setSearch = useZoneStore((state) => state.setSearch);
  const loadRows = useZoneStore((state) => state.load);
  const saveRow = useZoneStore((state) => state.save);
  const removeRow = useZoneStore((state) => state.remove);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [limit, setLimit] = useState<PageLimit>(DEFAULT_LIMIT);
  const [orderBy, setOrderBy] = useState<SortOrder>("ASC");
  const [editing, setEditing] = useState<Zone | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Zone | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());

  const title = t("settings.modules.zone.title");
  const description = t("settings.modules.zone.description");
  const requestParams = useMemo<FetchZonesParams>(
    () => ({ search, page, limit, orderBy, lang: language, branch_uuid_fk: branchUuid }),
    [branchUuid, language, limit, orderBy, page, search]
  );
  const pageSize = limit === "All" ? rows.length || Number(DEFAULT_LIMIT) : Number(limit ?? DEFAULT_LIMIT);
  const totalPages = Math.max(1, Number(storeTotalPages || Math.ceil(total / pageSize) || 1));
  const pageStart = rows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;
  const fullLoading = loading && !hasLoaded;
  const backgroundLoading = refreshing || (loading && hasLoaded);
  const pagingBusy = loading || refreshing;
  const canGoBack = page > 1 && !pagingBusy;
  const canGoNext = page < totalPages && !pagingBusy;
  const ids = useMemo(() => rows.map(zoneId).filter(Boolean), [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedRows.has(id));

  async function load() {
    if (!branchUuid) {
      showToast({ title: t("settings.loadFailed", { title }), description: t("settings.branchRequired"), tone: "error" });
      return;
    }

    try {
      await loadRows(requestParams, { background: hasLoaded });
    } catch (error) {
      showToast({
        title: t("settings.loadFailed", { title }),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchUuid, language, page, limit, orderBy]);

  useEffect(() => {
    setSelectedRows((current) => {
      if (!current.size) return current;
      const allowed = new Set(ids);
      let changed = false;
      const next = new Set<string>();
      current.forEach((id) => {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : current;
    });
  }, [ids]);

  function applyFilters() {
    if (page === 1) void load();
    else setPage(1);
  }

  function toggleSelected(id: string, checked: boolean) {
    if (!id) return;
    setSelectedRows((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedRows(checked ? new Set(ids) : new Set());
  }

  function openCreate() {
    if (!branchUuid) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.branchRequired"), tone: "error" });
      return;
    }

    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: Zone) {
    setEditing(row);
    setDialogOpen(true);
  }

  function missingFieldDescription(field: ReturnType<typeof missingZoneField>) {
    if (field === "branch") return t("settings.branchRequired");
    if (field === "name") return t("settings.zoneNameRequired");
    return t("toasts.pleaseTryAgain");
  }

  async function save(formData: FormData) {
    const nameLa = String(formData.get("zone_name_la") ?? "").trim();
    const nameEng = String(formData.get("zone_name_eng") ?? "").trim();
    const missing = missingZoneField({ branchUuid, nameLa });

    if (missing) {
      showToast({ title: t("settings.saveFailed"), description: missingFieldDescription(missing), tone: "error" });
      return;
    }

    try {
      await saveRow(buildZonePayload({ branchUuid, editing, nameEng, nameLa }));
      showToast({ title: t("settings.saved"), tone: "success" });
      setDialogOpen(false);
      setEditing(null);
      await loadRows(requestParams, { background: true });
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function remove(row: Zone) {
    const id = zoneId(row);
    if (!id) return;

    try {
      await removeRow(id);
      showToast({ title: t("settings.deleted"), tone: "success" });
      setDeleteTarget(null);
      setSelectedRows((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      await loadRows(requestParams, { background: true });
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  const table = rows.length ? (
    <SettingsTableScroll>
      <Table className="min-w-[860px]">
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("fields.no")}</TableHead>
            <TableHead>{t("nav.zone")}</TableHead>
            <TableHead>{t("fields.zone_name_la")}</TableHead>
            <TableHead>{t("fields.zone_name_eng")}</TableHead>
            <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const id = zoneId(row);
            const name = zoneName(row);
            const selected = selectedRows.has(id);
            return (
              <TableRow key={id || index} className="h-14" data-state={selected ? "selected" : undefined}>
                <TableCell className="w-10 px-2">
                  <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onChange={(event) => toggleSelected(id, event.target.checked)} />
                </TableCell>
                <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black tabular-nums text-muted-foreground">{pageStart + index}</TableCell>
                <TableCell className="max-w-[28rem]">
                  <ZoneIdentity row={row} />
                </TableCell>
                <TableCell className="max-w-[18rem] text-muted-foreground">
                  <span className="block truncate">{zoneValue(row, "zone_name_la", "-")}</span>
                </TableCell>
                <TableCell className="max-w-[18rem] text-muted-foreground">
                  <span className="block truncate">{zoneValue(row, "zone_name_eng", "-")}</span>
                </TableCell>
                <TableCell className="text-right">
                  <SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </SettingsTableScroll>
  ) : null;

  const mobileList = rows.length ? (
    <SettingsMobileList>
      {rows.map((row, index) => {
        const id = zoneId(row);
        const name = zoneName(row);
        const selected = selectedRows.has(id);
        return (
          <SettingsMobileCard
            key={id || index}
            actions={<SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />}
            checked={selected}
            leading={<ZoneIcon />}
            selectLabel={t("common.selectRow", { name })}
            selected={selected}
            subtitle={
              id ? (
                <span className="block truncate" translate="no">
                  {id}
                </span>
              ) : undefined
            }
            title={name}
            onCheckedChange={(checked) => toggleSelected(id, checked)}
          >
            <SettingsMobileMetaGrid>
              <SettingsMobileMeta label={t("fields.zone_name_la")} value={zoneValue(row, "zone_name_la", "-")} />
              <SettingsMobileMeta label={t("fields.zone_name_eng")} value={zoneValue(row, "zone_name_eng", "-")} />
            </SettingsMobileMetaGrid>
          </SettingsMobileCard>
        );
      })}
    </SettingsMobileList>
  ) : null;

  const toolbar = (
    <SettingsToolbar
      state={{
        search,
        limit,
        orderBy,
        limitOptions: PAGE_LIMIT_OPTIONS,
        selectedCount: selectedRows.size,
        onApply: applyFilters,
        onLimit: (nextLimit) => {
          setLimit(nextLimit);
          setPage(1);
        },
        onOrder: (nextOrder) => {
          setOrderBy(nextOrder);
          setPage(1);
        },
        onSearch: setSearch
      }}
    />
  );

  const listSurface = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur sm:px-4 lg:px-5">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black">{t("settings.zoneList")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("common.showingRange", { start: pageStart, end: pageEnd, total })} - {t("common.page", { current: page, total: totalPages })}
            </p>
          </div>
          <div className="min-w-0 xl:max-w-[48rem]">{toolbar}</div>
        </div>
        {backgroundLoading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner aria-hidden />
            {t("settings.refreshingZoneList")}
          </div>
        ) : null}
      </div>
      {rows.length ? (
        <>
          <div className="hidden min-h-0 flex-1 md:flex">{table}</div>
          <div className="min-h-0 flex-1 overflow-y-auto md:hidden">{mobileList}</div>
        </>
      ) : (
        <div className="flex min-h-72 flex-1 items-center justify-center p-4">
          <Empty className="max-w-md border border-dashed bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Map aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{t("settings.noRecords", { title: title.toLowerCase() })}</EmptyTitle>
              <EmptyDescription>{t("empty.adjustSearch")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </div>
  );

  return (
    <>
      <SettingsModuleShell
        addLabel={`${t("actions.add")} ${t("nav.zone")}`}
        cardTitle={t("settings.zoneList")}
        description={description}
        emptyDescription={t("empty.adjustSearch")}
        emptyTitle={t("settings.noRecords", { title: title.toLowerCase() })}
        footer={
          rows.length ? (
            <SettingsPaginationFooter
              canGoBack={canGoBack}
              canGoNext={canGoNext}
              page={page}
              pageEnd={pageEnd}
              pageStart={pageStart}
              total={total}
              totalPages={totalPages}
              onBack={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            />
          ) : undefined
        }
        hideCardHeader
        loading={fullLoading}
        loadingLabel={t("settings.loading", { title })}
        table={listSurface}
        title={title}
        onAdd={openCreate}
      />
      <ZoneFormDialog
        branchUuid={branchUuid}
        editing={editing}
        open={dialogOpen}
        saving={saving}
        title={title}
        onOpenChange={(nextOpen) => {
          if (saving) return;
          setDialogOpen(nextOpen);
          if (!nextOpen) setEditing(null);
        }}
        onSubmit={save}
      />
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        confirmPending={saving}
        description={t("settings.deleteConfirm")}
        open={Boolean(deleteTarget)}
        title={t("actions.delete")}
        onConfirm={() => {
          if (deleteTarget) void remove(deleteTarget);
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
      />
    </>
  );
}

function ZoneFormDialog({
  branchUuid,
  editing,
  onOpenChange,
  onSubmit,
  open,
  saving,
  title
}: {
  branchUuid: string;
  editing: Zone | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
  title: string;
}) {
  const { t } = useTranslation();
  const [zoneNameLa, setZoneNameLa] = useState("");
  const [zoneNameEng, setZoneNameEng] = useState("");
  const formKey = zoneId(editing) || "new-zone";

  useEffect(() => {
    setZoneNameLa(zoneValue(editing, "zone_name_la", zoneValue(editing, "zone_name")));
    setZoneNameEng(zoneValue(editing, "zone_name_eng"));
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-2xl">
        <SettingsDialogForm key={formKey} action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
            <DialogDescription>{t("settings.zoneFormHint")}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.zoneDetails")}</FieldLegend>
                  <FieldDescription>{t("settings.zoneDetailsHint")}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="zone_name_la">{t("fields.zone_name_la")}</FieldLabel>
                    <Input
                      id="zone_name_la"
                      name="zone_name_la"
                      autoComplete="off"
                      disabled={saving}
                      required
                      value={zoneNameLa}
                      onChange={(event) => setZoneNameLa(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="zone_name_eng">{t("fields.zone_name_eng")}</FieldLabel>
                    <Input
                      id="zone_name_eng"
                      name="zone_name_eng"
                      autoComplete="off"
                      disabled={saving}
                      value={zoneNameEng}
                      onChange={(event) => setZoneNameEng(event.target.value)}
                    />
                  </Field>
                </FieldGroup>
              </FieldSet>
            </FieldGroup>
          </SettingsDialogBody>
          <input name="branch_uuid_fk" type="hidden" value={branchUuid} readOnly />
          <input name="zone_uuid" type="hidden" value={zoneId(editing)} readOnly />
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saving || !branchUuid || !zoneNameLa.trim()} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
