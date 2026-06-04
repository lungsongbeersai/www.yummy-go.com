"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Save, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { canManageStorePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { StorePermissionMenu, StorePermissionRoleTree, StorePermissionTree } from "@/services/store-permissions";
import { useAuthStore } from "@/stores/auth-store";
import { useStorePermissionsStore } from "@/stores/store-permissions-store";
import { useToastStore } from "@/stores/toast-store";

function currentRoleTree(tree: StorePermissionTree | null, roleId: number | null) {
  if (!tree || !roleId) return null;
  return tree.roles.find((role) => role.role_id === roleId) ?? tree.roles[0] ?? null;
}

function menuSubmenus(menu: StorePermissionMenu) {
  return [...menu.sub_detail].sort((a, b) => a.sub_sort - b.sub_sort || a.sub_title.localeCompare(b.sub_title));
}

function totalSubmenus(roleTree: StorePermissionRoleTree | null) {
  return roleTree?.menus.reduce((sum, menu) => sum + menu.sub_detail.length, 0) ?? 0;
}

function menuSelection(menu: StorePermissionMenu, checked: Set<string>) {
  const submenus = menuSubmenus(menu);
  const selected = submenus.filter((submenu) => checked.has(submenu.sub_id)).length;
  return {
    allChecked: Boolean(submenus.length && selected === submenus.length),
    selected,
    submenus,
    total: submenus.length
  };
}

