"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, RotateCcw, Save, Search, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

function savedSubmenus(role: StorePermissionRoleTree) {
  return role.menus.reduce((sum, menu) => sum + menu.sub_detail.length, 0);
}

function matchesSearch(value: string | undefined, query: string) {
  return String(value ?? "").toLowerCase().includes(query);
}

function filteredMenus(roleTree: StorePermissionRoleTree | null, search: string) {
  if (!roleTree) return [];
  const query = search.trim().toLowerCase();
  if (!query) return roleTree.menus;
  return roleTree.menus.filter((menu) => {
    if (matchesSearch(menu.menu_title, query) || matchesSearch(menu.menu_path, query)) return true;
    return menu.sub_detail.some((submenu) =>
      matchesSearch(submenu.sub_title, query) || matchesSearch(submenu.sub_path, query)
    );
  });
}

function menuSelection(menu: StorePermissionMenu, checked: Set<string>) {
  const submenus = menuSubmenus(menu);
  const selected = submenus.filter((submenu) => checked.has(submenu.sub_id)).length;
  return {
    allChecked: Boolean(submenus.length && selected === submenus.length),
    someChecked: selected > 0,
    selected,
    submenus,
    total: submenus.length
  };
}

function PermissionCheckbox({
  indeterminate,
  ...props
}: ComponentProps<typeof Checkbox> & { indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  return <Checkbox ref={ref} {...props} />;
}

export function StorePermissionsPage() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.show);
  const checkedSubIds = useStorePermissionsStore((state) => state.checkedSubIds);
  const dirty = useStorePermissionsStore((state) => state.dirty);
  const loadingOptions = useStorePermissionsStore((state) => state.loadingOptions);
  const loadingSaved = useStorePermissionsStore((state) => state.loadingSaved);
  const loadingTree = useStorePermissionsStore((state) => state.loadingTree);
  const roles = useStorePermissionsStore((state) => state.roles);
  const savedList = useStorePermissionsStore((state) => state.savedList);
  const saving = useStorePermissionsStore((state) => state.saving);
  const selectedRoleId = useStorePermissionsStore((state) => state.selectedRoleId);
  const selectedStoreUuid = useStorePermissionsStore((state) => state.selectedStoreUuid);
  const stores = useStorePermissionsStore((state) => state.stores);
  const tree = useStorePermissionsStore((state) => state.tree);
  const loadOptions = useStorePermissionsStore((state) => state.loadOptions);
  const loadTree = useStorePermissionsStore((state) => state.loadTree);
  const resetChanges = useStorePermissionsStore((state) => state.resetChanges);
  const savePermissions = useStorePermissionsStore((state) => state.save);
  const setRole = useStorePermissionsStore((state) => state.setRole);
  const setStore = useStorePermissionsStore((state) => state.setStore);
  const toggleMenu = useStorePermissionsStore((state) => state.toggleMenu);
  const toggleSubmenu = useStorePermissionsStore((state) => state.toggleSubmenu);
  const [permissionSearch, setPermissionSearch] = useState("");
  const allowed = canManageStorePermissions(user?.status);
  const userStatus = Number(user?.status ?? 0);
  const language = i18n.language;
  const roleTree = useMemo(() => currentRoleTree(tree, selectedRoleId), [selectedRoleId, tree]);
  const visibleMenus = useMemo(() => filteredMenus(roleTree, permissionSearch), [permissionSearch, roleTree]);
  const checkedSet = useMemo(() => new Set(checkedSubIds), [checkedSubIds]);
  const total = totalSubmenus(roleTree);
  const selectedCount = checkedSubIds.length;
  const loading = loadingOptions || loadingTree || loadingSaved;
  const selectedRole = roles.find((role) => role.roles_id === selectedRoleId);
  const selectedStore = stores.find((store) => store.store_uuid === selectedStoreUuid);
  const canReset = dirty && !saving && !loading;
  const canSave = Boolean(selectedStoreUuid && selectedRoleId && tree && dirty) && !saving && !loading;

  useEffect(() => {
    if (!allowed) router.replace("/");
  }, [allowed, router]);

  useEffect(() => {
    if (!allowed || !userStatus) return;
    void loadPermissionOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, language, userStatus]);

  useEffect(() => {
    if (!allowed || !userStatus || !selectedStoreUuid || !selectedRoleId) return;
    void loadPermissionTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, language, selectedRoleId, selectedStoreUuid, userStatus]);

  async function loadPermissionOptions() {
    try {
      await loadOptions(userStatus, language);
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
      await loadOptions(userStatus, language);
      await loadTree(userStatus, language);
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
      await loadTree(userStatus, language);
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
      await savePermissions(userStatus, language);
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
          <Button disabled={saving || loading} size="sm" type="button" variant="outline" onClick={refresh}>
            {loading ? <Spinner data-icon="inline-start" /> : <RefreshCcw data-icon="inline-start" />}
            {t("actions.refresh")}
          </Button>
          <Button disabled={!canReset} size="sm" type="button" variant="outline" onClick={resetChanges}>
            <RotateCcw data-icon="inline-start" />
            {t("storePermissions.resetChanges")}
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
                {selectedStore?.store_name
                  ? t("storePermissions.storeRoleContext", {
                    role: selectedRole?.role_name ?? "-",
                    store: selectedStore.store_name
                  })
                  : t("storePermissions.assignmentHint")}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <Badge className="border-primary/30 bg-primary/10 text-primary">
                <ShieldCheck />
                {t("storePermissions.selectedSummary", { selected: selectedCount, total })}
              </Badge>
              <Badge className={dirty ? "border-primary/30 bg-primary/10 text-primary" : undefined}>
                {dirty ? t("storePermissions.unsavedChanges") : t("storePermissions.noChanges")}
              </Badge>
            </div>
          </div>

          <FieldGroup className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(16rem,0.9fr)]">
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

            <Field className="gap-2">
              <FieldLabel htmlFor="permission-search">{t("storePermissions.searchPermissions")}</FieldLabel>
              <div className="flex min-w-0 items-center gap-2 rounded-md border border-input bg-background px-2.5 shadow-sm transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                <Search aria-hidden className="shrink-0 text-muted-foreground" />
                <Input
                  id="permission-search"
                  autoComplete="off"
                  className="h-9 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                  disabled={loading || saving}
                  placeholder={t("storePermissions.searchPlaceholder")}
                  value={permissionSearch}
                  onChange={(event) => setPermissionSearch(event.target.value)}
                />
              </div>
              <FieldDescription>{t("storePermissions.searchHint")}</FieldDescription>
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
            <div className="grid min-h-0 flex-1 lg:grid-cols-[20rem_minmax(0,1fr)]">
              <SavedPermissionsOverview
                roles={savedList?.roles ?? []}
                selectedRoleId={selectedRoleId}
              />
              <section className="flex min-h-0 min-w-0 flex-col">
                <div className="shrink-0 border-b border-border px-4 py-3 lg:px-5">
                  <Alert>
                    <ShieldCheck />
                    <AlertTitle>{t("storePermissions.assignmentTitle")}</AlertTitle>
                    <AlertDescription>
                      {t("storePermissions.editorHint", { role: selectedRole?.role_name ?? "-" })}
                    </AlertDescription>
                  </Alert>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-5">
                  {visibleMenus.length ? (
                    <div className="flex flex-col gap-3">
                      {visibleMenus.map((menu) => (
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
                  ) : (
                    <EmptyState
                      description={t("storePermissions.noSearchResultsDescription")}
                      title={t("storePermissions.noSearchResults")}
                    />
                  )}
                </div>
              </section>
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

function SavedPermissionsOverview({
  roles,
  selectedRoleId
}: {
  roles: StorePermissionRoleTree[];
  selectedRoleId: number | null;
}) {
  const { t } = useTranslation();

  return (
    <aside className="flex min-h-0 min-w-0 flex-col border-b border-border bg-muted/20 lg:border-b-0 lg:border-r">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="text-sm font-black">{t("storePermissions.savedOverview")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("storePermissions.savedOverviewHint")}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {roles.length ? (
          <div className="flex flex-col gap-2">
            {roles.map((role) => {
              const selected = role.role_id === selectedRoleId;
              const count = savedSubmenus(role);
              return (
                <div
                  key={role.role_id}
                  className={cn(
                    "rounded-md border border-border bg-background p-3 shadow-sm",
                    selected && "border-primary/40 bg-primary/5 ring-2 ring-primary/10"
                  )}
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{role.role_name || role.roles_name || "-"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("storePermissions.savedRoleSummary", { count })}
                      </p>
                    </div>
                    {selected ? (
                      <Badge className="shrink-0 border-primary/20 bg-primary/10 text-primary">
                        {t("storePermissions.editing")}
                      </Badge>
                    ) : null}
                  </div>
                  {role.menus.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {role.menus.map((menu) => (
                        <Badge key={menu.menu_id} className="max-w-full truncate">
                          {menu.menu_title || "-"}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            description={t("storePermissions.noSavedRolesDescription")}
            title={t("storePermissions.noSavedRoles")}
          />
        )}
      </div>
    </aside>
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
  const indeterminate = selection.someChecked && !selection.allChecked;

  return (
    <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <label className="flex min-w-0 cursor-pointer items-start gap-3">
          <PermissionCheckbox
            aria-checked={indeterminate ? "mixed" : selection.allChecked}
            aria-label={t("storePermissions.toggleMenu", { title: menu.menu_title })}
            checked={selection.allChecked}
            className="mt-1"
            disabled={saving || !selection.total}
            indeterminate={indeterminate}
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

      <div className="border-t border-border bg-muted/30 px-4 py-3">
        {selection.submenus.length ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {selection.submenus.map((submenu) => (
              <label
                key={submenu.sub_id}
                className={cn(
                  "flex min-w-0 cursor-pointer items-start gap-3 rounded-md border border-border bg-background px-3 py-2 shadow-sm transition-colors",
                  checkedSet.has(submenu.sub_id) && "border-primary/30 bg-primary/5"
                )}
              >
                <Checkbox
                  aria-label={submenu.sub_title}
                  checked={checkedSet.has(submenu.sub_id)}
                  className="mt-1"
                  disabled={saving}
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
