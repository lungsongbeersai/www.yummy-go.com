"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader
} from "@/features/settings/shared/settings-shell";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import type { Customer } from "@/services/customer";
import { customerId, customerMemberCode, customerStatus, customerValue } from "./customer-utils";

export interface CustomerFormDialogProps {
  editing: Customer | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
}

export function CustomerFormDialog({
  editing,
  onOpenChange,
  onSubmit,
  open,
  saving
}: CustomerFormDialogProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState(() => customerStatus(editing));
  const formKey = customerId(editing) || "new-customer";

  useResetOnChange(`${formKey}:${open}`, () => {
    setStatus(customerStatus(editing));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-2xl">
        <SettingsDialogForm key={formKey} action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>
              {editing ? t("settings.editRecord") : t("settings.newRecord")}: {t("settings.modules.customer.title")}
            </DialogTitle>
            <DialogDescription>{t("settings.customerFormHint")}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.customerDetails")}</FieldLegend>
                  <FieldDescription>{t("settings.customerDetailsHint")}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="customer-member-code">{t("fields.member_code")}</FieldLabel>
                    <Input
                      id="customer-member-code"
                      name="member_code"
                      autoComplete="off"
                      defaultValue={customerMemberCode(editing)}
                      disabled={saving}
                      spellCheck={false}
                      translate="no"
                    />
                    <FieldDescription>{t("settings.memberCodeHint")}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="customer-name">{t("fields.customer_name")}</FieldLabel>
                    <Input
                      id="customer-name"
                      name="customer_name"
                      autoComplete="name"
                      defaultValue={customerValue(editing, "customer_name")}
                      disabled={saving}
                      required
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="customer-status">{t("fields.customer_status")}</FieldLabel>
                    <input name="customer_status" type="hidden" value={status} />
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger id="customer-status" className="w-full" disabled={saving}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectGroup>
                          <SelectItem value="1">{t("common.active")}</SelectItem>
                          <SelectItem value="2">{t("common.inactive")}</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
              </FieldSet>

              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.customerContactDetails")}</FieldLegend>
                  <FieldDescription>{t("settings.customerContactDetailsHint")}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="customer-phone">{t("fields.customer_phone")}</FieldLabel>
                    <Input
                      id="customer-phone"
                      name="customer_phone"
                      autoComplete="tel"
                      defaultValue={customerValue(editing, "customer_phone")}
                      disabled={saving}
                      inputMode="tel"
                      type="tel"
                      translate="no"
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="customer-address">{t("fields.customer_address")}</FieldLabel>
                    <Textarea
                      id="customer-address"
                      name="customer_address"
                      autoComplete="street-address"
                      defaultValue={customerValue(editing, "customer_address")}
                      disabled={saving}
                      rows={4}
                    />
                  </Field>
                </FieldGroup>
              </FieldSet>
            </FieldGroup>
          </SettingsDialogBody>
          <input name="customer_uuid" type="hidden" value={customerId(editing)} readOnly />
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
