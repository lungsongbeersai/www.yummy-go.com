"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEFAULT_CROP, SettingsImageCropPanel, cropImageFile, type CropState } from "@/features/settings/shared/settings-image-crop";
import {
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsRowActions,
  SettingsTableScroll,
  SettingsToolbar
} from "@/features/settings/shared/settings-shell";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { ApiEntity, PageLimit, SortOrder } from "@/services/shared/types";
import type { FetchUsersParams, Role, SaveUserInput, User } from "@/services/user";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";
import { useUserStore } from "@/stores/user-store";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;
const ORDER_OPTIONS: Array<{ labelKey: "asc" | "desc"; value: SortOrder }> = [
  { labelKey: "asc", value: "asc" },
  { labelKey: "desc", value: "desc" }
];

function value(row: ApiEntity | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

function userId(row: User | null | undefined) {
  return value(row, "login_uuid");
}

function roleId(row: Role | User | null | undefined) {
  return value(row, "roles_id_fk", value(row, "roles_id", value(row, "role_id")));
}

function roleName(row: Role | User | null | undefined) {
  return value(row, "roles_name", value(row, "role_name", value(row, "roles_name_la", value(row, "roles_name_eng", "-"))));
}

function branchName(row: ApiEntity | null | undefined) {
  return value(row, "branch_name", value(row, "branch_name_la", value(row, "branch_name_eng", "-")));
}

function isProtectedUser(row: User) {
  const raw = row.btn_disabled ?? row.btn_disible;
  if (raw === null || raw === undefined) return false;
  const status = String(raw).trim().toLowerCase();
  return Boolean(status) && status !== "null";
}

function initials(email: string) {
  const name = email.split("@")[0]?.trim() || email.trim();
  return (name.slice(0, 2) || "U").toUpperCase();
}

function UserAvatar({
  email,
  src
}: {
  email: string;
  src: string;
}) {
  return (
    <Avatar size="lg">
      {src ? <AvatarImage alt={email} src={src} /> : null}
      <AvatarFallback>{initials(email)}</AvatarFallback>
    </Avatar>
  );
}

function activeLabel(status: string, active: string, inactive: string) {
  return Number(status || 1) === 1 ? active : inactive;
}

export function UserSettingsPage() {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const branchUuid = user?.branch_uuid ?? "";
  const loginBranchName = user?.branch_name || t("settings.currentBranch");
  const currentLoginUuid = user?.uuid ?? "";
  const loggedRoleId = Number(user?.status ?? 0);
  const showToast = useToastStore((state) => state.show);
  const rows = useUserStore((state) => state.rows);
  const total = useUserStore((state) => state.total);
  const storeTotalPages = useUserStore((state) => state.totalPages);
  const search = useUserStore((state) => state.search);
  const loading = useUserStore((state) => state.loading);
  const saving = useUserStore((state) => state.saving);
  const setSearch = useUserStore((state) => state.setSearch);
  const loadRows = useUserStore((state) => state.load);
  const saveRow = useUserStore((state) => state.save);
  const removeRow = useUserStore((state) => state.remove);
  const loadRoles = useReferenceStore((state) => state.loadRoles);
  const userProfileUrl = useReferenceStore((state) => state.userProfileUrl);
  const [roles, setRoles] = useState<Role[]>([]);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [limit, setLimit] = useState<PageLimit>(DEFAULT_LIMIT);
  const [orderBy, setOrderBy] = useState<SortOrder>("asc");
  const [editing, setEditing] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());

  const title = t("settings.modules.user.title");
  const description = t("settings.modules.user.description");
  const requestParams = useMemo<FetchUsersParams>(
    () => ({
      search,
      page,
      limit,
      orderBy,
      lang: language,
      branch_uuid_fk: branchUuid,
      roles_id_fk: loggedRoleId || ""
    }),
    [branchUuid, language, limit, loggedRoleId, orderBy, page, search]
  );
  const pageSize = limit === "All" ? rows.length || Number(DEFAULT_LIMIT) : Number(limit ?? DEFAULT_LIMIT);
  const totalPages = Math.max(1, Number(storeTotalPages || Math.ceil(total / pageSize) || 1));
  const pageStart = rows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;
  const canGoBack = page > 1 && !loading;
  const canGoNext = page < totalPages && !loading;
  const ids = useMemo(() => rows.map(userId).filter(Boolean), [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedRows.has(id));

  async function load() {
    if (!branchUuid) {
      showToast({ title: t("settings.loadFailed", { title }), description: t("settings.branchRequired"), tone: "error" });
      return;
    }

    try {
      await loadRows(requestParams);
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
  }, [branchUuid, language, page, limit, orderBy, loggedRoleId]);

  useEffect(() => {
    if (!loggedRoleId) {
      setRoles([]);
      return;
    }

    let active = true;
    loadRoles(language, loggedRoleId)
      .then((nextRoles) => {
        if (active) setRoles(nextRoles);
      })
      .catch((error) => {
        showToast({
          title: t("settings.loadFailed", { title: t("fields.roles_name") }),
          description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
          tone: "error"
        });
      });

    return () => {
      active = false;
    };
  }, [language, loadRoles, loggedRoleId, showToast, t]);

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
    if (!roles.length) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.createRoleFirst"), tone: "error" });
      return;
    }
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: User) {
    if (isProtectedUser(row)) return;
    setEditing(row);
    setDialogOpen(true);
  }

  async function save(formData: FormData) {
    const selectedRoleId = String(formData.get("roles_id_fk") ?? "").trim();
    const password = String(formData.get("login_password") ?? "").trim();
    const profile = formData.get("login_profile");
    const id = userId(editing);

    if (!branchUuid) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.branchRequired"), tone: "error" });
      return;
    }
    if (!selectedRoleId) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.createRoleFirst"), tone: "error" });
      return;
    }
    if (!id && !password) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.passwordRequired"), tone: "error" });
      return;
    }

    const input: SaveUserInput = {
      branch_uuid_fk: branchUuid,
      roles_id_fk: Number(selectedRoleId),
      login_email: String(formData.get("login_email") ?? "").trim(),
      login_active: Number(formData.get("login_active") ?? 1)
    };
    if (id) input.login_uuid = id;
    if (password) input.login_password = password;
    if (profile instanceof File && profile.size) input.login_profile = profile;

    try {
      await saveRow(input);
      showToast({ title: t("settings.saved"), tone: "success" });
      setDialogOpen(false);
      setEditing(null);
      await loadRows(requestParams);
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function remove(row: User) {
    if (isProtectedUser(row)) return;
    const id = userId(row);
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
      await loadRows(requestParams);
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
      <Table className="min-w-[1080px]">
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("fields.no")}</TableHead>
            <TableHead>{t("nav.user")}</TableHead>
            <TableHead>{t("fields.roles_name")}</TableHead>
            <TableHead>{t("nav.branch")}</TableHead>
            <TableHead>{t("fields.login_active")}</TableHead>
            <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const id = userId(row);
            const email = value(row, "login_email", "-");
            const selected = selectedRows.has(id);
            const protectedRow = isProtectedUser(row);
            const currentRow = Boolean(currentLoginUuid && id === currentLoginUuid);
            return (
              <TableRow key={id || index} className={currentRow ? "bg-primary/5" : undefined} data-state={selected ? "selected" : undefined}>
                <TableCell className="w-10 px-2">
                  <Checkbox aria-label={t("common.selectRow", { name: email })} checked={selected} onChange={(event) => toggleSelected(id, event.target.checked)} />
                </TableCell>
                <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black text-muted-foreground">{pageStart + index}</TableCell>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar email={email} src={userProfileUrl(value(row, "login_profile"))} />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="min-w-0 truncate font-black">{email}</p>
                        {currentRow ? <Badge className="shrink-0 border-primary/25 bg-primary/10 text-primary">{t("settings.currentUser")}</Badge> : null}
                        {protectedRow ? <Badge className="shrink-0">{t("settings.protectedUser")}</Badge> : null}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{roleName(row)}</TableCell>
                <TableCell className="text-muted-foreground">{branchName(row)}</TableCell>
                <TableCell>
                  <Badge className={Number(value(row, "login_active", "1")) === 1 ? "border-primary/25 bg-primary/10 text-primary" : undefined}>
                    {activeLabel(value(row, "login_active", "1"), t("common.active"), t("common.inactive"))}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <SettingsRowActions
                    row={row}
                    editDisabled={protectedRow}
                    deleteDisabled={protectedRow}
                    onEdit={openEdit}
                    onDelete={setDeleteTarget}
                  />
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
        const id = userId(row);
        const email = value(row, "login_email", "-");
        const selected = selectedRows.has(id);
        const protectedRow = isProtectedUser(row);
        const currentRow = Boolean(currentLoginUuid && id === currentLoginUuid);
        const active = value(row, "login_active", "1");
        return (
          <SettingsMobileCard
            key={id || index}
            actions={
              <SettingsRowActions
                row={row}
                editDisabled={protectedRow}
                deleteDisabled={protectedRow}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
              />
            }
            badges={
              <>
                {currentRow ? <Badge className="shrink-0 border-primary/25 bg-primary/10 text-primary">{t("settings.currentUser")}</Badge> : null}
                {protectedRow ? <Badge className="shrink-0">{t("settings.protectedUser")}</Badge> : null}
              </>
            }
            checked={selected}
            className={currentRow ? "bg-primary/5" : undefined}
            leading={<UserAvatar email={email} src={userProfileUrl(value(row, "login_profile"))} />}
            selectLabel={t("common.selectRow", { name: email })}
            selected={selected}
            title={email}
            onCheckedChange={(checked) => toggleSelected(id, checked)}
          >
            <SettingsMobileMetaGrid>
              <SettingsMobileMeta label={t("fields.roles_name")} value={roleName(row)} />
              <SettingsMobileMeta label={t("nav.branch")} value={branchName(row)} />
              <SettingsMobileMeta
                label={t("fields.login_active")}
                value={
                  <Badge className={Number(active) === 1 ? "border-primary/25 bg-primary/10 text-primary" : undefined}>
                    {activeLabel(active, t("common.active"), t("common.inactive"))}
                  </Badge>
                }
              />
            </SettingsMobileMetaGrid>
          </SettingsMobileCard>
        );
      })}
    </SettingsMobileList>
  ) : null;

  return (
    <>
      <SettingsModuleShell
        addLabel={`${t("actions.add")} ${t("nav.user")}`}
        cardTitle={t("settings.userList")}
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
        loading={loading}
        loadingLabel={t("settings.loading", { title })}
        mobileList={mobileList}
        summary={`${t("common.showingRange", { start: pageStart, end: pageEnd, total })} - ${t("common.page", { current: page, total: totalPages })}`}
        table={table}
        title={title}
        toolbar={
          <SettingsToolbar
            state={{
              search,
              limit,
              orderBy,
              limitOptions: PAGE_LIMIT_OPTIONS,
              orderOptions: ORDER_OPTIONS.map((option) => ({ label: t(`common.${option.labelKey}`), value: option.value })),
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
        }
        onAdd={openCreate}
      />
      <UserFormDialog
        currentBranchName={loginBranchName}
        currentBranchUuid={branchUuid}
        description={description}
        editing={editing}
        loggedRoleId={loggedRoleId}
        open={dialogOpen}
        roleOptions={roles}
        saving={saving}
        title={title}
        profileSrc={editing ? userProfileUrl(value(editing, "login_profile")) : ""}
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

function UserFormDialog({
  currentBranchName,
  currentBranchUuid,
  description,
  editing,
  loggedRoleId,
  onOpenChange,
  onSubmit,
  open,
  profileSrc,
  roleOptions,
  saving,
  title
}: {
  currentBranchName: string;
  currentBranchUuid: string;
  description: string;
  editing: User | null;
  loggedRoleId: number;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  profileSrc: string;
  roleOptions: Role[];
  saving: boolean;
  title: string;
}) {
  const { t } = useTranslation();
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [loginActive, setLoginActive] = useState("1");
  const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);

  const roles = useMemo(() => {
    const editingRoleId = roleId(editing);
    if (!editingRoleId || roleOptions.some((role) => roleId(role) === editingRoleId)) return roleOptions;
    return [{ roles_id_fk: editingRoleId, roles_name: roleName(editing) }, ...roleOptions] as Role[];
  }, [editing, roleOptions]);

  useEffect(() => {
    setSelectedRoleId(roleId(editing) || String(loggedRoleId || ""));
    setLoginActive(value(editing, "login_active", "1"));
    setSelectedProfileImage(null);
    setCrop(DEFAULT_CROP);
  }, [editing, loggedRoleId, open]);

  async function handleSubmit(formData: FormData) {
    if (selectedProfileImage) {
      const croppedFile = await cropImageFile(selectedProfileImage, crop, t("settings.storeBranch.imageLoadFailed"));
      formData.set("login_profile", croppedFile);
    }
    await onSubmit(formData);
  }

  const formKey = userId(editing) || "new";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-4xl"
        showCloseButton={!saving}
      >
        <DialogHeader className="border-b border-border px-4 py-3 pr-12">
          <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form key={formKey} action={handleSubmit} className="flex min-h-0 flex-auto flex-col overflow-hidden sm:max-h-[calc(100dvh-8rem)]">
          <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[18rem_minmax(0,1fr)] md:overflow-hidden">
            <SettingsImageCropPanel
              crop={crop}
              className="shrink-0 md:overflow-y-auto"
              description={t("settings.profileImageHint")}
              emptyLabel={t("fields.login_profile")}
              existingSrc={profileSrc}
              fileSupportText={t("settings.storeBranch.imageSupport")}
              fieldId="login_profile"
              horizontalLabel={t("settings.storeBranch.horizontal")}
              previewMaxClassName="max-w-[10rem] sm:max-w-56 md:max-w-none"
              removeLabel={t("settings.storeBranch.cancelImage")}
              saving={saving}
              selectedFile={selectedProfileImage}
              title={t("settings.storeBranch.cropImage")}
              uploadLabel={t("settings.storeBranch.uploadImage")}
              verticalLabel={t("settings.storeBranch.vertical")}
              zoomLabel={t("settings.storeBranch.zoom")}
              onCropChange={setCrop}
              onFileChange={setSelectedProfileImage}
            />
            <div className="min-h-0 p-4 md:overflow-y-auto">
              <FieldGroup className="gap-4 pb-1">
                <FieldSet className="gap-3 rounded-lg border border-border bg-card p-4">
                  <FieldLegend className="text-sm font-black">{t("nav.branch")}</FieldLegend>
                  <FieldDescription>{t("settings.branchFromLogin")}</FieldDescription>
                  <Field>
                    <FieldLabel htmlFor="branch_uuid_fk">{t("nav.branch")}</FieldLabel>
                    <input name="branch_uuid_fk" type="hidden" value={currentBranchUuid} />
                    <Input id="branch_uuid_fk" value={currentBranchName || "-"} readOnly aria-readonly />
                  </Field>
                </FieldSet>

                <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                  <div>
                    <FieldLegend className="mb-1 text-sm font-black">{t("settings.userFormHint")}</FieldLegend>
                    <FieldDescription>{t("settings.selectRole")}</FieldDescription>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="login_email">{t("fields.login_email")}</FieldLabel>
                      <Input
                        id="login_email"
                        name="login_email"
                        type="email"
                        defaultValue={value(editing, "login_email")}
                        placeholder="abc@gmail.com"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="login_password">{t("fields.login_password")}</FieldLabel>
                      <Input id="login_password" name="login_password" type="password" required={!editing} autoComplete="new-password" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="roles_id_fk">{t("fields.roles_id_fk")}</FieldLabel>
                      <input name="roles_id_fk" type="hidden" value={selectedRoleId} />
                      <Select required value={selectedRoleId} onValueChange={setSelectedRoleId}>
                        <SelectTrigger id="roles_id_fk" className="w-full">
                          <SelectValue placeholder={t("settings.selectRole")} />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectGroup>
                            {roles.map((role) => {
                              const id = roleId(role);
                              if (!id) return null;
                              return (
                                <SelectItem key={id} value={id}>
                                  {roleName(role)}
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="login_active">{t("fields.login_active")}</FieldLabel>
                      <input name="login_active" type="hidden" value={loginActive} />
                      <Select required value={loginActive} onValueChange={setLoginActive}>
                        <SelectTrigger id="login_active" className="w-full">
                          <SelectValue placeholder={t("fields.login_active")} />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectGroup>
                            <SelectItem value="1">{t("common.active")}</SelectItem>
                            <SelectItem value="2">{t("common.inactive")}</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </FieldSet>
              </FieldGroup>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border bg-card/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur [&>button]:w-full sm:[&>button]:w-auto">
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saving || !currentBranchUuid || !selectedRoleId} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
