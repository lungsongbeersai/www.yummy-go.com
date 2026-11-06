"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, CheckCircle2, ChevronsDownUp, ChevronsUpDown, CircleX, FlaskConical, RefreshCcw, Search, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { LoadingState } from "@/components/common/loading-state";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { SettingsPageHeader } from "@/features/settings/shared/settings-page-header";
import { canManageStorePermissions } from "@/lib/permissions";
import { canConfigureTrialStorePermissions, resolveTrialPermissionContext, TRIAL_PERMISSION_ROLE_ID } from "@/lib/trial-store-permissions";
import type { StorePermissionRoleTree, StorePermissionTree } from "@/services/permissions/access";
import { useAuthStore } from "@/stores/auth-store";
import { usePermissionsAccessStore } from "@/stores/permissions-access-store";
import { useToastStore } from "@/stores/toast-store";
import {
  menuSubmenus,
  PermissionEmpty,
  PermissionGroupList,
  PermissionProgress,
  PermissionRoleList,
  PermissionSaveBar,
  PermissionStorePicker,
  type PermissionMenuGroup
} from "./store-permissions-panels";

/** A switch that would drop unsaved ticks, held until the user confirms. */
type PendingSwitch = { type: "refresh" } | { roleId: number; type: "role" } | { storeUuid: string; type: "store" }
  | { storeUuid: string; roleId: number; type: "trial" };

interface StorePermissionsPageProps {
  initialTrialContext?: { storeUuid?: string | string[]; roleId?: string | string[] };
}

function currentRoleTree(tree: StorePermissionTree | null, roleId: number | null) {
  if (!tree || !roleId) return null;
  return tree.roles.find((role) => role.role_id === roleId) ?? tree.roles[0] ?? null;
}

