"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader
} from "@/features/settings/shared/settings-shell";
import type { Currency } from "@/services/currency";
import { CurrencyFlagPicker } from "./currency-flag-picker";
import {
  currencyIcon,
  currencyId,
  currencyStatus,
  currencyValue
} from "./currency-utils";

export function CurrencyFormDialog({
  editing,
  onOpenChange,
  onSubmit,
  open,
  saving
}: {
  editing: Currency | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [status, setStatus] = useState("1");
  const formKey = currencyId(editing) || "new-currency";
  const saveDisabled = saving || !name.trim() || !icon.trim() || !status.trim();

  useEffect(() => {
    setName(currencyValue(editing, "currency_name"));
    setIcon(currencyIcon(editing) === "-" ? "" : currencyIcon(editing));
    setStatus(currencyStatus(editing));
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-5xl">
        <SettingsDialogForm key={formKey} action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {t("settings.modules.currency.title")}</DialogTitle>
            <DialogDescription>{t("settings.currencyFormHint")}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.currencyDetails")}</FieldLegend>
                  <FieldDescription>{t("settings.currencyDetailsHint")}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="currency-name">{t("fields.currency_name")}</FieldLabel>
                    <Input
                      id="currency-name"
                      name="currency_name"
                      autoComplete="off"
                      disabled={saving}
                      required
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="currency-status">{t("fields.currency_status")}</FieldLabel>
                    <input name="currency_status" type="hidden" value={status} />
                    <Select required value={status} onValueChange={setStatus}>
                      <SelectTrigger id="currency-status" className="w-full" disabled={saving}>
                        <SelectValue placeholder={t("fields.currency_status")} />
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
                  <FieldLegend>{t("settings.currencyFlagStatus")}</FieldLegend>
                  <FieldDescription>{t("settings.currencyFlagStatusHint")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="currency-icon">{t("fields.currency_icon")}</FieldLabel>
                  <CurrencyFlagPicker
                    code={icon}
                    disabled={saving}
                    id="currency-icon"
                    name="currency_icon"
                    required
                    onChange={setIcon}
                  />
                </Field>
              </FieldSet>
            </FieldGroup>
          </SettingsDialogBody>
          <input name="currency_uuid" type="hidden" value={currencyId(editing)} readOnly />
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={saveDisabled} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
