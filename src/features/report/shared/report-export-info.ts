// Header rows shared by every report's Excel/PDF export file.
export function exportInfoRows(
  t: (key: string) => string,
  input: {
    branchLabel?: string;
    dateFrom: string;
    dateTo: string;
    paymentMethodLabel?: string;
    typeLabel?: string;
  },
) {
  return [
    ...(input.typeLabel
      ? [{ Metric: t("report.filters.typePage"), Value: input.typeLabel }]
      : []),
    ...(input.branchLabel
      ? [{ Metric: t("dashboard.branch"), Value: input.branchLabel }]
      : []),
    {
      Metric: t("report.reportDate"),
      Value: `${input.dateFrom} - ${input.dateTo}`,
    },
    ...(input.paymentMethodLabel
      ? [
          {
            Metric: t("report.filters.paymentMethod"),
            Value: input.paymentMethodLabel,
          },
        ]
      : []),
  ];
}
