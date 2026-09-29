"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Landmark, Pencil, Plus, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { getAccountQrUrl } from "@/lib/image";
import {
  type Bank,
  type BranchAccount,
} from "@/services/bank-account";
import { useBankAccountStore } from "@/stores/bank-account-store";
import { useToastStore } from "@/stores/toast-store";

const ACTIVE = 1;
const INACTIVE = 2;

export function BranchTransferAccounts({
  branchUuid,
  disabled,
}: {
  branchUuid: string;
  disabled: boolean;
}) {
  const { t, i18n } = useTranslation();
  const showToast = useToastStore((state) => state.show);
  const fetchBanks = useBankAccountStore((state) => state.fetchBanks);
  const fetchBranchAccounts = useBankAccountStore(
    (state) => state.fetchBranchAccounts,
  );
  const saveBank = useBankAccountStore((state) => state.saveBank);
  const saveBranchAccount = useBankAccountStore(
    (state) => state.saveBranchAccount,
  );
  const [banks, setBanks] = useState<Bank[]>([]);
  const [accounts, setAccounts] = useState<BranchAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankNameLa, setBankNameLa] = useState("");
  const [bankNameEng, setBankNameEng] = useState("");
  const [accountUuid, setAccountUuid] = useState("");
  const [bankUuid, setBankUuid] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountStatus, setAccountStatus] = useState(String(ACTIVE));
  const [selectedAccountQr, setSelectedAccountQr] = useState<File | null>(null);
  const [accountQrCrop, setAccountQrCrop] = useState<CropState>(DEFAULT_CROP);

  const load = useCallback(async () => {
    if (!branchUuid) return;
    setLoading(true);
    try {
      const [nextBanks, nextAccounts] = await Promise.all([
        fetchBanks(),
        fetchBranchAccounts(branchUuid),
      ]);
      setBanks(nextBanks);
      setAccounts(nextAccounts);
      setBankUuid((current) =>
        nextBanks.some((bank) => bank.bank_uuid === current)
          ? current
          : (nextBanks.find((bank) => Number(bank.bank_status) === ACTIVE)
              ?.bank_uuid ?? ""),
      );
    } catch (error) {
      showToast({
        title: t("settings.storeBranch.transferAccountsLoadFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [branchUuid, fetchBanks, fetchBranchAccounts, showToast, t]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  function resetAccountForm(nextBankUuid = "") {
    setAccountUuid("");
    setBankUuid(
      nextBankUuid ||
        banks.find((bank) => Number(bank.bank_status) === ACTIVE)?.bank_uuid ||
        "",
    );
    setAccountName("");
    setAccountNumber("");
    setAccountStatus(String(ACTIVE));
    setSelectedAccountQr(null);
    setAccountQrCrop(DEFAULT_CROP);
  }

  function editAccount(account: BranchAccount) {
    setAccountUuid(account.account_uuid);
    setBankUuid(account.bank_uuid_fk);
    setAccountName(account.account_name);
    setAccountNumber(account.account_number);
    setAccountStatus(String(account.account_status));
    setSelectedAccountQr(null);
    setAccountQrCrop(DEFAULT_CROP);
  }

  async function handleSaveBank() {
    if (disabled || saving || !bankNameLa.trim()) return;
    setSaving(true);
    try {
      const saved = await saveBank({
        bank_name_la: bankNameLa.trim(),
        bank_name_eng: bankNameEng.trim(),
        bank_status: ACTIVE,
      });
      setBankNameLa("");
      setBankNameEng("");
      setShowBankForm(false);
      await load();
      setBankUuid(saved.bank_uuid);
      showToast({
        title: t("settings.storeBranch.bankSaved"),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAccount() {
    if (
      disabled ||
      saving ||
      !branchUuid ||
      !bankUuid ||
      !accountName.trim() ||
      !accountNumber.trim()
    )
      return;

    setSaving(true);
    try {
      const accountQr = selectedAccountQr
        ? await cropImageFile(
            selectedAccountQr,
            accountQrCrop,
            t("settings.storeBranch.imageLoadFailed"),
            {
              aspect: QR_CROP_ASPECT,
              outputHeight: QR_CROP_OUTPUT_HEIGHT,
              outputWidth: QR_CROP_OUTPUT_WIDTH,
            },
          )
        : undefined;

      await saveBranchAccount({
        account_uuid: accountUuid || undefined,
        bank_uuid_fk: bankUuid,
        branch_uuid_fk: branchUuid,
        account_name: accountName.trim(),
        account_number: accountNumber.trim(),
        account_qr: accountQr,
        account_status: Number(accountStatus),
      });
      resetAccountForm();
      await load();
      showToast({
        title: t("settings.storeBranch.transferAccountSaved"),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  const language = i18n.resolvedLanguage || i18n.language;
  const activeBanks = banks.filter(
    (bank) =>
      Number(bank.bank_status) === ACTIVE || bank.bank_uuid === bankUuid,
  );
  const bankLabel = (bank: Bank) =>
    (language.startsWith("en") ? bank.bank_name_eng : bank.bank_name_la) ||
    bank.bank_name_la ||
    bank.bank_name_eng;
  const editingAccount = accounts.find(
    (account) => account.account_uuid === accountUuid,
  );
  const existingAccountQr = editingAccount
    ? editingAccount.account_qr ||
      (editingAccount.account_qr_raw
        ? getAccountQrUrl(editingAccount.account_qr_raw)
        : "")
    : "";

  if (!branchUuid) {
    return (
      <FieldSet className="gap-2 rounded-lg border border-border bg-card p-4">
        <FieldLegend>{t("settings.storeBranch.transferAccounts")}</FieldLegend>
        <FieldDescription>
          {t("settings.storeBranch.saveBranchBeforeAccounts")}
        </FieldDescription>
      </FieldSet>
    );
  }

  return (
    <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Field className="min-w-0 gap-1">
          <FieldLegend>{t("settings.storeBranch.transferAccounts")}</FieldLegend>
          <FieldDescription>
            {t("settings.storeBranch.transferAccountsHint")}
          </FieldDescription>
        </Field>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading || saving}
          onClick={() => void load()}
        >
          {loading ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
          {t("actions.refresh")}
        </Button>
      </div>

      <div className="grid gap-2">
        {accounts.length ? (
          accounts.map((account) => (
            <div
              key={account.account_uuid}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                {account.account_qr ? (
                  <Image
                    alt={t("settings.storeBranch.accountQr")}
                    className="size-12 shrink-0 rounded-md border border-border bg-background object-contain p-1"
                    height={48}
                    src={account.account_qr}
                    unoptimized
                    width={48}
                  />
                ) : (
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <Landmark aria-hidden />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {language.startsWith("en")
                      ? account.bank_name_eng || account.bank_name_la
                      : account.bank_name_la || account.bank_name_eng}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {account.account_name} · {account.account_number}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={Number(account.account_status) === ACTIVE ? "default" : "secondary"}>
                  {Number(account.account_status) === ACTIVE
                    ? t("settings.storeBranch.active")
                    : t("settings.storeBranch.inactive")}
                </Badge>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label={t("actions.edit")}
                  disabled={disabled || saving}
                  onClick={() => editAccount(account)}
                >
                  <Pencil aria-hidden />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {loading
              ? t("common.loading")
              : t("settings.storeBranch.noTransferAccounts")}
          </p>
        )}
      </div>

      <FieldGroup className="grid gap-3 rounded-lg bg-muted/20 p-3 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="branch-transfer-bank">
              {t("settings.storeBranch.bank")}
            </FieldLabel>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || saving}
              onClick={() => setShowBankForm((current) => !current)}
            >
              <Plus data-icon="inline-start" />
              {t("settings.storeBranch.addBank")}
            </Button>
          </div>
          <Select
            disabled={disabled || saving || !activeBanks.length}
            value={bankUuid}
            onValueChange={setBankUuid}
          >
            <SelectTrigger id="branch-transfer-bank" className="w-full">
              <SelectValue placeholder={t("settings.storeBranch.selectBank")} />
            </SelectTrigger>
            <SelectContent>
              {activeBanks.map((bank) => (
                <SelectItem key={bank.bank_uuid} value={bank.bank_uuid}>
                  {bankLabel(bank)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="branch-transfer-account-name">
            {t("settings.storeBranch.accountName")}
          </FieldLabel>
          <Input
            id="branch-transfer-account-name"
            disabled={disabled || saving}
            value={accountName}
            onChange={(event) => setAccountName(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="branch-transfer-account-number">
            {t("settings.storeBranch.accountNumber")}
          </FieldLabel>
          <Input
            id="branch-transfer-account-number"
            disabled={disabled || saving}
            inputMode="numeric"
            value={accountNumber}
            onChange={(event) => setAccountNumber(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="branch-transfer-account-status">
            {t("settings.storeBranch.status")}
          </FieldLabel>
          <Select
            disabled={disabled || saving}
            value={accountStatus}
            onValueChange={setAccountStatus}
          >
            <SelectTrigger id="branch-transfer-account-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={String(ACTIVE)}>
                {t("settings.storeBranch.active")}
              </SelectItem>
              <SelectItem value={String(INACTIVE)}>
                {t("settings.storeBranch.inactive")}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <SettingsImageCropPanel
          accept="image/jpeg,image/png,image/webp"
          aspect={QR_CROP_ASPECT}
          aspectClass={QR_CROP_ASPECT_CLASS}
          crop={accountQrCrop}
          className="rounded-lg border border-border sm:col-span-2"
          description={t("settings.storeBranch.accountQrHint")}
          disabled={disabled}
          emptyLabel={t("settings.storeBranch.accountQr")}
          existingSrc={existingAccountQr}
          fieldId="branch-transfer-account-qr"
          fileSupportText={t("settings.storeBranch.accountQrSupport")}
          previewMaxClassName="max-w-48"
          removeLabel={t("settings.storeBranch.cancelImage")}
          saving={saving}
          selectedFile={selectedAccountQr}
          sideBorderAt="lg"
          title={t("settings.storeBranch.accountQr")}
          uploadLabel={t("settings.storeBranch.uploadAccountQr")}
          zoomLabel={t("settings.storeBranch.zoom")}
          onCropChange={setAccountQrCrop}
          onFileChange={setSelectedAccountQr}
        />
        <div className="flex items-end gap-2">
          {accountUuid ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => resetAccountForm()}
            >
              {t("actions.cancel")}
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={
              disabled ||
              saving ||
              !bankUuid ||
              !accountName.trim() ||
              !accountNumber.trim()
            }
            onClick={() => void handleSaveAccount()}
          >
            {saving ? <Spinner data-icon="inline-start" /> : null}
            {accountUuid
              ? t("actions.save")
              : t("settings.storeBranch.addAccount")}
          </Button>
        </div>
      </FieldGroup>

      {showBankForm ? (
        <FieldGroup className="grid gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="new-bank-name-la">
              {t("settings.storeBranch.bankNameLa")}
            </FieldLabel>
            <Input
              id="new-bank-name-la"
              disabled={disabled || saving}
              value={bankNameLa}
              onChange={(event) => setBankNameLa(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-bank-name-eng">
              {t("settings.storeBranch.bankNameEng")}
            </FieldLabel>
            <Input
              id="new-bank-name-eng"
              disabled={disabled || saving}
              value={bankNameEng}
              onChange={(event) => setBankNameEng(event.target.value)}
            />
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <Button
              type="button"
              disabled={disabled || saving || !bankNameLa.trim()}
              onClick={() => void handleSaveBank()}
            >
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {t("settings.storeBranch.saveBank")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setShowBankForm(false)}
            >
              {t("actions.cancel")}
            </Button>
          </div>
        </FieldGroup>
      ) : null}
    </FieldSet>
  );
}
