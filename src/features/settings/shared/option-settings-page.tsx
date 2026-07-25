"use client";

import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
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
import { SettingsCrudShell, SettingsCrudToolbar } from "@/features/settings/shared/settings-crud-shell";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader,
  SettingsListSurface,
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsRowActions,
  SettingsTableScroll,
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
  const controller = useSettingsCrudController<Row, SaveInput, Params>({
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
  const { allSelected, openEdit, pageStart, rowId, rows, selectedRows, setDeleteTarget, toggleAll, toggleSelected } =
    controller;

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

  return (
    <SettingsCrudShell
      addLabel={`${t("actions.add")} ${itemLabel}`}
      cardTitle={listTitle}
      controller={controller}
      description={description}
      formDialog={
        <OptionFormDialog
          description={formDescription ?? description}
          dialogContentClassName={dialogContentClassName}
          editing={controller.editing}
          fields={fields}
          idKey={idKey}
          open={controller.dialogOpen}
          saving={controller.saving}
          slug={slug}
          title={title}
          formTitle={formTitle ?? title}
          onOpenChange={controller.onDialogOpenChange}
          onSubmit={controller.save}
        />
      }
      listSurface={
        <SettingsListSurface
          backgroundLoading={controller.backgroundLoading}
          emptyIcon={<Icon aria-hidden />}
          emptyTitle={title.toLowerCase()}
          hasRows={rows.length > 0}
          listTitle={listTitle}
          mobileList={mobileList}
          refreshLabel={refreshLabel ?? t("settings.loading", { title })}
          table={table}
          toolbar={<SettingsCrudToolbar controller={controller} />}
        />
      }
      title={title}
    />
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
