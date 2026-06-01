"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ImageIcon, KeyRound, MapPin, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { SETTINGS, type SettingConfig } from "@/features/settings/settings-config";
import { DEFAULT_CROP, SettingsImageCropPanel, cropImageFile, type CropState } from "@/features/settings/settings-image-crop";
import {
  SettingsModuleHeader,
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsPaginationFooter,
  SettingsRowActions,
  SettingsTableScroll,
  SettingsToolbar
} from "@/features/settings/settings-shell";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import { canCreateStoreBranch, canDeleteStoreBranch, canEditStoreBranch } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useToastStore } from "@/stores/toast-store";

type EntityKind = "store" | "branch";
type Row = Record<string, unknown>;

interface StoreBranchLabels {
  active: string;
  actions: string;
  addBranch: string;
  addStore: string;
  address: string;
  branch: string;
  branchHint: string;
  branchInfo: string;
  branchList: string;
  cancel: string;
  charge: string;
  chargePercent: string;
  closed: string;
  cancelImage: string;
  cropHint: string;
  cropImage: string;
  current: string;
  delete: string;
  deleteConfirm: string;
  deleteFailed: string;
  email: string;
  general: string;
  horizontal: string;
  imageLoadFailed: string;
  imageSupport: string;
  inactive: string;
  name: string;
  nameEn: string;
  nameLa: string;
  noStore: string;
  open: string;
  phone: string;
  plc: string;
  resetFailed: string;
  resetPassword: string;
  save: string;
  saveFailed: string;
  saved: string;
  savingHint: string;
  savingTitle: string;
  selectAll: string;
  selectRecord: string;
  showing: string;
  store: string;
  storeHint: string;
  storeInfo: string;
  storeList: string;
  taxBilling: string;
  type: string;
  uploadImage: string;
  vertical: string;
  vat: string;
  vatPercent: string;
  zoom: string;
}
function useStoreBranchLabels(): StoreBranchLabels {
  const { t } = useTranslation();

  return {
    active: t("common.active"),
    actions: t("common.actions"),
    addBranch: t("settings.storeBranch.addBranch"),
    addStore: t("settings.storeBranch.addStore"),
    address: t("fields.branch_address"),
    branch: t("nav.branch"),
    branchHint: t("settings.storeBranch.branchHint"),
    branchInfo: t("settings.storeBranch.branchInfo"),
    branchList: t("settings.storeBranch.branchList"),
    cancel: t("actions.cancel"),
    charge: t("settings.storeBranch.charge"),
    chargePercent: t("settings.storeBranch.chargePercent"),
    closed: t("settings.storeBranch.closed"),
    cancelImage: t("settings.storeBranch.cancelImage"),
    cropHint: t("settings.storeBranch.cropHint"),
    cropImage: t("settings.storeBranch.cropImage"),
    current: t("settings.storeBranch.current"),
    delete: t("actions.delete"),
    deleteConfirm: t("settings.deleteConfirm"),
    deleteFailed: t("settings.deleteFailed"),
    email: t("fields.email"),
    general: t("settings.storeBranch.general"),
    horizontal: t("settings.storeBranch.horizontal"),
    imageLoadFailed: t("settings.storeBranch.imageLoadFailed"),
    imageSupport: t("settings.storeBranch.imageSupport"),
    inactive: t("common.inactive"),
    name: t("fields.name"),
    nameEn: t("fields.nameEn"),
    nameLa: t("fields.nameLa"),
    noStore: t("settings.storeBranch.noStore"),
    open: t("settings.storeBranch.open"),
    phone: t("fields.phone"),
    plc: t("settings.storeBranch.plc"),
    resetFailed: t("settings.storeBranch.resetFailed"),
    resetPassword: t("settings.storeBranch.resetPassword"),
    save: t("actions.save"),
    saveFailed: t("settings.saveFailed"),
    saved: t("settings.saved"),
    savingHint: t("settings.storeBranch.savingHint"),
    savingTitle: t("settings.storeBranch.savingTitle"),
    selectAll: t("common.selectAll"),
    selectRecord: t("settings.storeBranch.selectRecord"),
    showing: t("common.showing"),
    store: t("nav.store"),
    storeHint: t("settings.storeBranch.storeHint"),
    storeInfo: t("settings.storeBranch.storeInfo"),
    storeList: t("settings.storeBranch.storeList"),
    taxBilling: t("settings.storeBranch.taxBilling"),
    type: t("settings.storeBranch.type"),
    uploadImage: t("settings.storeBranch.uploadImage"),
    vertical: t("settings.storeBranch.vertical"),
    vat: t("settings.storeBranch.vat"),
    vatPercent: t("settings.storeBranch.vatPercent"),
    zoom: t("settings.storeBranch.zoom")
  };
}

