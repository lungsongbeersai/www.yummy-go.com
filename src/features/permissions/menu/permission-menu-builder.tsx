"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
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
  ArrowRightLeft,
  ArrowUp,
  FileText,
  GripVertical,
  Info,
  ListTree,
  Pencil,
  Plus,
  Search,
  Trash2
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenuIcon } from "@/components/common/menu-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { SETTINGS_ACCENT } from "@/features/settings/shared/settings-tones";
import { cn } from "@/lib/utils";
import type { PermissionMainMenu, PermissionSubMenu } from "@/services/permissions/menu-admin";
import {
  badgeLabel,
  iconOption,
  menuBadgeText,
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
  onAddSub: (menu: PermissionMainMenu) => void;
  onDeleteMain: (menu: PermissionMainMenu) => void;
  onDeleteSub: (menu: PermissionMainMenu, submenu: PermissionSubMenu) => void;
  onEditMain: (menu: PermissionMainMenu) => void;
  onEditSub: (menu: PermissionMainMenu, submenu: PermissionSubMenu) => void;
  onMoveMain: (menuId: string, direction: PermissionMenuMoveDirection) => void;
  onMoveSub: (menu: PermissionMainMenu, subId: string, direction: PermissionMenuMoveDirection) => void;
  onReorderMain: (event: DragEndEvent) => void;
  onReorderSub: (menu: PermissionMainMenu, event: DragEndEvent) => void;
  onRelocateSub: (menu: PermissionMainMenu, submenu: PermissionSubMenu) => void;
  onSearchChange: (search: string) => void;
  onSelectMenu: (menuId: string) => void;
}

