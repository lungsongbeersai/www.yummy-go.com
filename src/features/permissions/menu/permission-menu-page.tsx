"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { useRouter } from "next/navigation";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ListTree, Plus, RefreshCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { LoadingState } from "@/components/common/loading-state";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SettingsPageHeader } from "@/features/settings/shared/settings-page-header";
import { useLatestValue } from "@/hooks/use-latest-value";
import { canManagePermissionMenu } from "@/lib/permissions";
import {
  PermissionSubMenuMoveError,
  type PermissionMainMenu,
  type PermissionSubMenu
} from "@/services/permissions/menu-admin";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { usePermissionsMenuStore } from "@/stores/permissions-menu-store";
import { usePermissionsSidebarStore } from "@/stores/permissions-sidebar-store";
import { useToastStore } from "@/stores/toast-store";
import { MainMenuDialog, SubMenuDialog } from "./permission-menu-dialogs";
import { MAIN_FORM_INITIAL, SUB_FORM_INITIAL, type MainFormState, type SubFormState } from "./permission-menu-options";
import { PermissionMenuBuilder } from "./permission-menu-builder";
import {
  MoveSubMenuDialog,
  type PermissionSubMenuMoveRequest,
  type PermissionSubMenuMoveTarget
} from "./permission-menu-move-dialog";
import { refreshPermissionSidebarMenu } from "./permission-menu-sidebar-refresh";
import {
  filterPermissionMenus,
  movePermissionItem,
  menuSubmenus,
  resolveSelectedPermissionMenuId,
  type PermissionMenuMoveDirection,
  type PermissionMenuDeleteTarget
} from "./permission-menu-utils";

function editText(value: string | undefined, fallback: string) {
  const next = value?.trim();
  return next || fallback;
}

function mainFormFromMenu(menu: PermissionMainMenu): MainFormState {
  const fallbackTitle = menu.menu_title || "";
  return {
    menu_badge: String(menu.menu_badge || 2),
    menu_badge_text: menu.menu_badge_text || "",
    menu_icon: menu.menu_icon || MAIN_FORM_INITIAL.menu_icon,
    menu_id: menu.menu_id,
    menu_path: menu.menu_path || "",
    menu_status: String(menu.menu_status || 1),
    menu_title_eng: editText(menu.menu_title_eng, fallbackTitle),
    menu_title_la: editText(menu.menu_title_la, fallbackTitle)
  };
}

function subFormFromSubmenu(submenu: PermissionSubMenu): SubFormState {
  const fallbackTitle = submenu.sub_title || "";
  return {
    sub_id: submenu.sub_id,
    sub_path: submenu.sub_path || "",
    sub_status: String(submenu.sub_status ?? 1),
    sub_title_eng: editText(submenu.sub_title_eng, fallbackTitle),
    sub_title_la: editText(submenu.sub_title_la, fallbackTitle)
  };
}

