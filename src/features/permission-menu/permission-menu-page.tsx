"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ChevronsDownUp, ChevronsUpDown, RefreshCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SettingsModuleShell } from "@/features/settings/settings-shell";
import { canManagePermissionMenu } from "@/lib/permissions";
import type { PermissionMainMenu, PermissionSubMenu } from "@/services/permission-menu";
import { useAuthStore } from "@/stores/auth-store";
import { usePermissionMenuStore } from "@/stores/permission-menu-store";
import { useToastStore } from "@/stores/toast-store";
import { MainMenuDialog, SubMenuDialog } from "./permission-menu-dialogs";
import { MAIN_FORM_INITIAL, SUB_FORM_INITIAL, type MainFormState, type SubFormState } from "./permission-menu-options";
import { PermissionMenuTable } from "./permission-menu-table";
import {
  defaultExpandedMenuIds,
  menuIds,
  menuSubmenus,
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
  const hasLoaded = usePermissionMenuStore((state) => state.hasLoaded);
  const menus = usePermissionMenuStore((state) => state.menus);
  const loading = usePermissionMenuStore((state) => state.loading);
  const refreshing = usePermissionMenuStore((state) => state.refreshing);
  const saving = usePermissionMenuStore((state) => state.saving);
  const sorting = usePermissionMenuStore((state) => state.sorting);
  const total = usePermissionMenuStore((state) => state.total);
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
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(() => new Set());
  const expandedInitializedRef = useRef(false);
  const knownMenuIdsRef = useRef<Set<string>>(new Set());
  const allowed = canManagePermissionMenu(user?.status);
  const language = i18n.language;
  const fullLoading = loading && !hasLoaded;
  const backgroundLoading = refreshing || (loading && hasLoaded);
  const busy = saving || sorting || fullLoading || backgroundLoading;
  const submenuTotal = useMemo(
    () => menus.reduce((sum, menu) => sum + menu.sub_detail.length, 0),
    [menus]
  );
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
    const nextKnownMenuIds = new Set(menus.map((menu) => menu.menu_id));
    const previousKnownMenuIds = knownMenuIdsRef.current;
    const shouldInitialize = !expandedInitializedRef.current;
    setExpandedMenus((current) => {
      const next = new Set(Array.from(current).filter((menuId) => nextKnownMenuIds.has(menuId)));
      const defaultExpanded = defaultExpandedMenuIds(menus);

      if (shouldInitialize) {
        defaultExpanded.forEach((menuId) => next.add(menuId));
      } else {
        defaultExpanded.forEach((menuId) => {
          if (!previousKnownMenuIds.has(menuId)) next.add(menuId);
        });
      }

      return next;
    });
    expandedInitializedRef.current = true;
    knownMenuIdsRef.current = nextKnownMenuIds;
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

  async function saveMain() {
    const editing = Boolean(mainForm.menu_id);
    try {
      await createMain(mainForm, language);
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
        showToast({ title: t("permissionMenu.mainDeleted"), tone: "success" });
      } else {
        await deleteSub(deleteTarget.submenu.sub_id, language);
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
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = menus.findIndex((menu) => menu.menu_id === active.id);
    const newIndex = menus.findIndex((menu) => menu.menu_id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    try {
      await sortMain(arrayMove(menus, oldIndex, newIndex), language);
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
      showToast({ title: t("permissionMenu.sortSaved"), tone: "success" });
    } catch (error) {
      showToast({
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        title: t("permissionMenu.sortFailed"),
        tone: "error"
      });
    }
  }

  function toggleExpanded(menuId: string) {
    setExpandedMenus((current) => {
      const next = new Set(current);
      if (next.has(menuId)) next.delete(menuId);
      else next.add(menuId);
      return next;
    });
  }

  function setAllExpanded(expanded: boolean) {
    setExpandedMenus(expanded ? new Set(menuIds(menus)) : new Set());
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

  const allExpanded = menus.length > 0 && menus.every((menu) => expandedMenus.has(menu.menu_id));
  const expandToggleAction = menus.length ? (
    <div className="flex flex-wrap gap-2">
      <Button
        size="xs"
        type="button"
        variant="outline"
        onClick={() => setAllExpanded(!allExpanded)}
      >
        {allExpanded ? <ChevronsDownUp data-icon="inline-start" /> : <ChevronsUpDown data-icon="inline-start" />}
        {allExpanded ? t("permissionMenu.collapseAll") : t("permissionMenu.expandAll")}
      </Button>
    </div>
  ) : null;

  const menuList = (
    <PermissionMenuTable
      busy={busy}
      expandedMenus={expandedMenus}
      menus={menus}
      sensors={sensors}
      onAddSub={openCreateSubDialog}
      onDeleteMain={(menu) => setDeleteTarget({ menu, type: "main" })}
      onDeleteSub={(menu, submenu) => setDeleteTarget({ menu, submenu, type: "sub" })}
      onEditMain={openEditMainDialog}
      onEditSub={openEditSubDialog}
      onReorderMain={reorderMain}
      onReorderSub={reorderSub}
      onToggleExpanded={toggleExpanded}
    />
  );

  if (!allowed) return <LoadingState label={t("common.processing")} variant="table" />;

  return (
    <>
      <SettingsModuleShell
        addLabel={t("permissionMenu.addMain")}
        cardTitle={t("permissionMenu.mainMenus")}
        description={t("permissionMenu.description")}
        emptyDescription={t("permissionMenu.emptyDescription")}
        emptyTitle={t("permissionMenu.emptyTitle")}
        loading={fullLoading}
        loadingLabel={t("permissionMenu.loading")}
        table={menuList}
        title={t("permissionMenu.title")}
        toolbarStart={expandToggleAction}
        toolbar={
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge className="border-primary/20 bg-primary/10 text-primary">
                {t("permissionMenu.kicker")}
              </Badge>
              <Badge>
                {t("permissionMenu.summary", {
                  main: total || menus.length,
                  sub: submenuTotal
                })}
              </Badge>
              {sorting ? (
                <Badge className="border-primary/30 bg-primary/10 text-primary">
                  {t("permissionMenu.savingSort")}
                </Badge>
              ) : null}
            </div>
            <Button className="w-full sm:w-auto" disabled={loading || refreshing} size="sm" type="button" variant="outline" onClick={refresh}>
              {loading || refreshing ? <Spinner data-icon="inline-start" /> : <RefreshCcw data-icon="inline-start" />}
              {t("actions.refresh")}
            </Button>
          </div>
        }
        onAdd={openCreateMainDialog}
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
