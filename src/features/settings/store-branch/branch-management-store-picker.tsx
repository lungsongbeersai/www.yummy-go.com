"use client";

import { useTranslation } from "react-i18next";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BranchManagementStore } from "@/services/branch";
import { branchManagementStoreLabel } from "./branch-management-scope";

interface BranchManagementStorePickerProps {
  disabled: boolean;
  onChange: (storeUuid: string) => void;
  stores: BranchManagementStore[];
  value: string;
}

export function BranchManagementStorePicker({ disabled, onChange, stores, value }: BranchManagementStorePickerProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;

  return (
    <Field className="min-w-0 rounded-lg border border-border bg-card p-4">
      <FieldLabel htmlFor="branch-management-store">{t("nav.store")}</FieldLabel>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="branch-management-store" className="min-h-10 w-full min-w-0 sm:max-w-md">
          <SelectValue placeholder={t("settings.storeBranch.selectStore")} />
        </SelectTrigger>
        <SelectContent position="popper">
          {stores.map((store) => (
            <SelectItem key={store.store_uuid} value={store.store_uuid}>
              {branchManagementStoreLabel(store, language)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription>{t("settings.storeBranch.selectStoreHint")}</FieldDescription>
    </Field>
  );
}
