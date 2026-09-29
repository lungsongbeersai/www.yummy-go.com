"use client";

import { useState, type ReactNode } from "react";
import { ArrowUpToLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenuIcon } from "@/components/common/menu-icon";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogHeader
} from "@/features/settings/shared/settings-shell";
import { SETTINGS_ACCENT } from "@/features/settings/shared/settings-tones";
import { cn } from "@/lib/utils";
import type { PermissionMainMenu, PermissionSubMenu } from "@/services/permissions/menu-admin";
import { iconOption } from "./permission-menu-utils";

/** Where a submenu goes: under another main menu, or up to a main menu of its own. */
export type PermissionSubMenuMoveTarget = { menuId: string; type: "menu" } | { type: "main" };

export type PermissionSubMenuMoveRequest = { menu: PermissionMainMenu; submenu: PermissionSubMenu };

const PROMOTE_VALUE = "__promote__";

// Keyed on the submenu by the caller, so each opening starts with nothing picked.
export function MoveSubMenuDialog({
  menus,
  request,
  saving,
  onMove,
  onOpenChange
}: {
  menus: PermissionMainMenu[];
  request: PermissionSubMenuMoveRequest | null;
  saving: boolean;
  onMove: (target: PermissionSubMenuMoveTarget) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState("");
  const targets = menus.filter((menu) => menu.menu_id !== request?.menu.menu_id);

  function submit() {
    if (!picked) return;
    onMove(picked === PROMOTE_VALUE ? { type: "main" } : { menuId: picked, type: "menu" });
  }

  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <SettingsDialogContent>
        <SettingsDialogHeader>
          <DialogTitle>{t("permissionMenu.moveSubTitle", { title: request?.submenu.sub_title ?? "" })}</DialogTitle>
          <DialogDescription>
            {t("permissionMenu.moveSubDescription", { title: request?.menu.menu_title ?? "" })}
          </DialogDescription>
        </SettingsDialogHeader>
        <SettingsDialogBody>
          <Command className="rounded-lg border">
            <CommandInput placeholder={t("permissionMenu.searchMain")} />
            <CommandList className="max-h-80">
              <CommandEmpty>{t("permissionMenu.noMainSearchResults")}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  data-checked={picked === PROMOTE_VALUE}
                  value={`${PROMOTE_VALUE} ${t("permissionMenu.promoteToMain")}`}
                  onSelect={() => setPicked(PROMOTE_VALUE)}
                >
                  <TargetTile active={picked === PROMOTE_VALUE}>
                    <ArrowUpToLine />
                  </TargetTile>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{t("permissionMenu.promoteToMain")}</span>
                    <span className="text-muted-foreground">{t("permissionMenu.promoteToMainHint")}</span>
                  </span>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading={t("permissionMenu.moveToMenu")}>
                {targets.map((menu) => (
                  <CommandItem
                    key={menu.menu_id}
                    data-checked={picked === menu.menu_id}
                    value={`${menu.menu_title} ${menu.menu_path} ${menu.menu_id}`}
                    onSelect={() => setPicked(menu.menu_id)}
                  >
                    <TargetTile active={picked === menu.menu_id}>
                      <MenuIcon value={iconOption(menu.menu_icon).value} />
                    </TargetTile>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{menu.menu_title || "-"}</span>
                      <span className="truncate font-mono text-2xs text-muted-foreground" translate="no">
                        {menu.menu_path || "-"}
                      </span>
                    </span>
                    <span className="text-muted-foreground tabular-nums">{menu.sub_detail.length}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </SettingsDialogBody>
        <SettingsDialogFooter>
          <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("actions.cancel")}
          </Button>
          <Button disabled={saving || !picked} type="button" onClick={submit}>
            {saving ? <Spinner data-icon="inline-start" /> : null}
            {t("permissionMenu.moveConfirm")}
          </Button>
        </SettingsDialogFooter>
      </SettingsDialogContent>
    </Dialog>
  );
}

function TargetTile({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
        active ? SETTINGS_ACCENT.solid : SETTINGS_ACCENT.soft
      )}
    >
      {children}
    </span>
  );
}
