"use client";

import type { CSSProperties } from "react";
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
  ArrowDown,
  ArrowUp,
  FileText,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Trash2
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
  submenuIds,
  type PermissionMenuMoveDirection
} from "./permission-menu-utils";

type Sensors = ReturnType<typeof useSensors>;

interface PermissionMenuBuilderProps {
  busy: boolean;
  mainSearch: string;
  menus: PermissionMainMenu[];
  searchActive: boolean;
  selectedMenu: PermissionMainMenu | null;
  selectedMenuId: string;
  sensors: Sensors;
  sorting: boolean;
  visibleMenus: PermissionMainMenu[];
  onAddMain: () => void;
  onAddSub: (menu: PermissionMainMenu) => void;
  onDeleteMain: (menu: PermissionMainMenu) => void;
  onDeleteSub: (menu: PermissionMainMenu, submenu: PermissionSubMenu) => void;
  onEditMain: (menu: PermissionMainMenu) => void;
  onEditSub: (menu: PermissionMainMenu, submenu: PermissionSubMenu) => void;
  onMoveMain: (menuId: string, direction: PermissionMenuMoveDirection) => void;
  onMoveSub: (menu: PermissionMainMenu, subId: string, direction: PermissionMenuMoveDirection) => void;
  onReorderMain: (event: DragEndEvent) => void;
  onReorderSub: (menu: PermissionMainMenu, event: DragEndEvent) => void;
  onSearchChange: (search: string) => void;
  onSelectMenu: (menuId: string) => void;
}

