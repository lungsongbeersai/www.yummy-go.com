"use client";

import { useTranslation } from "react-i18next";
import { ReportSelectField } from "./report-filter-fields";
import type { ReportLocationOption } from "./report-location";

export function ReportLocationFields({
  branchUuid,
  disabled,
  fieldClassName,
  idPrefix,
  loading,
  tableOptions,
  tableUuid,
  zoneOptions,
  zoneUuid,
  onTableChange,
  onZoneChange,
}: {
  branchUuid: string;
  disabled?: boolean;
  fieldClassName?: string;
  idPrefix: string;
  loading: boolean;
  tableOptions: ReportLocationOption[];
  tableUuid: string;
  zoneOptions: ReportLocationOption[];
  zoneUuid: string;
  onTableChange: (tableUuid: string) => void;
  onZoneChange: (zoneUuid: string) => void;
}) {
  const { t } = useTranslation();
  const fieldsDisabled = disabled || !branchUuid || loading;

  return (
    <>
      <ReportSelectField
        disabled={fieldsDisabled}
        fieldClassName={fieldClassName}
        id={`${idPrefix}-zone`}
        label={t("report.filters.zone")}
        options={zoneOptions}
        placeholder={t("report.filters.allZones")}
        value={zoneUuid}
        onValueChange={onZoneChange}
      />
      <ReportSelectField
        disabled={fieldsDisabled}
        fieldClassName={fieldClassName}
        id={`${idPrefix}-table`}
        label={t("report.filters.table")}
        options={tableOptions}
        placeholder={t("report.filters.allTables")}
        value={tableUuid}
        onValueChange={onTableChange}
      />
    </>
  );
}
