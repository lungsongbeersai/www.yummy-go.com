import { readValue, textValue } from "@/lib/values";
import type { ApiEntity } from "@/services/shared/types";

export type ReportBranchOption = {
  label: string;
  value: string;
};

export function branchOptionLabel(branch: ApiEntity, language: string) {
  const keys =
    language === "en"
      ? [
          "branch_name_eng",
          "branch_name",
          "branch_name_la",
          "branch_code",
          "branch_uuid",
        ]
      : [
          "branch_name_la",
          "branch_name",
          "branch_name_eng",
          "branch_code",
          "branch_uuid",
        ];
  return textValue(readValue(branch, keys));
}

export function branchOptionFromRow(
  branch: ApiEntity,
  language: string,
): ReportBranchOption | null {
  const value = textValue(
    readValue(branch, ["branch_uuid", "branch_uuid_fk"]),
    "",
  );
  if (!value) return null;
  return { value, label: branchOptionLabel(branch, language) };
}

export function selectedBranchLabel(
  options: ReportBranchOption[],
  value: string,
  fallback = "-",
) {
  return options.find((option) => option.value === value)?.label ?? fallback;
}
