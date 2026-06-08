"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import type { StoreApi, UseBoundStore } from "zustand";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ColorCodeBadge,
  ColorSwatch,
  OptionFormFields,
  type OptionColumn,
  type OptionField
} from "@/features/settings/shared/option-settings-fields";
import {
  optionPageRange,
  optionPageSize,
  optionTotalPages,
  optionValue
} from "@/features/settings/shared/option-settings-utils";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader,
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsRowActions,
  SettingsTableScroll,
  SettingsToolbar
} from "@/features/settings/shared/settings-shell";
import { useOptionRowSelection } from "@/features/settings/shared/use-option-row-selection";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { ApiEntity, FetchParams, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore, type AuthUser } from "@/stores/auth-store";
import type { CrudListState } from "@/stores/crud-list-store";
import { useToastStore } from "@/stores/toast-store";

type OptionStore<Row extends ApiEntity, SaveInput extends ApiEntity, Params extends FetchParams> =
  UseBoundStore<StoreApi<CrudListState<Row, SaveInput, Params>>>;

export interface OptionSaveArgs<Row extends ApiEntity> {
  editing: Row | null;
  formData: FormData;
  scope: Record<string, unknown>;
  storeUuid: string;
  user: AuthUser | null;
}

export interface OptionSettingsPageProps<
  Row extends ApiEntity,
  SaveInput extends ApiEntity,
  Params extends FetchParams
> {
  slug: string;
  itemLabel: string;
  title: string;
  description: string;
  listTitle: string;
  idKey: keyof Row & string;
  nameKey: keyof Row & string;
  nameFallbackKey?: keyof Row & string;
  nameLaKey?: keyof Row & string;
  nameEngKey?: keyof Row & string;
  colorKey?: keyof Row & string;
  dialogContentClassName?: string;
  fields: OptionField<Row>[];
  columns: OptionColumn<Row>[];
  icon: LucideIcon;
  initialPagination: UrlPaginationState;
  store: OptionStore<Row, SaveInput, Params>;
  buildInput?: (args: OptionSaveArgs<Row>) => SaveInput;
  formDescription?: string;
  formTitle?: string;
  getName?: (row: Row) => string;
  getSubtitle?: (row: Row) => ReactNode;
  refreshLabel?: string;
  renderBadges?: (row: Row) => ReactNode;
  renderLeading?: (row: Row) => ReactNode;
  requiredScopeKey?: string;
  requiredScopeMessage?: string;
  scope?: (storeUuid: string, user: AuthUser | null) => Record<string, unknown>;
  tableClassName?: string;
  validateInput?: (args: OptionSaveArgs<Row>) => string | null;
}

function defaultInput<Row extends ApiEntity, SaveInput extends ApiEntity>({
  editing,
  fields,
  formData,
  idKey,
  scope
}: OptionSaveArgs<Row> & {
  fields: OptionField<Row>[];
  idKey: keyof Row & string;
}): SaveInput {
  const input: Record<string, unknown> = { ...scope };
  fields.forEach((field) => {
    input[field.name] = formData.get(field.name) ?? "";
  });
  const id = optionValue(editing, idKey);
  if (id) input[idKey] = id;
  return input as SaveInput;
}

export function OptionSettingsPage<
  Row extends ApiEntity,
  SaveInput extends ApiEntity,
  Params extends FetchParams
