"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Check, CircleSlash2, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { CurrencyFlag, currencyFlagOptions, type CurrencyFlagOption } from "@/features/settings/shared/currency-flag";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

type FlagGroup = "all" | "asean" | "majorCurrency" | "europe" | "middleAfrica" | "americas" | "asiaPacific" | "other";
type DirectFlagGroup = Exclude<FlagGroup, "all" | "other">;

const FLAG_GROUPS: Array<{ value: FlagGroup; labelKey: string }> = [
  { value: "all", labelKey: "settings.flagGroups.all" },
  { value: "asean", labelKey: "settings.flagGroups.asean" },
  { value: "majorCurrency", labelKey: "settings.flagGroups.majorCurrency" },
  { value: "europe", labelKey: "settings.flagGroups.europe" },
  { value: "middleAfrica", labelKey: "settings.flagGroups.middleAfrica" },
  { value: "americas", labelKey: "settings.flagGroups.americas" },
  { value: "asiaPacific", labelKey: "settings.flagGroups.asiaPacific" },
  { value: "other", labelKey: "settings.flagGroups.other" }
];

const DIRECT_FLAG_GROUPS: DirectFlagGroup[] = ["asean", "majorCurrency", "europe", "middleAfrica", "americas", "asiaPacific"];

const FLAG_GROUP_CODES: Record<DirectFlagGroup, Set<string>> = {
  asean: new Set(["LA", "TH", "VN", "MM", "KH", "SG", "MY", "ID", "PH", "BN", "TL"]),
  majorCurrency: new Set(["US", "EU", "GB", "JP", "CN", "KR", "IN", "RU", "TR", "AU", "CA", "CH", "HK", "TW", "SA", "AE", "BR", "MX", "ZA", "NG"]),
  europe: new Set([
    "AD", "AL", "AM", "AT", "AX", "AZ", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FO", "FR", "GB", "GE", "GG", "GI", "GR", "HR", "HU", "IE", "IM", "IS", "IT", "JE", "LI", "LT", "LU", "LV", "MC", "MD", "ME", "MK", "MT", "NL", "NO", "PL", "PT", "RO", "RS", "RU", "SE", "SI", "SJ", "SK", "SM", "UA", "VA", "EU"
  ]),
  middleAfrica: new Set([
    "AE", "AF", "AO", "BF", "BH", "BI", "BJ", "BW", "CD", "CF", "CG", "CI", "CM", "CV", "DJ", "DZ", "EG", "EH", "ER", "ET", "GA", "GH", "GM", "GN", "GQ", "GW", "IL", "IO", "IQ", "IR", "JO", "KE", "KM", "KW", "LB", "LR", "LS", "LY", "MA", "MG", "ML", "MR", "MU", "MW", "MZ", "NA", "NE", "NG", "OM", "PK", "PS", "QA", "RW", "SA", "SC", "SD", "SL", "SN", "SO", "SS", "ST", "SY", "SZ", "TD", "TG", "TN", "TZ", "UG", "YE", "ZA", "ZM", "ZW"
  ]),
  americas: new Set([
    "AG", "AI", "AR", "AW", "BB", "BM", "BO", "BR", "BS", "BZ", "CA", "CL", "CO", "CR", "CU", "DM", "DO", "EC", "GD", "GL", "GT", "GY", "HN", "HT", "JM", "KN", "KY", "LC", "MX", "NI", "PA", "PE", "PR", "PY", "SR", "SV", "TT", "US", "UY", "VE"
  ]),
  asiaPacific: new Set([
    "AU", "BD", "BT", "CN", "FJ", "HK", "ID", "IN", "JP", "KG", "KH", "KR", "KZ", "LA", "LK", "MN", "MO", "MV", "MY", "NP", "NZ", "PH", "PK", "SG", "TH", "TJ", "TM", "TW", "UZ", "VN", "WS"
  ])
};

function flagGroup(option: CurrencyFlagOption): FlagGroup {
  if (option.custom) return "other";
  for (const group of DIRECT_FLAG_GROUPS) {
    if (FLAG_GROUP_CODES[group].has(option.code)) return group;
  }
  return "other";
}

