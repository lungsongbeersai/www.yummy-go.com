"use client";

import { useTranslation } from "react-i18next";
import type { ReportExcelLayout } from "./excel";

type Translate = (key: string) => string;

export function officialReportExcelLayout(
  t: Translate,
  title?: string,
): ReportExcelLayout {
  return {
    headerLines: [
      t("report.officialHeader.line1"),
      t("report.officialHeader.line2"),
    ],
    signatures: {
      owner: t("report.signatures.shopOwner"),
      preparer: t("report.signatures.reportPreparer"),
    },
    title,
  };
}

export function ReportOfficialHeader() {
  const { t } = useTranslation();

  return (
    <div
      className="report-print-official-header"
      style={{ marginBottom: 18, textAlign: "center", width: "100%" }}
    >
      <p style={{ margin: 0, textAlign: "center", width: "100%" }}>
        {t("report.officialHeader.line1")}
      </p>
      <p style={{ margin: 0, textAlign: "center", width: "100%" }}>
        {t("report.officialHeader.line2")}
      </p>
    </div>
  );
}

export function ReportSignatures() {
  const { t } = useTranslation();

  return (
    <div
      className="report-print-signatures"
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 56,
        pageBreakInside: "avoid",
        width: "100%",
      }}
    >
      <ReportSignature align="left" label={t("report.signatures.reportPreparer")} />
      <ReportSignature align="right" label={t("report.signatures.shopOwner")} />
    </div>
  );
}

function ReportSignature({
  align,
  label,
}: {
  align: "left" | "right";
  label: string;
}) {
  return (
    <div
      className="report-print-signature"
      style={{
        display: "grid",
        gap: 52,
        justifyItems: align === "left" ? "start" : "end",
        textAlign: align,
        width: "40%",
      }}
    >
      <strong>{label}</strong>
      <span aria-hidden="true" style={{ margin: 0, width: "70%" }} />
    </div>
  );
}