>({
  buildInput,
  colorKey,
  columns,
  description,
  dialogContentClassName,
  fields,
  formDescription,
  formTitle,
  getName,
  getSubtitle,
  icon: Icon,
  idKey,
  initialPagination,
  itemLabel,
  listTitle,
  nameEngKey,
  nameFallbackKey,
  nameKey,
  nameLaKey,
  refreshLabel,
  renderBadges,
  renderLeading,
  requiredScopeKey,
  requiredScopeMessage,
  scope: getScope,
  slug,
  store,
  tableClassName = "min-w-[860px]",
  title,
  validateInput
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
  const hasLoaded = store((state) => state.hasLoaded);
  const loading = store((state) => state.loading);
  const refreshing = store((state) => state.refreshing);
  const saving = store((state) => state.saving);
  const setSearch = store((state) => state.setSearch);
  const loadRows = store((state) => state.load);
  const saveRow = store((state) => state.save);
  const removeRow = store((state) => state.remove);
  const { changeLimit, limit, page, resetPage, setPage } = useUrlPagination({ initialPagination });
  const [orderBy, setOrderBy] = useState<SortOrder>("ASC");
  const [editing, setEditing] = useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  const scope = useMemo(() => getScope?.(storeUuid, user) ?? {}, [getScope, storeUuid, user]);
  const scopeKey = JSON.stringify(scope);
  const missingRequiredScope = Boolean(requiredScopeKey && !String(scope[requiredScopeKey] ?? "").trim());
  const requestParams = useMemo<Params>(
    () => ({ search, page, limit, orderBy, lang: language, ...scope }) as Params,
    [language, limit, orderBy, page, scope, search]
  );
  const pageSize = optionPageSize(limit, rows.length);
  const totalPages = optionTotalPages(storeTotalPages, total, pageSize);
  const { start: pageStart, end: pageEnd } = optionPageRange(rows.length, page, pageSize);
  const fullLoading = loading && !hasLoaded;
  const backgroundLoading = refreshing || (loading && hasLoaded);
  const pagingBusy = loading || refreshing;
  const canGoBack = page > 1 && !pagingBusy;
  const canGoNext = page < totalPages && !pagingBusy;
  const rowId = useCallback((row: Row) => optionValue(row, idKey), [idKey]);
  const { allSelected, removeSelected, selectedRows, toggleAll, toggleSelected } = useOptionRowSelection(rows, rowId);

  function requiredScopeDescription() {
    return requiredScopeMessage ?? t("settings.branchRequired");
  }

  async function load() {
    if (missingRequiredScope) {
      showToast({ title: t("settings.loadFailed", { title }), description: requiredScopeDescription(), tone: "error" });
      return;
    }

    try {
      await loadRows(requestParams, { background: hasLoaded });
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

  function optionName(row: Row) {
    return getName?.(row) ?? optionValue(row, nameKey, optionValue(row, nameFallbackKey ?? "", optionValue(row, nameLaKey ?? "", optionValue(row, nameEngKey ?? "", "-"))));
  }

  function optionSubtitle(row: Row) {
    if (getSubtitle) return getSubtitle(row);
    if (colorKey) {
      const color = optionValue(row, colorKey);
      return color && color !== optionName(row) ? color : "";
    }
    if (!nameLaKey && !nameEngKey) return "";
    return `${optionValue(row, nameLaKey ?? "", "-")} / ${optionValue(row, nameEngKey ?? "", "-")}`;
  }

  function applyFilters() {
    if (page === 1) void load();
    else resetPage();
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

    const args = { editing, formData, scope, storeUuid, user };
    const validationMessage = validateInput?.(args) ?? null;
    if (validationMessage) {
      showToast({ title: t("settings.saveFailed"), description: validationMessage, tone: "error" });
      return;
    }

    try {
      const input = buildInput?.(args) ?? defaultInput<Row, SaveInput>({ ...args, fields, idKey });
      await saveRow(input);
      showToast({ title: t("settings.saved"), tone: "success" });
      setDialogOpen(false);
      setEditing(null);
      await loadRows(requestParams, { background: true });
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function remove(row: Row) {
    const id = rowId(row);
    if (!id) return;

    try {
      await removeRow(id);
      showToast({ title: t("settings.deleted"), tone: "success" });
      setDeleteTarget(null);
      removeSelected(id);
      await loadRows(requestParams, { background: true });
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  function leading(row: Row) {
    if (colorKey) return <ColorSwatch value={optionValue(row, colorKey)} large />;
    if (renderLeading) return renderLeading(row);
    return (
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon aria-hidden />
      </span>
    );
  }

  const table = rows.length ? (
    <SettingsTableScroll>
      <Table className={tableClassName}>
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("fields.no")}</TableHead>
            <TableHead>{itemLabel}</TableHead>
            {columns.map((column) => (
              <TableHead key={column.key}>{column.label}</TableHead>
            ))}
            <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const id = rowId(row);
            const name = optionName(row);
            const selected = selectedRows.has(id);
            const subtitle = optionSubtitle(row);
            return (
              <TableRow key={id || index} className="h-14" data-state={selected ? "selected" : undefined}>
                <TableCell className="w-10 px-2">
                  <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onChange={(event) => toggleSelected(id, event.target.checked)} />
                </TableCell>
                <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black tabular-nums text-muted-foreground">{pageStart + index}</TableCell>
                <TableCell className="max-w-[28rem]">
                  <div className="flex min-w-0 items-center gap-3">
                    {leading(row)}
                    <div className="min-w-0">
                      <p className="truncate font-black">{name}</p>
                      {subtitle ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p> : null}
                    </div>
                  </div>
                </TableCell>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.render ? column.render(row) : optionValue(row, column.key, "-")}
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
        const id = rowId(row);
        const name = optionName(row);
        const selected = selectedRows.has(id);
        const subtitle = optionSubtitle(row);
        return (
          <SettingsMobileCard
            key={id || index}
            actions={<SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />}
            badges={renderBadges?.(row)}
            checked={selected}
            leading={leading(row)}
            selectLabel={t("common.selectRow", { name })}
            selected={selected}
            subtitle={subtitle ? <span className="block truncate">{subtitle}</span> : undefined}
            title={name}
            onCheckedChange={(checked) => toggleSelected(id, checked)}
          >
            <SettingsMobileMetaGrid>
              {columns.map((column) => (
                <SettingsMobileMeta key={column.key} label={column.label} value={column.render ? column.render(row) : optionValue(row, column.key, "-")} />
              ))}
            </SettingsMobileMetaGrid>
          </SettingsMobileCard>
        );
      })}
    </SettingsMobileList>
  ) : null;

  const toolbar = (
    <SettingsToolbar
      state={{
        search,
        limit,
        orderBy,
        selectedCount: selectedRows.size,
        onApply: applyFilters,
        onLimit: changeLimit,
        onOrder: (nextOrder) => {
          setOrderBy(nextOrder);
          setPage(1);
        },
        onSearch: setSearch
      }}
    />
  );

  const listSurface = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur sm:px-4 lg:px-5">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black">{listTitle}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("common.showingRange", { start: pageStart, end: pageEnd, total })} - {t("common.page", { current: page, total: totalPages })}
            </p>
          </div>
          <div className="min-w-0 xl:max-w-[48rem]">{toolbar}</div>
        </div>
        {backgroundLoading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner aria-hidden />
            {refreshLabel ?? t("settings.loading", { title })}
          </div>
        ) : null}
      </div>
      {rows.length ? (
        <>
          <div className="hidden min-h-0 flex-1 md:flex">{table}</div>
          <div className="min-h-0 flex-1 overflow-y-auto md:hidden">{mobileList}</div>
        </>
      ) : (
        <div className="flex min-h-72 flex-1 items-center justify-center p-4">
          <Empty className="max-w-md border border-dashed bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{t("settings.noRecords", { title: title.toLowerCase() })}</EmptyTitle>
              <EmptyDescription>{t("empty.adjustSearch")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </div>
  );

  return (
    <>
      <SettingsModuleShell
        addLabel={`${t("actions.add")} ${itemLabel}`}
        cardTitle={listTitle}
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
        hideCardHeader
        loading={fullLoading}
        loadingLabel={t("settings.loading", { title })}
        table={listSurface}
        title={title}
        onAdd={openCreate}
      />
      <OptionFormDialog
        description={formDescription ?? description}
        dialogContentClassName={dialogContentClassName}
        editing={editing}
        fields={fields}
        idKey={idKey}
        open={dialogOpen}
        saving={saving}
        slug={slug}
        title={title}
        formTitle={formTitle ?? title}
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
        confirmPending={saving}
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
  description,
  dialogContentClassName,
  editing,
  fields,
  formTitle,
  idKey,
  onOpenChange,
  onSubmit,
  open,
  saving,
  slug,
  title
}: {
  description: string;
  dialogContentClassName?: string;
  editing: Row | null;
  fields: OptionField<Row>[];
  formTitle: string;
  idKey: keyof Row & string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
  slug: string;
  title: string;
}) {
  const { t } = useTranslation();
  const formKey = optionValue(editing, idKey) || `new-${slug}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className={dialogContentClassName ?? "sm:max-w-2xl"}>
        <SettingsDialogForm key={formKey} action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <OptionFormFields
              description={description}
              editing={editing}
              fields={fields}
              saving={saving}
              slug={slug}
              title={formTitle}
            />
          </SettingsDialogBody>
          <input name={idKey} type="hidden" value={optionValue(editing, idKey)} readOnly />
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

export { ColorCodeBadge, ColorSwatch, optionValue };