export function StorePermissionsPage() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.show);
  const checkedSubIds = useStorePermissionsStore((state) => state.checkedSubIds);
  const loadingOptions = useStorePermissionsStore((state) => state.loadingOptions);
  const loadingTree = useStorePermissionsStore((state) => state.loadingTree);
  const roles = useStorePermissionsStore((state) => state.roles);
  const saving = useStorePermissionsStore((state) => state.saving);
  const selectedRoleId = useStorePermissionsStore((state) => state.selectedRoleId);
  const selectedStoreUuid = useStorePermissionsStore((state) => state.selectedStoreUuid);
  const stores = useStorePermissionsStore((state) => state.stores);
  const tree = useStorePermissionsStore((state) => state.tree);
  const loadOptions = useStorePermissionsStore((state) => state.loadOptions);
  const loadTree = useStorePermissionsStore((state) => state.loadTree);
  const savePermissions = useStorePermissionsStore((state) => state.save);
  const setRole = useStorePermissionsStore((state) => state.setRole);
  const setStore = useStorePermissionsStore((state) => state.setStore);
  const toggleMenu = useStorePermissionsStore((state) => state.toggleMenu);
  const toggleSubmenu = useStorePermissionsStore((state) => state.toggleSubmenu);
  const allowed = canManageStorePermissions(user?.status);
  const language = i18n.language;
  const roleTree = useMemo(() => currentRoleTree(tree, selectedRoleId), [selectedRoleId, tree]);
  const checkedSet = useMemo(() => new Set(checkedSubIds), [checkedSubIds]);
  const total = totalSubmenus(roleTree);
  const selectedCount = checkedSubIds.length;
  const loading = loadingOptions || loadingTree;
  const canSave = Boolean(selectedStoreUuid && selectedRoleId && tree) && !saving && !loading;

  useEffect(() => {
    if (!allowed) router.replace("/");
  }, [allowed, router]);

  useEffect(() => {
    if (!allowed) return;
    void loadPermissionOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, language]);

  useEffect(() => {
    if (!allowed || !selectedStoreUuid || !selectedRoleId) return;
    void loadPermissionTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, language, selectedRoleId, selectedStoreUuid]);

  async function loadPermissionOptions() {
    try {
      await loadOptions(language);
    } catch (error) {
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("storePermissions.loadFailed"),
        tone: "error"
      });
    }
  }

  async function refresh() {
    try {
      await loadOptions(language);
      await loadTree(language);
    } catch (error) {
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("storePermissions.loadFailed"),
        tone: "error"
      });
    }
  }

  async function loadPermissionTree() {
    try {
      await loadTree(language);
    } catch (error) {
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("storePermissions.treeLoadFailed"),
        tone: "error"
      });
    }
  }

  async function save() {
    if (!canSave) return;
    try {
      await savePermissions(language);
      showToast({ title: t("storePermissions.saved"), tone: "success" });
    } catch (error) {
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("storePermissions.saveFailed"),
        tone: "error"
      });
    }
  }

  if (!allowed) return <LoadingState label={t("common.processing")} variant="table" />;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 px-4 py-3 lg:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-primary">{t("storePermissions.kicker")}</p>
          <h1 className="mt-1 text-xl font-black">{t("storePermissions.title")}</h1>
          <p className="mt-0.5 hidden max-w-3xl truncate text-xs text-muted-foreground sm:block">
            {t("storePermissions.description")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button disabled={loading} size="sm" type="button" variant="outline" onClick={refresh}>
            {loading ? <Spinner data-icon="inline-start" /> : <RefreshCcw data-icon="inline-start" />}
            {t("actions.refresh")}
          </Button>
          <Button disabled={!canSave} size="sm" type="button" onClick={save}>
            {saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            {t("actions.save")}
          </Button>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-b-0">
        <CardHeader className="shrink-0 flex-col gap-3 px-4 py-3 lg:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle>{t("storePermissions.cardTitle")}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("storePermissions.summary", { selected: selectedCount, total })}
              </p>
            </div>
            <Badge className="shrink-0 border-primary/30 bg-primary/10 text-primary">
              <ShieldCheck />
              {t("storePermissions.plcOnly")}
            </Badge>
          </div>
          <FieldGroup className="grid gap-3 md:grid-cols-2">
            <Field className="gap-2">
              <FieldLabel htmlFor="permission-store-select">{t("storePermissions.store")}</FieldLabel>
              <Select
                disabled={loadingOptions || saving}
                value={selectedStoreUuid}
                onValueChange={setStore}
              >
                <SelectTrigger id="permission-store-select" className="w-full">
                  <SelectValue placeholder={t("storePermissions.selectStore")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {stores.map((store) => (
                      <SelectItem key={store.store_uuid} value={store.store_uuid}>
                        {store.store_name || store.store_uuid}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>{t("storePermissions.storeHint")}</FieldDescription>
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="permission-role-select">{t("storePermissions.role")}</FieldLabel>
              <Select
                disabled={loadingOptions || saving}
                value={selectedRoleId ? String(selectedRoleId) : ""}
                onValueChange={(value) => setRole(Number(value))}
              >
                <SelectTrigger id="permission-role-select" className="w-full">
                  <SelectValue placeholder={t("storePermissions.selectRole")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {roles.map((role) => (
                      <SelectItem key={role.roles_id} value={String(role.roles_id)}>
                        {role.role_name || role.roles_id}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>{t("storePermissions.roleHint")}</FieldDescription>
            </Field>
          </FieldGroup>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {loading ? (
            <div className="min-h-0 flex-1 p-4">
              <LoadingState label={t("storePermissions.loading")} variant="table" />
            </div>
          ) : !stores.length || !roles.length ? (
            <div className="flex min-h-72 flex-1 items-center justify-center p-4">
              <EmptyState
                description={t("storePermissions.noOptionsDescription")}
                title={t("storePermissions.noOptions")}
              />
            </div>
          ) : roleTree?.menus.length ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <Alert className="m-4 mb-0">
                <ShieldCheck />
                <AlertTitle>{t("storePermissions.assignmentTitle")}</AlertTitle>
                <AlertDescription>{t("storePermissions.assignmentHint")}</AlertDescription>
              </Alert>
              <div className="flex min-h-full flex-col pt-4">
                {roleTree.menus.map((menu) => (
                  <PermissionMenuGroup
                    key={menu.menu_id}
                    checkedSet={checkedSet}
                    menu={menu}
                    saving={saving}
                    onToggleMenu={toggleMenu}
                    onToggleSubmenu={toggleSubmenu}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex min-h-72 flex-1 items-center justify-center p-4">
              <EmptyState
                description={t("storePermissions.emptyTreeDescription")}
                title={t("storePermissions.emptyTree")}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PermissionMenuGroup({
  checkedSet,
  menu,
  saving,
  onToggleMenu,
  onToggleSubmenu
}: {
  checkedSet: Set<string>;
  menu: StorePermissionMenu;
  saving: boolean;
  onToggleMenu: (menuId: string, checked: boolean) => void;
  onToggleSubmenu: (subId: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const selection = menuSelection(menu, checkedSet);

  return (
    <section className="border-t border-border bg-card">
      <div className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:px-5">
        <label className="flex min-w-0 cursor-pointer items-start gap-3">
          <Checkbox
            checked={selection.allChecked}
            className="mt-1"
            disabled={saving || !selection.total}
            aria-label={t("storePermissions.toggleMenu", { title: menu.menu_title })}
            onChange={(event) => onToggleMenu(menu.menu_id, event.target.checked)}
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="min-w-0 truncate text-sm font-black">{menu.menu_title || "-"}</h2>
              <Badge>{t("storePermissions.selectedCount", selection)}</Badge>
            </div>
            <div className="mt-2 flex min-w-0 flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="min-w-0 max-w-full truncate rounded-md border border-border bg-muted px-2 py-1 font-mono">
                {menu.menu_path || "-"}
              </span>
              <span className="rounded-md border border-border bg-muted px-2 py-1">
                {t("storePermissions.menuSort", { sort: menu.menu_sort || 0 })}
              </span>
            </div>
          </div>
        </label>
      </div>

      <div className="border-t border-border bg-muted/30 px-4 py-3 lg:px-5">
        {selection.submenus.length ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {selection.submenus.map((submenu) => (
              <label
                key={submenu.sub_id}
                className={cn(
                  "flex min-w-0 cursor-pointer items-start gap-3 rounded-md border border-border bg-background px-3 py-2 shadow-sm",
                  checkedSet.has(submenu.sub_id) && "border-primary/30 bg-primary/5"
                )}
              >
                <Checkbox
                  checked={checkedSet.has(submenu.sub_id)}
                  className="mt-1"
                  disabled={saving}
                  aria-label={submenu.sub_title}
                  onChange={(event) => onToggleSubmenu(submenu.sub_id, event.target.checked)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{submenu.sub_title || "-"}</p>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{submenu.sub_path || "-"}</p>
                </div>
              </label>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-background px-3 py-3 text-sm text-muted-foreground">
            {t("storePermissions.noSubmenus")}
          </div>
        )}
      </div>
    </section>
  );
}
