"use client";

import { useState, type ComponentProps } from "react";
import {
  ChevronDown,
  ChevronsUpDown,
  RotateCcw,
  Save,
  ShieldCheck,
  Store as StoreIcon,
  UserRound
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenuIcon } from "@/components/common/menu-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { SETTINGS_ACCENT } from "@/features/settings/shared/settings-tones";
import { cn } from "@/lib/utils";
import type {
  StorePermissionMenu,
  StorePermissionRole,
  StorePermissionStore,
  StorePermissionSubMenu
} from "@/services/permissions/access";

export interface PermissionMenuGroup {
  menu: StorePermissionMenu;
  submenus: StorePermissionSubMenu[];
}

export function menuSubmenus(menu: StorePermissionMenu) {
  return [...menu.sub_detail].sort((a, b) => a.sub_sort - b.sub_sort || a.sub_title.localeCompare(b.sub_title));
}

function menuSelection(menu: StorePermissionMenu, checked: Set<string>) {
  const submenus = menuSubmenus(menu);
  const selected = submenus.filter((submenu) => checked.has(submenu.sub_id)).length;
  return {
    allChecked: Boolean(submenus.length && selected === submenus.length),
    someChecked: selected > 0,
    selected,
    total: submenus.length
  };
}

/** A field label inside the setup card. */
function SectionLabel({ children, htmlFor }: { children: string; htmlFor?: string }) {
  return (
    <Label htmlFor={htmlFor} className="text-xs font-semibold text-muted-foreground">
      {children}
    </Label>
  );
}

