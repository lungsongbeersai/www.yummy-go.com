"use client";

import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  QR_CROP_ASPECT,
  QR_CROP_ASPECT_CLASS,
  QR_CROP_OUTPUT_HEIGHT,
  QR_CROP_OUTPUT_WIDTH,
} from "@/config/image-crop";
import {
  DEFAULT_CROP,
  SettingsImageCropPanel,
  cropImageFile,
  type CropState,
} from "@/features/settings/shared/settings-image-crop";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader,
} from "@/features/settings/shared/settings-shell";
import type { Bank, BranchAccount, SaveBankInput, SaveBranchAccountInput } from "@/services/bank-account";

const ACTIVE = 1;
const INACTIVE = 2;

function bankLabel(bank: Bank, language: string) {
  return (language.startsWith("en") ? bank.bank_name_eng : bank.bank_name_la)
    || bank.bank_name_la
    || bank.bank_name_eng;
}

export function BankFormDialog({
  editing,
  onOpenChange,
  onSave,
  open,
  saving,
}: {
  editing: Bank | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: SaveBankInput) => Promise<void>;
  open: boolean;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState(String(editing?.bank_status ?? ACTIVE));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await onSave({
      bank_uuid: editing?.bank_uuid,
      bank_name_la: String(data.get("bank_name_la") ?? "").trim(),
      bank_name_eng: String(data.get("bank_name_eng") ?? "").trim(),
      bank_status: Number(status),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent>
        <SettingsDialogForm onSubmit={submit}>
          <SettingsDialogHeader>
            <DialogTitle>
              {editing ? t("settings.editRecord") : t("settings.newRecord")}: {t("settings.modules.bank.title")}
            </DialogTitle>
            <DialogDescription>{t("settings.bankAccount.bankFormHint")}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="bank-name-la">{t("settings.storeBranch.bankNameLa")}</FieldLabel>
                <Input id="bank-name-la" name="bank_name_la" defaultValue={editing?.bank_name_la ?? ""} disabled={saving} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="bank-name-eng">{t("settings.storeBranch.bankNameEng")}</FieldLabel>
                <Input id="bank-name-eng" name="bank_name_eng" defaultValue={editing?.bank_name_eng ?? ""} disabled={saving} />
              </Field>
              <Field>
                <FieldLabel htmlFor="bank-status">{t("settings.storeBranch.status")}</FieldLabel>
                <Select value={status} onValueChange={setStatus} disabled={saving}>
                  <SelectTrigger id="bank-status" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent position="popper"><SelectGroup>
                    <SelectItem value={String(ACTIVE)}>{t("common.active")}</SelectItem>
                    <SelectItem value={String(INACTIVE)}>{t("common.inactive")}</SelectItem>
                  </SelectGroup></SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </SettingsDialogBody>
          <SettingsDialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>{t("actions.cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? <Spinner data-icon="inline-start" /> : null}{t("actions.save")}</Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}

export function AccountFormDialog({
  banks,
  branchUuid,
  editing,
  onOpenChange,
  onSave,
  open,
  saving,
}: {
  banks: Bank[];
  branchUuid: string;
  editing: BranchAccount | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: SaveBranchAccountInput) => Promise<void>;
  open: boolean;
  saving: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [bankUuid, setBankUuid] = useState(
    editing?.bank_uuid_fk || banks.find((bank) => Number(bank.bank_status) === ACTIVE)?.bank_uuid || "",
  );
  const [status, setStatus] = useState(String(editing?.account_status ?? ACTIVE));
  const [selectedQr, setSelectedQr] = useState<File | null>(null);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const selectableBanks = banks.filter(
    (bank) => Number(bank.bank_status) === ACTIVE || bank.bank_uuid === bankUuid,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const accountQr = selectedQr
      ? await cropImageFile(selectedQr, crop, t("settings.storeBranch.imageLoadFailed"), {
          aspect: QR_CROP_ASPECT,
          outputHeight: QR_CROP_OUTPUT_HEIGHT,
          outputWidth: QR_CROP_OUTPUT_WIDTH,
        })
      : undefined;

    await onSave({
      account_uuid: editing?.account_uuid,
      bank_uuid_fk: bankUuid,
      branch_uuid_fk: branchUuid,
      account_name: String(data.get("account_name") ?? "").trim(),
      account_number: String(data.get("account_number") ?? "").trim(),
      account_qr: accountQr,
      account_status: Number(status),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-3xl">
        <SettingsDialogForm onSubmit={submit}>
          <SettingsDialogHeader>
            <DialogTitle>
              {editing ? t("settings.editRecord") : t("settings.newRecord")}: {t("settings.modules.account.title")}
            </DialogTitle>
            <DialogDescription>{t("settings.bankAccount.accountFormHint")}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field><FieldLegend>{t("settings.bankAccount.accountDetails")}</FieldLegend><FieldDescription>{t("settings.bankAccount.accountDetailsHint")}</FieldDescription></Field>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="account-bank">{t("settings.storeBranch.bank")}</FieldLabel>
                    <Select value={bankUuid} onValueChange={setBankUuid} disabled={saving || !selectableBanks.length}>
                      <SelectTrigger id="account-bank" className="w-full"><SelectValue placeholder={t("settings.storeBranch.selectBank")} /></SelectTrigger>
                      <SelectContent position="popper"><SelectGroup>
                        {selectableBanks.map((bank) => <SelectItem key={bank.bank_uuid} value={bank.bank_uuid}>{bankLabel(bank, i18n.resolvedLanguage || i18n.language)}</SelectItem>)}
                      </SelectGroup></SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="account-name">{t("settings.storeBranch.accountName")}</FieldLabel>
                    <Input id="account-name" name="account_name" defaultValue={editing?.account_name ?? ""} disabled={saving} required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="account-number">{t("settings.storeBranch.accountNumber")}</FieldLabel>
                    <Input id="account-number" name="account_number" defaultValue={editing?.account_number ?? ""} disabled={saving} inputMode="numeric" required translate="no" />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="account-status">{t("settings.storeBranch.status")}</FieldLabel>
                    <Select value={status} onValueChange={setStatus} disabled={saving}>
                      <SelectTrigger id="account-status" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent position="popper"><SelectGroup>
                        <SelectItem value={String(ACTIVE)}>{t("common.active")}</SelectItem>
                        <SelectItem value={String(INACTIVE)}>{t("common.inactive")}</SelectItem>
                      </SelectGroup></SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
              </FieldSet>
              <SettingsImageCropPanel
                accept="image/jpeg,image/png,image/webp"
                aspect={QR_CROP_ASPECT}
                aspectClass={QR_CROP_ASPECT_CLASS}
                crop={crop}
                className="rounded-lg border border-border"
                description={t("settings.storeBranch.accountQrHint")}
                disabled={saving}
                emptyLabel={t("settings.storeBranch.accountQr")}
                existingSrc={editing?.account_qr ?? ""}
                fieldId="account-qr"
                fileSupportText={t("settings.storeBranch.accountQrSupport")}
                previewMaxClassName="max-w-48"
                removeLabel={t("settings.storeBranch.cancelImage")}
                saving={saving}
                selectedFile={selectedQr}
                sideBorderAt="lg"
                title={t("settings.storeBranch.accountQr")}
                uploadLabel={t("settings.storeBranch.uploadAccountQr")}
                zoomLabel={t("settings.storeBranch.zoom")}
                onCropChange={setCrop}
                onFileChange={setSelectedQr}
              />
            </FieldGroup>
          </SettingsDialogBody>
          <SettingsDialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>{t("actions.cancel")}</Button>
            <Button type="submit" disabled={saving || !branchUuid || !bankUuid}>{saving ? <Spinner data-icon="inline-start" /> : null}{t("actions.save")}</Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
