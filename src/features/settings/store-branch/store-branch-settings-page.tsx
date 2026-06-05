"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { Building2, CheckCircle2, KeyRound, MapPin, Plus, QrCode, Store } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { SETTINGS } from "@/features/settings/shared/settings-config";
import { DEFAULT_CROP, SettingsImageCropPanel, cropImageFile, type CropState } from "@/features/settings/shared/settings-image-crop";
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
import {
  branchChargeSummary,
  branchVatSummary,
  buildBranchPayload,
  buildStorePayload,
  isStoreActive,
  isStorePlc,
  missingBranchField,
  missingStoreField,
  storeBranchId,
  storeBranchMediaKey,
  storeBranchName,
  storeBranchNumber,
  storeBranchValue,
  type StoreBranchKind
} from "@/features/settings/store-branch/store-branch-utils";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import { canCreateStoreBranch, canDeleteStoreBranch, canEditStoreBranch } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useToastStore } from "@/stores/toast-store";

type Row = Record<string, unknown>;

interface StoreBranchLabels {
  active: string;
  actions: string;
  addBranch: string;
  addStore: string;
  address: string;
  branch: string;
  branchDetails: string;
  branchHint: string;
  branchInfo: string;
  branchList: string;
  branchNameRequired: string;
  cancel: string;
  cancelImage: string;
  charge: string;
  chargePercent: string;
  closed: string;
  contactDetails: string;
  contactHint: string;
  cropHint: string;
  cropImage: string;
  current: string;
  delete: string;
  deleteConfirm: string;
  deleteFailed: string;
  email: string;
  emailPlaceholder: string;
  general: string;
  horizontal: string;
  imageLoadFailed: string;
  imageSupport: string;
  inactive: string;
  name: string;
  nameEn: string;
  nameLa: string;
  noBranch: string;
  noStore: string;
  open: string;
  phone: string;
  plc: string;
  refreshBranch: string;
  refreshStore: string;
  resetFailed: string;
  resetPassword: string;
  save: string;
  saveFailed: string;
  saved: string;
  savingHint: string;
  savingTitle: string;
  selectAll: string;
  selectRecord: string;
  store: string;
  storeDetails: string;
  storeEmailRequired: string;
  storeHint: string;
  storeInfo: string;
  storeList: string;
  storeNameRequired: string;
  storeRequired: string;
  taxBilling: string;
  taxBillingHint: string;
  type: string;
  uploadImage: string;
  vertical: string;
  vat: string;
  vatPercent: string;
  zoom: string;
}

const LIST_PAGE = 1;
const LIST_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;
const EMPTY_ROWS: Row[] = [];

