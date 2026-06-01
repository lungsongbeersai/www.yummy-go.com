"use client";

import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, CircleSlash2, Search, X, type LucideIcon } from "lucide-react";
import type { StoreApi, UseBoundStore } from "zustand";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyFlag, currencyFlagOptions, type CurrencyFlagOption } from "@/features/settings/currency-flag";
import {
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader,
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsRowActions,
  SettingsTableScroll,
  SettingsToolbar
} from "@/features/settings/settings-shell";
import { DEFAULT_PAGE_LIMIT } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { ApiEntity, FetchParams, PageLimit, SortOrder } from "@/services/shared/types";
import type { CrudListState } from "@/stores/crud-list-store";
import { authStoreUuid, useAuthStore, type AuthUser } from "@/stores/auth-store";
import { useAppStore } from "@/stores/app-store";
import { useToastStore } from "@/stores/toast-store";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;
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
  europe: new Set([
    "AD", "AL", "AM", "AT", "AX", "AZ", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FO", "FR", "GB", "GE", "GG", "GI", "GR", "HR", "HU", "IE", "IM", "IS", "IT", "JE", "LI", "LT", "LU", "LV", "MC", "MD", "ME", "MK", "MT", "NL", "NO", "PL", "PT", "RO", "RS", "RU", "SE", "SI", "SJ", "SK", "SM", "UA", "VA", "EU"
  ]),
  middleAfrica: new Set([
    "AE", "AF", "AO", "BF", "BH", "BI", "BJ", "BW", "CD", "CF", "CG", "CI", "CM", "CV", "DJ", "DZ", "EG", "EH", "ER", "ET", "GA", "GH", "GM", "GN", "GQ", "GW", "IL", "IO", "IQ", "IR", "JO", "KE", "KM", "KW", "LB", "LR", "LS", "LY", "MA", "MG", "ML", "MR", "MU", "MW", "MZ", "NA", "NE", "NG", "OM", "PK", "PS", "QA", "RE", "RW", "SA", "SC", "SD", "SH", "SL", "SN", "SO", "SS", "ST", "SY", "SZ", "TD", "TF", "TG", "TN", "TZ", "UG", "YE", "YT", "ZA", "ZM", "ZW"
  ]),
  americas: new Set([
    "AG", "AI", "AR", "AS", "AW", "BB", "BL", "BM", "BO", "BQ", "BR", "BS", "BZ", "CA", "CL", "CO", "CR", "CU", "CW", "DM", "DO", "EC", "FK", "GD", "GF", "GL", "GP", "GS", "GT", "GU", "GY", "HN", "HT", "JM", "KN", "KY", "LC", "MF", "MQ", "MS", "MX", "NI", "PA", "PE", "PM", "PR", "PY", "SR", "SV", "SX", "TC", "TT", "UM", "US", "UY", "VC", "VE", "VG", "VI"
  ]),
  asiaPacific: new Set([
    "AQ", "AU", "BD", "BT", "CC", "CK", "CN", "CX", "FJ", "FM", "GU", "HK", "HM", "ID", "IN", "JP", "KG", "KI", "KP", "KR", "KZ", "LK", "MH", "MN", "MO", "MP", "MV", "MY", "NC", "NF", "NP", "NR", "NU", "NZ", "PF", "PG", "PH", "PN", "PW", "SB", "SG", "TH", "TJ", "TK", "TM", "TO", "TV", "TW", "UZ", "VN", "VU", "WF", "WS"
  ])
};

type OptionStore<Row extends ApiEntity, SaveInput extends ApiEntity, Params extends FetchParams> =
  UseBoundStore<StoreApi<CrudListState<Row, SaveInput, Params>>>;

interface OptionField<Row extends ApiEntity> {
  name: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "email" | "password" | "textarea" | "color-code" | "flag-code" | "select";
  fallbackKey?: keyof Row & string;
  options?: Array<{ label: string; value: string }>;
}

interface OptionColumn<Row extends ApiEntity> {
  key: keyof Row & string;
  label: string;
  className?: string;
  render?: (row: Row) => ReactNode;
}

interface OptionSettingsPageProps<
  Row extends ApiEntity,
  SaveInput extends ApiEntity,
  Params extends FetchParams
