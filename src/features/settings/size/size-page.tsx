"use client";

import { useEffect, useMemo, useState } from "react";
import { Ruler } from "lucide-react";
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
import { buildSizePayload, missingSizeField, sizeId, sizeName, sizeValue } from "@/features/settings/size/size-utils";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { FetchSizesParams, Size } from "@/services/size";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useSizeStore } from "@/stores/size-store";
import { useToastStore } from "@/stores/toast-store";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;

function SizeIcon() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
      <Ruler aria-hidden />
    </span>
  );
}

function SizeIdentity({ row }: { row: Size }) {
  const id = sizeId(row);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <SizeIcon />
      <div className="min-w-0">
        <p className="truncate font-black">{sizeName(row)}</p>
        {id ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground" translate="no">
            {id}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function SizeSettingsPage() {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const showToast = useToastStore((state) => state.show);
  const rows = useSizeStore((state) => state.rows);
  const total = useSizeStore((state) => state.total);
  const storeTotalPages = useSizeStore((state) => state.totalPages);
  const search = useSizeStore((state) => state.search);
  const hasLoaded = useSizeStore((state) => state.hasLoaded);
  const loading = useSizeStore((state) => state.loading);
  const refreshing = useSizeStore((state) => state.refreshing);
  const saving = useSizeStore((state) => state.saving);
  const setSearch = useSizeStore((state) => state.setSearch);
  const loadRows = useSizeStore((state) => state.load);
  const saveRow = useSizeStore((state) => state.save);
  const removeRow = useSizeStore((state) => state.remove);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [limit, setLimit] = useState<PageLimit>(DEFAULT_LIMIT);
  const [orderBy, setOrderBy] = useState<SortOrder>("ASC");
  const [editing, setEditing] = useState<Size | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Size | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());

  const title = t("settings.modules.size.title");
  const description = t("settings.modules.size.description");
  const requestParams = useMemo<FetchSizesParams>(
    () => ({ search, page, limit, orderBy, lang: language, store_uuid_fk: storeUuid }),
    [language, limit, orderBy, page, search, storeUuid]
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
  const ids = useMemo(() => rows.map(sizeId).filter(Boolean), [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedRows.has(id));

  async function load() {
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
  }, [language, page, limit, orderBy, storeUuid]);

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
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: Size) {
    setEditing(row);
    setDialogOpen(true);
  }

  function missingFieldDescription(field: ReturnType<typeof missingSizeField>) {
    if (field === "name") return t("settings.sizeNameRequired");
    return t("toasts.pleaseTryAgain");
  }

  async function save(formData: FormData) {
    const nameLa = String(formData.get("size_name_la") ?? "").trim();
    const nameEng = String(formData.get("size_name_eng") ?? "").trim();
    const missing = missingSizeField({ nameLa });

    if (missing) {
      showToast({ title: t("settings.saveFailed"), description: missingFieldDescription(missing), tone: "error" });
      return;
    }

    try {
      await saveRow(buildSizePayload({ editing, nameEng, nameLa, storeUuid }));
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

  async function remove(row: Size) {
    const id = sizeId(row);
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
            <TableHead>{t("nav.size")}</TableHead>
            <TableHead>{t("fields.size_name_la")}</TableHead>
            <TableHead>{t("fields.size_name_eng")}</TableHead>
            <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const id = sizeId(row);
            const name = sizeName(row);
            const selected = selectedRows.has(id);
            return (
              <TableRow key={id || index} className="h-14" data-state={selected ? "selected" : undefined}>
                <TableCell className="w-10 px-2">
                  <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onChange={(event) => toggleSelected(id, event.target.checked)} />
                </TableCell>
                <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black tabular-nums text-muted-foreground">{pageStart + index}</TableCell>
                <TableCell className="max-w-[28rem]">
                  <SizeIdentity row={row} />
                </TableCell>
                <TableCell className="max-w-[18rem] text-muted-foreground">
                  <span className="block truncate">{sizeValue(row, "size_name_la", "-")}</span>
                </TableCell>
                <TableCell className="max-w-[18rem] text-muted-foreground">
                  <span className="block truncate">{sizeValue(row, "size_name_eng", "-")}</span>
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
        const id = sizeId(row);
        const name = sizeName(row);
        const selected = selectedRows.has(id);
        return (
          <SettingsMobileCard
            key={id || index}
            actions={<SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />}
            checked={selected}
            leading={<SizeIcon />}
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
              <SettingsMobileMeta label={t("fields.size_name_la")} value={sizeValue(row, "size_name_la", "-")} />
              <SettingsMobileMeta label={t("fields.size_name_eng")} value={sizeValue(row, "size_name_eng", "-")} />
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
            <p className="text-sm font-black">{t("settings.sizeList")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("common.showingRange", { start: pageStart, end: pageEnd, total })} - {t("common.page", { current: page, total: totalPages })}
            </p>
          </div>
          <div className="min-w-0 xl:max-w-[48rem]">{toolbar}</div>
        </div>
        {backgroundLoading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner aria-hidden />
            {t("settings.refreshingSizeList")}
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
                <Ruler aria-hidden />
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
        addLabel={`${t("actions.add")} ${t("nav.size")}`}
        cardTitle={t("settings.sizeList")}
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
      <SizeFormDialog
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

function SizeFormDialog({
  editing,
  onOpenChange,
  onSubmit,
  open,
  saving,
  title
}: {
  editing: Size | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
  title: string;
}) {
  const { t } = useTranslation();
  const [sizeNameLa, setSizeNameLa] = useState("");
  const [sizeNameEng, setSizeNameEng] = useState("");
  const formKey = sizeId(editing) || "new-size";

  useEffect(() => {
    setSizeNameLa(sizeValue(editing, "size_name_la", sizeValue(editing, "size_name")));
    setSizeNameEng(sizeValue(editing, "size_name_eng"));
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-2xl">
        <SettingsDialogForm key={formKey} action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
            <DialogDescription>{t("settings.sizeFormHint")}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.sizeDetails")}</FieldLegend>
                  <FieldDescription>{t("settings.sizeDetailsHint")}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="size_name_la">{t("fields.size_name_la")}</FieldLabel>
                    <Input
                      id="size_name_la"
                      name="size_name_la"
                      autoComplete="off"
                      disabled={saving}
                      required
                      value={sizeNameLa}
                      onChange={(event) => setSizeNameLa(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="size_name_eng">{t("fields.size_name_eng")}</FieldLabel>
                    <Input
                      id="size_name_eng"
                      name="size_name_eng"
                      autoComplete="off"
                      disabled={saving}
                      value={sizeNameEng}
                      onChange={(event) => setSizeNameEng(event.target.value)}
                    />
                  </Field>
                </FieldGroup>
              </FieldSet>
            </FieldGroup>
          </SettingsDialogBody>
          <input name="size_uuid" type="hidden" value={sizeId(editing)} readOnly />
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saving || !sizeNameLa.trim()} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
