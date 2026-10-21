"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { categoryPrintPermission, optionRowClass, safeId } from "./printer-form-utils";
import type { PrinterFormWorkflow } from "./use-printer-form";

export function PrinterPrintPermissions({ form }: { form: PrinterFormWorkflow }) {
  const { t } = form;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <Field orientation="horizontal" className="items-start">
        <div className="flex-1">
          <FieldLabel htmlFor="printer-print-role-mode" className="mb-1 font-semibold">
            {t("printer.printRoleMode")}
          </FieldLabel>
          <FieldDescription id="printer-print-role-mode-description">{t("printer.printRoleModeHint")}</FieldDescription>
          <p className="mt-2 text-sm font-medium" aria-live="polite">
            {t(form.printRoleMode === 2 ? "printer.printRoleModeRestricted" : "printer.printRoleModeUnrestricted")}
          </p>
        </div>
        <Switch
          id="printer-print-role-mode"
          checked={form.printRoleMode === 2}
          disabled={form.saving}
          aria-describedby="printer-print-role-mode-description"
          className="mt-1"
          onCheckedChange={(checked) => form.setPrintRoleMode(checked ? 2 : 1)}
        />
      </Field>
      {form.printRoleMode === 2 ? (
        <>
          {form.loadingEmployeeRoles || (!form.employeeRolesLoaded && !form.employeeRolesError) ? (
            <div className="grid gap-2 sm:grid-cols-2" aria-busy="true" aria-label={t("printer.employeeRolesLoading")}>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : form.employeeRolesError ? (
            <Alert variant="destructive">
              <AlertTitle>{t("printer.employeeRolesLoadFailed")}</AlertTitle>
              <AlertDescription>
                <p>{form.employeeRolesError}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  void form.reloadEmployeeRoles().catch(() => undefined);
                }}>
                  {t("actions.tryAgain")}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          <FieldDescription>
            {t(form.mappingType === "OFF" ? "printer.printRoleSelectCategories" : "printer.printRoleInlineHint")}
          </FieldDescription>
        </>
      ) : null}
    </div>
  );
}

export function PrinterCategoryPrintRoles({ form, categoryUuid, categoryLabel }: {
  form: PrinterFormWorkflow;
  categoryUuid: string;
  categoryLabel: string;
}) {
  const { t } = form;
  const permission = categoryPrintPermission(form.categoryPrintPermissions, categoryUuid);
  const allId = safeId("printer-print-all-roles", categoryUuid);
  const selected = form.selectedCategories.includes(categoryUuid);
  const disabled = form.saving || form.loadingEmployeeRoles || !form.employeeRolesLoaded || Boolean(form.employeeRolesError);
  const missingRole = selected && !permission.all_roles && permission.allowed_role_ids.length === 0;

  return (
    <FieldSet className="min-w-0 gap-3" aria-label={t("printer.categoryPrintRolesLabel", { category: categoryLabel })}>
      <FieldLegend className="text-xs font-semibold">{t("printer.categoryPrintRoles")}</FieldLegend>
      {!selected ? <FieldDescription>{t("printer.categoryPrintRoleAutoSelectHint")}</FieldDescription> : null}
      <Field orientation="horizontal" className={optionRowClass(permission.all_roles)} onClick={(event) => {
        if (disabled || (event.target as HTMLElement).closest('label, input, [role="checkbox"]')) return;
        form.setAllPrintRoles(categoryUuid, !permission.all_roles);
      }}>
        <Checkbox
          id={allId}
          checked={permission.all_roles}
          disabled={disabled}
          onCheckedChange={(checked) => form.setAllPrintRoles(categoryUuid, checked === true)}
        />
        <FieldLabel htmlFor={allId} className="flex-1 font-semibold">{t("printer.allEmployeeRoles")}</FieldLabel>
      </Field>
      {form.employeeRoleOptions.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {form.employeeRoleOptions.map((role) => {
            const id = safeId(`printer-print-role-${categoryUuid}`, String(role.value));
            const checked = !permission.all_roles && permission.allowed_role_ids.includes(role.value);
            return (
              <Field key={role.value} orientation="horizontal" className={optionRowClass(checked)} onClick={(event) => {
                if (disabled || (event.target as HTMLElement).closest('label, input, [role="checkbox"]')) return;
                form.togglePrintRole(categoryUuid, role.value);
              }}>
                <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={() => {
                  form.togglePrintRole(categoryUuid, role.value);
                }} />
                <FieldLabel htmlFor={id} className="flex-1">{role.label}</FieldLabel>
              </Field>
            );
          })}
        </div>
      ) : !form.loadingEmployeeRoles && form.employeeRolesLoaded && !form.employeeRolesError ? (
        <FieldDescription>{t("printer.noEmployeeRoles")}</FieldDescription>
      ) : null}
      {missingRole ? (
        <p className="text-sm text-destructive" role="status">{t("printer.selectPrintRoleRequired")}</p>
      ) : null}
    </FieldSet>
  );
}