function totalSubmenus(roleTree: StorePermissionRoleTree | null) {
  return roleTree?.menus.reduce((sum, menu) => sum + menu.sub_detail.length, 0) ?? 0;
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

export function StorePermissionsPage({ initialTrialContext }: StorePermissionsPageProps) {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hasTrialRequest = initialTrialContext?.storeUuid !== undefined;
  const requestedStoreUuid = typeof initialTrialContext?.storeUuid === "string" ? initialTrialContext.storeUuid : "";
  const requestedRoleId = initialTrialContext?.roleId === undefined ? null
    : typeof initialTrialContext.roleId === "string" ? initialTrialContext.roleId : "invalid";
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
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch | null>(null);
  const [trialContextResult, setTrialContextResult] = useState<{ key: string; valid: boolean } | null>(null);
  const initializedTrialContext = useRef("");
  const optionsRequestId = useRef(0);
  const allowed = canManageStorePermissions(user?.status);
  const loginUuid = user?.uuid ?? "";
  const userStatus = Number(user?.status ?? 0);
  const trialContextKey = hasTrialRequest
    ? JSON.stringify([loginUuid, userStatus, user?.store_status, requestedStoreUuid, requestedRoleId]) : "";
  const trialContextPending = hasTrialRequest && trialContextResult?.key !== trialContextKey;
  const trialContextError = hasTrialRequest && trialContextResult?.key === trialContextKey && !trialContextResult.valid;
  const language = i18n.language;
  const roleTree = useMemo(() => currentRoleTree(tree, selectedRoleId), [selectedRoleId, tree]);
  const visibleGroups = useMemo(() => filteredMenuGroups(roleTree, permissionSearch), [permissionSearch, roleTree]);
  const visibleMenuIds = useMemo(
    () => visibleGroups.map((group) => group.menu.menu_id).filter(Boolean),
    [visibleGroups]
  );
  const checkedSet = useMemo(() => new Set(checkedSubIds), [checkedSubIds]);
  // Saved submenus per role for this store, shown beside each role.
  const savedCounts = useMemo(
    () =>
      new Map(
        (savedList?.roles ?? []).map((role) => [
          role.role_id,
          role.menus.reduce((sum, menu) => sum + menu.sub_detail.length, 0)
        ])
      ),
    [savedList]
  );
  const total = totalSubmenus(roleTree);
  const selectedCount = checkedSubIds.length;
  const loading = loadingOptions || loadingTree || loadingSaved || trialContextPending;
  const selectedRole = roles.find((role) => role.roles_id === selectedRoleId);
  const selectedStore = stores.find((store) => store.store_uuid === selectedStoreUuid);
  const trialRole = roles.find((role) => role.roles_id === TRIAL_PERMISSION_ROLE_ID);
  const showTrialContext = canConfigureTrialStorePermissions(user) && selectedStore?.store_status === 3;
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

  const loadPermissionOptions = useCallback(() => {
    const requestId = ++optionsRequestId.current;
    return loadOptions(loginUuid, language).then(() => {
      if (requestId !== optionsRequestId.current || useAuthStore.getState().user?.uuid !== loginUuid) return;
      if (hasTrialRequest && initializedTrialContext.current !== trialContextKey) {
        const state = usePermissionsAccessStore.getState();
        const context = resolveTrialPermissionContext(useAuthStore.getState().user, requestedStoreUuid, requestedRoleId, state);
        if (!context) {
          setTrialContextResult({ key: trialContextKey, valid: false });
          return;
        }
        const changed = state.selectedStoreUuid !== context.storeUuid || state.selectedRoleId !== context.roleId;
        if (changed && state.dirty) setPendingSwitch({ ...context, type: "trial" });
        else if (changed) {
          setStore(context.storeUuid);
          setRole(context.roleId);
        }
        initializedTrialContext.current = trialContextKey;
      }
      if (hasTrialRequest) setTrialContextResult({ key: trialContextKey, valid: true });
      else {
        initializedTrialContext.current = "";
        setTrialContextResult(null);
      }
    }).catch((error: unknown) => {
      if (requestId !== optionsRequestId.current) return;
      if (hasTrialRequest) setTrialContextResult({ key: trialContextKey, valid: false });
      else {
        initializedTrialContext.current = "";
        setTrialContextResult(null);
      }
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("storePermissions.loadFailed"),
        tone: "error"
      });
    });
  }, [hasTrialRequest, language, loadOptions, loginUuid, requestedRoleId, requestedStoreUuid, setRole, setStore, showToast, t, trialContextKey]);

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
    return () => { optionsRequestId.current += 1; };
  }, [allowed, loadPermissionOptions, loginUuid]);

  useEffect(() => {
    if (!allowed || !userStatus || !selectedStoreUuid || !selectedRoleId || trialContextPending || trialContextError) return;
    const current = usePermissionsAccessStore.getState();
    if (current.dirty && current.tree?.company_uuid_fk === selectedStoreUuid
      && current.tree.roles.some((role) => role.role_id === selectedRoleId)) return;
    void loadPermissionTree();
  }, [allowed, loadPermissionTree, selectedRoleId, selectedStoreUuid, trialContextError, trialContextPending, userStatus]);

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

  function applySwitch(next: PendingSwitch) {
    if (next.type === "store") setStore(next.storeUuid);
    else if (next.type === "role") setRole(next.roleId);
    else if (next.type === "trial") {
      setStore(next.storeUuid);
      setRole(next.roleId);
    }
    else void refresh();
  }

  // Changing store or role (or reloading) throws the ticks away, so ask first when some are unsaved.
  function requestSwitch(next: PendingSwitch) {
    if (next.type === "store" && next.storeUuid === selectedStoreUuid) return;
    if (next.type === "role" && next.roleId === selectedRoleId) return;
    if (dirty) setPendingSwitch(next);
    else applySwitch(next);
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
  if (trialContextError) return (
    <div className="p-4">
      <Alert variant="destructive" className="max-w-xl rounded-xl p-4 font-lao">
        <ShieldCheck aria-hidden />
        <AlertTitle>{t("storePermissions.trialUnavailable")}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <p>{t("storePermissions.trialUnavailableHint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/settings/manage-access-permissions">{t("storePermissions.title")}</Link>
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => void loadPermissionOptions()}>{t("actions.refresh")}</Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );

  const savedTotal = [...savedCounts.values()].reduce((sum, count) => sum + count, 0);

  return (
    // The page is the container: once the setup and permission cards fit side by side (@4xl) the
    // page stops scrolling and the permission list scrolls inside its card; narrower, the whole
    // page scrolls and the save bar sticks to the bottom.
    <div className="@container h-full min-h-0 overflow-y-auto">
      <div className="flex flex-col gap-4 p-4 @4xl:h-full">
        <SettingsPageHeader
          icon={ShieldCheck}
          title={t("storePermissions.title")}
          description={
            selectedStore?.store_name
              ? t("storePermissions.storeRoleContext", { role: selectedRole?.role_name ?? "-", store: selectedStore.store_name })
              : t("storePermissions.description")
          }
          actions={
            <Button disabled={saving || loading} type="button" variant="outline" onClick={() => requestSwitch({ type: "refresh" })}>
              {loading ? <Spinner data-icon="inline-start" /> : <RefreshCcw data-icon="inline-start" />}
              {t("actions.refresh")}
            </Button>
          }
        />

        {showTrialContext ? (
          <Alert role="status" className="shrink-0 rounded-xl border-primary/20 bg-primary/5 p-4 font-lao">
            <FlaskConical aria-hidden className="text-primary" />
            <AlertTitle>{t("storePermissions.trialTitle")}</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <p>{selectedRoleId === TRIAL_PERMISSION_ROLE_ID
                ? t("storePermissions.trialHint")
                : t("storePermissions.trialRoleHint", { role: trialRole?.role_name ?? "-" })}</p>
              {trialRole && selectedRoleId !== TRIAL_PERMISSION_ROLE_ID ? (
                <Button type="button" variant="outline" className="min-h-11" disabled={saving || loading} onClick={() => requestSwitch({ roleId: TRIAL_PERMISSION_ROLE_ID, type: "role" })}>
                  {t("storePermissions.configureTrial")}
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-4 @4xl:grid @4xl:min-h-0 @4xl:flex-1 @4xl:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
          {/* Setup: which store and role is being edited, and how much of the menu it opens. */}
          <Card className="shrink-0 gap-4 p-3 @4xl:min-h-0 @4xl:overflow-y-auto">
            <PermissionStorePicker
              disabled={loadingOptions || saving}
              stores={stores}
              value={selectedStoreUuid}
              onValueChange={(storeUuid) => requestSwitch({ storeUuid, type: "store" })}
            />
            <PermissionRoleList
              disabled={loadingOptions || saving}
              roles={roles}
              savedCounts={savedCounts}
              value={selectedRoleId}
              onValueChange={(roleId) => requestSwitch({ roleId, type: "role" })}
            />
            <Separator />
            <PermissionProgress selected={selectedCount} total={total} />
            {savedList ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 aria-hidden className="size-3.5 shrink-0" />
                {t("storePermissions.savedSummaryCompact", { count: savedTotal })}
              </p>
            ) : null}
          </Card>

          <div className="flex min-w-0 flex-col gap-3 @4xl:min-h-0">
            <Card className="gap-0 py-0 @4xl:min-h-0 @4xl:flex-1">
              <div className="flex shrink-0 flex-col gap-3 border-b p-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <div className="flex min-w-48 flex-1 flex-col gap-0.5">
                    <h2 className="text-sm font-semibold">{t("storePermissions.tableTitle")}</h2>
                    <p className="text-xs text-muted-foreground">{t("storePermissions.tableHint")}</p>
                  </div>
                  <InputGroup className="@xl:max-w-64">
                    <InputGroupAddon>
                      <Search />
                    </InputGroupAddon>
                    <InputGroupInput
                      aria-label={t("storePermissions.searchPermissions")}
                      autoComplete="off"
                      disabled={loading || saving}
                      name="permission_search"
                      placeholder={t("storePermissions.searchPlaceholder")}
                      value={permissionSearch}
                      onChange={(event) => setPermissionSearch(event.target.value)}
                    />
                  </InputGroup>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button disabled={!canSelectAll} type="button" variant="outline" onClick={selectAllSubmenus}>
                    <CheckCheck data-icon="inline-start" />
                    {t("storePermissions.selectAll")}
                  </Button>
                  <Button disabled={!canClearAll} type="button" variant="outline" onClick={clearAllSubmenus}>
                    <CircleX data-icon="inline-start" />
                    {t("storePermissions.clearAll")}
                  </Button>
                  <Button
                    className="ml-auto"
                    disabled={!canToggleGroups}
                    type="button"
                    variant="ghost"
                    onClick={toggleAllMenuGroups}
                  >
                    {allCollapsed ? <ChevronsUpDown data-icon="inline-start" /> : <ChevronsDownUp data-icon="inline-start" />}
                    {allCollapsed ? t("actions.expandAll") : t("actions.collapseAll")}
                  </Button>
                </div>
              </div>

              {/* settings-table-scroll keeps the bottom safe-area clear (see globals.css). */}
              <div className="settings-table-scroll flex min-h-0 flex-1 flex-col p-3 @4xl:overflow-y-auto">
                {loading ? (
                  <LoadingState label={t("storePermissions.loading")} variant="settingsTable" />
                ) : !stores.length || !roles.length ? (
                  <PermissionEmpty
                    description={t("storePermissions.noOptionsDescription")}
                    title={t("storePermissions.noOptions")}
                  />
                ) : roleTree?.menus.length ? (
                  visibleGroups.length ? (
                    <div className="@container">
                      <PermissionGroupList
                        checkedSet={checkedSet}
                        collapsedMenuIds={collapsedMenuIds}
                        groups={visibleGroups}
                        searchActive={searchActive}
                        saving={saving}
                        onToggleCollapse={toggleMenuCollapse}
                        onToggleMenu={toggleMenu}
                        onToggleSubmenu={toggleSubmenu}
                      />
                    </div>
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
              </div>
            </Card>

            <PermissionSaveBar
              canReset={canReset}
              canSave={canSave}
              dirty={dirty}
              saving={saving}
              onReset={resetChanges}
              onSave={save}
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("storePermissions.discardConfirm")}
        description={t("storePermissions.discardDescription")}
        open={Boolean(pendingSwitch)}
        title={t("storePermissions.discardTitle")}
        onConfirm={() => {
          if (pendingSwitch) applySwitch(pendingSwitch);
          setPendingSwitch(null);
        }}
        onOpenChange={(open) => {
          if (!open) setPendingSwitch(null);
        }}
      />
    </div>
  );
}