> {
  slug: string;
  itemLabel: string;
  title: string;
  description: string;
  idKey: keyof Row & string;
  nameKey: keyof Row & string;
  nameFallbackKey?: keyof Row & string;
  nameLaKey?: keyof Row & string;
  nameEngKey?: keyof Row & string;
  colorKey?: keyof Row & string;
  cardTitle?: string;
  dialogContentClassName?: string;
  icon: LucideIcon;
  renderLeading?: (row: Row) => ReactNode;
  requiredScopeKey?: string;
  requiredScopeMessage?: string;
  tableClassName?: string;
  fields: OptionField<Row>[];
  columns: OptionColumn<Row>[];
  scope?: (storeUuid: string, user: AuthUser | null) => Record<string, unknown>;
  store: OptionStore<Row, SaveInput, Params>;
}

function value(row: ApiEntity | null, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

function colorStyle(color: string): CSSProperties | undefined {
  const trimmed = color.trim();
  return HEX_COLOR.test(trimmed) ? { backgroundColor: trimmed } : undefined;
}

function pickerColor(color: string) {
  const trimmed = color.trim();
  if (HEX_PICKER_COLOR.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return "#000000";
}

function ColorSwatch({ value: color, large = false }: { value: string; large?: boolean }) {
  return (
    <span
      className={large ? "size-9 shrink-0 rounded-md border border-border bg-muted" : "size-5 shrink-0 rounded border border-border bg-muted"}
      style={colorStyle(color)}
      aria-hidden
    />
  );
}

function ColorCodeInput({
  defaultValue,
  id,
  name,
  required
}: {
  defaultValue: string;
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
    <div className="flex items-center gap-2">
      <Input
        aria-label={t("fields.color_picker")}
        className="size-10 shrink-0 cursor-pointer p-1"
        type="color"
        value={pickerColor(code)}
        onChange={(event) => setCode(event.target.value)}
      />
      <Input
        id={id}
        name={name}
        value={code}
        placeholder="#000000"
        required={required}
        onChange={(event) => setCode(event.target.value)}
      />
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
  id,
  name,
  required
}: {
  defaultValue: string;
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
              placeholder={t("settings.searchFlags")}
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search ? (
              <Button aria-label="Clear search" size="iconSm" type="button" variant="ghost" onClick={() => setSearch("")}>
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

export function OptionSettingsPage<
  Row extends ApiEntity,
  SaveInput extends ApiEntity,
  Params extends FetchParams
>({
  colorKey,
  cardTitle,
  columns,
  description,
  dialogContentClassName,
  fields,
  icon: Icon,
  idKey,
  itemLabel,
  nameFallbackKey,
  nameEngKey,
  nameKey,
  nameLaKey,
  renderLeading,
  requiredScopeKey,
  requiredScopeMessage,
  scope: getScope,
  slug,
  store,
  tableClassName = "min-w-[820px]",
  title
}: OptionSettingsPageProps<Row, SaveInput, Params>) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const showToast = useToastStore((state) => state.show);
  const rows = store((state) => state.rows);
  const total = store((state) => state.total);
  const storeTotalPages = store((state) => state.totalPages);
  const search = store((state) => state.search);
  const loading = store((state) => state.loading);
  const saving = store((state) => state.saving);
  const setSearch = store((state) => state.setSearch);
  const loadRows = store((state) => state.load);
  const saveRow = store((state) => state.save);
  const removeRow = store((state) => state.remove);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [limit, setLimit] = useState<PageLimit>(DEFAULT_LIMIT);
  const [orderBy, setOrderBy] = useState<SortOrder>("ASC");
  const [editing, setEditing] = useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());

  const scope = useMemo(() => getScope?.(storeUuid, user) ?? {}, [getScope, storeUuid, user]);
  const scopeKey = JSON.stringify(scope);
  const missingRequiredScope = Boolean(requiredScopeKey && !String(scope[requiredScopeKey] ?? "").trim());
  const requestParams = useMemo<Params>(
    () => ({ search, page, limit, orderBy, lang: language, ...scope }) as Params,
    [language, limit, orderBy, page, scope, search]
  );
  const pageSize = limit === "All" ? rows.length || Number(DEFAULT_LIMIT) : Number(limit ?? DEFAULT_LIMIT);
  const totalPages = Math.max(1, Number(storeTotalPages || Math.ceil(total / pageSize) || 1));
  const pageStart = rows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;
  const canGoBack = page > 1 && !loading;
  const canGoNext = page < totalPages && !loading;
  const ids = useMemo(() => rows.map((row) => value(row, idKey)).filter(Boolean), [idKey, rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedRows.has(id));

  function requiredScopeDescription() {
    return requiredScopeMessage ?? t("settings.branchRequired");
  }

  async function load() {
    if (missingRequiredScope) {
      showToast({ title: t("settings.loadFailed", { title }), description: requiredScopeDescription(), tone: "error" });
      return;
    }

    try {
      await loadRows(requestParams);
    } catch (error) {
      showToast({
        title: t("settings.loadFailed", { title }),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, page, limit, orderBy, scopeKey]);

  useEffect(() => {
    setSelectedRows((current) => {
      if (!current.size) return current;
      const allowed = new Set(ids);
      let changed = false;
      const next = new Set<string>();
      current.forEach((id) => {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : current;
    });
  }, [ids]);

  function optionName(row: Row) {
    return value(row, nameKey, value(row, nameFallbackKey ?? "", value(row, nameLaKey ?? "", value(row, nameEngKey ?? "", "-"))));
  }

  function optionSubtitle(row: Row) {
    if (colorKey) {
      const color = value(row, colorKey);
      return color && color !== optionName(row) ? color : "";
    }
    if (!nameLaKey && !nameEngKey) return "";
    return `${value(row, nameLaKey ?? "", "-")} / ${value(row, nameEngKey ?? "", "-")}`;
  }

  function applyFilters() {
    if (page === 1) void load();
    else setPage(1);
  }

  function toggleSelected(id: string, checked: boolean) {
    if (!id) return;
    setSelectedRows((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedRows(checked ? new Set(ids) : new Set());
  }

  function openCreate() {
    if (missingRequiredScope) {
      showToast({ title: t("settings.saveFailed"), description: requiredScopeDescription(), tone: "error" });
      return;
    }

    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: Row) {
    setEditing(row);
    setDialogOpen(true);
  }

  async function save(formData: FormData) {
    if (missingRequiredScope) {
      showToast({ title: t("settings.saveFailed"), description: requiredScopeDescription(), tone: "error" });
      return;
    }

    const input: Record<string, unknown> = { ...scope };
    fields.forEach((field) => {
      input[field.name] = formData.get(field.name) ?? "";
    });
    const id = value(editing, idKey);
    if (id) input[idKey] = id;

    try {
      await saveRow(input as SaveInput);
      showToast({ title: t("settings.saved"), tone: "success" });
      setDialogOpen(false);
      setEditing(null);
      await loadRows(requestParams);
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function remove(row: Row) {
    const id = value(row, idKey);
    if (!id) return;
    try {
      await removeRow(id);
      showToast({ title: t("settings.deleted"), tone: "success" });
      setDeleteTarget(null);
      setSelectedRows((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      await loadRows(requestParams);
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  const table = rows.length ? (
    <SettingsTableScroll>
      <Table className={tableClassName}>
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">#</TableHead>
            <TableHead>{itemLabel}</TableHead>
            {columns.map((column) => (
              <TableHead key={column.key}>{column.label}</TableHead>
            ))}
            <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const id = value(row, idKey);
            const selected = selectedRows.has(id);
            const subtitle = optionSubtitle(row);
            return (
              <TableRow key={id || index} data-state={selected ? "selected" : undefined}>
                <TableCell className="w-10 px-2">
                  <Checkbox aria-label={t("common.selectRow", { name: optionName(row) })} checked={selected} onChange={(event) => toggleSelected(id, event.target.checked)} />
                </TableCell>
                <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black text-muted-foreground">{pageStart + index}</TableCell>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    {colorKey ? (
                      <ColorSwatch value={value(row, colorKey)} large />
                    ) : renderLeading ? (
                      renderLeading(row)
                    ) : (
                      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-black">{optionName(row)}</p>
                      {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
                    </div>
                  </div>
                </TableCell>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.render ? column.render(row) : value(row, column.key, "-")}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  <SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </SettingsTableScroll>
  ) : null;
  const mobileList = rows.length ? (
    <SettingsMobileList>
      {rows.map((row, index) => {
        const id = value(row, idKey);
        const selected = selectedRows.has(id);
        const subtitle = optionSubtitle(row);
        return (
          <SettingsMobileCard
            key={id || index}
            actions={<SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />}
            checked={selected}
            leading={
              colorKey ? (
                <ColorSwatch value={value(row, colorKey)} large />
              ) : renderLeading ? (
                renderLeading(row)
              ) : (
                <span className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icon />
                </span>
              )
            }
            selectLabel={t("common.selectRow", { name: optionName(row) })}
            selected={selected}
            subtitle={subtitle ? <span className="block truncate">{subtitle}</span> : undefined}
            title={optionName(row)}
            onCheckedChange={(checked) => toggleSelected(id, checked)}
          >
            <SettingsMobileMetaGrid>
              {columns.map((column) => (
                <SettingsMobileMeta key={column.key} label={column.label} value={column.render ? column.render(row) : value(row, column.key, "-")} />
              ))}
            </SettingsMobileMetaGrid>
          </SettingsMobileCard>
        );
      })}
    </SettingsMobileList>
  ) : null;

  return (
    <>
      <SettingsModuleShell
        addLabel={`${t("actions.add")} ${itemLabel}`}
        cardTitle={cardTitle ?? title}
        description={description}
        emptyDescription={t("empty.adjustSearch")}
        emptyTitle={t("settings.noRecords", { title: title.toLowerCase() })}
        footer={
          rows.length ? (
            <SettingsPaginationFooter
              canGoBack={canGoBack}
              canGoNext={canGoNext}
              page={page}
              pageEnd={pageEnd}
              pageStart={pageStart}
              total={total}
              totalPages={totalPages}
              onBack={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            />
          ) : undefined
        }
        loading={loading}
        loadingLabel={t("settings.loading", { title })}
        mobileList={mobileList}
        summary={`${t("common.showingRange", { start: pageStart, end: pageEnd, total })} - ${t("common.page", { current: page, total: totalPages })}`}
        table={table}
        title={title}
        toolbar={
          <SettingsToolbar
            state={{
              search,
              limit,
              orderBy,
              selectedCount: selectedRows.size,
              onApply: applyFilters,
              onLimit: (nextLimit) => {
                setLimit(nextLimit);
                setPage(1);
              },
              onOrder: (nextOrder) => {
                setOrderBy(nextOrder);
                setPage(1);
              },
              onSearch: setSearch
            }}
          />
        }
        onAdd={openCreate}
      />
      <OptionFormDialog
        dialogContentClassName={dialogContentClassName}
        description={description}
        editing={editing}
        fields={fields}
        idKey={idKey}
        open={dialogOpen}
        saving={saving}
        slug={slug}
        title={title}
        onOpenChange={(nextOpen) => {
          if (saving) return;
          setDialogOpen(nextOpen);
          if (!nextOpen) setEditing(null);
        }}
        onSubmit={save}
      />
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        description={t("settings.deleteConfirm")}
        open={Boolean(deleteTarget)}
        title={t("actions.delete")}
        onConfirm={() => {
          if (deleteTarget) void remove(deleteTarget);
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
      />
    </>
  );
}

function OptionFormDialog<Row extends ApiEntity>({
  dialogContentClassName,
  description,
  editing,
  fields,
  idKey,
  onOpenChange,
  onSubmit,
  open,
  saving,
  slug,
  title
}: {
  dialogContentClassName?: string;
  description: string;
  editing: Row | null;
  fields: OptionField<Row>[];
  idKey: keyof Row & string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
  slug: string;
  title: string;
}) {
  const { t } = useTranslation();
  const [selectValues, setSelectValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextValues: Record<string, string> = {};
    fields.forEach((field) => {
      if (field.type === "select") {
        nextValues[field.name] = value(editing, field.name, value(editing, field.fallbackKey ?? "", field.options?.[0]?.value ?? ""));
      }
    });
    setSelectValues(nextValues);
  }, [editing, fields, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className={dialogContentClassName}>
        <SettingsDialogForm action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{title}</FieldLabel>
              <FieldDescription>{description}</FieldDescription>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((field) => {
                const fieldId = `${slug}-${field.name}`;
                const defaultValue = value(editing, field.name, value(editing, field.fallbackKey ?? ""));
                return (
                  <Field key={field.name} className={field.type === "textarea" || field.type === "flag-code" ? "sm:col-span-2" : undefined}>
                    <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
                    {field.type === "color-code" ? (
                      <ColorCodeInput id={fieldId} name={field.name} defaultValue={defaultValue} required={field.required} />
                    ) : field.type === "flag-code" ? (
                      <FlagPicker id={fieldId} name={field.name} defaultValue={defaultValue} required={field.required} />
                    ) : field.type === "textarea" ? (
                      <Textarea id={fieldId} name={field.name} defaultValue={defaultValue} required={field.required} />
                    ) : field.type === "select" ? (
                      <>
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
                      <Input
                        id={fieldId}
                        name={field.name}
                        type={field.type ?? "text"}
                        defaultValue={defaultValue}
                        placeholder={field.type === "email" ? "abc@gmail.com" : undefined}
                        required={field.required}
                      />
                    )}
                  </Field>
                );
              })}
            </div>
          </FieldGroup>
          </SettingsDialogBody>
          <input name={idKey} type="hidden" value={value(editing, idKey)} readOnly />
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}

export { ColorSwatch, value as optionValue };
