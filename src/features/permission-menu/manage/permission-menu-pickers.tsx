"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, CircleSlash2, FileText, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogHeader
} from "@/features/settings/shared/settings-shell";
import { cn } from "@/lib/utils";
import { NAV_ICON_OPTIONS, PROJECT_ROUTE_OPTIONS, type PickerOption } from "./permission-menu-options";
import { iconOption, optionLabel } from "./permission-menu-utils";

interface ResolvedIconOption extends PickerOption {
  label: string;
  searchText: string;
}

export function IconPickerButton({
  disabled,
  id,
  onValueChange,
  value
}: {
  disabled?: boolean;
  id: string;
  onValueChange: (value: string) => void;
  value: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = iconOption(value);
  const SelectedIcon = selected.icon ?? FileText;
  const selectedLabel = optionLabel(selected, t);
  const options = useMemo<ResolvedIconOption[]>(
    () =>
      NAV_ICON_OPTIONS.map((option) => {
        const label = optionLabel(option, t);
        return {
          ...option,
          label,
          searchText: [option.value, label].join(" ").toLowerCase()
        };
      }),
    [t]
  );
  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.searchText.includes(query));
  }, [options, search]);

  function selectIcon(nextValue: string) {
    onValueChange(nextValue);
    setSearch("");
    setOpen(false);
  }

  return (
    <>
      <Button
        aria-haspopup="dialog"
        className="h-auto min-h-20 w-full justify-start gap-3 px-3 py-3 text-left"
        disabled={disabled}
        id={id}
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-md bg-primary/10 text-primary [&_svg]:size-7">
          <SelectedIcon aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-muted-foreground">
            {t("permissionMenu.selectedIcon")}
          </span>
          <span className="mt-1 block truncate text-sm font-black text-foreground">{selectedLabel}</span>
          <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">{selected.value}</span>
        </span>
        <span className="shrink-0 text-xs font-bold text-primary">{t("permissionMenu.changeIcon")}</span>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setSearch("");
        }}
      >
        <SettingsDialogContent className="sm:max-w-3xl">
          <SettingsDialogHeader>
            <DialogTitle>{t("permissionMenu.iconDialogTitle")}</DialogTitle>
            <DialogDescription>{t("permissionMenu.iconDialogDescription")}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody className="flex flex-col gap-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
              <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <span className="grid size-14 shrink-0 place-items-center rounded-md bg-primary/10 text-primary [&_svg]:size-8">
                  <SelectedIcon aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{t("permissionMenu.selectedIcon")}</p>
                  <p className="truncate text-sm font-semibold text-foreground">{selectedLabel}</p>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{selected.value}</p>
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-card p-3">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">
                    {t("permissionMenu.selectIcon")}
                  </span>
                  <Badge className="h-6 min-w-14 justify-center rounded-md bg-primary/10 px-2.5 text-primary">
                    {filteredOptions.length} / {options.length}
                  </Badge>
                </div>
                <div className="flex min-w-0 items-center gap-2 rounded-md border border-input bg-background px-2.5 transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <Search aria-hidden />
                  </span>
                  <Input
                    aria-label={t("permissionMenu.searchIcon")}
                    autoComplete="off"
                    className="h-10 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                    name="permission_icon_search"
                    placeholder={t("permissionMenu.searchIcon")}
                    spellCheck={false}
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {search ? (
                    <Button
                      aria-label={t("permissionMenu.clearIconSearch")}
                      size="iconSm"
                      type="button"
                      variant="ghost"
                      onClick={() => setSearch("")}
                    >
                      <X aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="max-h-88 overflow-y-auto rounded-lg border border-border bg-background p-2">
              {filteredOptions.length ? (
                <div aria-label={t("permissionMenu.selectIcon")} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="listbox">
                  {filteredOptions.map((option) => {
                    const isActive = option.value === value;
                    const Icon = option.icon ?? FileText;
                    return (
                      <Button
                        key={option.value}
                        aria-selected={isActive}
                        className={cn(
                          "h-auto min-h-20 justify-start gap-3 px-3 py-2 text-left shadow-sm",
                          isActive && "border-primary bg-primary/10 text-foreground ring-2 ring-primary/15"
                        )}
                        role="option"
                        title={option.label}
                        type="button"
                        variant="outline"
                        onClick={() => selectIcon(option.value)}
                      >
                        <span className={cn("grid size-12 shrink-0 place-items-center rounded-md bg-primary/10 text-primary [&_svg]:size-8", isActive && "ring-1 ring-primary/25")}>
                          <Icon aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-sm font-medium">{option.label}</span>
                          <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">{option.value}</span>
                        </span>
                        {isActive ? <Check aria-hidden /> : null}
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <Empty className="min-h-40 border border-dashed bg-muted/30 p-6">
                  <EmptyHeader>
                    <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
                      <CircleSlash2 aria-hidden />
                    </EmptyMedia>
                    <EmptyTitle>{t("permissionMenu.noIconsFound")}</EmptyTitle>
                    <EmptyDescription>{t("permissionMenu.tryDifferentIconSearch")}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </SettingsDialogBody>
          <SettingsDialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("actions.close")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogContent>
      </Dialog>
    </>
  );
}

export function PathPicker({
  disabled,
  id,
  onValueChange,
  value
}: {
  disabled?: boolean;
  id: string;
  onValueChange: (value: string) => void;
  value: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Input
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        id={id}
        name={id}
        placeholder={t("permissionMenu.manualPathPlaceholder")}
        spellCheck={false}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={t("permissionMenu.openPathSuggestions")}
            disabled={disabled}
            role="combobox"
            size="iconSm"
            type="button"
            variant="outline"
          >
            <ChevronsUpDown aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-80 max-w-[calc(100vw-2rem)] overflow-hidden p-0"
          portalled={false}
          side="bottom"
          sideOffset={6}
          onTouchMove={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <Command
            className="**:data-[slot=command-input-wrapper]:h-9 **:data-[slot=command-input]:h-9 **:data-[slot=command-item]:py-2"
            filter={(optionValue, search) => (optionValue.includes(search.toLowerCase()) ? 1 : 0)}
          >
            <CommandInput
              aria-label={t("permissionMenu.searchPath")}
              autoComplete="off"
              name="permission_path_search"
              placeholder={t("permissionMenu.searchPath")}
              spellCheck={false}
            />
            <CommandList className="max-h-60 overscroll-contain">
              <CommandEmpty>{t("permissionMenu.noPathsFound")}</CommandEmpty>
              <CommandGroup heading={t("permissionMenu.routeSuggestions")}>
                {PROJECT_ROUTE_OPTIONS.map((option) => {
                  const Icon = option.icon ?? FileText;
                  const label = optionLabel(option, t);
                  return (
                    <CommandItem
                      key={option.value}
                      value={`${option.value} ${label}`.toLowerCase()}
                      onSelect={() => {
                        onValueChange(option.value);
                        setOpen(false);
                      }}
                    >
                      <Icon aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{label}</span>
                        <span className="block truncate font-mono text-xs text-muted-foreground">{option.value}</span>
                      </span>
                      <Check className={cn("ml-auto", option.value === value ? "opacity-100" : "opacity-0")} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
