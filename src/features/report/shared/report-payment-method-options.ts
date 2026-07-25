import {
  PAYMENT_METHOD_REPORT_FILTER_OPTIONS,
  type PaymentMethodReportFilter,
} from "@/config/report-filters";

export interface PaymentMethodFallbackOption {
  label: string;
  sortOrder: number;
  value: PaymentMethodReportFilter;
}

// รายการช่องทางชำระเงินสำรอง ใช้ก่อนที่ backend จะส่งรายการจริงมา (หรือรายงานที่ไม่มี
// รายการจาก backend เลย เช่น category sales)
export function paymentMethodFallbackOptions(
  t: (key: string) => string,
): PaymentMethodFallbackOption[] {
  return PAYMENT_METHOD_REPORT_FILTER_OPTIONS.map((value, index) => ({
    label: value === "all" ? t("common.all") : t(`report.paymentMethods.${value}`),
    sortOrder: index + 1,
    value,
  }));
}

export function selectedPaymentMethodLabel(
  options: { label: string; value: PaymentMethodReportFilter }[],
  value: PaymentMethodReportFilter,
  t: (key: string) => string,
) {
  return options.find((option) => option.value === value)?.label ?? t("common.all");
}
