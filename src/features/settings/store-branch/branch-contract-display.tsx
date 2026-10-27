import { Badge } from "@/components/ui/badge";
import { branchContractPackageMonths } from "@/lib/branch-contract";
import { branchContractDateLabel, branchContractDaysRemaining, storeBranchValue } from "./store-branch-utils";
import type { StoreBranchLabels, StoreBranchSettingsRow } from "./store-branch-types";

export function BranchContractDate({ row, field, language, labels }: {
  row: StoreBranchSettingsRow;
  field: "contract_start_on" | "contract_end_on";
  language: string;
  labels: StoreBranchLabels;
}) {
  const value = storeBranchValue(row, field);
  return <span className="tabular-nums">{value ? branchContractDateLabel(value, language) || value : labels.dateUnavailable}</span>;
}

export function BranchContractPackage({ row, labels }: { row: StoreBranchSettingsRow; labels: StoreBranchLabels }) {
  const months = branchContractPackageMonths(row.contract_package_months);
  const label = months === 1 ? labels.contractMonthly
    : months === 3 ? labels.contractThreeMonths
      : months === 6 ? labels.contractSixMonths
        : months === 12 ? labels.contractYearly : labels.dateUnavailable;
  return <Badge variant="secondary">{label}</Badge>;
}

export function BranchContractEnd({ row, language, labels }: {
  row: StoreBranchSettingsRow;
  language: string;
  labels: StoreBranchLabels;
}) {
  const days = branchContractDaysRemaining(row);
  const status = days === null ? null : days === 0 ? labels.dueToday
    : days > 0 ? `${days.toLocaleString("en-US")} ${labels.daysRemaining}`
      : `${Math.abs(days).toLocaleString("en-US")} ${labels.daysOverdue}`;
  return (
    <span className="flex flex-col items-start gap-1">
      <BranchContractDate row={row} field="contract_end_on" language={language} labels={labels} />
      {status && days !== null ? days < 0 ? (
        <Badge variant="destructive">{status}</Badge>
      ) : days <= 30 ? (
        <Badge className="bg-warning/15 text-warning-text">{status}</Badge>
      ) : <span className="text-muted-foreground tabular-nums">{status}</span> : null}
    </span>
  );
}
