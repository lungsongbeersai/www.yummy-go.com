"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleX,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canManageStorePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type {
  StorePermissionMenu,
  StorePermissionRoleTree,
  StorePermissionSubMenu,
  StorePermissionTree
} from "@/services/store-permissions";
import { useAuthStore } from "@/stores/auth-store";
import { useStorePermissionsStore } from "@/stores/store-permissions-store";
import { useToastStore } from "@/stores/toast-store";

interface PermissionMenuGroup {
  menu: StorePermissionMenu;
  submenus: StorePermissionSubMenu[];
}

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

function filteredMenuGroups(roleTree: StorePermissionRoleTree | null, search: string): PermissionMenuGroup[] {
  if (!roleTree) return [];
  const query = search.trim().toLowerCase();

  return roleTree.menus.reduce<PermissionMenuGroup[]>((groups, menu) => {
    const submenus = menuSubmenus(menu);
    const menuMatches = matchesSearch(menu.menu_title, query) || matchesSearch(menu.menu_path, query);
    const visibleSubmenus = !query || menuMatches
      ? submenus
      : submenus.filter((submenu) =>
        matchesSearch(submenu.sub_title, query) || matchesSearch(submenu.sub_path, query)
      );

    if (!query || menuMatches || visibleSubmenus.length) {
      groups.push({ menu, submenus: visibleSubmenus });
    }

    return groups;
  }, []);
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
  const clearAllSubmenus = useStorePermissionsStore((state) => state.clearAllSubmenus);
  const selectAllSubmenus = useStorePermissionsStore((state) => state.selectAllSubmenus);
  const setRole = useStorePermissionsStore((state) => state.setRole);
  const setStore = useStorePermissionsStore((state) => state.setStore);
  const toggleMenu = useStorePermissionsStore((state) => state.toggleMenu);
  const toggleSubmenu = useStorePermissionsStore((state) => state.toggleSubmenu);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [collapsedMenuIds, setCollapsedMenuIds] = useState<Set<string>>(() => new Set());
  const allowed = canManageStorePermissions(user?.status);
  const userStatus = Number(user?.status ?? 0);
  const language = i18n.language;
  const roleTree = useMemo(() => currentRoleTree(tree, selectedRoleId), [selectedRoleId, tree]);
  const visibleGroups = useMemo(() => filteredMenuGroups(roleTree, permissionSearch), [permissionSearch, roleTree]);
  const visibleMenuIds = useMemo(
    () => visibleGroups.map((group) => group.menu.menu_id).filter(Boolean),
    [visibleGroups]
  );
  const checkedSet = useMemo(() => new Set(checkedSubIds), [checkedSubIds]);
  const total = totalSubmenus(roleTree);
  const selectedCount = checkedSubIds.length;
  const loading = loadingOptions || loadingTree || loadingSaved;
  const selectedRole = roles.find((role) => role.roles_id === selectedRoleId);
  const selectedStore = stores.find((store) => store.store_uuid === selectedStoreUuid);
  const searchActive = Boolean(permissionSearch.trim());
  const allCollapsed = Boolean(
    visibleMenuIds.length &&
    visibleMenuIds.every((menuId) => collapsedMenuIds.has(menuId))
  );
  const canSelectAll = Boolean(roleTree && total > 0 && selectedCount < total) && !saving && !loading;
  const canClearAll = Boolean(selectedCount) && !saving && !loading;
  const canToggleGroups = Boolean(visibleMenuIds.length) && !searchActive;
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

  function toggleMenuCollapse(menuId: string) {
    if (!menuId) return;
    setCollapsedMenuIds((current) => {
      const next = new Set(current);
      if (next.has(menuId)) next.delete(menuId);
      else next.add(menuId);
      return next;
    });
  }

  function toggleAllMenuGroups() {
    if (searchActive || !visibleMenuIds.length) return;
    setCollapsedMenuIds((current) => {
      const next = new Set(current);
      visibleMenuIds.forEach((menuId) => {
        if (allCollapsed) next.delete(menuId);
        else next.add(menuId);
      });
      return next;
    });
  }

  if (!allowed) return <LoadingState label={t("common.processing")} variant="table" />;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 flex-col gap-3 border-b border-border bg-card px-4 py-3 lg:px-5">
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary [&_svg]:size-5">
              <ShieldCheck aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-primary">{t("storePermissions.kicker")}</p>
              <h1 className="truncate text-lg font-black">{t("storePermissions.title")}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {selectedStore?.store_name
                  ? t("storePermissions.storeRoleContext", {
                    role: selectedRole?.role_name ?? "-",
                    store: selectedStore.store_name
                  })
                  : t("storePermissions.description")}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge className="border-primary/30 bg-primary/10 text-primary [&_svg]:size-3.5">
              <ShieldCheck />
              {t("storePermissions.selectedSummary", { selected: selectedCount, total })}
            </Badge>
            <Badge className={dirty ? "border-primary/30 bg-primary/10 text-primary" : undefined}>
              {dirty ? t("storePermissions.unsavedChanges") : t("storePermissions.noChanges")}
            </Badge>
            <Button disabled={!canSave} size="sm" type="button" onClick={save}>
              {saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              {t("actions.save")}
            </Button>
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <FieldGroup className="grid gap-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_minmax(16rem,1.1fr)]">
            <Field className="gap-1">
              <FieldLabel htmlFor="permission-store-select">{t("storePermissions.store")}</FieldLabel>
              <Select disabled={loadingOptions || saving} value={selectedStoreUuid} onValueChange={setStore}>
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
            </Field>

            <Field className="gap-1">
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
            </Field>

            <Field className="gap-1">
              <FieldLabel htmlFor="permission-search">{t("storePermissions.searchPermissions")}</FieldLabel>
              <div className="flex min-w-0 items-center gap-2 rounded-md border border-input bg-background px-2.5 shadow-sm transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                <Search aria-hidden className="shrink-0 text-muted-foreground" />
                <Input
                  id="permission-search"
                  autoComplete="off"
                  className="h-9 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                  disabled={loading || saving}
                  name="permission_search"
                  placeholder={t("storePermissions.searchPlaceholder")}
                  value={permissionSearch}
                  onChange={(event) => setPermissionSearch(event.target.value)}
                />
              </div>
            </Field>
          </FieldGroup>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button disabled={saving || loading} size="sm" type="button" variant="outline" onClick={refresh}>
              {loading ? <Spinner data-icon="inline-start" /> : <RefreshCcw data-icon="inline-start" />}
              {t("actions.refresh")}
            </Button>
            <Button disabled={!canReset} size="sm" type="button" variant="outline" onClick={resetChanges}>
              <RotateCcw data-icon="inline-start" />
              {t("storePermissions.resetChanges")}
            </Button>
          </div>
        </div>
      </header>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-b-0 border-t-0 shadow-none">
        <CardHeader className="shrink-0 flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-5">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{t("storePermissions.tableTitle")}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{t("storePermissions.tableHint")}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <SavedPermissionsSummary roles={savedList?.roles ?? []} />
            <Button disabled={!canToggleGroups} size="sm" type="button" variant="outline" onClick={toggleAllMenuGroups}>
              {allCollapsed ? <ChevronDown data-icon="inline-start" /> : <ChevronRight data-icon="inline-start" />}
              {allCollapsed ? t("actions.expandAll") : t("actions.collapseAll")}
            </Button>
            <Button disabled={!canSelectAll} size="sm" type="button" variant="outline" onClick={selectAllSubmenus}>
              <CheckCheck data-icon="inline-start" />
              {t("storePermissions.selectAll")}
            </Button>
            <Button disabled={!canClearAll} size="sm" type="button" variant="outline" onClick={clearAllSubmenus}>
              <CircleX data-icon="inline-start" />
              {t("storePermissions.clearAll")}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {loading ? (
            <div className="min-h-0 flex-1 p-4">
              <LoadingState label={t("storePermissions.loading")} variant="table" />
            </div>
          ) : !stores.length || !roles.length ? (
            <PermissionEmpty
              description={t("storePermissions.noOptionsDescription")}
              title={t("storePermissions.noOptions")}
            />
          ) : roleTree?.menus.length ? (
            visibleGroups.length ? (
              <PermissionTable
                checkedSet={checkedSet}
                collapsedMenuIds={collapsedMenuIds}
                groups={visibleGroups}
                searchActive={searchActive}
                saving={saving}
                onToggleCollapse={toggleMenuCollapse}
                onToggleMenu={toggleMenu}
                onToggleSubmenu={toggleSubmenu}
              />
            ) : (
              <PermissionEmpty
                description={t("storePermissions.noSearchResultsDescription")}
                title={t("storePermissions.noSearchResults")}
              />
            )
          ) : (
            <PermissionEmpty
              description={t("storePermissions.emptyTreeDescription")}
              title={t("storePermissions.emptyTree")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SavedPermissionsSummary({ roles }: { roles: StorePermissionRoleTree[] }) {
  const { t } = useTranslation();
  const totalSaved = roles.reduce((sum, role) => sum + savedSubmenus(role), 0);

  return (
    <Badge className="[&_svg]:size-3.5">
      <CheckCircle2 />
      {t("storePermissions.savedSummaryCompact", { count: totalSaved })}
    </Badge>
  );
}

function PermissionTable({
  checkedSet,
  collapsedMenuIds,
  groups,
  searchActive,
  saving,
  onToggleCollapse,
  onToggleMenu,
  onToggleSubmenu
}: {
  checkedSet: Set<string>;
  collapsedMenuIds: Set<string>;
  groups: PermissionMenuGroup[];
  searchActive: boolean;
  saving: boolean;
  onToggleCollapse: (menuId: string) => void;
  onToggleMenu: (menuId: string, checked: boolean) => void;
  onToggleSubmenu: (subId: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table className="min-w-[820px]">
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-12 px-3 text-center">{t("storePermissions.access")}</TableHead>
            <TableHead className="min-w-[18rem]">{t("storePermissions.menuColumn")}</TableHead>
            <TableHead className="min-w-[18rem]">{t("permissionMenu.columns.path")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map(({ menu, submenus }) => {
            const selection = menuSelection(menu, checkedSet);
            const indeterminate = selection.someChecked && !selection.allChecked;
            const collapsed = searchActive ? false : collapsedMenuIds.has(menu.menu_id);
            const menuInputId = `permission-menu-${menu.menu_id}`;

            return (
              <Fragment key={menu.menu_id}>
                <TableRow className="border-t border-border bg-muted/40 hover:bg-muted/60">
                  <TableCell className="w-12 px-3 text-center">
                    <PermissionCheckbox
                      id={menuInputId}
                      aria-checked={indeterminate ? "mixed" : selection.allChecked}
                      aria-label={t("storePermissions.toggleMenu", { title: menu.menu_title || menu.menu_path || "-" })}
                      checked={selection.allChecked}
                      disabled={saving || !selection.total}
                      indeterminate={indeterminate}
                      onChange={(event) => onToggleMenu(menu.menu_id, event.target.checked)}
                    />
                  </TableCell>
                  <TableCell colSpan={2} className="px-2 py-0">
                    <Button
                      aria-expanded={!collapsed}
                      aria-label={
                        collapsed
                          ? t("storePermissions.expandMenu", { title: menu.menu_title || menu.menu_path || "-" })
                          : t("storePermissions.collapseMenu", { title: menu.menu_title || menu.menu_path || "-" })
                      }
                      className="h-auto w-full justify-start px-2 py-2 text-left font-bold disabled:cursor-default disabled:opacity-100"
                      disabled={searchActive}
                      type="button"
                      variant="ghost"
                      onClick={() => onToggleCollapse(menu.menu_id)}
                    >
                      {collapsed ? <ChevronRight data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
                      <ShieldCheck data-icon="inline-start" />
                      <span className="min-w-0 flex-1 truncate">{menu.menu_title || "-"}</span>
                      <Badge className="bg-primary/10 text-primary tabular-nums">
                        {t("storePermissions.selectedCount", selection)}
                      </Badge>
                      <span className="hidden min-w-0 max-w-64 truncate font-mono text-xs font-normal text-muted-foreground lg:block" translate="no">
                        {menu.menu_path || "-"}
                      </span>
                    </Button>
                  </TableCell>
                </TableRow>

                {collapsed ? null : submenus.length ? (
                  submenus.map((submenu) => {
                    const checked = checkedSet.has(submenu.sub_id);
                    const submenuInputId = `permission-submenu-${submenu.sub_id}`;

                    return (
                      <TableRow key={submenu.sub_id} className="bg-background" data-state={checked ? "selected" : undefined}>
                        <TableCell className="w-12 px-3 text-center">
                          <Checkbox
                            id={submenuInputId}
                            aria-label={submenu.sub_title || submenu.sub_path || submenu.sub_id}
                            checked={checked}
                            disabled={saving}
                            onChange={(event) => onToggleSubmenu(submenu.sub_id, event.target.checked)}
                          />
                        </TableCell>
                        <TableCell className="max-w-[32rem]">
                          <label htmlFor={submenuInputId} className="flex min-w-0 cursor-pointer items-center gap-2 pl-3">
                            <span aria-hidden className="h-6 w-4 shrink-0 rounded-bl-md border-b border-l border-border" />
                            <span className="block min-w-0 truncate font-black">{submenu.sub_title || "-"}</span>
                          </label>
                        </TableCell>
                        <TableCell className="max-w-[28rem]">
                          <label
                            htmlFor={submenuInputId}
                            className="block min-w-0 cursor-pointer truncate font-mono text-xs text-muted-foreground"
                            translate="no"
                          >
                            {submenu.sub_path || "-"}
                          </label>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell className="w-12 px-3" />
                    <TableCell colSpan={2} className="h-12 text-sm text-muted-foreground">
                      {t("storePermissions.noSubmenus")}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function PermissionEmpty({
  className,
  description,
  title
}: {
  className?: string;
  description: string;
  title: string;
}) {
  return (
    <Empty className={cn("min-h-72 flex-1 border-0", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
          <ShieldCheck aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
