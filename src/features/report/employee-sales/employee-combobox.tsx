"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, User as UserIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import type { User } from "@/services/user";

export function EmployeeCombobox({
  disabled = false,
  employees,
  id,
  loading = false,
  onValueChange,
  value: selectedValue,
}: {
  disabled?: boolean;
  employees: User[];
  id: string;
  loading?: boolean;
  onValueChange: (value: string) => void;
  value: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const options = useMemo(() => employees.map(employee => ({
    label: employee.login_email || employee.login_uuid,
    searchText: [employee.login_uuid, employee.login_email, employee.roles_name].filter(Boolean).join(" ").toLowerCase(),
    value: employee.login_uuid,
  })), [employees]);
  const selected = options.find(option => option.value === selectedValue);
  const dropdownLoading = open && loading;

  return (
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
          <span className="min-w-0 truncate">{selected?.label || t("employeeSales.allEmployees")}</span>
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
        side="bottom"
        sideOffset={6}
        onTouchMove={event => event.stopPropagation()}
        onWheel={event => event.stopPropagation()}
      >
        <Command
          className="[&_[data-slot=command-input-wrapper]]:h-8 [&_[data-slot=command-input]]:h-8 [&_[data-slot=command-item]]:py-1"
          filter={(value, search) => (value.includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder={t("employeeSales.searchEmployee")} />
          <CommandList className="max-h-48 overscroll-contain">
            <CommandEmpty>{t("employeeSales.noEmployeesFound")}</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__all__" onSelect={() => { onValueChange(""); setOpen(false); }}>
                <UserIcon />
                <span className="min-w-0 flex-1 truncate">{t("employeeSales.allEmployees")}</span>
                <Check className={selectedValue === "" ? "ml-auto opacity-100" : "ml-auto opacity-0"} />
              </CommandItem>
              {options.map(option => (
                <CommandItem
                  key={option.value}
                  value={`${option.value} ${option.searchText}`}
                  onSelect={() => { onValueChange(option.value); setOpen(false); }}
                >
                  <UserIcon />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <Check className={option.value === selectedValue ? "ml-auto opacity-100" : "ml-auto opacity-0"} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
