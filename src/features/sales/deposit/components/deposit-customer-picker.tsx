"use client";

import { useEffect, useId, useState } from "react";
import { Check, ChevronsUpDown, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { CustomerFormDialog } from "@/features/settings/customer/customer-form-dialog";
import { customerFormInput } from "@/features/settings/customer/customer-utils";
import type { Customer } from "@/services/customer";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useToastStore } from "@/stores/toast-store";

interface DepositCustomerPickerProps {
  allowCreate?: boolean;
  disabled?: boolean;
  onChange: (customer: Customer) => void;
  value: Customer | null;
}

export function DepositCustomerPicker({ allowCreate, disabled, onChange, value }: DepositCustomerPickerProps) {
  const { t } = useTranslation();
  const id = useId();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const rows = useCustomerStore((state) => state.rows);
  const loading = useCustomerStore((state) => state.loading);
  const load = useCustomerStore((state) => state.load);
  const save = useCustomerStore((state) => state.save);
  const showToast = useToastStore((state) => state.show);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open || !storeUuid) return;
    let current = true;
    const timer = window.setTimeout(() => {
      setLoadError("");
      void load({ store_uuid_fk: storeUuid, search: search.trim(), limit: 30, lang: language })
        .catch((error: unknown) => {
          if (current) setLoadError(error instanceof Error ? error.message : t("settings.loadFailed", { title: t("deposit.customer") }));
        });
    }, search.trim() ? 250 : 0);
    return () => { current = false; window.clearTimeout(timer); };
  }, [language, load, open, search, storeUuid, t]);

  async function createCustomer(form: FormData) {
    if (!storeUuid || creating) return;
    setCreating(true);
    try {
      const saved = await save(customerFormInput(form, storeUuid, null));
      if (saved.customer_uuid) onChange(saved);
      setCreateOpen(false);
    } catch (error) {
      showToast({ title: t("settings.saveFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
    } finally { setCreating(false); }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t("deposit.customer")}</Label>
      <div className="flex min-w-0 gap-2">
        <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
          <PopoverTrigger asChild>
            <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open}
              disabled={disabled || !storeUuid} className="h-11 min-w-0 flex-1 justify-between text-left font-normal">
              <span className="truncate">{value?.customer_name || t("deposit.customerSearchPlaceholder")}
                {value?.customer_phone ? <span className="ml-2 text-muted-foreground">{value.customer_phone}</span> : null}
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-60 p-0">
            <Command shouldFilter={false}>
              <CommandInput value={search} onValueChange={setSearch} placeholder={t("deposit.customerSearchPlaceholder")} />
              <CommandList>
                {loadError ? <Alert variant="destructive" className="m-2 w-auto"><AlertDescription>{loadError}</AlertDescription></Alert> : null}
                {loading ? <div className="flex items-center gap-2 p-4 text-muted-foreground"><Spinner />{t("common.loading")}</div> : null}
                {!loading && !loadError ? <CommandEmpty>{t("deposit.noCustomerResults")}</CommandEmpty> : null}
                <CommandGroup>
                  {!loading && !loadError ? rows.map((customer) => (
                    <CommandItem key={customer.customer_uuid} value={customer.customer_uuid} className="min-h-11"
                      onSelect={() => { onChange(customer); setOpen(false); }}>
                      <div className="min-w-0 flex-1"><p className="truncate font-medium">{customer.customer_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{customer.customer_phone || customer.member_code || "—"}</p></div>
                      {value?.customer_uuid === customer.customer_uuid ? <Check className="size-4" /> : null}
                    </CommandItem>
                  )) : null}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {allowCreate ? <Button type="button" variant="outline" disabled={disabled || !storeUuid} className="h-11 shrink-0"
          onClick={() => { setOpen(false); setCreateOpen(true); }} aria-label={t("deposit.addCustomer")}>
          <UserPlus className="size-4" /><span className="hidden sm:inline">{t("deposit.addCustomerShort")}</span>
        </Button> : null}
      </div>
      {allowCreate ? <CustomerFormDialog editing={null} open={createOpen} saving={creating}
        onOpenChange={(next) => !creating && setCreateOpen(next)} onSubmit={createCustomer} /> : null}
    </div>
  );
}
