"use client";

import { Fragment, type CSSProperties } from "react";
import {
  closestCenter,
  DndContext,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  GripVertical,
  Menu,
  Pencil,
  Plus,
  Trash2
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SettingsTableScroll } from "@/features/settings/settings-shell";
import { cn } from "@/lib/utils";
import type { PermissionMainMenu, PermissionSubMenu } from "@/services/permission-menu";
import {
  badgeLabel,
  iconOption,
  menuIds,
  menuStatusLabel,
  menuSubmenus,
  statusClass,
  statusLabel,
  submenuIds
} from "./permission-menu-utils";

type Sensors = ReturnType<typeof useSensors>;

export function PermissionMenuTable({
  busy,
  expandedMenus,
  menus,
  sensors,
  onAddSub,
  onDeleteMain,
  onDeleteSub,
  onEditMain,
  onEditSub,
  onReorderMain,
  onReorderSub,
  onToggleExpanded
}: {
  busy: boolean;
  expandedMenus: Set<string>;
  menus: PermissionMainMenu[];
  sensors: Sensors;
  onAddSub: (menu: PermissionMainMenu) => void;
  onDeleteMain: (menu: PermissionMainMenu) => void;
  onDeleteSub: (menu: PermissionMainMenu, submenu: PermissionSubMenu) => void;
  onEditMain: (menu: PermissionMainMenu) => void;
  onEditSub: (menu: PermissionMainMenu, submenu: PermissionSubMenu) => void;
  onReorderMain: (event: DragEndEvent) => void;
  onReorderSub: (menu: PermissionMainMenu, event: DragEndEvent) => void;
  onToggleExpanded: (menuId: string) => void;
}) {
  const { t } = useTranslation();

  if (!menus.length) return null;

  return (
    <SettingsTableScroll>
      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        sensors={sensors}
        onDragEnd={onReorderMain}
      >
        <Table className="min-w-[960px]">
          <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
            <TableRow>
              <TableHead className="w-10 px-2" aria-hidden />
              <TableHead className="w-10 px-2" aria-hidden />
              <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("permissionMenu.columns.no")}</TableHead>
              <TableHead>{t("permissionMenu.columns.menu")}</TableHead>
              <TableHead className="w-40">{t("permissionMenu.columns.badge")}</TableHead>
              <TableHead className="w-44">{t("permissionMenu.columns.status")}</TableHead>
              <TableHead className="w-14 text-right">{t("permissionMenu.columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <SortableContext items={menuIds(menus)} strategy={verticalListSortingStrategy}>
            <TableBody>
              {menus.map((menu, index) => (
                <SortableMainMenuRows
                  key={menu.menu_id}
                  busy={busy}
                  expanded={expandedMenus.has(menu.menu_id)}
                  index={index}
                  menu={menu}
                  sensors={sensors}
                  onAddSub={() => onAddSub(menu)}
                  onDelete={() => onDeleteMain(menu)}
                  onDeleteSub={(submenu) => onDeleteSub(menu, submenu)}
                  onEdit={() => onEditMain(menu)}
                  onEditSub={(submenu) => onEditSub(menu, submenu)}
                  onReorderSub={(event) => onReorderSub(menu, event)}
                  onToggleExpanded={() => onToggleExpanded(menu.menu_id)}
                />
              ))}
            </TableBody>
          </SortableContext>
        </Table>
      </DndContext>
    </SettingsTableScroll>
  );
}

function SortableMainMenuRows({
  busy,
  expanded,
  index,
  menu,
  sensors,
  onAddSub,
  onDelete,
  onDeleteSub,
  onEdit,
  onEditSub,
  onReorderSub,
  onToggleExpanded
}: {
  busy: boolean;
  expanded: boolean;
  index: number;
  menu: PermissionMainMenu;
  sensors: Sensors;
  onAddSub: () => void;
  onDelete: () => void;
  onDeleteSub: (submenu: PermissionSubMenu) => void;
  onEdit: () => void;
  onEditSub: (submenu: PermissionSubMenu) => void;
  onReorderSub: (event: DragEndEvent) => void;
  onToggleExpanded: () => void;
}) {
  const { t } = useTranslation();
  const submenus = menuSubmenus(menu);
  const selectedIcon = iconOption(menu.menu_icon);
  const SelectedIcon = selectedIcon.icon ?? FileText;
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    disabled: busy,
    id: menu.menu_id
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  const detailId = `permission-menu-submenus-${menu.menu_id}`;

  return (
    <Fragment>
      <TableRow
        ref={setNodeRef}
        className={cn("align-middle", isDragging && "relative bg-card shadow-md")}
        style={style}
      >
        <TableCell className="w-10 px-2">
          <Button
            aria-label={t("permissionMenu.reorderMain")}
            className="cursor-grab active:cursor-grabbing"
            disabled={busy}
            size="iconSm"
            type="button"
            variant="ghost"
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden />
          </Button>
        </TableCell>
        <TableCell className="w-10 px-2">
          <Button
            aria-controls={detailId}
            aria-expanded={expanded}
            aria-label={t(expanded ? "permissionMenu.collapseMenu" : "permissionMenu.expandMenu", {
              title: menu.menu_title || "-"
            })}
            size="iconSm"
            type="button"
            variant="ghost"
            onClick={onToggleExpanded}
          >
            {expanded ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
          </Button>
        </TableCell>
        <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black tabular-nums text-muted-foreground">
          {index + 1}
        </TableCell>
        <TableCell>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary [&_svg]:size-4">
              <SelectedIcon aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate font-black">{menu.menu_title || "-"}</p>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="min-w-0 truncate font-mono" translate="no">{menu.menu_path || "-"}</span>
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge>{badgeLabel(menu.menu_badge, t)}</Badge>
        </TableCell>
        <TableCell>
          <Badge className={cn("shrink-0", statusClass(menu.menu_status))}>
            {menuStatusLabel(menu.menu_status, t)}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          <MainMenuRowActions busy={busy} onAddSub={onAddSub} onDelete={onDelete} onEdit={onEdit} />
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow id={detailId} className="bg-muted/20 hover:bg-muted/20">
          <TableCell className="p-0" colSpan={7}>
            <div className="px-4 py-3">
              {submenus.length ? (
                <DndContext
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis]}
                  sensors={sensors}
                  onDragEnd={onReorderSub}
                >
                  <SortableContext items={submenuIds(submenus)} strategy={verticalListSortingStrategy}>
                    <Table
                      aria-label={t("permissionMenu.submenuTableLabel", { title: menu.menu_title || "-" })}
                      className="min-w-[720px] overflow-hidden rounded-md border border-border bg-background"
                    >
                      <TableHeader className="bg-muted/60">
                        <TableRow>
                          <TableHead className="w-10 px-2" aria-hidden />
                          <TableHead className="w-px whitespace-nowrap px-2 text-center">
                            {t("permissionMenu.columns.no")}
                          </TableHead>
                          <TableHead>{t("permissionMenu.columns.menu")}</TableHead>
                          <TableHead>{t("permissionMenu.columns.path")}</TableHead>
                          <TableHead className="w-36">{t("permissionMenu.columns.status")}</TableHead>
                          <TableHead className="w-14 text-right">{t("permissionMenu.columns.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {submenus.map((submenu, subIndex) => (
                          <SortableSubMenuRow
                            key={submenu.sub_id}
                            busy={busy}
                            index={subIndex}
                            submenu={submenu}
                            onDelete={() => onDeleteSub(submenu)}
                            onEdit={() => onEditSub(submenu)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="rounded-md border border-dashed border-border bg-background px-3 py-3 text-sm text-muted-foreground">
                  {t("permissionMenu.noSubmenus")}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </Fragment>
  );
}

function SortableSubMenuRow({
  busy,
  index,
  submenu,
  onDelete,
  onEdit
}: {
  busy: boolean;
  index: number;
  submenu: PermissionSubMenu;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    disabled: busy,
    id: submenu.sub_id
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <TableRow
      ref={setNodeRef}
      className={cn("align-middle", isDragging && "relative bg-card shadow-md")}
      style={style}
    >
      <TableCell className="w-10 px-2">
        <Button
          aria-label={t("permissionMenu.reorderSub")}
          className="cursor-grab active:cursor-grabbing"
          disabled={busy}
          size="iconSm"
          type="button"
          variant="ghost"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden />
        </Button>
      </TableCell>
      <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black tabular-nums text-muted-foreground">
        {index + 1}
      </TableCell>
      <TableCell>
        <p className="min-w-0 truncate font-black">{submenu.sub_title || "-"}</p>
      </TableCell>
      <TableCell className="max-w-72 truncate font-mono text-xs text-muted-foreground" translate="no">
        {submenu.sub_path || "-"}
      </TableCell>
      <TableCell>
        <Badge className={cn("shrink-0", statusClass(submenu.sub_status))}>
          {statusLabel(submenu.sub_status, t)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <SubMenuRowActions busy={busy} onDelete={onDelete} onEdit={onEdit} />
      </TableCell>
    </TableRow>
  );
}

function MainMenuRowActions({
  busy,
  onAddSub,
  onDelete,
  onEdit
}: {
  busy: boolean;
  onAddSub: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={t("common.actions")} disabled={busy} size="iconSm" type="button" variant="ghost">
          <Menu aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={busy} onSelect={onEdit}>
            <Pencil aria-hidden />
            {t("actions.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onSelect={onAddSub}>
            <Plus aria-hidden />
            {t("permissionMenu.addSub")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={busy} variant="destructive" onSelect={onDelete}>
            <Trash2 aria-hidden />
            {t("permissionMenu.deleteMain")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SubMenuRowActions({
  busy,
  onDelete,
  onEdit
}: {
  busy: boolean;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={t("common.actions")} disabled={busy} size="iconSm" type="button" variant="ghost">
          <Menu aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={busy} onSelect={onEdit}>
            <Pencil aria-hidden />
            {t("actions.edit")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={busy} variant="destructive" onSelect={onDelete}>
            <Trash2 aria-hidden />
            {t("permissionMenu.deleteSub")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
