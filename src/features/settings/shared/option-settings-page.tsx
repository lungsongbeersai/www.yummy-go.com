"use client";

import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ColorCodeBadge,
  ColorSwatch,
  OptionFormFields,
  type OptionColumn,
  type OptionField
} from "@/features/settings/shared/option-settings-fields";
import { optionValue } from "@/features/settings/shared/option-settings-utils";
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
  SettingsToolbar,
  SettingsEmptyRecords,} from "@/features/settings/shared/settings-shell";
import {
  useSettingsCrudController,
  type SettingsCrudSaveArgs,
  type SettingsCrudStore
} from "@/features/settings/shared/use-settings-crud-controller";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { ApiEntity, FetchParams } from "@/services/shared/types";
import type { AuthUser } from "@/stores/auth-store";

type OptionStore<Row extends ApiEntity, SaveInput extends ApiEntity, Params extends FetchParams> =
  SettingsCrudStore<Row, SaveInput, Params>;

export type OptionSaveArgs<Row extends ApiEntity> = SettingsCrudSaveArgs<Row>;

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
  const {
    allSelected,
    applyFilters,
    backgroundLoading,
    changeLimit,
    deleteTarget,
    dialogOpen,
    editing,
    fullLoading,
    limit,
    onDialogOpenChange,
    openCreate,
    openEdit,
    orderBy,
    page,
    pageEnd,
    pageStart,
    remove,
    rowId,
    rows,
    save,
    saving,
    search,
    selectedRows,
    setDeleteTarget,
    setOrderBy,
    setPage,
    setSearch,
    toggleAll,
    toggleSelected,
    total,
    totalPages
  } = useSettingsCrudController<Row, SaveInput, Params>({
    // ไม่มี buildInput ที่ระบุมา = ใช้ defaultInput ที่ประกอบจาก fields[] แทน
    buildInput: (args) => buildInput?.(args) ?? defaultInput<Row, SaveInput>({ ...args, fields, idKey }),
    idKey,
    initialPagination,
    requiredScopeKey,
    requiredScopeMessage,
    scope: getScope,
    store,
    title,
    validateInput
  });

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
        <SettingsEmptyRecords icon={<Icon aria-hidden />} title={title.toLowerCase()} />
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
              page={page}
              pageEnd={pageEnd}
              pageStart={pageStart}
              total={total}
              totalPages={totalPages}
              onPageChange={setPage}
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
        onOpenChange={onDialogOpenChange}
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

export function OptionFormDialog<Row extends ApiEntity>({
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
