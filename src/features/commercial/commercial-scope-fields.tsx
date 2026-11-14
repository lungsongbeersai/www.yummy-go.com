"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Field, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import { useCommercialStore } from "@/stores/commercial-store";

interface ScopeOption {
  value: string;
  label: string;
  keywords: string[];
}

interface ScopeSearchProps {
  id: string;
  label: string;
  searchLabel: string;
  placeholder: string;
  emptyLabel: string;
  value: string;
  options: ScopeOption[];
  disabled: boolean;
  onSelect: (value: string) => void;
}

function ScopeSearch({ id, label, searchLabel, placeholder, emptyLabel, value, options, disabled, onSelect }: ScopeSearchProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return <Field className="min-w-0">
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open && !disabled} aria-label={searchLabel} disabled={disabled} className="h-12 w-full min-w-0 justify-between gap-3 px-3 text-sm">
          <span className="min-w-0 truncate text-left" title={selected?.label}>{selected?.label || placeholder}</span>
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) max-w-(--radix-popover-content-available-width) overflow-hidden p-0 font-lao">
        <Command className="min-h-0 [&_[data-slot=command-input-wrapper]]:shrink-0 [&_[data-slot=command-input-wrapper]_[data-slot=input-group]]:h-11!">
          <CommandInput aria-label={searchLabel} placeholder={searchLabel} className="text-sm" />
          <CommandList className="min-h-0 max-h-64 overscroll-contain">
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => <CommandItem key={option.value} value={option.value} keywords={[option.label, ...option.keywords]} data-checked={option.value === value} className="min-h-11 text-sm" onSelect={() => { setOpen(false); onSelect(option.value); }}>
                <span className="min-w-0 flex-1 truncate" title={option.label}>{option.label}</span>
              </CommandItem>)}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </Field>;
}

/** Document destination search stays independent of shared catalogue ownership. */
export function CommercialScopeFields() {
  const l = useCommercialLabels();
  const stores = useCommercialStore((state) => state.stores);
  const branches = useCommercialStore((state) => state.branches);
  const storeUuid = useCommercialStore((state) => state.storeUuid);
  const branchUuid = useCommercialStore((state) => state.branchUuid);
  const canSelectStore = useCommercialStore((state) => state.canSelectStore);
  const loading = useCommercialStore((state) => state.optionsLoading);
  const selectStore = useCommercialStore((state) => state.selectStore);
  const selectBranch = useCommercialStore((state) => state.selectBranch);
  const storeOptions = stores.map((store) => ({ value: store.store_uuid, label: store.store_name_la || store.store_name_eng || store.store_uuid,
    keywords: [store.store_name_la || "", store.store_name_eng || ""] }));
  const branchOptions = branches.filter((branch) => branch.store_uuid_fk === storeUuid).map((branch) => ({ value: branch.branch_uuid,
    label: branch.branch_name || branch.branch_name_la || branch.branch_name_eng || branch.branch_uuid,
    keywords: [branch.branch_name_la || "", branch.branch_name_eng || "", branch.branch_tel || "", branch.branch_address || ""] }));

  return <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
    <ScopeSearch id="commercial-store" label={l("documentStore")} searchLabel={l("searchStore")} placeholder={l("selectStore")} emptyLabel={l("noResults")} value={storeUuid} options={storeOptions} disabled={loading || !canSelectStore || !storeOptions.length} onSelect={(next) => { void selectStore(next).catch(() => {}); }} />
    <ScopeSearch id="commercial-branch" label={l("documentBranch")} searchLabel={l("searchBranch")} placeholder={l("selectBranch")} emptyLabel={l("noResults")} value={branchUuid} options={branchOptions} disabled={loading || !branchOptions.length} onSelect={selectBranch} />
  </div>;
}
