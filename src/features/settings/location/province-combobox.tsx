"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useDropdownButtonLoading } from "@/hooks/use-dropdown-button-loading";
import {
  locationValue,
  provinceLabel
} from "./location-utils";
import type { LocationSettingsRow } from "./location-types";

export function ProvinceCombobox({
  disabled = false,
  id,
  loading = false,
  onValueChange,
  provinces,
  value: selectedValue
}: {
  disabled?: boolean;
  id: string;
  loading?: boolean;
  onValueChange: (value: string) => void;
  provinces: LocationSettingsRow[];
  value: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const options = useMemo(() => {
    const selectedExists = provinces.some((province) => locationValue(province, "province_uuid") === selectedValue);
    const list = provinces.map((province) => {
      const uuid = locationValue(province, "province_uuid");
      const label = provinceLabel(province);
      const laoName = locationValue(province, "province_name_la");
      const englishName = locationValue(province, "province_name_eng");
      return {
        label,
        searchText: [uuid, label, laoName, englishName].join(" ").toLowerCase(),
        value: uuid
      };
    });

    if (!selectedValue || selectedExists) return list;
    return [{ label: selectedValue, searchText: selectedValue.toLowerCase(), value: selectedValue }, ...list];
  }, [provinces, selectedValue]);
  const selected = options.find((option) => option.value === selectedValue);
  const dropdownLoading = useDropdownButtonLoading({ loading, open, loadingKey: `${options.length}:${selectedValue}` });

  return (
    <>
      <input name="province_uuid_fk" readOnly type="hidden" value={selectedValue} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-busy={dropdownLoading}
            className="w-full justify-between"
            disabled={disabled}
            id={id}
            role="combobox"
            type="button"
            variant="outline"
          >
            <span className="min-w-0 truncate">{selected?.label || t("settings.selectProvince")}</span>
            {dropdownLoading ? (
              <Spinner data-icon="inline-end" />
            ) : (
              <ChevronsUpDown className="opacity-50" data-icon="inline-end" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
          portalled={false}
          side="bottom"
          sideOffset={6}
          onTouchMove={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <Command
            className="[&_[data-slot=command-input-wrapper]]:h-8 [&_[data-slot=command-input]]:h-8 [&_[data-slot=command-item]]:py-1"
            filter={(value, search) => (value.includes(search.toLowerCase()) ? 1 : 0)}
          >
            <CommandInput placeholder={t("settings.searchProvince")} />
            <CommandList className="max-h-28 overscroll-contain">
              <CommandEmpty>{t("settings.noProvincesFound")}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.value} ${option.searchText}`}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <MapPin />
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    <Check className={option.value === selectedValue ? "ml-auto opacity-100" : "ml-auto opacity-0"} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
