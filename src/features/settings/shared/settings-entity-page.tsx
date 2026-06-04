"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/features/settings/shared/settings-shell";
import { DEFAULT_PAGE_LIMIT } from "@/lib/pagination";
import type { SettingConfig } from "@/features/settings/shared/settings-config";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useToastStore } from "@/stores/toast-store";

const EMPTY_ROWS: Record<string, unknown>[] = [];
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;

function value(row: Record<string, unknown> | null, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

function isIdentifierKey(key: string) {
  const normalized = key.toLowerCase();
  return normalized === "id" || normalized.endsWith("_id") || normalized.includes("uuid");
}

export function SettingsEntityPage({ config }: { config: SettingConfig }) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const showToast = useToastStore((state) => state.show);
  const entity = useSettingsStore((state) => state.entities[config.slug]);
  const rows = entity?.rows ?? EMPTY_ROWS;
  const total = entity?.total ?? rows.length;
  const storeTotalPages = entity?.totalPages ?? 1;
  const search = entity?.search ?? "";
  const loading = entity?.loading ?? false;
  const saving = entity?.saving ?? false;
  const setStoreSearch = useSettingsStore((state) => state.setSearch);
  const loadEntity = useSettingsStore((state) => state.load);
  const saveEntity = useSettingsStore((state) => state.save);
  const removeEntity = useSettingsStore((state) => state.remove);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [limit, setLimit] = useState<PageLimit>(DEFAULT_LIMIT);
  const [orderBy, setOrderBy] = useState<SortOrder>("ASC");
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const visibleColumns = config.columns.filter((column) => !isIdentifierKey(column.key));

  const title = t(`settings.modules.${config.slug}.title`);
  const description = t(`settings.modules.${config.slug}.description`);
  const scope = useMemo(() => config.scope?.(user) ?? {}, [config, user]);
  const scopeKey = JSON.stringify(scope);
  const pageSize = limit === "All" ? rows.length || Number(DEFAULT_LIMIT) : Number(limit ?? DEFAULT_LIMIT);
  const totalPages = Math.max(1, Number(storeTotalPages || Math.ceil(total / pageSize) || 1));
  const pageStart = rows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;
  const canGoBack = page > 1 && !loading;
  const canGoNext = page < totalPages && !loading;
  const ids = useMemo(() => rows.map((row) => value(row, config.idKey)).filter(Boolean), [config.idKey, rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedRows.has(id));

  async function load() {
    try {
      await loadEntity(config, { search, page, limit, orderBy, lang: language, ...scope });
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
  }, [config.slug, language, page, limit, orderBy, scopeKey]);

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

  async function save(formData: FormData) {
    const input: Record<string, unknown> = { ...scope };
    config.fields.forEach((field) => {
      const fieldValue = formData.get(field.name);
      if (fieldValue !== null && fieldValue !== "") input[field.name] = fieldValue;
    });
    if (editing?.[config.idKey]) input[config.idKey] = editing[config.idKey];

    try {
      await saveEntity(config, input);
      showToast({ title: t("settings.saved"), tone: "success" });
      setOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function remove(row: Record<string, unknown>) {
    const id = value(row, config.idKey);
    if (!id) return;
    try {
      await removeEntity(config, id);
      showToast({ title: t("settings.deleted"), tone: "success" });
      setDeleteTarget(null);
      setSelectedRows((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      await load();
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
      <Table className="min-w-[900px]">
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">#</TableHead>
            {visibleColumns.map((column) => (
              <TableHead key={column.key}>
                {t(`fields.${column.key}`)}
              </TableHead>
            ))}
            <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const id = value(row, config.idKey);
            const selected = selectedRows.has(id);
            return (
              <TableRow key={id || index} data-state={selected ? "selected" : undefined}>
                <TableCell className="w-10 px-2">
                  <Checkbox aria-label={t("common.selectRow", { name: id })} checked={selected} onChange={(event) => toggleSelected(id, event.target.checked)} />
                </TableCell>
                <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black text-muted-foreground">{pageStart + index}</TableCell>
                {visibleColumns.map((column) => (
                  <TableCell key={column.key} className="text-muted-foreground">
                    {value(row, column.key, "-")}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  <SettingsRowActions
                    row={row}
                    onEdit={(nextRow) => {
                      setEditing(nextRow);
                      setOpen(true);
                    }}
                    onDelete={setDeleteTarget}
                  />
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
        const id = value(row, config.idKey);
        const selected = selectedRows.has(id);
        const titleColumn = visibleColumns[0];
        const detailColumns = visibleColumns.slice(1);
        return (
          <SettingsMobileCard
            key={id || index}
            actions={
              <SettingsRowActions
                row={row}
                onEdit={(nextRow) => {
                  setEditing(nextRow);
                  setOpen(true);
                }}
                onDelete={setDeleteTarget}
              />
            }
            checked={selected}
            leading={
              <span className="grid size-9 place-items-center rounded-md bg-primary/10 text-sm font-black text-primary">
                {pageStart + index}
              </span>
            }
            selectLabel={t("common.selectRow", { name: value(row, titleColumn?.key ?? "", "-") })}
            selected={selected}
            title={value(row, titleColumn?.key ?? "", "-")}
            onCheckedChange={(checked) => toggleSelected(id, checked)}
          >
            {detailColumns.length ? (
              <SettingsMobileMetaGrid>
                {detailColumns.map((column) => (
                  <SettingsMobileMeta key={column.key} label={t(`fields.${column.key}`)} value={value(row, column.key, "-")} />
                ))}
              </SettingsMobileMetaGrid>
            ) : null}
          </SettingsMobileCard>
        );
      })}
    </SettingsMobileList>
  ) : null;

  return (
    <>
      <SettingsModuleShell
        addLabel={`${t("actions.add")} ${title}`}
        cardTitle={title}
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
              onSearch: (nextSearch) => setStoreSearch(config.slug, nextSearch)
            }}
          />
        }
        onAdd={() => {
          setEditing(null);
          setOpen(true);
        }}
      />
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (saving) return;
          setOpen(nextOpen);
          if (!nextOpen) setEditing(null);
        }}
      >
        <SettingsDialogContent className="sm:max-w-2xl">
          <SettingsDialogForm action={save}>
            <SettingsDialogHeader>
              <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </SettingsDialogHeader>
            <SettingsDialogBody>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                {config.fields.map((field) => {
                  const defaultValue = value(editing, field.name);
                  const fieldId = `${config.slug}-${field.name}`;
                  return (
                    <Field key={field.name} className={field.type === "textarea" ? "md:col-span-2" : undefined}>
                      <FieldLabel htmlFor={fieldId}>{t(`fields.${field.name}`)}</FieldLabel>
                      {field.type === "textarea" ? (
                        <Textarea id={fieldId} name={field.name} defaultValue={defaultValue} required={field.required} />
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
              </FieldGroup>
            </SettingsDialogBody>
            <SettingsDialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setOpen(false);
                  setEditing(null);
                }}
              >
                {t("actions.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner data-icon="inline-start" /> : null}
                {saving ? t("common.processing") : t("actions.save")}
              </Button>
            </SettingsDialogFooter>
          </SettingsDialogForm>
        </SettingsDialogContent>
      </Dialog>
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
