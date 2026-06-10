"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { RefreshCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { LoadingState } from "@/components/common/loading-state";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SettingsModuleShell } from "@/features/settings/shared/settings-shell";
import { canManagePermissionMenu } from "@/lib/permissions";
import type { PermissionMainMenu, PermissionSubMenu } from "@/services/permission-menu";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { usePermissionMenuStore } from "@/stores/permission-menu-store";
import { useSidebarMenuStore } from "@/stores/sidebar-menu-store";
import { useToastStore } from "@/stores/toast-store";
import { MainMenuDialog, SubMenuDialog } from "./permission-menu-dialogs";
import { MAIN_FORM_INITIAL, SUB_FORM_INITIAL, type MainFormState, type SubFormState } from "./permission-menu-options";
import { PermissionMenuBuilder } from "./permission-menu-builder";
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
  const loadSidebarMenu = useSidebarMenuStore((state) => state.load);
  const hasLoaded = usePermissionMenuStore((state) => state.hasLoaded);
  const menus = usePermissionMenuStore((state) => state.menus);
  const loading = usePermissionMenuStore((state) => state.loading);
  const refreshing = usePermissionMenuStore((state) => state.refreshing);
  const saving = usePermissionMenuStore((state) => state.saving);
  const sorting = usePermissionMenuStore((state) => state.sorting);
  const load = usePermissionMenuStore((state) => state.load);
  const createMain = usePermissionMenuStore((state) => state.createMain);
  const createSub = usePermissionMenuStore((state) => state.createSub);
  const deleteMain = usePermissionMenuStore((state) => state.deleteMain);
  const deleteSub = usePermissionMenuStore((state) => state.deleteSub);
  const sortMain = usePermissionMenuStore((state) => state.sortMain);
  const sortSub = usePermissionMenuStore((state) => state.sortSub);
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

  useEffect(() => {
    if (!allowed) router.replace("/");
  }, [allowed, router]);

  useEffect(() => {
    if (!allowed) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, language]);

  useEffect(() => {
    setSelectedMenuId((current) => resolveSelectedPermissionMenuId(menus, current));
  }, [menus]);

  async function refresh() {
    try {
      await load(language, { background: hasLoaded });
    } catch (error) {
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("permissionMenu.loadFailed"),
        tone: "error"
      });
    }
  }

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
      onAddMain={openCreateMainDialog}
      onAddSub={openCreateSubDialog}
      onDeleteMain={(menu) => setDeleteTarget({ menu, type: "main" })}
      onDeleteSub={(menu, submenu) => setDeleteTarget({ menu, submenu, type: "sub" })}
      onEditMain={openEditMainDialog}
      onEditSub={openEditSubDialog}
      onMoveMain={moveMain}
      onMoveSub={moveSub}
      onReorderMain={reorderMain}
      onReorderSub={reorderSub}
      onSearchChange={setMainSearch}
      onSelectMenu={setSelectedMenuId}
    />
  );

  if (!allowed) return <LoadingState label={t("common.processing")} variant="table" />;

  return (
    <>
      <SettingsModuleShell
        cardTitle={t("permissionMenu.builderTitle")}
        description={t("permissionMenu.description")}
        emptyDescription={t("permissionMenu.emptyDescription")}
        emptyTitle={t("permissionMenu.emptyTitle")}
        headerActions={
          <Button disabled={loading || refreshing} size="sm" type="button" variant="outline" onClick={refresh}>
            {loading || refreshing ? <Spinner data-icon="inline-start" /> : <RefreshCcw data-icon="inline-start" />}
            {t("actions.refresh")}
          </Button>
        }
        hideCardHeader
        loading={fullLoading}
        loadingLabel={t("permissionMenu.loading")}
        table={menuList}
        title={t("permissionMenu.title")}
      />
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
    </>
  );
}