function useStoreBranchLabels(): StoreBranchLabels {
  const { t } = useTranslation();

  return {
    active: t("common.active"),
    actions: t("common.actions"),
    addBranch: t("settings.storeBranch.addBranch"),
    addStore: t("settings.storeBranch.addStore"),
    address: t("fields.branch_address"),
    branch: t("nav.branch"),
    branchDetails: t("settings.storeBranch.branchDetails"),
    branchHint: t("settings.storeBranch.branchHint"),
    branchInfo: t("settings.storeBranch.branchInfo"),
    branchList: t("settings.storeBranch.branchList"),
    branchNameRequired: t("settings.storeBranch.branchNameRequired"),
    cancel: t("actions.cancel"),
    cancelImage: t("settings.storeBranch.cancelImage"),
    charge: t("settings.storeBranch.charge"),
    chargePercent: t("settings.storeBranch.chargePercent"),
    closed: t("settings.storeBranch.closed"),
    contactDetails: t("settings.storeBranch.contactDetails"),
    contactHint: t("settings.storeBranch.contactHint"),
    cropHint: t("settings.storeBranch.cropHint"),
    cropImage: t("settings.storeBranch.cropImage"),
    current: t("settings.storeBranch.current"),
    delete: t("actions.delete"),
    deleteConfirm: t("settings.deleteConfirm"),
    deleteFailed: t("settings.deleteFailed"),
    email: t("fields.email"),
    emailPlaceholder: t("settings.emailPlaceholder"),
    general: t("settings.storeBranch.general"),
    horizontal: t("settings.storeBranch.horizontal"),
    imageLoadFailed: t("settings.storeBranch.imageLoadFailed"),
    imageSupport: t("settings.storeBranch.imageSupport"),
    inactive: t("common.inactive"),
    name: t("fields.name"),
    nameEn: t("fields.nameEn"),
    nameLa: t("fields.nameLa"),
    noBranch: t("settings.storeBranch.noBranch"),
    noStore: t("settings.storeBranch.noStore"),
    open: t("settings.storeBranch.open"),
    phone: t("fields.phone"),
    plc: t("settings.storeBranch.plc"),
    refreshBranch: t("settings.storeBranch.refreshingBranchList"),
    refreshStore: t("settings.storeBranch.refreshingStoreList"),
    resetFailed: t("settings.storeBranch.resetFailed"),
    resetPassword: t("settings.storeBranch.resetPassword"),
    save: t("actions.save"),
    saveFailed: t("settings.saveFailed"),
    saved: t("settings.saved"),
    savingHint: t("settings.storeBranch.savingHint"),
    savingTitle: t("settings.storeBranch.savingTitle"),
    selectAll: t("common.selectAll"),
    selectRecord: t("settings.storeBranch.selectRecord"),
    store: t("nav.store"),
    storeDetails: t("settings.storeBranch.storeDetails"),
    storeEmailRequired: t("settings.storeBranch.storeEmailRequired"),
    storeHint: t("settings.storeBranch.storeHint"),
    storeInfo: t("settings.storeBranch.storeInfo"),
    storeList: t("settings.storeBranch.storeList"),
    storeNameRequired: t("settings.storeBranch.storeNameRequired"),
    storeRequired: t("settings.storeRequired"),
    taxBilling: t("settings.storeBranch.taxBilling"),
    taxBillingHint: t("settings.storeBranch.taxBillingHint"),
    type: t("settings.storeBranch.type"),
    uploadImage: t("settings.storeBranch.uploadImage"),
    vertical: t("settings.storeBranch.vertical"),
    vat: t("settings.storeBranch.vat"),
    vatPercent: t("settings.storeBranch.vatPercent"),
    zoom: t("settings.storeBranch.zoom")
  };
}