export function PermissionMenuBuilder({
  busy,
  mainSearch,
  menus,
  searchActive,
  selectedMenu,
  selectedMenuId,
  sensors,
  sorting,
  visibleMenus,
  onAddMain,
  onAddSub,
  onDeleteMain,
  onDeleteSub,
  onEditMain,
  onEditSub,
  onMoveMain,
  onMoveSub,
  onReorderMain,
  onReorderSub,
  onSearchChange,
  onSelectMenu
}: PermissionMenuBuilderProps) {
  const { t } = useTranslation();
  const sortDisabled = busy || searchActive;

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
      <section className="flex max-h-[42dvh] min-h-64 min-w-0 flex-col border-b border-border lg:max-h-none lg:border-b-0 lg:border-r">
        <div className="shrink-0 border-b border-border p-3">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black">{t("permissionMenu.mainList")}</h2>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {t("permissionMenu.mainListHint")}
              </p>
            </div>
            <Button className="shrink-0" disabled={busy} size="sm" type="button" onClick={onAddMain}>
              <Plus data-icon="inline-start" />
              {t("permissionMenu.addMain")}
            </Button>
          </div>
          <div className="mt-3 flex min-w-0 items-center gap-2 rounded-md border border-input bg-background px-2.5 shadow-sm transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <Search aria-hidden className="shrink-0 text-muted-foreground" />
            <Input
              aria-label={t("permissionMenu.searchMain")}
              autoComplete="off"
              className="h-9 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              name="permission_menu_main_search"
              placeholder={t("permissionMenu.searchMainPlaceholder")}
              spellCheck={false}
              value={mainSearch}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
          {searchActive ? (
            <Badge className="mt-2 border-primary/20 bg-primary/10 text-primary">
              {t("permissionMenu.sortPausedBySearch")}
            </Badge>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {!menus.length ? (
            <PermissionMenuEmpty
              description={t("permissionMenu.emptyDescription")}
              title={t("permissionMenu.emptyTitle")}
            />
          ) : visibleMenus.length ? (
            <DndContext
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              sensors={sensors}
              onDragEnd={sortDisabled ? undefined : onReorderMain}
            >
              <SortableContext items={menuIds(visibleMenus)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2">
                  {visibleMenus.map((menu) => {
                    const index = menus.findIndex((item) => item.menu_id === menu.menu_id);
                    return (
                      <SortableMainMenuCard
                        key={menu.menu_id}
                        busy={busy}
                        index={index}
                        menu={menu}
                        searchActive={searchActive}
                        selected={menu.menu_id === selectedMenuId}
                        total={menus.length}
                        onMove={onMoveMain}
                        onSelect={onSelectMenu}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <PermissionMenuEmpty
              description={t("permissionMenu.noMainSearchDescription")}
              title={t("permissionMenu.noMainSearchResults")}
            />
          )}
        </div>
      </section>

      <section className="flex min-h-[24rem] min-w-0 flex-1 flex-col">
        {selectedMenu ? (
          <SelectedMenuPanel
            busy={busy}
            menu={selectedMenu}
            sensors={sensors}
            sorting={sorting}
            onAddSub={onAddSub}
            onDeleteMain={onDeleteMain}
            onDeleteSub={onDeleteSub}
            onEditMain={onEditMain}
            onEditSub={onEditSub}
            onMoveSub={onMoveSub}
            onReorderSub={onReorderSub}
          />
        ) : (
          <PermissionMenuEmpty
            description={t("permissionMenu.selectMenuDescription")}
            title={t("permissionMenu.selectMenuTitle")}
          />
        )}
      </section>
    </div>
  );
}

function SelectedMenuPanel({
  busy,
  menu,
  sensors,
  sorting,
  onAddSub,
  onDeleteMain,
  onDeleteSub,
  onEditMain,
  onEditSub,
  onMoveSub,
  onReorderSub
}: {
  busy: boolean;
  menu: PermissionMainMenu;
  sensors: Sensors;
  sorting: boolean;
  onAddSub: (menu: PermissionMainMenu) => void;
  onDeleteMain: (menu: PermissionMainMenu) => void;
  onDeleteSub: (menu: PermissionMainMenu, submenu: PermissionSubMenu) => void;
  onEditMain: (menu: PermissionMainMenu) => void;
  onEditSub: (menu: PermissionMainMenu, submenu: PermissionSubMenu) => void;
  onMoveSub: (menu: PermissionMainMenu, subId: string, direction: PermissionMenuMoveDirection) => void;
  onReorderSub: (menu: PermissionMainMenu, event: DragEndEvent) => void;
}) {
  const { t } = useTranslation();
  const submenus = menuSubmenus(menu);
  const selectedIcon = iconOption(menu.menu_icon);
  const SelectedIcon = selectedIcon.icon ?? FileText;

  return (
    <>
      <div className="shrink-0 border-b border-border p-4 lg:px-5">
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/10 text-primary [&_svg]:size-5">
              <SelectedIcon aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-muted-foreground">{t("permissionMenu.selectedMenu")}</p>
              <h2 className="mt-0.5 break-words text-lg font-black">{menu.menu_title || "-"}</h2>
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                <Badge>{badgeLabel(menu.menu_badge, t)}</Badge>
                <Badge className={cn("shrink-0", statusClass(menu.menu_status))}>
                  {menuStatusLabel(menu.menu_status, t)}
                </Badge>
                {sorting ? (
                  <Badge className="border-primary/20 bg-primary/10 text-primary">
                    {t("permissionMenu.savingSort")}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 max-w-full break-words font-mono text-xs text-muted-foreground" translate="no">
                {menu.menu_path || "-"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:justify-end">
            <Button disabled={busy} size="sm" type="button" variant="outline" onClick={() => onEditMain(menu)}>
              <Pencil data-icon="inline-start" />
              {t("actions.edit")}
            </Button>
            <Button disabled={busy} size="sm" type="button" variant="outline" onClick={() => onAddSub(menu)}>
              <Plus data-icon="inline-start" />
              {t("permissionMenu.addSub")}
            </Button>
            <Button
              className="text-destructive hover:text-destructive"
              disabled={busy}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => onDeleteMain(menu)}
            >
              <Trash2 data-icon="inline-start" />
              {t("actions.delete")}
            </Button>
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 lg:px-5">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black">{t("permissionMenu.submenuList")}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("permissionMenu.submenuListHint")}</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 lg:p-4">
          {submenus.length ? (
            <DndContext
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              sensors={sensors}
              onDragEnd={(event) => onReorderSub(menu, event)}
            >
              <SortableContext items={submenuIds(submenus)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2">
                  {submenus.map((submenu, index) => (
                    <SortableSubMenuCard
                      key={submenu.sub_id}
                      busy={busy}
                      index={index}
                      menu={menu}
                      submenu={submenu}
                      total={submenus.length}
                      onDelete={onDeleteSub}
                      onEdit={onEditSub}
                      onMove={onMoveSub}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <PermissionMenuEmpty
              description={t("permissionMenu.noSubmenusDescription")}
              title={t("permissionMenu.noSubmenus")}
            />
          )}
        </div>
      </div>
    </>
  );
}

function SortableMainMenuCard({
  busy,
  index,
  menu,
  searchActive,
  selected,
  total,
  onMove,
  onSelect
}: {
  busy: boolean;
  index: number;
  menu: PermissionMainMenu;
  searchActive: boolean;
  selected: boolean;
  total: number;
  onMove: (menuId: string, direction: PermissionMenuMoveDirection) => void;
  onSelect: (menuId: string) => void;
}) {
  const { t } = useTranslation();
  const sortDisabled = busy || searchActive;
  const selectedIcon = iconOption(menu.menu_icon);
  const SelectedIcon = selectedIcon.icon ?? FileText;
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    disabled: sortDisabled,
    id: menu.menu_id
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border bg-background p-2 shadow-sm",
        selected && "border-primary/40 bg-primary/5 ring-2 ring-primary/10",
        isDragging && "relative bg-card shadow-md"
      )}
      style={style}
    >
      <Button
        aria-label={t("permissionMenu.reorderMain")}
        className="cursor-grab active:cursor-grabbing"
        disabled={sortDisabled}
        size="iconSm"
        type="button"
        variant="ghost"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden />
      </Button>
      <Button
        aria-pressed={selected}
        className="h-auto min-h-12 min-w-0 justify-start gap-3 px-2 py-1.5 text-left"
        disabled={busy}
        type="button"
        variant="ghost"
        onClick={() => onSelect(menu.menu_id)}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary [&_svg]:size-4">
          <SelectedIcon aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black">{menu.menu_title || "-"}</span>
          <span className="mt-1 block truncate font-mono text-xs text-muted-foreground" translate="no">
            {menu.menu_path || "-"}
          </span>
        </span>
      </Button>
      <ReorderButtons
        busy={sortDisabled}
        itemTitle={menu.menu_title || "-"}
        isFirst={index <= 0}
        isLast={index >= total - 1}
        onMove={(direction) => onMove(menu.menu_id, direction)}
      />
    </div>
  );
}

function SortableSubMenuCard({
  busy,
  index,
  menu,
  submenu,
  total,
  onDelete,
  onEdit,
  onMove
}: {
  busy: boolean;
  index: number;
  menu: PermissionMainMenu;
  submenu: PermissionSubMenu;
  total: number;
  onDelete: (menu: PermissionMainMenu, submenu: PermissionSubMenu) => void;
  onEdit: (menu: PermissionMainMenu, submenu: PermissionSubMenu) => void;
  onMove: (menu: PermissionMainMenu, subId: string, direction: PermissionMenuMoveDirection) => void;
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
    <div
      ref={setNodeRef}
      className={cn(
        "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border bg-background p-2 shadow-sm",
        isDragging && "relative bg-card shadow-md"
      )}
      style={style}
    >
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
      <div className="min-w-0 px-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="min-w-0 truncate text-sm font-black">{submenu.sub_title || "-"}</p>
          <Badge className={cn("shrink-0", statusClass(submenu.sub_status))}>
            {statusLabel(submenu.sub_status, t)}
          </Badge>
        </div>
        <p className="mt-1 break-words font-mono text-xs text-muted-foreground" translate="no">
          {submenu.sub_path || "-"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ReorderButtons
          busy={busy}
          itemTitle={submenu.sub_title || "-"}
          isFirst={index <= 0}
          isLast={index >= total - 1}
          onMove={(direction) => onMove(menu, submenu.sub_id, direction)}
        />
        <Separator orientation="vertical" className="mx-1 h-8" />
        <Button
          aria-label={t("permissionMenu.editSub")}
          disabled={busy}
          size="iconSm"
          type="button"
          variant="ghost"
          onClick={() => onEdit(menu, submenu)}
        >
          <Pencil aria-hidden />
        </Button>
        <Button
          aria-label={t("permissionMenu.deleteSub")}
          className="text-destructive hover:text-destructive"
          disabled={busy}
          size="iconSm"
          type="button"
          variant="ghost"
          onClick={() => onDelete(menu, submenu)}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function ReorderButtons({
  busy,
  isFirst,
  isLast,
  itemTitle,
  onMove
}: {
  busy: boolean;
  isFirst: boolean;
  isLast: boolean;
  itemTitle: string;
  onMove: (direction: PermissionMenuMoveDirection) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex shrink-0 flex-col gap-1">
      <Button
        aria-label={t("permissionMenu.moveUp", { title: itemTitle })}
        disabled={busy || isFirst}
        size="iconSm"
        type="button"
        variant="ghost"
        onClick={() => onMove("up")}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        aria-label={t("permissionMenu.moveDown", { title: itemTitle })}
        disabled={busy || isLast}
        size="iconSm"
        type="button"
        variant="ghost"
        onClick={() => onMove("down")}
      >
        <ArrowDown aria-hidden />
      </Button>
    </div>
  );
}

function PermissionMenuEmpty({
  description,
  title
}: {
  description: string;
  title: string;
}) {
  return (
    <Empty className="min-h-52 border border-dashed bg-muted/20 p-4">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
          <FileText aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