export function CurrencyFlagPicker({
  code,
  disabled,
  id,
  name,
  onChange,
  required
}: {
  code: string;
  disabled?: boolean;
  id: string;
  name: string;
  onChange: (code: string) => void;
  required?: boolean;
}) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const options = useMemo(() => currencyFlagOptions(language, code), [code, language]);
  const [activeGroup, setActiveGroup] = useState<FlagGroup>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const selected = options.find((option) => option.code === code) ?? options[0];
  const groupOptions = useMemo(
    () => (activeGroup === "all" ? options : options.filter((option) => flagGroup(option) === activeGroup)),
    [activeGroup, options]
  );
  const filteredOptions = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return groupOptions;
    return groupOptions.filter((option) => option.searchText.includes(query));
  }, [deferredSearch, groupOptions]);

  useEffect(() => {
    setActiveGroup("all");
    setSearch("");
  }, [code]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <input aria-required={required} id={id} name={name} type="hidden" value={code} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <CurrencyFlag className="size-12 rounded-md" code={selected?.code ?? code} label={selected?.label ?? code} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{t("settings.selectedFlag")}</p>
            <p className="truncate text-sm font-semibold text-foreground">{selected?.label || t("settings.selectFlag")}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground" translate="no">
              {selected?.code || code || "-"}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-card p-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">
              {t(FLAG_GROUPS.find((group) => group.value === activeGroup)?.labelKey ?? "settings.flagGroups.all")}
            </span>
            <Badge className="h-6 min-w-14 justify-center rounded-md bg-primary/10 px-2.5 text-primary">
              {filteredOptions.length} / {groupOptions.length}
            </Badge>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-md border border-input bg-background px-2.5 transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Search aria-hidden />
            </span>
            <Input
              id={`${id}-search`}
              name={`${name}_search`}
              autoComplete="off"
              className="h-10 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              disabled={disabled}
              placeholder={t("settings.searchFlags")}
              spellCheck={false}
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search ? (
              <Button aria-label={t("actions.clear")} disabled={disabled} size="iconSm" type="button" variant="ghost" onClick={() => setSearch("")}>
                <X aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FLAG_GROUPS.map((group) => {
          const isActive = activeGroup === group.value;
          return (
            <Button
              key={group.value}
              aria-pressed={isActive}
              className="shrink-0"
              disabled={disabled}
              size="sm"
              type="button"
              variant={isActive ? "default" : "outline"}
              onClick={() => setActiveGroup(group.value)}
            >
              {t(group.labelKey)}
            </Button>
          );
        })}
      </div>

      <div className="max-h-[20rem] overflow-y-auto rounded-lg border border-border bg-background p-2" role="listbox">
        {filteredOptions.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOptions.map((option) => {
              const isActive = option.code === code;
              return (
                <Button
                  key={option.code}
                  aria-selected={isActive}
                  className={cn(
                    "h-auto min-h-14 justify-start gap-3 px-3 py-2 text-left shadow-sm",
                    isActive && "border-primary bg-primary/10 text-foreground ring-2 ring-primary/15"
                  )}
                  disabled={disabled}
                  role="option"
                  title={`${option.code} ${option.label}`}
                  type="button"
                  variant="outline"
                  onClick={() => onChange(option.code)}
                >
                  <CurrencyFlag className={cn("size-9 rounded-md", isActive && "ring-1 ring-primary/25")} code={option.code} label={option.label} />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium">{option.label}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground" translate="no">
                      {option.code}
                    </span>
                  </span>
                  {option.custom ? <span className="hidden text-xs text-muted-foreground lg:inline">{t("settings.customFlag")}</span> : null}
                  {isActive ? <Check aria-hidden data-icon="inline-end" /> : null}
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
              <EmptyTitle>{t("settings.noFlagsFound")}</EmptyTitle>
              <EmptyDescription>{t("settings.tryDifferentFlagSearch")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}