export function PermissionMenuPage() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.show);
  const loadSidebarMenu = usePermissionsSidebarStore((state) => state.load);
  const hasLoaded = usePermissionsMenuStore((state) => state.hasLoaded);
  const menus = usePermissionsMenuStore((state) => state.menus);
  const loading = usePermissionsMenuStore((state) => state.loading);
  const refreshing = usePermissionsMenuStore((state) => state.refreshing);
  const saving = usePermissionsMenuStore((state) => state.saving);
  const sorting = usePermissionsMenuStore((state) => state.sorting);
  const load = usePermissionsMenuStore((state) => state.load);
  const createMain = usePermissionsMenuStore((state) => state.createMain);
  const createSub = usePermissionsMenuStore((state) => state.createSub);
  const deleteMain = usePermissionsMenuStore((state) => state.deleteMain);
  const deleteSub = usePermissionsMenuStore((state) => state.deleteSub);
  const sortMain = usePermissionsMenuStore((state) => state.sortMain);
  const sortSub = usePermissionsMenuStore((state) => state.sortSub);
  const moveSubToMenu = usePermissionsMenuStore((state) => state.moveSub);
  const promoteSub = usePermissionsMenuStore((state) => state.promoteSub);
  const [moveRequest, setMoveRequest] = useState<PermissionSubMenuMoveRequest | null>(null);
  const [mainDialogOpen, setMainDialogOpen] = useState(false);
  const [subDialogMenu, setSubDialogMenu] = useState<PermissionMainMenu | null>(null);
  const [mainForm, setMainForm] = useState<MainFormState>(MAIN_FORM_INITIAL);
  const [subForm, setSubForm] = useState<SubFormState>(SUB_FORM_INITIAL);
  const [deleteTarget, setDeleteTarget] = useState<PermissionMenuDeleteTarget | null>(null);
  const [mainSearch, setMainSearch] = useState("");
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const allowed = canManagePermissionMenu(user?.status);
  const storeUuid = authStoreUuid(user);
  const language = i18n.language;
  const hasLoadedRef = useLatestValue(hasLoaded);
  const fullLoading = loading && !hasLoaded;
  const backgroundLoading = refreshing || (loading && hasLoaded);
  const busy = saving || sorting || fullLoading || backgroundLoading;
  const visibleMenus = useMemo(() => filterPermissionMenus(menus, mainSearch), [mainSearch, menus]);
  const selectedMenu = useMemo(
    () => menus.find((menu) => menu.menu_id === selectedMenuId) ?? null,
    [menus, selectedMenuId]
  );
  const searchActive = mainSearch.trim().length > 0;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const refresh = useCallback(async () => {
    try {
      await load(language, { background: hasLoadedRef.current });
    } catch (error) {
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("permissionMenu.loadFailed"),
        tone: "error"
      });
    }
  }, [hasLoadedRef, language, load, showToast, t]);

  useEffect(() => {
    if (!allowed) router.replace("/");
  }, [allowed, router]);

  useEffect(() => {
    if (!allowed) return;
    void refresh();
  }, [allowed, refresh]);

  // เมนูชุดใหม่ = คงตัวที่เลือกไว้ถ้ายังอยู่ ไม่งั้นเลือกตัวแรกที่ใช้ได้
  useResetOnChange(menus, () => setSelectedMenuId((current) => resolveSelectedPermissionMenuId(menus, current)));

  function refreshSidebarMenu() {
    void refreshPermissionSidebarMenu({
      language,
      loadSidebarMenu,
      status: user?.status,
      storeUuid
    });
  }

  async function saveMain() {
    const editing = Boolean(mainForm.menu_id);
    try {
      await createMain(mainForm, language);
      refreshSidebarMenu();
      setMainDialogOpen(false);
      setMainForm(MAIN_FORM_INITIAL);
      showToast({ title: t(editing ? "permissionMenu.mainUpdated" : "permissionMenu.mainSaved"), tone: "success" });
    } catch (error) {
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("permissionMenu.saveFailed"),
        tone: "error"
      });
    }
  }

  async function saveSub() {
    if (!subDialogMenu) return;
    const editing = Boolean(subForm.sub_id);
    try {
      await createSub({ ...subForm, menu_id: subDialogMenu.menu_id }, language);
      refreshSidebarMenu();
      setSubDialogMenu(null);
      setSubForm(SUB_FORM_INITIAL);
      showToast({ title: t(editing ? "permissionMenu.subUpdated" : "permissionMenu.subSaved"), tone: "success" });
    } catch (error) {
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("permissionMenu.saveFailed"),
        tone: "error"
      });
    }
  }

  async function removeTarget() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "main") {
        await deleteMain(deleteTarget.menu.menu_id, language);
        refreshSidebarMenu();
        showToast({ title: t("permissionMenu.mainDeleted"), tone: "success" });
      } else {
        await deleteSub(deleteTarget.submenu.sub_id, language);
        refreshSidebarMenu();
        showToast({ title: t("permissionMenu.subDeleted"), tone: "success" });
      }
      setDeleteTarget(null);
    } catch (error) {
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("permissionMenu.deleteFailed"),
        tone: "error"
      });
    }
  }

  async function reorderMain(event: DragEndEvent) {
    if (searchActive) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = menus.findIndex((menu) => menu.menu_id === active.id);
    const newIndex = menus.findIndex((menu) => menu.menu_id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    try {
      await sortMain(arrayMove(menus, oldIndex, newIndex), language);
      refreshSidebarMenu();
      showToast({ title: t("permissionMenu.sortSaved"), tone: "success" });
    } catch (error) {
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("permissionMenu.sortFailed"),
        tone: "error"
      });
    }
  }

  async function moveMain(menuId: string, direction: PermissionMenuMoveDirection) {
    if (searchActive) return;
    const nextMenus = movePermissionItem(menus, menuId, direction, (menu) => menu.menu_id);
    if (nextMenus === menus) return;
    try {
      await sortMain(nextMenus, language);
      refreshSidebarMenu();
      showToast({ title: t("permissionMenu.sortSaved"), tone: "success" });
    } catch (error) {
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("permissionMenu.sortFailed"),
        tone: "error"
      });
    }
  }

  async function moveSub(
    menu: PermissionMainMenu,
    subId: string,
    direction: PermissionMenuMoveDirection
  ) {
    const submenus = menuSubmenus(menu);
    const nextSubmenus = movePermissionItem(submenus, subId, direction, (submenu) => submenu.sub_id);
    if (nextSubmenus === submenus) return;
    try {
      await sortSub(menu.menu_id, nextSubmenus, language);
      refreshSidebarMenu();
      showToast({ title: t("permissionMenu.sortSaved"), tone: "success" });
    } catch (error) {
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("permissionMenu.sortFailed"),
        tone: "error"
      });
    }
  }

  async function reorderSub(menu: PermissionMainMenu, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const submenus = menuSubmenus(menu);
    const oldIndex = submenus.findIndex((submenu) => submenu.sub_id === active.id);
    const newIndex = submenus.findIndex((submenu) => submenu.sub_id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    try {
      await sortSub(menu.menu_id, arrayMove(submenus, oldIndex, newIndex), language);
      refreshSidebarMenu();
      showToast({ title: t("permissionMenu.sortSaved"), tone: "success" });
    } catch (error) {
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("permissionMenu.sortFailed"),
        tone: "error"
      });
    }
  }

  async function relocateSub(target: PermissionSubMenuMoveTarget) {
    if (!moveRequest) return;
    const { submenu } = moveRequest;
    try {
      if (target.type === "main") {
        await promoteSub(submenu.sub_id, language);
      } else {
        await moveSubToMenu(submenu.sub_id, target.menuId, language);
        setSelectedMenuId(target.menuId);
      }
      refreshSidebarMenu();
      setMoveRequest(null);
      showToast({
        title: t(target.type === "main" ? "permissionMenu.promoted" : "permissionMenu.subMoved", { title: submenu.sub_title }),
        tone: "success"
      });
    } catch (error) {
      showToast({
        description:
          error instanceof PermissionSubMenuMoveError
            ? t("permissionMenu.moveUnsupported")
            : error instanceof Error
              ? error.message
              : t("toasts.pleaseTryAgain"),
        title: t("permissionMenu.moveFailed"),
        tone: "error"
      });
    }
  }

  function openCreateMainDialog() {
    setMainForm(MAIN_FORM_INITIAL);
    setMainDialogOpen(true);
  }

  function openEditMainDialog(menu: PermissionMainMenu) {
    setMainForm(mainFormFromMenu(menu));
    setMainDialogOpen(true);
  }

  function openCreateSubDialog(menu: PermissionMainMenu) {
    setSubForm(SUB_FORM_INITIAL);
    setSubDialogMenu(menu);
  }

  function openEditSubDialog(menu: PermissionMainMenu, submenu: PermissionSubMenu) {
    setSubForm(subFormFromSubmenu(submenu));
    setSubDialogMenu(menu);
  }

  const menuList = (
    <PermissionMenuBuilder
      busy={busy}
      mainSearch={mainSearch}
      menus={menus}
      searchActive={searchActive}
      selectedMenu={selectedMenu}
      selectedMenuId={selectedMenuId}
      sensors={sensors}
      sorting={sorting}
      visibleMenus={visibleMenus}
      onAddSub={openCreateSubDialog}
      onDeleteMain={(menu) => setDeleteTarget({ menu, type: "main" })}
      onDeleteSub={(menu, submenu) => setDeleteTarget({ menu, submenu, type: "sub" })}
      onEditMain={openEditMainDialog}
      onEditSub={openEditSubDialog}
      onMoveMain={moveMain}
      onMoveSub={moveSub}
      onReorderMain={reorderMain}
      onReorderSub={reorderSub}
      onRelocateSub={(menu, submenu) => setMoveRequest({ menu, submenu })}
      onSearchChange={setMainSearch}
      onSelectMenu={setSelectedMenuId}
    />
  );

  if (!allowed) return <LoadingState label={t("common.processing")} variant="table" />;

  return (
    // Same frame as the settings list pages: header card, then the builder. The page is the
    // container: once both builder cards fit side by side (@4xl) the page stops scrolling and each
    // card scrolls inside itself; narrower, the whole page scrolls.
    <div className="@container h-full min-h-0 overflow-y-auto">
      <div className="flex flex-col gap-4 p-4 @4xl:h-full">
        <SettingsPageHeader
          icon={ListTree}
          title={t("permissionMenu.title")}
          description={t("permissionMenu.description")}
          count={fullLoading ? null : menus.length}
          actions={
            <>
              <Button disabled={loading || refreshing} type="button" variant="outline" onClick={refresh}>
                {loading || refreshing ? <Spinner data-icon="inline-start" /> : <RefreshCcw data-icon="inline-start" />}
                {t("actions.refresh")}
              </Button>
              <Button disabled={busy} type="button" onClick={openCreateMainDialog}>
                <Plus data-icon="inline-start" />
                {t("permissionMenu.addMain")}
              </Button>
            </>
          }
        />
        {fullLoading ? <LoadingState label={t("permissionMenu.loading")} variant="settingsTable" /> : menuList}
      </div>
      <MainMenuDialog
        form={mainForm}
        open={mainDialogOpen}
        saving={saving}
        setForm={setMainForm}
        onOpenChange={(open) => {
          if (saving) return;
          setMainDialogOpen(open);
          if (!open) setMainForm(MAIN_FORM_INITIAL);
        }}
        onSave={saveMain}
      />
      <SubMenuDialog
        form={subForm}
        menu={subDialogMenu}
        saving={saving}
        setForm={setSubForm}
        onOpenChange={(open) => {
          if (saving) return;
          if (!open) {
            setSubDialogMenu(null);
            setSubForm(SUB_FORM_INITIAL);
          }
        }}
        onSave={saveSub}
      />
      <MoveSubMenuDialog
        key={moveRequest?.submenu.sub_id ?? "closed"}
        menus={menus}
        request={moveRequest}
        saving={saving}
        onMove={relocateSub}
        onOpenChange={(open) => {
          if (!open && !saving) setMoveRequest(null);
        }}
      />
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        confirmPending={saving}
        description={
          deleteTarget?.type === "main"
            ? t("permissionMenu.deleteMainDescription", { title: deleteTarget.menu.menu_title })
            : t("permissionMenu.deleteSubDescription", { title: deleteTarget?.submenu.sub_title ?? "" })
        }
        open={Boolean(deleteTarget)}
        title={t("permissionMenu.deleteTitle")}
        onConfirm={removeTarget}
        onOpenChange={(open) => {
          if (!open && !saving) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
