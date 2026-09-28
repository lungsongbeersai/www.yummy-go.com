"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SettingsPageHeader } from "@/features/settings/shared/settings-page-header";
import { canManageStorePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type {
  StorePermissionMenu,
  StorePermissionRoleTree,
  StorePermissionSubMenu,
  StorePermissionTree
} from "@/services/permissions/access";
import { useAuthStore } from "@/stores/auth-store";
import { usePermissionsAccessStore } from "@/stores/permissions-access-store";
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
  checked,
  ...props
}: ComponentProps<typeof Checkbox> & { indeterminate?: boolean }) {
  return (
    <Checkbox
      checked={indeterminate ? "indeterminate" : checked}
      {...props}
    />
  );
}

export function StorePermissionsPage() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.show);
  const checkedSubIds = usePermissionsAccessStore((state) => state.checkedSubIds);
  const dirty = usePermissionsAccessStore((state) => state.dirty);
  const loadingOptions = usePermissionsAccessStore((state) => state.loadingOptions);
  const loadingSaved = usePermissionsAccessStore((state) => state.loadingSaved);
  const loadingTree = usePermissionsAccessStore((state) => state.loadingTree);
  const roles = usePermissionsAccessStore((state) => state.roles);
  const savedList = usePermissionsAccessStore((state) => state.savedList);
  const saving = usePermissionsAccessStore((state) => state.saving);
  const selectedRoleId = usePermissionsAccessStore((state) => state.selectedRoleId);
  const selectedStoreUuid = usePermissionsAccessStore((state) => state.selectedStoreUuid);
  const stores = usePermissionsAccessStore((state) => state.stores);
  const tree = usePermissionsAccessStore((state) => state.tree);
  const loadOptions = usePermissionsAccessStore((state) => state.loadOptions);
  const loadTree = usePermissionsAccessStore((state) => state.loadTree);
  const resetChanges = usePermissionsAccessStore((state) => state.resetChanges);
  const savePermissions = usePermissionsAccessStore((state) => state.save);
  const clearAllSubmenus = usePermissionsAccessStore((state) => state.clearAllSubmenus);
  const selectAllSubmenus = usePermissionsAccessStore((state) => state.selectAllSubmenus);
  const setRole = usePermissionsAccessStore((state) => state.setRole);
  const setStore = usePermissionsAccessStore((state) => state.setStore);
  const toggleMenu = usePermissionsAccessStore((state) => state.toggleMenu);
  const toggleSubmenu = usePermissionsAccessStore((state) => state.toggleSubmenu);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [collapsedMenuIds, setCollapsedMenuIds] = useState<Set<string>>(() => new Set());
  const allowed = canManageStorePermissions(user?.status);
  const loginUuid = user?.uuid ?? "";
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

  const loadPermissionOptions = useCallback(async () => {
    try {
      await loadOptions(loginUuid, language);
    } catch (error) {
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("storePermissions.loadFailed"),
        tone: "error"
      });
    }
  }, [language, loadOptions, loginUuid, showToast, t]);

  const loadPermissionTree = useCallback(async () => {
    try {
      await loadTree(userStatus, language);
    } catch (error) {
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("storePermissions.treeLoadFailed"),
        tone: "error"
      });
    }
  }, [language, loadTree, showToast, t, userStatus]);

  useEffect(() => {
    if (!allowed) router.replace("/");
  }, [allowed, router]);

  useEffect(() => {
    if (!allowed || !loginUuid) return;
    void loadPermissionOptions();
  }, [allowed, loadPermissionOptions, loginUuid]);

  useEffect(() => {
    if (!allowed || !userStatus || !selectedStoreUuid || !selectedRoleId) return;
    void loadPermissionTree();
  }, [allowed, loadPermissionTree, selectedRoleId, selectedStoreUuid, userStatus]);

  async function refresh() {
    try {
      await loadOptions(loginUuid, language);
      await loadTree(userStatus, language);
    } catch (error) {
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("storePermissions.loadFailed"),
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
    // Same frame as the settings list pages: header card, filter row, then the permission table in
    // a bordered card that scrolls inside itself on wide screens (the whole page scrolls on phones).
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 lg:overflow-hidden">
      <SettingsPageHeader
        icon={ShieldCheck}
        title={t("storePermissions.title")}
        description={
          selectedStore?.store_name
            ? t("storePermissions.storeRoleContext", { role: selectedRole?.role_name ?? "-", store: selectedStore.store_name })
            : t("storePermissions.description")
        }
        actions={
          <>
            <Badge variant="secondary" className="tabular-nums">
              {t("storePermissions.selectedSummary", { selected: selectedCount, total })}
            </Badge>
            {/* Unsaved changes are the one thing to act on here, so only they get the filled badge. */}
            <Badge variant={dirty ? "default" : "outline"}>
              {dirty ? t("storePermissions.unsavedChanges") : t("storePermissions.noChanges")}
            </Badge>
            <Button disabled={!canSave} type="button" onClick={save}>
              {saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              {t("actions.save")}
            </Button>
          </>
        }
      />

      <div className="grid shrink-0 items-end gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <FieldGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field>
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

          <Field>
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

          <Field className="sm:col-span-2 lg:col-span-1">
            <FieldLabel htmlFor="permission-search">{t("storePermissions.searchPermissions")}</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                id="permission-search"
                autoComplete="off"
                disabled={loading || saving}
                name="permission_search"
                placeholder={t("storePermissions.searchPlaceholder")}
                value={permissionSearch}
                onChange={(event) => setPermissionSearch(event.target.value)}
              />
            </InputGroup>
          </Field>
        </FieldGroup>

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={saving || loading} type="button" variant="outline" onClick={refresh}>
            {loading ? <Spinner data-icon="inline-start" /> : <RefreshCcw data-icon="inline-start" />}
            {t("actions.refresh")}
          </Button>
          <Button disabled={!canReset} type="button" variant="outline" onClick={resetChanges}>
            <RotateCcw data-icon="inline-start" />
            {t("storePermissions.resetChanges")}
          </Button>
        </div>
      </div>

      {/* shrink-0 isn't wanted here: this card is the part that takes the remaining height. */}
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="shrink-0 border-b">
          <CardTitle>{t("storePermissions.tableTitle")}</CardTitle>
          <CardDescription>{t("storePermissions.tableHint")}</CardDescription>
          {/* A row of its own under the description: four buttons beside the title would squeeze it. */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <SavedPermissionsSummary roles={savedList?.roles ?? []} />
            <Button disabled={!canToggleGroups} type="button" variant="outline" onClick={toggleAllMenuGroups}>
              {allCollapsed ? <ChevronDown data-icon="inline-start" /> : <ChevronRight data-icon="inline-start" />}
              {allCollapsed ? t("actions.expandAll") : t("actions.collapseAll")}
            </Button>
            <Button disabled={!canSelectAll} type="button" variant="outline" onClick={selectAllSubmenus}>
              <CheckCheck data-icon="inline-start" />
              {t("storePermissions.selectAll")}
            </Button>
            <Button disabled={!canClearAll} type="button" variant="outline" onClick={clearAllSubmenus}>
              <CircleX data-icon="inline-start" />
              {t("storePermissions.clearAll")}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {loading ? (
            <div className="min-h-0 flex-1 p-4">
              <LoadingState label={t("storePermissions.loading")} variant="settingsTable" />
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
    // settings-table-scroll กันพื้นที่ safe-area ล่างให้แล้ว (ดู globals.css) — หน้านี้ไม่มี
    // pagination/footer แบบ AppPagination (settings-shell.tsx) ที่กันไว้ให้เอง
    <div className="settings-table-scroll min-h-0 flex-1 overflow-auto">
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
                      onCheckedChange={(checked) => onToggleMenu(menu.menu_id, checked as boolean)}
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
                            onCheckedChange={(checked) => onToggleSubmenu(submenu.sub_id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell className="max-w-[32rem]">
                          <Label htmlFor={submenuInputId} className="flex min-w-0 cursor-pointer items-center gap-2 pl-3">
                            <span aria-hidden className="h-6 w-4 shrink-0 rounded-bl-md border-b border-l border-border" />
                            <span className="block min-w-0 truncate font-black">{submenu.sub_title || "-"}</span>
                          </Label>
                        </TableCell>
                        <TableCell className="max-w-[28rem]">
                          <Label
                            htmlFor={submenuInputId}
                            className="block min-w-0 cursor-pointer truncate font-mono text-xs text-muted-foreground"
                            translate="no"
                          >
                            {submenu.sub_path || "-"}
                          </Label>
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