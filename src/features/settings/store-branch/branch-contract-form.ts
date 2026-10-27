import {
  branchContractPackageMonths,
  contractEndOn,
  contractToday
} from "@/lib/branch-contract";
import type { StoreBranchRow } from "./store-branch-utils";

export interface BranchContractFormValues {
  startOn: string;
  endOn: string;
  packageMonths: string;
}

export type BranchContractFormError = "dates" | "range" | "package" | null;

function dateValue(value: unknown) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

export function initialBranchContractValues(editing: StoreBranchRow): BranchContractFormValues {
  if (!editing) {
    const startOn = contractToday();
    return { startOn, endOn: contractEndOn(startOn, 12), packageMonths: "12" };
  }
  return {
    startOn: dateValue(editing.contract_start_on),
    endOn: dateValue(editing.contract_end_on),
    packageMonths: String(branchContractPackageMonths(editing.contract_package_months) ?? 12)
  };
}

export function branchContractFormValues(formData: FormData): BranchContractFormValues {
  return {
    startOn: String(formData.get("contract_start_on") ?? "").trim(),
    endOn: String(formData.get("contract_end_on") ?? "").trim(),
    packageMonths: String(formData.get("contract_package_months") ?? "").trim()
  };
}

export function hasBranchContractChanges(editing: StoreBranchRow, values: BranchContractFormValues) {
  if (!editing) return true;
  const previous = initialBranchContractValues(editing);
  return previous.startOn !== values.startOn || previous.endOn !== values.endOn ||
    previous.packageMonths !== values.packageMonths;
}

export function branchContractFormError(
  editing: StoreBranchRow,
  values: BranchContractFormValues,
  editable: boolean
): BranchContractFormError {
  if (!editable || !hasBranchContractChanges(editing, values)) return null;
  if (!branchContractPackageMonths(values.packageMonths)) return "package";
  if (!contractEndOn(values.startOn, 1) || !contractEndOn(values.endOn, 1)) return "dates";
  if (values.endOn < values.startOn) return "range";
  return null;
}
