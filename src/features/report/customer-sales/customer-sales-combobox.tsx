"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import type { Customer } from "@/services/customer";
import { useCustomerSearch } from "./use-customer-search";

// ต่างจาก EmployeeCombobox (พนักงานผูกสาขา โหลดครั้งเดียวได้ทั้งหมดมากรองฝั่ง client): ลูกค้าผูกกับ
// ทั้งร้าน อาจมีจำนวนมาก จึงค้นด้วยข้อความไปที่ backend แบบ debounce แทน — เก็บชื่อที่เลือกไว้ใน
// draft ของหน้ารายงานเอง (ไม่ใช่ resolve จาก options) เพราะผลค้นหาที่โชว์อยู่อาจไม่มีลูกค้าที่เคยเลือกแล้ว
export function CustomerSalesCombobox({
  disabled = false,
  id,
  label,
  language,
  value,
  onSelect,
}: {
  disabled?: boolean;
  id: string;
  label: string;
  language: string;
  value: string;
  onSelect: (customer: Customer | null) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { options, loading } = useCustomerSearch(search, language, open);
  const dropdownLoading = open && loading;

  return (
    <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setSearch(""); }}>
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
          <span className="min-w-0 truncate" translate="no">{value ? label : t("report.customerSales.allCustomers")}</span>
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
          shouldFilter={false}
          className="[&_[data-slot=command-input-wrapper]]:h-8 [&_[data-slot=command-input]]:h-8 [&_[data-slot=command-item]]:py-1"
        >
          <CommandInput placeholder={t("report.customerSales.searchCustomer")} value={search} onValueChange={setSearch} />
          <CommandList className="max-h-48 overscroll-contain">
            <CommandEmpty>{loading ? t("common.loading") : t("report.customerSales.noCustomersFound")}</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__all__" onSelect={() => { onSelect(null); setOpen(false); }}>
                <UserRound />
                <span className="min-w-0 flex-1 truncate">{t("report.customerSales.allCustomers")}</span>
                <Check className={value === "" ? "ml-auto opacity-100" : "ml-auto opacity-0"} />
              </CommandItem>
              {options.map(customer => (
                <CommandItem
                  key={customer.customer_uuid}
                  value={customer.customer_uuid}
                  onSelect={() => { onSelect(customer); setOpen(false); }}
                >
                  <UserRound />
                  <span className="min-w-0 flex-1 truncate" translate="no">
                    {customer.customer_name || customer.member_code || customer.customer_uuid}
                    {customer.customer_phone ? ` · ${customer.customer_phone}` : ""}
                  </span>
                  <Check className={customer.customer_uuid === value ? "ml-auto opacity-100" : "ml-auto opacity-0"} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
