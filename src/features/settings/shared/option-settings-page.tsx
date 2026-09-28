"use client";

import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle
} from "@/components/ui/item";
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
import { SettingsListPageLayout } from "@/features/settings/shared/settings-list-page-layout";
import { SettingsIconTile } from "@/features/settings/shared/settings-tones";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader,
  SettingsEmptyRecords,
  SettingsRowActions
} from "@/features/settings/shared/settings-shell";
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

  // Records with a Lao and an English name lead with the Lao one (what staff read) and show the
  // English one underneath. The LA/EN columns a page lists are then skipped: the old table showed
  // the same name three times (name, "LA / EN" under it, and a column for each).
  // (Pages whose getName is just the usual name → LA → EN fallback get this too; colour and
  // currency supply their own subtitle or swatch and keep their layout.)
  const bilingual = !getSubtitle && !colorKey && Boolean(nameLaKey || nameEngKey);
  const visibleColumns = bilingual
    ? columns.filter((column) => column.key !== nameLaKey && column.key !== nameEngKey)
    : columns;

  function optionName(row: Row) {
    const fallback = getName?.(row) ?? optionValue(row, nameKey, optionValue(row, nameFallbackKey ?? "", optionValue(row, nameLaKey ?? "", optionValue(row, nameEngKey ?? "", "-"))));
    return bilingual ? optionValue(row, nameLaKey ?? "", fallback) : fallback;
  }

  function optionSubtitle(row: Row): ReactNode {
    if (getSubtitle) return getSubtitle(row);
    if (colorKey) {
      const color = optionValue(row, colorKey);
      return color && color !== optionName(row) ? color : "";
    }
    if (!bilingual) return "";
    const english = optionValue(row, nameEngKey ?? "");
    return english && english !== optionName(row) ? english : "";
  }

  function leading(row: Row) {
    if (colorKey) return <ColorSwatch value={optionValue(row, colorKey)} large />;
    if (renderLeading) return renderLeading(row);
    return <SettingsIconTile icon={Icon} />;
  }

  function columnValue(row: Row, column: OptionColumn<Row>) {
    return column.render ? column.render(row) : optionValue(row, column.key, "-");
  }

  const table = (
    <Table containerClassName="min-h-0 flex-1 overflow-auto">
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow>
          <TableHead className="w-px">
            <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onCheckedChange={(checked) => toggleAll(checked === true)} />
          </TableHead>
          {/* w-px: checkbox, number and actions shrink to their content; the name takes the spare width. */}
          <TableHead className="w-px text-center">{t("fields.no")}</TableHead>
          <TableHead className="min-w-56">{itemLabel}</TableHead>
          {visibleColumns.map((column) => (
            <TableHead key={column.key}>{column.label}</TableHead>
          ))}
          <TableHead className="w-px">
            <span className="sr-only">{t("common.actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const id = rowId(row);
          const name = optionName(row);
          const selected = selectedRows.has(id);
          const subtitle = optionSubtitle(row);
          return (
            <TableRow key={id || index} data-state={selected ? "selected" : undefined}>
              <TableCell>
                <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onCheckedChange={(checked) => toggleSelected(id, checked === true)} />
              </TableCell>
              <TableCell className="text-center text-muted-foreground tabular-nums">{pageStart + index}</TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <span className="flex shrink-0">{leading(row)}</span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-medium">{name}</span>
                    {subtitle ? <span className="truncate text-muted-foreground">{subtitle}</span> : null}
                  </div>
                </div>
              </TableCell>
              {visibleColumns.map((column) => (
                <TableCell key={column.key} className={column.className}>
                  {columnValue(row, column)}
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
  );

  // Narrow pages: one Item per record — leading icon/swatch, name and subtitle, then any extra
  // columns as "label: value" in the footer. Two columns once there is room for them.
  const mobileList = (
    <ItemGroup className="@xl:grid @xl:grid-cols-2">
      {rows.map((row, index) => {
        const id = rowId(row);
        const name = optionName(row);
        const subtitle = optionSubtitle(row);
        return (
          <Item key={id || index} variant="outline">
            <Checkbox
              aria-label={t("common.selectRow", { name })}
              checked={selectedRows.has(id)}
              onCheckedChange={(checked) => toggleSelected(id, checked === true)}
            />
            <ItemMedia>{leading(row)}</ItemMedia>
            <ItemContent>
              <ItemTitle>
                {name}
                {renderBadges?.(row)}
              </ItemTitle>
              {subtitle ? <ItemDescription>{subtitle}</ItemDescription> : null}
            </ItemContent>
            <ItemActions>
              <SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />
            </ItemActions>
            {visibleColumns.length ? (
              <ItemFooter className="flex-wrap justify-start gap-x-4 gap-y-1">
                {visibleColumns.map((column) => (
                  <span key={column.key} className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">{column.label}:</span>
                    {columnValue(row, column)}
                  </span>
                ))}
              </ItemFooter>
            ) : null}
          </Item>
        );
      })}
    </ItemGroup>
  );

  return (
    <SettingsListPageLayout
      id={`option-${slug}`}
      title={title}
      description={description}
      icon={Icon}
      addLabel={`${t("actions.add")} ${itemLabel}`}
      onAdd={openCreate}
      loading={fullLoading}
      loadingLabel={t("settings.loading", { title })}
      search={search}
      searching={backgroundLoading}
      searchingLabel={refreshLabel ?? t("settings.loading", { title })}
      onSearchChange={setSearch}
      onSearchApply={applyFilters}
      orderBy={orderBy}
      onOrderChange={(nextOrder) => {
        setOrderBy(nextOrder);
        setPage(1);
      }}
      allSelected={allSelected}
      selectAllLabel={t("common.selectAll")}
      selectedCount={selectedRows.size}
      onToggleAll={toggleAll}
      hasRows={rows.length > 0}
      table={table}
      mobileList={mobileList}
      empty={<SettingsEmptyRecords icon={<Icon aria-hidden />} title={title.toLowerCase()} />}
      page={page}
      pageStart={pageStart}
      pageEnd={pageEnd}
      total={total}
      totalPages={totalPages}
      limit={limit}
      onLimitChange={changeLimit}
      onPageChange={setPage}
    >
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
    </SettingsListPageLayout>
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