const LIST_PAGE = 1;
const LIST_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;
const EMPTY_ROWS: Row[] = [];

function value(row: Row | null, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

function numberValue(row: Row | null, key: string, fallback = 0) {
  const raw = row?.[key];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && raw !== "" && raw !== undefined && raw !== null ? parsed : fallback;
}

function displayName(row: Row, kind: EntityKind) {
  if (kind === "store") {
    return value(row, "store_name", value(row, "store_name_la", value(row, "store_name_eng", "-")));
  }
  return value(row, "branch_name", value(row, "branch_name_la", value(row, "branch_name_eng", "-")));
}

function imageUrl(row: Row | null, kind: EntityKind) {
  if (!row) return "";
  const references = useReferenceStore.getState();
  if (kind === "store") return references.storeLogoUrl(value(row, "store_logo"));
  return references.branchQrUrl(value(row, "branch_qr"));
}

function rowId(row: Row, config: SettingConfig) {
  return value(row, config.idKey);
}

function StatusBadge({ active, labels }: { active: boolean; labels: StoreBranchLabels }) {
  return (
    <Badge className={cn(active ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground")}>
      {active ? labels.open : labels.closed}
    </Badge>
  );
}

function MediaPreview({ alt, src, kind }: { alt: string; src: string; kind: EntityKind }) {
  return (
    <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted">
      {src ? (
        <Image src={src} alt={alt} width={44} height={44} unoptimized className="size-full object-cover" />
      ) : (
        <ImageIcon className="size-4 text-muted-foreground" />
      )}
      <span className="sr-only">{kind}</span>
    </div>
  );
}

export function StoreBranchSettingsPage({ kind }: { kind: EntityKind }) {
  const { t } = useTranslation();
  const config = SETTINGS[kind];
  const language = useAppStore((state) => state.language);
  const labels = useStoreBranchLabels();
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const showToast = useToastStore((state) => state.show);
  const resetPassword = useReferenceStore((state) => state.resetPassword);
  const entity = useSettingsStore((state) => state.entities[config.slug]);
  const rows = entity?.rows ?? EMPTY_ROWS;
  const search = entity?.search ?? "";
  const loading = entity?.loading ?? false;
  const saving = entity?.saving ?? false;
  const setSearch = useSettingsStore((state) => state.setSearch);
  const loadEntity = useSettingsStore((state) => state.load);
  const saveEntity = useSettingsStore((state) => state.save);
  const removeEntity = useSettingsStore((state) => state.remove);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(LIST_PAGE);
  const [limit, setLimit] = useState<PageLimit>(LIST_LIMIT);
  const [orderBy, setOrderBy] = useState<SortOrder>("ASC");

  const canCreate = canCreateStoreBranch(user?.status);
  const canDelete = canDeleteStoreBranch(user?.status);
  const canEdit = canEditStoreBranch(user?.status);
  const scope = useMemo(() => config.scope?.(user) ?? {}, [config, user]);
  const visibleRows = useMemo(() => {
    if (kind === "store" && !canCreate) return rows.filter((row) => value(row, "store_uuid") === storeUuid);
    if (kind === "branch" && !canCreate) return rows.filter((row) => value(row, "branch_uuid") === user?.branch_uuid);
    return rows;
  }, [canCreate, kind, rows, storeUuid, user?.branch_uuid]);
  const activeId = kind === "store" ? storeUuid : user?.branch_uuid;
  const title = kind === "store" ? labels.store : labels.branch;
  const description = kind === "store" ? labels.storeHint : labels.branchHint;
  const requestParams = useMemo(
    () => ({ page, limit, orderBy, lang: language, search, ...scope }),
    [language, limit, orderBy, page, scope, search]
  );
  const total = Number(entity?.total ?? visibleRows.length);
  const totalPages = Math.max(1, Number(entity?.totalPages ?? 1));
  const pageStart = visibleRows.length ? (page - 1) * (Number(limit) || visibleRows.length) + 1 : 0;
  const pageEnd = visibleRows.length ? pageStart + visibleRows.length - 1 : 0;
  const canGoBack = page > 1 && !loading;
  const canGoNext = page < totalPages && !loading;
  const visibleIds = useMemo(() => visibleRows.map((row) => rowId(row, config)).filter(Boolean), [config, visibleRows]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedRows.has(id));

  useEffect(() => {
    setSelectedRows((current) => {
      if (!current.size) return current;
      const allowed = new Set(visibleIds);
      let changed = false;
      const next = new Set<string>();
      current.forEach((id) => {
        if (allowed.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [visibleIds]);

  async function load() {
    try {
      await loadEntity(config, requestParams);
    } catch (error) {
      showToast({
        title: t("settings.loadFailed", { title }),
        description: error instanceof Error ? error.message : undefined,
        tone: "error"
      });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.slug, language, JSON.stringify(scope), page, limit, orderBy]);

  function resetForm() {
    setEditing(null);
    setDialogOpen(false);
  }

  function openCreateForm() {
    if (!canCreate) return;
    setEditing(null);
    setDialogOpen(true);
  }

  function openEditForm(row: Row) {
    if (!canEdit) return;
    setEditing(row);
    setDialogOpen(true);
  }

  function applyFilters() {
    if (page === 1) {
      void load();
    } else {
      setPage(1);
    }
  }

  function goBack() {
    setPage((current) => Math.max(1, current - 1));
  }

  function goNext() {
    setPage((current) => Math.min(totalPages, current + 1));
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedRows((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function toggleAllSelected(checked: boolean) {
    setSelectedRows(checked ? new Set(visibleIds) : new Set());
  }

  async function handleSave(formData: FormData) {
    const input: Row = { ...scope };
    const id = editing ? rowId(editing, config) : "";
    if (!id && !canCreate) return;
    if (id && !canEdit) return;
    if (id) input[config.idKey] = id;

    if (kind === "store") {
      input.store_name_la = formData.get("store_name_la") ?? "";
      input.store_name_eng = formData.get("store_name_eng") ?? "";
      input.store_email = formData.get("store_email") ?? "";
      input.store_status = Number(formData.get("store_status") ?? 2);
      input.store_active = Number(formData.get("store_active") ?? 1);
      const logo = formData.get("store_logo");
      if (logo instanceof File && logo.size) input.store_logo = logo;
    } else {
      input.branch_name = formData.get("branch_name") ?? "";
      input.branch_tel = formData.get("branch_tel") ?? "";
      input.branch_email = formData.get("branch_email") ?? "";
      input.branch_address = formData.get("branch_address") ?? "";
      input.vat_status = Number(formData.get("vat_status") ?? 2);
      input.vat_name = Number(formData.get("vat_name") ?? 0);
      input.charge_status = Number(formData.get("charge_status") ?? 2);
      input.charge_name = Number(formData.get("charge_name") ?? 0);
      const qr = formData.get("branch_qr");
      if (qr instanceof File && qr.size) input.branch_qr = qr;
    }

    try {
      await saveEntity(config, input);
      const nextRows = await loadEntity(config, requestParams);
      const updated = id ? nextRows.find((row) => rowId(row, config) === id) : null;
      if (updated && kind === "store" && id === storeUuid) {
        updateUser({
          store_logo: value(updated, "store_logo"),
          store_name: displayName(updated, "store")
        });
      }
      if (updated && kind === "branch" && id === user?.branch_uuid) {
        updateUser({
          branch_address: value(updated, "branch_address"),
          branch_name: displayName(updated, "branch"),
          branch_tel: value(updated, "branch_tel")
        });
      }
      showToast({ title: labels.saved, tone: "success" });
      resetForm();
    } catch (error) {
      showToast({
        title: labels.saveFailed,
        description: error instanceof Error ? error.message : undefined,
        tone: "error"
      });
    }
  }

  async function handleDelete(row: Row) {
    const id = rowId(row, config);
    if (!canDelete || !id || id === activeId) return;
    try {
      await removeEntity(config, id);
      if (editing && rowId(editing, config) === id) resetForm();
      setDeleteTarget(null);
      setSelectedRows((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    } catch (error) {
      showToast({
        title: labels.deleteFailed,
        description: error instanceof Error ? error.message : undefined,
        tone: "error"
      });
    }
  }

  async function handleResetPassword(row: Row) {
    const email = value(row, "store_email");
    if (!email) return;
    try {
      await resetPassword(email);
      showToast({ title: labels.resetPassword, tone: "success" });
    } catch (error) {
      showToast({
        title: labels.resetFailed,
        description: error instanceof Error ? error.message : undefined,
        tone: "error"
      });
    }
  }

  const mobileList = visibleRows.length ? (
    <SettingsMobileList>
      {visibleRows.map((row, rowIndex) => {
        const id = rowId(row, config);
        const isCurrent = id === activeId;
        const active = kind === "store" ? numberValue(row, "store_active", 1) === 1 : true;
        const selected = selectedRows.has(id);
        const rowNumber = pageStart + rowIndex;
        const name = displayName(row, kind);
        return (
          <SettingsMobileCard
            key={id || rowIndex}
            actions={
              <SettingsRowActions
                row={row}
                editDisabled={!canEdit}
                deleteDisabled={!canDelete || isCurrent}
                actions={
                  kind === "store"
                    ? [
                        {
                          label: labels.resetPassword,
                          icon: <KeyRound />,
                          disabled: !canEdit,
                          onSelect: (nextRow) => void handleResetPassword(nextRow)
                        }
                      ]
                    : undefined
                }
                onEdit={openEditForm}
                onDelete={setDeleteTarget}
              />
            }
            badges={
              <>
                <Badge className="shrink-0">{rowNumber}</Badge>
                {isCurrent ? <Badge className="border-primary/25 bg-primary/10 text-primary">{labels.current}</Badge> : null}
                <StatusBadge active={active} labels={labels} />
              </>
            }
            checked={selected}
            leading={<MediaPreview alt={name} kind={kind} src={imageUrl(row, kind)} />}
            selectLabel={t("common.selectRow", { name })}
            selected={selected}
            subtitle={<span className="block truncate">{kind === "branch" ? value(row, "branch_tel", "-") : value(row, "store_email", "-")}</span>}
            title={name}
            onCheckedChange={(checked) => toggleSelected(id, checked)}
          >
            <SettingsMobileMetaGrid>
              <SettingsMobileMeta label={labels.email} value={kind === "store" ? value(row, "store_email", "-") : value(row, "branch_email", "-")} />
              {kind === "store" ? (
                <SettingsMobileMeta label={labels.type} value={numberValue(row, "store_status", 2) === 1 ? labels.plc : labels.general} />
              ) : (
                <SettingsMobileMeta label={labels.address} value={value(row, "branch_address", "-")} />
              )}
              <SettingsMobileMeta label={labels.active} value={active ? labels.open : labels.closed} />
            </SettingsMobileMetaGrid>
          </SettingsMobileCard>
        );
      })}
    </SettingsMobileList>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <SettingsModuleHeader
        addLabel={kind === "store" ? labels.addStore : labels.addBranch}
        description={description}
        title={title}
        onAdd={canCreate ? openCreateForm : undefined}
      />

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-b-0">
        <CardHeader className="flex shrink-0 flex-col items-stretch justify-start gap-3 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-5">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="min-w-0">
              <CardTitle>{kind === "store" ? labels.storeList : labels.branchList}</CardTitle>
            </div>
          </div>
          <div className="min-w-0">
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
                onSearch: (nextSearch) => setSearch(config.slug, nextSearch)
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {loading ? (
            <div className="min-h-0 flex-1 p-4">
              <LoadingState variant="table" />
            </div>
          ) : visibleRows.length ? (
            <>
              <div className="hidden min-h-0 flex-1 md:flex">
                <SettingsTableScroll>
                  <Table className="min-w-[940px]">
                  <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                    <TableRow>
                    <TableHead className="w-10 px-2">
                      <Checkbox
                        aria-label={labels.selectAll}
                        checked={allSelected}
                        onChange={(event) => toggleAllSelected(event.target.checked)}
                      />
                    </TableHead>
                    <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("fields.no")}</TableHead>
                    <TableHead>{kind === "store" ? labels.store : labels.branch}</TableHead>
                    <TableHead>{labels.email}</TableHead>
                    <TableHead>{labels.type}</TableHead>
                    <TableHead>{labels.active}</TableHead>
                    <TableHead className="w-16 text-right">{labels.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row, rowIndex) => {
                    const id = rowId(row, config);
                    const isCurrent = id === activeId;
                    const active = kind === "store" ? numberValue(row, "store_active", 1) === 1 : true;
                    const selected = selectedRows.has(id);
                    const rowNumber = pageStart + rowIndex;

                    return (
                      <TableRow key={id} data-state={selected ? "selected" : undefined}>
                        <TableCell className="w-10 px-2">
                          <Checkbox
                            aria-label={`${labels.selectAll} ${displayName(row, kind)}`}
                            checked={selected}
                            onChange={(event) => toggleSelected(id, event.target.checked)}
                          />
                        </TableCell>
                        <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black text-muted-foreground">
                          {rowNumber}
                        </TableCell>
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-3">
                            <MediaPreview alt={displayName(row, kind)} kind={kind} src={imageUrl(row, kind)} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate font-black">{displayName(row, kind)}</p>
                                {isCurrent ? <Badge className="border-primary/25 bg-primary/10 text-primary">{labels.current}</Badge> : null}
                              </div>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {kind === "branch" ? value(row, "branch_tel", "-") : value(row, "store_email", "-")}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{kind === "store" ? value(row, "store_email", "-") : value(row, "branch_email", "-")}</TableCell>
                        <TableCell>
                          {kind === "store" ? (
                            <Badge>{numberValue(row, "store_status", 2) === 1 ? labels.plc : labels.general}</Badge>
                          ) : (
                            <span className="inline-flex max-w-[18rem] items-center gap-1 truncate text-muted-foreground">
                              <MapPin className="size-3.5 shrink-0" />
                              <span className="truncate">{value(row, "branch_address", "-")}</span>
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge active={active} labels={labels} />
                        </TableCell>
                        <TableCell className="text-right">
                          <SettingsRowActions
                            row={row}
                            editDisabled={!canEdit}
                            deleteDisabled={!canDelete || isCurrent}
                            actions={
                              kind === "store"
                                ? [
                                    {
                                      label: labels.resetPassword,
                                      icon: <KeyRound />,
                                      disabled: !canEdit,
                                      onSelect: (nextRow) => void handleResetPassword(nextRow)
                                    }
                                  ]
                                : undefined
                            }
                            onEdit={openEditForm}
                            onDelete={setDeleteTarget}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  </TableBody>
                </Table>
                </SettingsTableScroll>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto md:hidden">{mobileList}</div>
              <SettingsPaginationFooter
                canGoBack={canGoBack}
                canGoNext={canGoNext}
                page={page}
                pageEnd={pageEnd}
                pageStart={pageStart}
                total={total}
                totalPages={totalPages}
                onBack={goBack}
                onNext={goNext}
              />
            </>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center p-4">
              <EmptyState title={kind === "store" ? labels.noStore : labels.branchList} description={labels.selectRecord} />
            </div>
          )}
        </CardContent>
      </Card>

      <EntityFormDialog
        canEdit={canEdit}
        editing={editing}
        kind={kind}
        labels={labels}
        open={dialogOpen}
        saving={saving}
        onCancel={resetForm}
        onSubmit={handleSave}
      />
      <ConfirmDialog
        cancelLabel={labels.cancel}
        confirmLabel={labels.delete}
        description={labels.deleteConfirm}
        open={Boolean(deleteTarget)}
        title={labels.delete}
        onConfirm={() => {
          if (deleteTarget) void handleDelete(deleteTarget);
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function EntityFormDialog({
  canEdit,
  editing,
  kind,
  labels,
  onCancel,
  onSubmit,
  open,
  saving
}: {
  canEdit: boolean;
  editing: Row | null;
  kind: EntityKind;
  labels: StoreBranchLabels;
  onCancel: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !saving) onCancel();
      }}
    >
      <DialogContent
        className="!flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-5xl"
        showCloseButton={!saving}
      >
        <DialogHeader className="border-b border-border px-4 py-3 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
              {editing ? <CheckCircle2 className="size-4" /> : <Plus className="size-4" />}
            </span>
            {kind === "store" ? labels.storeInfo : labels.branchInfo}
          </DialogTitle>
          <DialogDescription>{editing ? displayName(editing, kind) : labels.selectRecord}</DialogDescription>
        </DialogHeader>
        <EntityForm
          canEdit={canEdit}
          editing={editing}
          kind={kind}
          labels={labels}
          saving={saving}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
        {saving ? <FormSavingOverlay labels={labels} onCancel={onCancel} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function FormSavingOverlay({ labels, onCancel }: { labels: StoreBranchLabels; onCancel: () => void }) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-background/90 p-4 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center shadow-xl">
        <div className="grid size-10 place-items-center rounded-lg bg-muted text-primary">
          <Spinner className="size-5" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-base font-black">{labels.savingTitle}</p>
          <p className="text-sm leading-6 text-muted-foreground">{labels.savingHint}</p>
        </div>
        <Button type="button" variant="outline" onClick={onCancel}>
          {labels.cancel}
        </Button>
      </div>
    </div>
  );
}

function FormSelectField({
  disabled,
  id,
  label,
  name,
  onValueChange,
  options,
  value: currentValue
}: {
  disabled?: boolean;
  id: string;
  label: string;
  name: string;
  onValueChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input name={name} type="hidden" value={currentValue} />
      <Select disabled={disabled} value={currentValue} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function EntityForm({
  canEdit,
  editing,
  kind,
  labels,
  onCancel,
  onSubmit,
  saving
}: {
  canEdit: boolean;
  editing: Row | null;
  kind: EntityKind;
  labels: StoreBranchLabels;
  onCancel: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
  saving: boolean;
}) {
  const recordKey = `${kind}-${editing ? value(editing, `${kind}_uuid`) : "new"}`;
  const imageFieldName = kind === "store" ? "store_logo" : "branch_qr";
  const disabled = !canEdit || saving;
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [storeStatus, setStoreStatus] = useState(() => String(numberValue(editing, "store_status", 2)));
  const [storeActive, setStoreActive] = useState(() => String(numberValue(editing, "store_active", 1)));
  const [vatStatus, setVatStatus] = useState(() => String(numberValue(editing, "vat_status", 2)));
  const [chargeStatus, setChargeStatus] = useState(() => String(numberValue(editing, "charge_status", 2)));
  const formHint = kind === "store" ? labels.storeHint : labels.branchHint;

  useEffect(() => {
    setSelectedImage(null);
    setCrop(DEFAULT_CROP);
    setStoreStatus(String(numberValue(editing, "store_status", 2)));
    setStoreActive(String(numberValue(editing, "store_active", 1)));
    setVatStatus(String(numberValue(editing, "vat_status", 2)));
    setChargeStatus(String(numberValue(editing, "charge_status", 2)));
  }, [editing, recordKey]);

  async function handleSubmit(formData: FormData) {
    if (selectedImage) {
      const croppedFile = await cropImageFile(selectedImage, crop, labels.imageLoadFailed);
      formData.set(imageFieldName, croppedFile);
    }

    await onSubmit(formData);
  }

  return (
    <form
      key={recordKey}
      action={handleSubmit}
      className="flex min-h-0 flex-auto flex-col overflow-hidden sm:max-h-[calc(100dvh-7rem)]"
    >
      <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[21rem_minmax(0,1fr)] lg:overflow-hidden">
        <SettingsImageCropPanel
          crop={crop}
          className="shrink-0 lg:overflow-y-auto"
          description={labels.cropHint}
          disabled={!canEdit}
          emptyLabel={kind === "store" ? labels.store : labels.branch}
          existingSrc={imageUrl(editing, kind)}
          fileSupportText={labels.imageSupport}
          fieldId={`${recordKey}-${imageFieldName}`}
          horizontalLabel={labels.horizontal}
          previewMaxClassName="max-w-[10rem] sm:max-w-56 lg:max-w-none"
          removeLabel={labels.cancelImage}
          saving={saving}
          selectedFile={selectedImage}
          sideBorderAt="lg"
          title={labels.cropImage}
          uploadLabel={labels.uploadImage}
          verticalLabel={labels.vertical}
          zoomLabel={labels.zoom}
          onCropChange={setCrop}
          onFileChange={setSelectedImage}
        />

        <div className="min-h-0 p-4 lg:overflow-y-auto">
          <div className="flex flex-col gap-4 pb-1">
            <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <FieldLegend className="mb-1 text-sm font-black">{labels.general}</FieldLegend>
                  <FieldDescription className="text-xs">{formHint}</FieldDescription>
                </div>
                <Badge>{kind === "store" ? labels.store : labels.branch}</Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {kind === "branch" ? (
                  <Field className="gap-2 md:col-span-2">
                    <FieldLabel htmlFor={`${recordKey}-branch-name`}>{labels.name}</FieldLabel>
                    <Input
                      id={`${recordKey}-branch-name`}
                      disabled={disabled}
                      name="branch_name"
                      defaultValue={value(editing, "branch_name")}
                      required
                    />
                  </Field>
                ) : (
                  <>
                    <Field className="gap-2">
                      <FieldLabel htmlFor={`${recordKey}-name-la`}>{labels.nameLa}</FieldLabel>
                      <Input
                        id={`${recordKey}-name-la`}
                        disabled={disabled}
                        name="store_name_la"
                        defaultValue={value(editing, "store_name_la", value(editing, "store_name"))}
                        required
                      />
                    </Field>
                    <Field className="gap-2">
                      <FieldLabel htmlFor={`${recordKey}-name-en`}>{labels.nameEn}</FieldLabel>
                      <Input
                        id={`${recordKey}-name-en`}
                        disabled={disabled}
                        name="store_name_eng"
                        defaultValue={value(editing, "store_name_eng")}
                      />
                    </Field>
                  </>
                )}
                <Field className="gap-2">
                  <FieldLabel htmlFor={`${recordKey}-email`}>{labels.email}</FieldLabel>
                  <Input
                    id={`${recordKey}-email`}
                    disabled={disabled}
                    name={`${kind}_email`}
                    type="email"
                    defaultValue={value(editing, `${kind}_email`)}
                    placeholder="abc@gmail.com"
                    required={kind === "store"}
                  />
                </Field>

                {kind === "branch" ? (
                  <Field className="gap-2">
                    <FieldLabel htmlFor={`${recordKey}-phone`}>{labels.phone}</FieldLabel>
                    <Input
                      id={`${recordKey}-phone`}
                      disabled={disabled}
                      name="branch_tel"
                      defaultValue={value(editing, "branch_tel")}
                    />
                  </Field>
                ) : (
                  <FormSelectField
                    disabled={disabled}
                    id={`${recordKey}-store-status`}
                    label={labels.type}
                    name="store_status"
                    value={storeStatus}
                    onValueChange={setStoreStatus}
                    options={[
                      { label: labels.plc, value: "1" },
                      { label: labels.general, value: "2" }
                    ]}
                  />
                )}

                {kind === "store" ? (
                  <FormSelectField
                    disabled={disabled}
                    id={`${recordKey}-store-active`}
                    label={labels.active}
                    name="store_active"
                    value={storeActive}
                    onValueChange={setStoreActive}
                    options={[
                      { label: labels.open, value: "1" },
                      { label: labels.closed, value: "2" }
                    ]}
                  />
                ) : null}
              </div>
            </FieldSet>

            {kind === "branch" ? (
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <FieldLegend className="mb-0 text-sm font-black">{labels.taxBilling}</FieldLegend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field className="gap-2 sm:col-span-2">
                    <FieldLabel htmlFor={`${recordKey}-address`}>{labels.address}</FieldLabel>
                    <Textarea
                      id={`${recordKey}-address`}
                      disabled={disabled}
                      name="branch_address"
                      defaultValue={value(editing, "branch_address")}
                    />
                  </Field>
                  <FormSelectField
                    disabled={disabled}
                    id={`${recordKey}-vat-status`}
                    label={labels.vat}
                    name="vat_status"
                    value={vatStatus}
                    onValueChange={setVatStatus}
                    options={[
                      { label: labels.active, value: "1" },
                      { label: labels.inactive, value: "2" }
                    ]}
                  />
                  <Field className="gap-2">
                    <FieldLabel htmlFor={`${recordKey}-vat-percent`}>{labels.vatPercent}</FieldLabel>
                    <Input
                      id={`${recordKey}-vat-percent`}
                      disabled={disabled}
                      name="vat_name"
                      type="number"
                      defaultValue={value(editing, "vat_name", "0")}
                    />
                  </Field>
                  <FormSelectField
                    disabled={disabled}
                    id={`${recordKey}-charge-status`}
                    label={labels.charge}
                    name="charge_status"
                    value={chargeStatus}
                    onValueChange={setChargeStatus}
                    options={[
                      { label: labels.active, value: "1" },
                      { label: labels.inactive, value: "2" }
                    ]}
                  />
                  <Field className="gap-2">
                    <FieldLabel htmlFor={`${recordKey}-charge-percent`}>{labels.chargePercent}</FieldLabel>
                    <Input
                      id={`${recordKey}-charge-percent`}
                      disabled={disabled}
                      name="charge_name"
                      type="number"
                      defaultValue={value(editing, "charge_name", "0")}
                    />
                  </Field>
                </div>
              </FieldSet>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-card/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
        <Button disabled={saving} type="button" variant="outline" onClick={onCancel}>
          {labels.cancel}
        </Button>
        <Button disabled={disabled} type="submit">
          {labels.save}
        </Button>
      </div>
    </form>
  );
}