function StatusBadge({ active, labels }: { active: boolean; labels: StoreBranchLabels }) {
  return (
    <Badge className={cn(active ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground")}>
      {active ? labels.open : labels.closed}
    </Badge>
  );
}

function StoreTypeBadge({ labels, row }: { labels: StoreBranchLabels; row: Row }) {
  return <Badge>{isStorePlc(row) ? labels.plc : labels.general}</Badge>;
}

function SummaryBadge({
  active,
  activeLabel,
  inactiveLabel,
  label,
  percentLabel
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  label: string;
  percentLabel: string;
}) {
  return (
    <Badge className={cn("max-w-full justify-start gap-1", active ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground")}>
      <span className="truncate">{label}</span>
      <span className="tabular-nums" translate="no">
        {active ? activeLabel : inactiveLabel} / {percentLabel}
      </span>
    </Badge>
  );
}

function BranchTaxBadges({ labels, row }: { labels: StoreBranchLabels; row: Row }) {
  const vat = branchVatSummary(row);
  const charge = branchChargeSummary(row);

  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <SummaryBadge active={vat.active} activeLabel={labels.active} inactiveLabel={labels.inactive} label={labels.vat} percentLabel={vat.percentLabel} />
      <SummaryBadge
        active={charge.active}
        activeLabel={labels.active}
        inactiveLabel={labels.inactive}
        label={labels.charge}
        percentLabel={charge.percentLabel}
      />
    </div>
  );
}

function MediaPreview({ alt, src, kind }: { alt: string; src: string; kind: StoreBranchKind }) {
  return (
    <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted">
      {src ? (
        <Image src={src} alt={alt} width={44} height={44} unoptimized className="size-full object-cover" />
      ) : kind === "store" ? (
        <Store aria-hidden className="size-4 text-muted-foreground" />
      ) : (
        <QrCode aria-hidden className="size-4 text-muted-foreground" />
      )}
    </div>
  );
}

function EntityIdentity({
  activeId,
  imageUrl,
  kind,
  labels,
  row
}: {
  activeId?: string;
  imageUrl: (row: Row, kind: StoreBranchKind) => string;
  kind: StoreBranchKind;
  labels: StoreBranchLabels;
  row: Row;
}) {
  const id = storeBranchId(row, kind);
  const name = storeBranchName(row, kind);
  const subtitle = kind === "store" ? storeBranchValue(row, "store_email", "-") : storeBranchValue(row, "branch_tel", "-");

  return (
    <div className="flex min-w-0 items-center gap-3">
      <MediaPreview alt={name} kind={kind} src={imageUrl(row, kind)} />
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="min-w-0 truncate font-black">{name}</p>
          {id && id === activeId ? <Badge className="border-primary/25 bg-primary/10 text-primary">{labels.current}</Badge> : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground" translate="no">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

export function StoreBranchSettingsPage({ kind }: { kind: StoreBranchKind }) {
  const { t } = useTranslation();
  const config = SETTINGS[kind];
  const language = useAppStore((state) => state.language);
  const labels = useStoreBranchLabels();
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const showToast = useToastStore((state) => state.show);
  const resetPassword = useReferenceStore((state) => state.resetPassword);
  const storeLogoUrl = useReferenceStore((state) => state.storeLogoUrl);
  const branchQrUrl = useReferenceStore((state) => state.branchQrUrl);
  const entity = useSettingsStore((state) => state.entities[config.slug]);
  const rows = entity?.rows ?? EMPTY_ROWS;
  const search = entity?.search ?? "";
  const hasLoaded = entity?.hasLoaded ?? false;
  const loading = entity?.loading ?? false;
  const refreshing = entity?.refreshing ?? false;
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
  const scopeKey = useMemo(() => JSON.stringify(scope), [scope]);
  const visibleRows = useMemo(() => {
    if (kind === "store" && !canCreate) return rows.filter((row) => storeBranchValue(row, "store_uuid") === storeUuid);
    if (kind === "branch" && !canCreate) return rows.filter((row) => storeBranchValue(row, "branch_uuid") === user?.branch_uuid);
    return rows;
  }, [canCreate, kind, rows, storeUuid, user?.branch_uuid]);
  const activeId = kind === "store" ? storeUuid : user?.branch_uuid;
  const title = kind === "store" ? labels.store : labels.branch;
  const description = kind === "store" ? labels.storeHint : labels.branchHint;
  const listTitle = kind === "store" ? labels.storeList : labels.branchList;
  const requestParams = useMemo(
    () => ({ page, limit, orderBy, lang: language, search, ...scope }),
    [language, limit, orderBy, page, scope, search]
  );
  const pageSize = limit === "All" ? visibleRows.length || Number(LIST_LIMIT) : Number(limit ?? LIST_LIMIT);
  const total = canCreate ? Number(entity?.total ?? visibleRows.length) : visibleRows.length;
  const totalPages = canCreate ? Math.max(1, Number(entity?.totalPages || Math.ceil(total / pageSize) || 1)) : 1;
  const pageStart = visibleRows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = visibleRows.length ? pageStart + visibleRows.length - 1 : 0;
  const fullLoading = loading && !hasLoaded;
  const backgroundLoading = refreshing || (loading && hasLoaded);
  const pagingBusy = loading || refreshing;
  const canGoBack = page > 1 && !pagingBusy;
  const canGoNext = page < totalPages && !pagingBusy;
  const visibleIds = useMemo(() => visibleRows.map((row) => storeBranchId(row, kind)).filter(Boolean), [kind, visibleRows]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedRows.has(id));
  const imageUrl = useMemo(
    () => (row: Row, rowKind: StoreBranchKind) => {
      const key = storeBranchMediaKey(row, rowKind);
      if (!key) return "";
      return rowKind === "store" ? storeLogoUrl(key) : branchQrUrl(key);
    },
    [branchQrUrl, storeLogoUrl]
  );

  useEffect(() => {
    setSelectedRows((current) => {
      if (!current.size) return current;
      const allowed = new Set(visibleIds);
      let changed = false;
      const next = new Set<string>();
      current.forEach((id) => {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : current;
    });
  }, [visibleIds]);

  async function load(background = hasLoaded) {
    try {
      await loadEntity(config, requestParams, { background });
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
  }, [config.slug, language, scopeKey, page, limit, orderBy]);

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
    if (page === 1) void load(true);
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

  function toggleAllSelected(checked: boolean) {
    setSelectedRows(checked ? new Set(visibleIds) : new Set());
  }

  function missingFieldDescription(field: ReturnType<typeof missingStoreField> | ReturnType<typeof missingBranchField>) {
    if (field === "store") return labels.storeRequired;
    if (field === "email") return labels.storeEmailRequired;
    if (field === "name") return kind === "store" ? labels.storeNameRequired : labels.branchNameRequired;
    return t("toasts.pleaseTryAgain");
  }

  async function handleSave(formData: FormData) {
    const id = editing ? storeBranchId(editing, kind) : "";
    if (!id && !canCreate) return;
    if (id && !canEdit) return;

    const logo = formData.get("store_logo");
    const qr = formData.get("branch_qr");
    const input =
      kind === "store"
        ? buildStorePayload({
            active: String(formData.get("store_active") ?? "1"),
            editing,
            email: String(formData.get("store_email") ?? ""),
            logo: logo instanceof File && logo.size ? logo : null,
            nameEng: String(formData.get("store_name_eng") ?? ""),
            nameLa: String(formData.get("store_name_la") ?? ""),
            status: String(formData.get("store_status") ?? "2")
          })
        : buildBranchPayload({
            address: String(formData.get("branch_address") ?? ""),
            chargePercent: String(formData.get("charge_name") ?? ""),
            chargeStatus: String(formData.get("charge_status") ?? "2"),
            editing,
            email: String(formData.get("branch_email") ?? ""),
            name: String(formData.get("branch_name") ?? ""),
            qr: qr instanceof File && qr.size ? qr : null,
            storeUuid: storeUuid,
            tel: String(formData.get("branch_tel") ?? ""),
            vatPercent: String(formData.get("vat_name") ?? ""),
            vatStatus: String(formData.get("vat_status") ?? "2")
          });
    const missing =
      kind === "store"
        ? missingStoreField({ email: String(input.store_email ?? ""), nameLa: String(input.store_name_la ?? "") })
        : missingBranchField({ name: String(input.branch_name ?? ""), storeUuid: String(input.store_uuid_fk ?? "") });

    if (missing) {
      showToast({ title: labels.saveFailed, description: missingFieldDescription(missing), tone: "error" });
      return;
    }

    try {
      await saveEntity(config, input);
      const nextRows = await loadEntity(config, requestParams, { background: true });
      const updated = id ? nextRows.find((row) => storeBranchId(row, kind) === id) : null;
      if (updated && kind === "store" && id === storeUuid) {
        updateUser({
          store_logo: storeBranchValue(updated, "store_logo"),
          store_name: storeBranchName(updated, "store")
        });
      }
      if (updated && kind === "branch" && id === user?.branch_uuid) {
        updateUser({
          branch_address: storeBranchValue(updated, "branch_address"),
          branch_name: storeBranchName(updated, "branch"),
          branch_tel: storeBranchValue(updated, "branch_tel")
        });
      }
      showToast({ title: labels.saved, tone: "success" });
      resetForm();
    } catch (error) {
      showToast({
        title: labels.saveFailed,
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function handleDelete(row: Row) {
    const id = storeBranchId(row, kind);
    if (!canDelete || !id || id === activeId) return;
    try {
      await removeEntity(config, id);
      await loadEntity(config, requestParams, { background: true });
      if (editing && storeBranchId(editing, kind) === id) resetForm();
      setDeleteTarget(null);
      setSelectedRows((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      showToast({ title: t("settings.deleted"), tone: "success" });
    } catch (error) {
      showToast({
        title: labels.deleteFailed,
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function handleResetPassword(row: Row) {
    const email = storeBranchValue(row, "store_email");
    if (!email) return;
    try {
      await resetPassword(email);
      showToast({ title: labels.resetPassword, tone: "success" });
    } catch (error) {
      showToast({
        title: labels.resetFailed,
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  const rowActions = (row: Row) => {
    const id = storeBranchId(row, kind);
    const isCurrent = id === activeId;
    return (
      <SettingsRowActions
        row={row}
        editDisabled={!canEdit || saving}
        deleteDisabled={!canDelete || isCurrent || saving}
        actions={
          kind === "store"
            ? [
                {
                  label: labels.resetPassword,
                  icon: <KeyRound aria-hidden />,
                  disabled: !canEdit || saving,
                  onSelect: (nextRow) => void handleResetPassword(nextRow)
                }
              ]
            : undefined
        }
        onEdit={openEditForm}
        onDelete={setDeleteTarget}
      />
    );
  };

  const table = visibleRows.length ? (
    <SettingsTableScroll>
      <Table className={kind === "store" ? "min-w-[940px]" : "min-w-[1080px]"}>
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={labels.selectAll} checked={allSelected} onChange={(event) => toggleAllSelected(event.target.checked)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("fields.no")}</TableHead>
            <TableHead>{kind === "store" ? labels.store : labels.branch}</TableHead>
            {kind === "store" ? (
              <>
                <TableHead>{labels.email}</TableHead>
                <TableHead>{labels.type}</TableHead>
                <TableHead>{labels.active}</TableHead>
              </>
            ) : (
              <>
                <TableHead>{labels.phone}</TableHead>
                <TableHead>{labels.email}</TableHead>
                <TableHead>{labels.address}</TableHead>
                <TableHead>{labels.taxBilling}</TableHead>
              </>
            )}
            <TableHead className="w-16 text-right">{labels.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map((row, rowIndex) => {
            const id = storeBranchId(row, kind);
            const name = storeBranchName(row, kind);
            const selected = selectedRows.has(id);
            const rowNumber = pageStart + rowIndex;

            return (
              <TableRow key={id || rowIndex} className="h-14" data-state={selected ? "selected" : undefined}>
                <TableCell className="w-10 px-2">
                  <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onChange={(event) => toggleSelected(id, event.target.checked)} />
                </TableCell>
                <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black tabular-nums text-muted-foreground">
                  {rowNumber}
                </TableCell>
                <TableCell className="max-w-[28rem]">
                  <EntityIdentity activeId={activeId} imageUrl={imageUrl} kind={kind} labels={labels} row={row} />
                </TableCell>
                {kind === "store" ? (
                  <>
                    <TableCell className="max-w-[18rem] text-muted-foreground">
                      <span className="block truncate" translate="no">
                        {storeBranchValue(row, "store_email", "-")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StoreTypeBadge labels={labels} row={row} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge active={isStoreActive(row)} labels={labels} />
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="max-w-[10rem] text-muted-foreground">
                      <span className="block truncate" translate="no">
                        {storeBranchValue(row, "branch_tel", "-")}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[16rem] text-muted-foreground">
                      <span className="block truncate" translate="no">
                        {storeBranchValue(row, "branch_email", "-")}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[22rem] text-muted-foreground">
                      <span className="flex min-w-0 items-center gap-1">
                        <MapPin aria-hidden className="size-3.5 shrink-0" />
                        <span className="truncate">{storeBranchValue(row, "branch_address", "-")}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <BranchTaxBadges labels={labels} row={row} />
                    </TableCell>
                  </>
                )}
                <TableCell className="text-right">{rowActions(row)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </SettingsTableScroll>
  ) : null;

  const mobileList = visibleRows.length ? (
    <SettingsMobileList>
      {visibleRows.map((row, rowIndex) => {
        const id = storeBranchId(row, kind);
        const selected = selectedRows.has(id);
        const rowNumber = pageStart + rowIndex;
        const name = storeBranchName(row, kind);
        const current = id === activeId;
        return (
          <SettingsMobileCard
            key={id || rowIndex}
            actions={rowActions(row)}
            badges={
              <>
                <Badge className="shrink-0 tabular-nums">{rowNumber}</Badge>
                {current ? <Badge className="border-primary/25 bg-primary/10 text-primary">{labels.current}</Badge> : null}
                {kind === "store" ? <StatusBadge active={isStoreActive(row)} labels={labels} /> : null}
              </>
            }
            checked={selected}
            leading={<MediaPreview alt={name} kind={kind} src={imageUrl(row, kind)} />}
            selectLabel={t("common.selectRow", { name })}
            selected={selected}
            subtitle={
              <span className="block truncate" translate="no">
                {kind === "store" ? storeBranchValue(row, "store_email", "-") : storeBranchValue(row, "branch_tel", "-")}
              </span>
            }
            title={name}
            onCheckedChange={(checked) => toggleSelected(id, checked)}
          >
            <SettingsMobileMetaGrid>
              {kind === "store" ? (
                <>
                  <SettingsMobileMeta label={labels.email} value={<span translate="no">{storeBranchValue(row, "store_email", "-")}</span>} />
                  <SettingsMobileMeta label={labels.type} value={isStorePlc(row) ? labels.plc : labels.general} />
                  <SettingsMobileMeta label={labels.active} value={isStoreActive(row) ? labels.open : labels.closed} />
                </>
              ) : (
                <>
                  <SettingsMobileMeta label={labels.phone} value={<span translate="no">{storeBranchValue(row, "branch_tel", "-")}</span>} />
                  <SettingsMobileMeta label={labels.email} value={<span translate="no">{storeBranchValue(row, "branch_email", "-")}</span>} />
                  <SettingsMobileMeta label={labels.address} value={storeBranchValue(row, "branch_address", "-")} />
                  <SettingsMobileMeta
                    label={labels.vat}
                    value={`${branchVatSummary(row).active ? labels.active : labels.inactive} / ${branchVatSummary(row).percentLabel}`}
                  />
                  <SettingsMobileMeta
                    label={labels.charge}
                    value={`${branchChargeSummary(row).active ? labels.active : labels.inactive} / ${branchChargeSummary(row).percentLabel}`}
                  />
                </>
              )}
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
        onSearch: (nextSearch) => setSearch(config.slug, nextSearch)
      }}
    />
  );

  const listSurface = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur sm:px-4 lg:px-5">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black">{listTitle}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("common.showingRange", { start: pageStart, end: pageEnd, total })} - {t("common.page", { current: page, total: totalPages })}
            </p>
          </div>
          <div className="min-w-0 xl:max-w-[48rem]">{toolbar}</div>
        </div>
        {backgroundLoading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner aria-hidden />
            {kind === "store" ? labels.refreshStore : labels.refreshBranch}
          </div>
        ) : null}
      </div>
      {visibleRows.length ? (
        <>
          <div className="hidden min-h-0 flex-1 md:flex">{table}</div>
          <div className="min-h-0 flex-1 overflow-y-auto md:hidden">{mobileList}</div>
        </>
      ) : (
        <div className="flex min-h-72 flex-1 items-center justify-center p-4">
          <Empty className="max-w-md border border-dashed bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {kind === "store" ? <Store aria-hidden /> : <Building2 aria-hidden />}
              </EmptyMedia>
              <EmptyTitle>{kind === "store" ? labels.noStore : labels.noBranch}</EmptyTitle>
              <EmptyDescription>{labels.selectRecord}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </div>
  );

  return (
    <>
      <SettingsModuleShell
        addLabel={kind === "store" ? labels.addStore : labels.addBranch}
        cardTitle={listTitle}
        description={description}
        footer={
          visibleRows.length ? (
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
        onAdd={canCreate ? openCreateForm : undefined}
      />
      <EntityFormDialog
        activeStoreUuid={storeUuid}
        canEdit={canEdit}
        editing={editing}
        imageUrl={(row, rowKind) => imageUrl(row, rowKind)}
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
        confirmPending={saving}
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
    </>
  );
}

function EntityFormDialog({
  activeStoreUuid,
  canEdit,
  editing,
  imageUrl,
  kind,
  labels,
  onCancel,
  onSubmit,
  open,
  saving
}: {
  activeStoreUuid: string;
  canEdit: boolean;
  editing: Row | null;
  imageUrl: (row: Row, rowKind: StoreBranchKind) => string;
  kind: StoreBranchKind;
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
      <SettingsDialogContent className="sm:max-w-5xl" showCloseButton={!saving}>
        <EntityForm
          activeStoreUuid={activeStoreUuid}
          canEdit={canEdit}
          editing={editing}
          imageUrl={imageUrl}
          kind={kind}
          labels={labels}
          saving={saving}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
        {saving ? <FormSavingOverlay labels={labels} onCancel={onCancel} /> : null}
      </SettingsDialogContent>
    </Dialog>
  );
}

function FormSavingOverlay({ labels, onCancel }: { labels: StoreBranchLabels; onCancel: () => void }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-background/90 p-4 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center shadow-xl">
        <div className="grid size-10 place-items-center rounded-lg bg-muted text-primary">
          <Spinner />
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
  value
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
      <input name={name} type="hidden" value={value} readOnly />
      <Select disabled={disabled} value={value} onValueChange={onValueChange}>
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
  activeStoreUuid,
  canEdit,
  editing,
  imageUrl,
  kind,
  labels,
  onCancel,
  onSubmit,
  saving
}: {
  activeStoreUuid: string;
  canEdit: boolean;
  editing: Row | null;
  imageUrl: (row: Row, rowKind: StoreBranchKind) => string;
  kind: StoreBranchKind;
  labels: StoreBranchLabels;
  onCancel: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
  saving: boolean;
}) {
  const recordKey = `${kind}-${editing ? storeBranchId(editing, kind) : "new"}`;
  const imageFieldName = kind === "store" ? "store_logo" : "branch_qr";
  const disabled = !canEdit || saving;
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [storeNameLa, setStoreNameLa] = useState("");
  const [storeNameEng, setStoreNameEng] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchTel, setBranchTel] = useState("");
  const [branchEmail, setBranchEmail] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [storeStatus, setStoreStatus] = useState("2");
  const [storeActive, setStoreActive] = useState("1");
  const [vatStatus, setVatStatus] = useState("2");
  const [vatPercent, setVatPercent] = useState("0");
  const [chargeStatus, setChargeStatus] = useState("2");
  const [chargePercent, setChargePercent] = useState("0");
  const formHint = kind === "store" ? labels.storeHint : labels.branchHint;
  const existingSrc = editing ? imageUrl(editing, kind) : "";
  const canSubmit =
    !disabled &&
    (kind === "store"
      ? !missingStoreField({ email: storeEmail, nameLa: storeNameLa })
      : !missingBranchField({ name: branchName, storeUuid: activeStoreUuid }));

  useEffect(() => {
    setSelectedImage(null);
    setCrop(DEFAULT_CROP);
    setStoreNameLa(storeBranchValue(editing, "store_name_la", storeBranchValue(editing, "store_name")));
    setStoreNameEng(storeBranchValue(editing, "store_name_eng"));
    setStoreEmail(storeBranchValue(editing, "store_email"));
    setBranchName(storeBranchValue(editing, "branch_name"));
    setBranchTel(storeBranchValue(editing, "branch_tel"));
    setBranchEmail(storeBranchValue(editing, "branch_email"));
    setBranchAddress(storeBranchValue(editing, "branch_address"));
    setStoreStatus(String(storeBranchNumber(editing, "store_status", 2)));
    setStoreActive(String(storeBranchNumber(editing, "store_active", 1)));
    setVatStatus(String(storeBranchNumber(editing, "vat_status", 2)));
    setVatPercent(String(storeBranchNumber(editing, "vat_name", 0)));
    setChargeStatus(String(storeBranchNumber(editing, "charge_status", 2)));
    setChargePercent(String(storeBranchNumber(editing, "charge_name", 0)));
  }, [editing, recordKey]);

  async function handleSubmit(formData: FormData) {
    if (selectedImage) {
      const croppedFile = await cropImageFile(selectedImage, crop, labels.imageLoadFailed);
      formData.set(imageFieldName, croppedFile);
    }
    await onSubmit(formData);
  }

  return (
    <SettingsDialogForm key={recordKey} action={handleSubmit} className="sm:max-h-[calc(100dvh-2rem)]">
      <SettingsDialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
            {editing ? <CheckCircle2 aria-hidden /> : <Plus aria-hidden />}
          </span>
          {kind === "store" ? labels.storeInfo : labels.branchInfo}
        </DialogTitle>
        <DialogDescription>{formHint}</DialogDescription>
      </SettingsDialogHeader>

      <SettingsDialogBody className="p-0 sm:p-0">
        <div className="grid min-h-full gap-4 p-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:p-5">
          <SettingsImageCropPanel
            crop={crop}
            className="rounded-lg border border-border lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto"
            description={labels.cropHint}
            disabled={!canEdit}
            emptyLabel={kind === "store" ? labels.store : labels.branch}
            existingSrc={existingSrc}
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

          <FieldGroup className="min-w-0 gap-4">
            <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
              <Field>
                <FieldLegend>{kind === "store" ? labels.storeDetails : labels.branchDetails}</FieldLegend>
                <FieldDescription>{formHint}</FieldDescription>
              </Field>
              {kind === "store" ? (
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`${recordKey}-name-la`}>{labels.nameLa}</FieldLabel>
                    <Input
                      id={`${recordKey}-name-la`}
                      name="store_name_la"
                      autoComplete="organization"
                      disabled={disabled}
                      required
                      value={storeNameLa}
                      onChange={(event) => setStoreNameLa(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${recordKey}-name-en`}>{labels.nameEn}</FieldLabel>
                    <Input
                      id={`${recordKey}-name-en`}
                      name="store_name_eng"
                      autoComplete="organization"
                      disabled={disabled}
                      value={storeNameEng}
                      onChange={(event) => setStoreNameEng(event.target.value)}
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor={`${recordKey}-email`}>{labels.email}</FieldLabel>
                    <Input
                      id={`${recordKey}-email`}
                      name="store_email"
                      autoComplete="email"
                      disabled={disabled}
                      placeholder={labels.emailPlaceholder}
                      required
                      spellCheck={false}
                      translate="no"
                      type="email"
                      value={storeEmail}
                      onChange={(event) => setStoreEmail(event.target.value)}
                    />
                  </Field>
                </FieldGroup>
              ) : (
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor={`${recordKey}-branch-name`}>{labels.name}</FieldLabel>
                    <Input
                      id={`${recordKey}-branch-name`}
                      name="branch_name"
                      autoComplete="organization"
                      disabled={disabled}
                      required
                      value={branchName}
                      onChange={(event) => setBranchName(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${recordKey}-phone`}>{labels.phone}</FieldLabel>
                    <Input
                      id={`${recordKey}-phone`}
                      name="branch_tel"
                      autoComplete="tel"
                      disabled={disabled}
                      inputMode="tel"
                      spellCheck={false}
                      translate="no"
                      type="tel"
                      value={branchTel}
                      onChange={(event) => setBranchTel(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${recordKey}-branch-email`}>{labels.email}</FieldLabel>
                    <Input
                      id={`${recordKey}-branch-email`}
                      name="branch_email"
                      autoComplete="email"
                      disabled={disabled}
                      placeholder={labels.emailPlaceholder}
                      spellCheck={false}
                      translate="no"
                      type="email"
                      value={branchEmail}
                      onChange={(event) => setBranchEmail(event.target.value)}
                    />
                  </Field>
                </FieldGroup>
              )}
            </FieldSet>

            {kind === "store" ? (
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{labels.contactDetails}</FieldLegend>
                  <FieldDescription>{labels.contactHint}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
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
                </FieldGroup>
              </FieldSet>
            ) : (
              <>
                <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                  <Field>
                    <FieldLegend>{labels.contactDetails}</FieldLegend>
                    <FieldDescription>{labels.contactHint}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${recordKey}-address`}>{labels.address}</FieldLabel>
                    <Textarea
                      id={`${recordKey}-address`}
                      name="branch_address"
                      autoComplete="street-address"
                      disabled={disabled}
                      value={branchAddress}
                      onChange={(event) => setBranchAddress(event.target.value)}
                    />
                  </Field>
                </FieldSet>

                <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                  <Field>
                    <FieldLegend>{labels.taxBilling}</FieldLegend>
                    <FieldDescription>{labels.taxBillingHint}</FieldDescription>
                  </Field>
                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
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
                    <Field>
                      <FieldLabel htmlFor={`${recordKey}-vat-percent`}>{labels.vatPercent}</FieldLabel>
                      <Input
                        id={`${recordKey}-vat-percent`}
                        name="vat_name"
                        autoComplete="off"
                        disabled={disabled}
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        translate="no"
                        type="number"
                        value={vatPercent}
                        onChange={(event) => setVatPercent(event.target.value)}
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
                    <Field>
                      <FieldLabel htmlFor={`${recordKey}-charge-percent`}>{labels.chargePercent}</FieldLabel>
                      <Input
                        id={`${recordKey}-charge-percent`}
                        name="charge_name"
                        autoComplete="off"
                        disabled={disabled}
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        translate="no"
                        type="number"
                        value={chargePercent}
                        onChange={(event) => setChargePercent(event.target.value)}
                      />
                    </Field>
                  </FieldGroup>
                </FieldSet>
              </>
            )}
          </FieldGroup>
        </div>
      </SettingsDialogBody>

      <input name={kind === "store" ? "store_uuid" : "branch_uuid"} type="hidden" value={storeBranchId(editing, kind)} readOnly />
      {kind === "branch" ? <input name="store_uuid_fk" type="hidden" value={activeStoreUuid} readOnly /> : null}
      <SettingsDialogFooter>
        <Button disabled={saving} type="button" variant="outline" onClick={onCancel}>
          {labels.cancel}
        </Button>
        <Button disabled={!canSubmit} type="submit">
          {saving ? <Spinner data-icon="inline-start" /> : null}
          {saving ? labels.savingTitle : labels.save}
        </Button>
      </SettingsDialogFooter>
    </SettingsDialogForm>
  );
}