// Store picker: a searchable dropdown, because a Super Admin picks from every store.
export function PermissionStorePicker({
  disabled,
  stores,
  value,
  onValueChange
}: {
  disabled: boolean;
  stores: StorePermissionStore[];
  value: string;
  onValueChange: (storeUuid: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = stores.find((store) => store.store_uuid === value);

  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel htmlFor="permission-store-select">{t("storePermissions.store")}</SectionLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="permission-store-select"
            aria-expanded={open}
            className="w-full justify-start"
            disabled={disabled}
            role="combobox"
            size="lg"
            type="button"
            variant="outline"
          >
            <StoreIcon data-icon="inline-start" />
            <span className="min-w-0 flex-1 truncate text-left">
              {selected ? selected.store_name || selected.store_uuid : t("storePermissions.selectStore")}
            </span>
            <ChevronsUpDown data-icon="inline-end" className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-64 max-w-(--radix-popover-content-available-width) p-0"
        >
          <Command>
            <CommandInput placeholder={t("settings.searchStore")} />
            <CommandList>
              <CommandEmpty>{t("settings.noStoresFound")}</CommandEmpty>
              <CommandGroup>
                {stores.map((store) => (
                  <CommandItem
                    key={store.store_uuid}
                    data-checked={store.store_uuid === value}
                    value={`${store.store_name} ${store.store_uuid}`}
                    onSelect={() => {
                      onValueChange(store.store_uuid);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{store.store_name || store.store_uuid}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Roles are few, so they are all on screen as a list instead of hidden in a dropdown; each shows
// how many submenus it has saved for this store.
export function PermissionRoleList({
  disabled,
  roles,
  savedCounts,
  value,
  onValueChange
}: {
  disabled: boolean;
  roles: StorePermissionRole[];
  savedCounts: Map<number, number>;
  value: number | null;
  onValueChange: (roleId: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-col gap-1.5">
      <SectionLabel>{t("storePermissions.role")}</SectionLabel>
      <div role="radiogroup" aria-label={t("storePermissions.role")} className="flex flex-col gap-1">
        {roles.map((role) => {
          const active = role.roles_id === value;
          const saved = savedCounts.get(role.roles_id);
          return (
            <button
              key={role.roles_id}
              aria-checked={active}
              className={cn(
                "flex min-w-0 items-center gap-2.5 rounded-lg border border-transparent p-1.5 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50",
                active && "border-primary/30 bg-primary/10 hover:bg-primary/10"
              )}
              disabled={disabled}
              role="radio"
              type="button"
              onClick={() => onValueChange(role.roles_id)}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  active ? SETTINGS_ACCENT.solid : SETTINGS_ACCENT.soft
                )}
              >
                <UserRound className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">{role.role_name || role.roles_id}</span>
              {typeof saved === "number" ? (
                <Badge variant="secondary" className="shrink-0 tabular-nums">
                  {saved}
                </Badge>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** How much of the menu this role can open: the one number the page is about. */
export function PermissionProgress({ selected, total }: { selected: number; total: number }) {
  const { t } = useTranslation();
  const percent = total ? Math.round((selected / total) * 100) : 0;

  return (
    <div className={cn("flex flex-col gap-2 rounded-lg p-3", SETTINGS_ACCENT.wash)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{t("storePermissions.access")}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{percent}%</span>
      </div>
      <p className="text-2xl/none font-semibold tabular-nums">
        {selected}
        <span className="text-sm font-normal text-muted-foreground"> / {total}</span>
      </p>
      <Progress value={percent} aria-label={t("storePermissions.summary", { selected, total })} />
    </div>
  );
}

function PermissionCheckbox({
  indeterminate,
  checked,
  ...props
}: ComponentProps<typeof Checkbox> & { indeterminate?: boolean }) {
  return <Checkbox checked={indeterminate ? "indeterminate" : checked} {...props} />;
}

// One card per main menu: a tri-state checkbox for the whole group, and its submenus as tick
// tiles that flow into two or three columns when the card is wide (container queries).
export function PermissionGroupList({
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
    <div className="flex flex-col gap-2">
      {groups.map(({ menu, submenus }) => {
        const selection = menuSelection(menu, checkedSet);
        const indeterminate = selection.someChecked && !selection.allChecked;
        const collapsed = searchActive ? false : collapsedMenuIds.has(menu.menu_id);
        const title = menu.menu_title || menu.menu_path || "-";

        return (
          <section key={menu.menu_id} className="overflow-hidden rounded-lg border bg-card">
            <div className={cn("flex min-w-0 items-center gap-2 py-1.5 pr-1.5 pl-3", selection.someChecked && "bg-primary/5")}>
              <PermissionCheckbox
                aria-checked={indeterminate ? "mixed" : selection.allChecked}
                aria-label={t("storePermissions.toggleMenu", { title })}
                checked={selection.allChecked}
                disabled={saving || !selection.total}
                indeterminate={indeterminate}
                onCheckedChange={(checked) => onToggleMenu(menu.menu_id, checked === true)}
              />
              <button
                aria-expanded={!collapsed}
                aria-label={t(collapsed ? "storePermissions.expandMenu" : "storePermissions.collapseMenu", { title })}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default"
                disabled={searchActive}
                type="button"
                onClick={() => onToggleCollapse(menu.menu_id)}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
                    selection.allChecked ? SETTINGS_ACCENT.solid : SETTINGS_ACCENT.soft
                  )}
                >
                  <MenuIcon value={menu.menu_icon} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-xs font-semibold">{menu.menu_title || "-"}</span>
                  <span className="truncate font-mono text-2xs text-muted-foreground" translate="no">
                    {menu.menu_path || "-"}
                  </span>
                </span>
                <Badge
                  className="shrink-0 tabular-nums"
                  variant={selection.allChecked ? "default" : selection.someChecked ? "secondary" : "outline"}
                >
                  {selection.selected}/{selection.total}
                </Badge>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                    collapsed && "-rotate-90",
                    searchActive && "opacity-0"
                  )}
                />
              </button>
            </div>

            {collapsed ? null : submenus.length ? (
              <div className="grid gap-1.5 border-t p-2 @xl:grid-cols-2 @5xl:grid-cols-3">
                {submenus.map((submenu) => {
                  const checked = checkedSet.has(submenu.sub_id);
                  const inputId = `permission-submenu-${submenu.sub_id}`;
                  return (
                    <Label
                      key={submenu.sub_id}
                      htmlFor={inputId}
                      className={cn(
                        "min-w-0 cursor-pointer gap-2.5 rounded-md border p-2.5 leading-normal font-normal transition-colors hover:bg-muted/50",
                        checked && "border-primary/40 bg-primary/5 hover:bg-primary/10"
                      )}
                    >
                      <Checkbox
                        id={inputId}
                        checked={checked}
                        disabled={saving}
                        onCheckedChange={(next) => onToggleSubmenu(submenu.sub_id, next === true)}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-xs font-medium">{submenu.sub_title || "-"}</span>
                        <span className="truncate font-mono text-2xs text-muted-foreground" translate="no">
                          {submenu.sub_path || "-"}
                        </span>
                      </span>
                    </Label>
                  );
                })}
              </div>
            ) : (
              <p className="border-t px-3 py-2.5 text-xs text-muted-foreground">{t("storePermissions.noSubmenus")}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Save bar: pinned to the bottom of the page, so Save is always in reach however far down the
// list the user has ticked. The bottom offset clears the native bottom nav (0 on the web).
export function PermissionSaveBar({
  canReset,
  canSave,
  dirty,
  saving,
  onReset,
  onSave
}: {
  canReset: boolean;
  canSave: boolean;
  dirty: boolean;
  saving: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="sticky bottom-[max(var(--app-shell-bottom-nav-height,0px),var(--pos-system-bottom-safe-area,0px))] z-10 flex shrink-0 flex-wrap items-center gap-2 rounded-lg border bg-card p-2 pl-3 shadow-sm">
      <p aria-live="polite" className="flex min-w-40 flex-1 items-center gap-2 text-xs">
        {/* Unsaved changes are a real state, so they get the status colour. */}
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dirty ? "bg-warning" : "bg-success")} />
        <span className={cn(dirty ? "font-medium" : "text-muted-foreground")}>
          {dirty ? t("storePermissions.unsavedChanges") : t("storePermissions.noChanges")}
        </span>
      </p>
      <Button disabled={!canReset} type="button" variant="outline" onClick={onReset}>
        <RotateCcw data-icon="inline-start" />
        {t("storePermissions.resetChanges")}
      </Button>
      <Button disabled={!canSave} type="button" onClick={onSave}>
        {saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
        {t("actions.save")}
      </Button>
    </div>
  );
}

export function PermissionEmpty({ description, title }: { description: string; title: string }) {
  return (
    <Empty className="min-h-72 flex-1 border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon" className={SETTINGS_ACCENT.soft}>
          <ShieldCheck aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
