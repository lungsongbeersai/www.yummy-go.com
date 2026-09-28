"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Store as StoreIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Store } from "@/services/store";

// Store filter of the user list: a searchable dropdown (shadcn combobox), because a Super Admin
// picks from every store in the system. "" means every store.
export function UserStoreFilter({
  stores,
  value,
  onValueChange
}: {
  stores: Store[];
  value: string;
  onValueChange: (storeUuid: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const options = stores
    .map((store) => ({ label: String(store.store_name ?? store.store_uuid ?? ""), value: String(store.store_uuid ?? "") }))
    .filter((option) => option.value);
  const selected = options.find((option) => option.value === value);

  function choose(next: string) {
    onValueChange(next);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={t("nav.store")}>
          <StoreIcon data-icon="inline-start" />
          <span className="max-w-48 truncate">{selected?.label ?? t("settings.allStores")}</span>
          <ChevronsUpDown data-icon="inline-end" className="opacity-50" />
        </Button>
      </PopoverTrigger>
      {/* Never wider than the space Radix measured beside the trigger (narrow phones). */}
      <PopoverContent align="start" className="w-72 max-w-(--radix-popover-content-available-width) p-0">
        <Command>
          <CommandInput placeholder={t("settings.searchStore")} />
          <CommandList>
            <CommandEmpty>{t("settings.noStoresFound")}</CommandEmpty>
            <CommandGroup>
              {/* Items are matched on their label, so typing a store name finds it. */}
              <CommandItem value={t("settings.allStores")} onSelect={() => choose("")}>
                {t("settings.allStores")}
                <Check className={cn("ml-auto", value ? "opacity-0" : "opacity-100")} />
              </CommandItem>
              {options.map((option) => (
                <CommandItem key={option.value} value={`${option.label} ${option.value}`} onSelect={() => choose(option.value)}>
                  <span className="truncate">{option.label}</span>
                  <Check className={cn("ml-auto", option.value === value ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
