"use client";

import { useState } from "react";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import { branchContractPackageMonths, contractEndOn } from "@/lib/branch-contract";
import { initialBranchContractValues } from "./branch-contract-form";
import type { StoreBranchLabels, StoreBranchSettingsRow } from "./store-branch-types";

export function BranchContractFields({
  disabled,
  editing,
  editable,
  labels,
  recordKey
}: {
  disabled: boolean;
  editing: StoreBranchSettingsRow | null;
  editable: boolean;
  labels: StoreBranchLabels;
  recordKey: string;
}) {
  const [values, setValues] = useState(() => initialBranchContractValues(editing));
  useResetOnDeps([editing, recordKey], () => {
    setValues(initialBranchContractValues(editing));
  });
  const contractDisabled = disabled || !editable;
  const packageId = `${recordKey}-contract-package`;

  return (
    <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
      <Field>
        <FieldLegend>{labels.contractDetails}</FieldLegend>
        <FieldDescription>{labels.contractHint}</FieldDescription>
      </Field>
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2" data-disabled={contractDisabled || undefined}>
          <FieldLabel htmlFor={packageId}>{labels.contractPackage}</FieldLabel>
          <input name="contract_package_months" type="hidden" value={values.packageMonths} readOnly />
          <Select
            disabled={contractDisabled}
            value={values.packageMonths}
            onValueChange={(packageMonths) => {
              const months = branchContractPackageMonths(packageMonths);
              if (!months) return;
              setValues((previous) => ({
                ...previous,
                packageMonths,
                endOn: contractEndOn(previous.startOn, months)
              }));
            }}
          >
            <SelectTrigger id={packageId} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                <SelectItem value="1">{labels.contractMonthly}</SelectItem>
                <SelectItem value="3">{labels.contractThreeMonths}</SelectItem>
                <SelectItem value="6">{labels.contractSixMonths}</SelectItem>
                <SelectItem value="12">{labels.contractYearly}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${recordKey}-contract-start`}>{labels.contractStartOn}</FieldLabel>
          <Input
            id={`${recordKey}-contract-start`}
            name="contract_start_on"
            type="date"
            disabled={contractDisabled}
            required={!editing}
            value={values.startOn}
            onChange={(event) => {
              const startOn = event.target.value;
              setValues((previous) => ({
                ...previous,
                startOn,
                endOn: contractEndOn(startOn, branchContractPackageMonths(previous.packageMonths) ?? 12)
              }));
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${recordKey}-contract-end`}>{labels.contractEndOn}</FieldLabel>
          <Input
            id={`${recordKey}-contract-end`}
            name="contract_end_on"
            type="date"
            disabled={contractDisabled}
            min={values.startOn || undefined}
            required={!editing}
            value={values.endOn}
            onChange={(event) => setValues((previous) => ({ ...previous, endOn: event.target.value }))}
          />
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}
