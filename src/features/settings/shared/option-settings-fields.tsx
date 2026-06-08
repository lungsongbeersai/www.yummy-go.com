"use client";

import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Check, CircleSlash2, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyFlag, currencyFlagOptions, type CurrencyFlagOption } from "@/features/settings/shared/currency-flag";
import { optionValue } from "@/features/settings/shared/option-settings-utils";
import { cn } from "@/lib/utils";
import type { ApiEntity } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const HEX_PICKER_COLOR = /^#[0-9a-fA-F]{6}$/;

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
  europe: new Set(["AD", "AL", "AM", "AT", "AX", "AZ", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FO", "FR", "GB", "GE", "GG", "GI", "GR", "HR", "HU", "IE", "IM", "IS", "IT", "JE", "LI", "LT", "LU", "LV", "MC", "MD", "ME", "MK", "MT", "NL", "NO", "PL", "PT", "RO", "RS", "RU", "SE", "SI", "SJ", "SK", "SM", "UA", "VA", "EU"]),
  middleAfrica: new Set(["AE", "AF", "AO", "BF", "BH", "BI", "BJ", "BW", "CD", "CF", "CG", "CI", "CM", "CV", "DJ", "DZ", "EG", "EH", "ER", "ET", "GA", "GH", "GM", "GN", "GQ", "GW", "IL", "IO", "IQ", "IR", "JO", "KE", "KM", "KW", "LB", "LR", "LS", "LY", "MA", "MG", "ML", "MR", "MU", "MW", "MZ", "NA", "NE", "NG", "OM", "PK", "PS", "QA", "RE", "RW", "SA", "SC", "SD", "SH", "SL", "SN", "SO", "SS", "ST", "SY", "SZ", "TD", "TF", "TG", "TN", "TZ", "UG", "YE", "YT", "ZA", "ZM", "ZW"]),
  americas: new Set(["AG", "AI", "AR", "AS", "AW", "BB", "BL", "BM", "BO", "BQ", "BR", "BS", "BZ", "CA", "CL", "CO", "CR", "CU", "CW", "DM", "DO", "EC", "FK", "GD", "GF", "GL", "GP", "GS", "GT", "GU", "GY", "HN", "HT", "JM", "KN", "KY", "LC", "MF", "MQ", "MS", "MX", "NI", "PA", "PE", "PM", "PR", "PY", "SR", "SV", "SX", "TC", "TT", "UM", "US", "UY", "VC", "VE", "VG", "VI"]),
  asiaPacific: new Set(["AQ", "AU", "BD", "BT", "CC", "CK", "CN", "CX", "FJ", "FM", "GU", "HK", "HM", "ID", "IN", "JP", "KG", "KI", "KP", "KR", "KZ", "LK", "MH", "MN", "MO", "MP", "MV", "MY", "NC", "NF", "NP", "NR", "NU", "NZ", "PF", "PG", "PH", "PN", "PW", "SB", "SG", "TH", "TJ", "TK", "TM", "TO", "TV", "TW", "UZ", "VN", "VU", "WF", "WS"])
};

export interface OptionField<Row extends ApiEntity> {
  name: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "email" | "password" | "textarea" | "color-code" | "flag-code" | "select";
  fallbackKey?: keyof Row & string;
  options?: Array<{ label: string; value: string }>;
}

export interface OptionColumn<Row extends ApiEntity> {
  key: keyof Row & string;
  label: string;
  className?: string;
  render?: (row: Row) => ReactNode;
}

export function colorStyle(color: string): CSSProperties | undefined {
  const trimmed = color.trim();
  return HEX_COLOR.test(trimmed) ? { backgroundColor: trimmed } : undefined;
}

export function pickerColor(color: string) {
  const trimmed = color.trim();
  if (HEX_PICKER_COLOR.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return "#000000";
}

export function ColorSwatch({ value: color, large = false }: { value: string; large?: boolean }) {
  return (
    <span
      aria-hidden
      className={large ? "size-12 shrink-0 rounded-lg border border-border bg-muted" : "size-5 shrink-0 rounded border border-border bg-muted"}
      style={colorStyle(color)}
    />
  );
}

export function ColorCodeBadge({ code }: { code: string }) {
  return (
    <Badge className="max-w-full border-primary/20 bg-primary/10 text-primary" translate="no">
      {code || "-"}
    </Badge>
  );
}

function ColorCodeInput({
  defaultValue,
  disabled,
  id,
  name,
  required
}: {
  defaultValue: string;
  disabled?: boolean;
  id: string;
  name: string;
  required?: boolean;
}) {
  const [code, setCode] = useState(defaultValue);
  const { t } = useTranslation();

  useEffect(() => {
    setCode(defaultValue);
  }, [defaultValue]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/25 p-3">
        <ColorSwatch value={code} large />
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{t("settings.colorPreview")}</p>
          <p className="mt-0.5 truncate text-sm font-semibold" translate="no">
            {code.trim() || "-"}
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <Field>
          <FieldLabel htmlFor={`${id}-picker`}>{t("fields.color_picker")}</FieldLabel>
          <Input
            id={`${id}-picker`}
            aria-label={t("fields.color_picker")}
            className="size-11 cursor-pointer p-1"
            disabled={disabled}
            type="color"
            value={pickerColor(code)}
            onChange={(event) => setCode(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={id}>{t("fields.color_code")}</FieldLabel>
          <Input
            id={id}
            name={name}
            autoComplete="off"
            disabled={disabled}
            required={required}
            spellCheck={false}
            translate="no"
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

function flagGroup(option: CurrencyFlagOption): FlagGroup {
  if (option.custom) return "other";
  for (const group of DIRECT_FLAG_GROUPS) {
    if (FLAG_GROUP_CODES[group].has(option.code)) return group;
  }
  return "other";
}

function FlagPicker({
  defaultValue,
  disabled,
  id,
  name,
  required
}: {
  defaultValue: string;
  disabled?: boolean;
  id: string;
  name: string;
  required?: boolean;
}) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const options = useMemo(() => currencyFlagOptions(language, defaultValue), [defaultValue, language]);
  const [activeGroup, setActiveGroup] = useState<FlagGroup>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [code, setCode] = useState(defaultValue.trim().toUpperCase() || options[0]?.code || "");
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
    setCode(defaultValue.trim().toUpperCase() || options[0]?.code || "");
    setActiveGroup("all");
    setSearch("");
  }, [defaultValue, options]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <input aria-required={required} id={id} name={name} type="hidden" value={code} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <CurrencyFlag className="size-12 rounded-md" code={selected?.code ?? code} label={selected?.label ?? code} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{t("settings.selectedFlag")}</p>
            <p className="truncate text-sm font-semibold text-foreground">{selected?.label || t("settings.selectFlag")}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{selected?.code || code || "-"}</p>
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
              <Search aria-hidden className="size-4" />
            </span>
            <Input
              className="h-10 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              disabled={disabled}
              placeholder={t("settings.searchFlags")}
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search ? (
              <Button aria-label="Clear search" disabled={disabled} size="iconSm" type="button" variant="ghost" onClick={() => setSearch("")}>
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

      <div className="max-h-[20rem] overflow-y-auto rounded-lg border border-border bg-background p-2">
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
                  onClick={() => setCode(option.code)}
                >
                  <CurrencyFlag className={cn("size-9 rounded-md", isActive && "ring-1 ring-primary/25")} code={option.code} label={option.label} />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium">{option.label}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{option.code}</span>
                  </span>
                  {option.custom ? <span className="hidden text-xs text-muted-foreground lg:inline">{t("settings.customFlag")}</span> : null}
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
              <EmptyTitle>{t("settings.noFlagsFound")}</EmptyTitle>
              <EmptyDescription>{t("settings.tryDifferentFlagSearch")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}

export function OptionFormFields<Row extends ApiEntity>({
  description,
  editing,
  fields,
  saving,
  slug,
  title
}: {
  description: string;
  editing: Row | null;
  fields: OptionField<Row>[];
  saving: boolean;
  slug: string;
  title: string;
}) {
  const [selectValues, setSelectValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextValues: Record<string, string> = {};
    fields.forEach((field) => {
      if (field.type === "select") {
        nextValues[field.name] = optionValue(editing, field.name, optionValue(editing, field.fallbackKey ?? "", field.options?.[0]?.value ?? ""));
      }
    });
    setSelectValues(nextValues);
  }, [editing, fields]);

  return (
    <FieldGroup>
      <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
        <Field>
          <FieldLegend>{title}</FieldLegend>
          <FieldDescription>{description}</FieldDescription>
        </Field>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => {
            const fieldId = `${slug}-${field.name}`;
            const defaultValue = optionValue(editing, field.name, optionValue(editing, field.fallbackKey ?? ""));
            const wide = field.type === "textarea" || field.type === "flag-code" || field.type === "color-code";
            return (
              <Field key={field.name} className={wide ? "sm:col-span-2" : undefined}>
                {field.type === "color-code" ? (
                  <ColorCodeInput id={fieldId} name={field.name} defaultValue={defaultValue} disabled={saving} required={field.required} />
                ) : field.type === "flag-code" ? (
                  <>
                    <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
                    <FlagPicker id={fieldId} name={field.name} defaultValue={defaultValue} disabled={saving} required={field.required} />
                  </>
                ) : field.type === "textarea" ? (
                  <>
                    <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
                    <Textarea id={fieldId} name={field.name} defaultValue={defaultValue} disabled={saving} required={field.required} />
                  </>
                ) : field.type === "select" ? (
                  <>
                    <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
                    <input name={field.name} type="hidden" value={selectValues[field.name] ?? ""} />
                    <Select
                      required={field.required}
                      value={selectValues[field.name] ?? ""}
                      onValueChange={(nextValue) => setSelectValues((current) => ({ ...current, [field.name]: nextValue }))}
                    >
                      <SelectTrigger id={fieldId} className="w-full">
                        <SelectValue placeholder={field.label} />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectGroup>
                          {field.options?.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <>
                    <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
                    <Input
                      id={fieldId}
                      name={field.name}
                      autoComplete="off"
                      defaultValue={defaultValue}
                      disabled={saving}
                      placeholder={field.type === "email" ? "abc@gmail.com" : undefined}
                      required={field.required}
                      type={field.type ?? "text"}
                    />
                  </>
                )}
              </Field>
            );
          })}
        </FieldGroup>
      </FieldSet>
    </FieldGroup>
  );
}