// Two cards: the main menus on the left (pick, search, reorder) and the picked menu with its
// submenus on the right. Container queries, not viewport breakpoints: the app sidebar takes
// 16rem, so the page itself decides when the two cards fit side by side.
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
  onAddSub,
  onDeleteMain,
  onDeleteSub,
  onEditMain,
  onEditSub,
  onMoveMain,
  onMoveSub,
  onReorderMain,
  onReorderSub,
  onRelocateSub,
  onSearchChange,
  onSelectMenu
}: PermissionMenuBuilderProps) {
  const { t } = useTranslation();
  const sortDisabled = busy || searchActive;
  const listRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  // Stacked (narrow page), the details sit below the list, out of sight: bring them into view so
  // a tap visibly does something. Side by side they are already on screen.
  function selectMenu(menuId: string) {
    onSelectMenu(menuId);
    const list = listRef.current;
    const detail = detailRef.current;
    if (!list || !detail || detail.getBoundingClientRect().top < list.getBoundingClientRect().bottom) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    detail.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col gap-4 @4xl:grid @4xl:min-h-0 @4xl:flex-1 @4xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
      <Card ref={listRef} className="max-h-[45dvh] min-h-72 shrink-0 gap-0 py-0 @4xl:max-h-none @4xl:min-h-0">
        <div className="flex shrink-0 flex-col gap-3 border-b p-3">
          <PanelTitle
            count={menus.length}
            hint={t("permissionMenu.mainListHint")}
            title={t("permissionMenu.mainList")}
          />
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={t("permissionMenu.searchMain")}
              autoComplete="off"
              name="manage_menu_main_search"
              placeholder={t("permissionMenu.searchMainPlaceholder")}
              spellCheck={false}
              value={mainSearch}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </InputGroup>
          {searchActive ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info aria-hidden className="size-3.5 shrink-0" />
              {t("permissionMenu.sortPausedBySearch")}
            </p>
          ) : null}
        </div>

        {/* settings-table-scroll keeps the bottom safe-area clear (see globals.css): this page
            has no pagination footer to do it. */}
        <div className="settings-table-scroll min-h-0 flex-1 overflow-y-auto p-2">
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
                <div className="flex flex-col gap-1">
                  {visibleMenus.map((menu) => {
                    const index = menus.findIndex((item) => item.menu_id === menu.menu_id);
                    return (
                      <SortableMainMenuRow
                        key={menu.menu_id}
                        busy={busy}
                        index={index}
                        menu={menu}
                        searchActive={searchActive}
                        selected={menu.menu_id === selectedMenuId}
                        total={menus.length}
                        onMove={onMoveMain}
                        onSelect={selectMenu}
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
      </Card>

      <Card ref={detailRef} className="min-h-96 gap-0 py-0 @4xl:min-h-0">
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
            onRelocateSub={onRelocateSub}
          />
        ) : (
          <div className="flex flex-1 items-center p-4">
            <PermissionMenuEmpty
              description={t("permissionMenu.selectMenuDescription")}
              title={t("permissionMenu.selectMenuTitle")}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function PanelTitle({ action, count, hint, title }: { action?: ReactNode; count: number; hint: string; title: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <div className="flex min-w-40 flex-1 flex-col gap-0.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {title}
          <Badge variant="secondary" className="tabular-nums">
            {count.toLocaleString("en-US")}
          </Badge>
        </h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {action}
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
  onReorderSub,
  onRelocateSub
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
  onRelocateSub: (menu: PermissionMainMenu, submenu: PermissionSubMenu) => void;
}) {
  const { t } = useTranslation();
  const submenus = menuSubmenus(menu);
  const selectedIcon = iconOption(menu.menu_icon);

  return (
    <>
      {/* The picked menu: the same theme-colour wash as the page header, so it reads as "this one". */}
      <div className={cn("flex shrink-0 flex-wrap items-start gap-3 border-b p-4", SETTINGS_ACCENT.wash)}>
        <span
          aria-hidden
          className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl shadow-sm [&_svg]:size-6", SETTINGS_ACCENT.solid)}
        >
          <MenuIcon value={selectedIcon.value} />
        </span>
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t("permissionMenu.selectedMenu")}</p>
          <h2 className="text-lg/tight font-semibold wrap-break-word">{menu.menu_title || "-"}</h2>
          <code className="w-fit max-w-full rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs wrap-break-word text-muted-foreground" translate="no">
            {menu.menu_path || "-"}
          </code>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={statusClass(menu.menu_status)}>{menuStatusLabel(menu.menu_status, t)}</Badge>
            <Badge variant="outline">{badgeLabel(menu.menu_badge, t, menu.menu_badge_text)}</Badge>
            {sorting ? (
              <Badge variant="secondary">
                <Spinner data-icon="inline-start" />
                {t("permissionMenu.savingSort")}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button disabled={busy} type="button" variant="outline" onClick={() => onEditMain(menu)}>
            <Pencil data-icon="inline-start" />
            {t("actions.edit")}
          </Button>
          <Button disabled={busy} type="button" variant="destructive" onClick={() => onDeleteMain(menu)}>
            <Trash2 data-icon="inline-start" />
            {t("actions.delete")}
          </Button>
        </div>
      </div>

      <div className="shrink-0 border-b px-4 py-3">
        <PanelTitle
          action={
            <Button disabled={busy} type="button" onClick={() => onAddSub(menu)}>
              <Plus data-icon="inline-start" />
              {t("permissionMenu.addSub")}
            </Button>
          }
          count={submenus.length}
          hint={t("permissionMenu.submenuListHint")}
          title={t("permissionMenu.submenuList")}
        />
      </div>

      {/* Same reason as the main list: settings-table-scroll keeps the bottom safe-area clear. */}
      <div className="settings-table-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {submenus.length ? (
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            sensors={sensors}
            onDragEnd={(event) => onReorderSub(menu, event)}
          >
            <SortableContext items={submenuIds(submenus)} strategy={verticalListSortingStrategy}>
              <ol aria-label={t("permissionMenu.submenuTableLabel", { title: menu.menu_title })} className="flex flex-col gap-2">
                {submenus.map((submenu, index) => (
                  <SortableSubMenuRow
                    key={submenu.sub_id}
                    busy={busy}
                    index={index}
                    menu={menu}
                    submenu={submenu}
                    total={submenus.length}
                    onDelete={onDeleteSub}
                    onEdit={onEditSub}
                    onMove={onMoveSub}
                    onRelocate={onRelocateSub}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        ) : (
          <PermissionMenuEmpty
            action={
              <Button disabled={busy} type="button" variant="outline" onClick={() => onAddSub(menu)}>
                <Plus data-icon="inline-start" />
                {t("permissionMenu.addSub")}
              </Button>
            }
            description={t("permissionMenu.noSubmenusDescription")}
            title={t("permissionMenu.noSubmenus")}
          />
        )}
      </div>
    </>
  );
}

function sortableStyle(transform: Parameters<typeof CSS.Transform.toString>[0], transition: string | undefined): CSSProperties {
  return { transform: CSS.Transform.toString(transform), transition };
}

function SortableMainMenuRow({
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
  const badgeText = menuBadgeText(menu.menu_badge, menu.menu_badge_text);
  const submenuCount = menu.sub_detail.length;
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    disabled: sortDisabled,
    id: menu.menu_id
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/row flex min-w-0 items-center gap-1 rounded-lg border border-transparent p-1 transition-colors hover:bg-muted/60",
        selected && "border-primary/30 bg-primary/10 hover:bg-primary/10",
        isDragging && "relative z-10 border-border bg-card shadow-md"
      )}
      style={sortableStyle(transform, transition)}
    >
      <Button
        aria-label={t("permissionMenu.reorderMain")}
        className="cursor-grab text-muted-foreground active:cursor-grabbing"
        disabled={sortDisabled}
        size="icon-sm"
        type="button"
        variant="ghost"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden />
      </Button>
      <button
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
        disabled={busy}
        type="button"
        onClick={() => onSelect(menu.menu_id)}
      >
        {/* The picked row gets the solid tile, the rest the soft one. */}
        <span
          aria-hidden
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
            selected ? SETTINGS_ACCENT.solid : SETTINGS_ACCENT.soft
          )}
        >
          <MenuIcon value={selectedIcon.value} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-xs font-semibold">{menu.menu_title || "-"}</span>
            {badgeText ? (
              <Badge className="max-w-20 shrink-0 truncate" translate="no">
                {badgeText}
              </Badge>
            ) : null}
          </span>
          <span className="truncate font-mono text-2xs text-muted-foreground" translate="no">
            {menu.menu_path || "-"}
          </span>
        </span>
      </button>
      {/* Arrows only on the picked row (touch and keyboard users); drag works on every row. */}
      {selected ? (
        <ReorderButtons
          busy={sortDisabled}
          isFirst={index <= 0}
          isLast={index >= total - 1}
          itemTitle={menu.menu_title || "-"}
          onMove={(direction) => onMove(menu.menu_id, direction)}
        />
      ) : (
        <Badge
          aria-label={t("permissionMenu.submenuCount", { count: submenuCount })}
          className="mr-1 min-w-6 shrink-0 justify-center tabular-nums"
          variant={submenuCount ? "secondary" : "outline"}
        >
          {submenuCount}
        </Badge>
      )}
    </div>
  );
}

function SortableSubMenuRow({
  busy,
  index,
  menu,
  submenu,
  total,
  onDelete,
  onEdit,
  onMove,
  onRelocate
}: {
  busy: boolean;
  index: number;
  menu: PermissionMainMenu;
  submenu: PermissionSubMenu;
  total: number;
  onDelete: (menu: PermissionMainMenu, submenu: PermissionSubMenu) => void;
  onEdit: (menu: PermissionMainMenu, submenu: PermissionSubMenu) => void;
  onMove: (menu: PermissionMainMenu, subId: string, direction: PermissionMenuMoveDirection) => void;
  onRelocate: (menu: PermissionMainMenu, submenu: PermissionSubMenu) => void;
}) {
  const { t } = useTranslation();
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    disabled: busy,
    id: submenu.sub_id
  });

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-card p-2 transition-colors hover:border-primary/30",
        isDragging && "relative z-10 shadow-md"
      )}
      style={sortableStyle(transform, transition)}
    >
      <div className="flex min-w-48 flex-1 items-center gap-2">
        <Button
          aria-label={t("permissionMenu.reorderSub")}
          className="cursor-grab text-muted-foreground active:cursor-grabbing"
          disabled={busy}
          size="icon-sm"
          type="button"
          variant="ghost"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden />
        </Button>
        {/* Its position in the sidebar, 1-based. */}
        <span
          aria-hidden
          className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums", SETTINGS_ACCENT.soft)}
        >
          {index + 1}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-xs font-semibold">{submenu.sub_title || "-"}</p>
          <p className="truncate font-mono text-2xs text-muted-foreground" translate="no">
            {submenu.sub_path || "-"}
          </p>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Badge className={statusClass(submenu.sub_status)}>{statusLabel(submenu.sub_status, t)}</Badge>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ReorderButtons
          busy={busy}
          isFirst={index <= 0}
          isLast={index >= total - 1}
          itemTitle={submenu.sub_title || "-"}
          onMove={(direction) => onMove(menu, submenu.sub_id, direction)}
        />
        <Button
          aria-label={t("permissionMenu.moveSubAction", { title: submenu.sub_title || "-" })}
          disabled={busy}
          size="icon-sm"
          title={t("permissionMenu.moveSubAction", { title: submenu.sub_title || "-" })}
          type="button"
          variant="ghost"
          onClick={() => onRelocate(menu, submenu)}
        >
          <ArrowRightLeft aria-hidden />
        </Button>
        <Button
          aria-label={t("permissionMenu.editSub")}
          disabled={busy}
          size="icon-sm"
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
          size="icon-sm"
          type="button"
          variant="ghost"
          onClick={() => onDelete(menu, submenu)}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </li>
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
    <div className="flex shrink-0 items-center">
      <Button
        aria-label={t("permissionMenu.moveUp", { title: itemTitle })}
        disabled={busy || isFirst}
        size="icon-sm"
        type="button"
        variant="ghost"
        onClick={() => onMove("up")}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        aria-label={t("permissionMenu.moveDown", { title: itemTitle })}
        disabled={busy || isLast}
        size="icon-sm"
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
  action,
  description,
  title
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Empty className="min-h-52 w-full border border-dashed p-4">
      <EmptyHeader>
        <EmptyMedia variant="icon" className={SETTINGS_ACCENT.soft}>
          {action ? <ListTree aria-hidden /> : <FileText aria-hidden />}
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
