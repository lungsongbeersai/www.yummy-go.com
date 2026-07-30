import type { PaymentMethodReportFilter } from "@/config/report-filters";
import type { PageLimit } from "@/services/shared/types";
import type {
  PaymentMethodReportRow,
  PaymentMethodSummaryCard,
  PaymentMethodsReportExportData
} from "@/stores/report-store";

export type PaymentMethodsReportFilters = {
  branchUuid: string;
  dateFrom: string;
  dateTo: string;
  limit: PageLimit;
  paymentMethod: PaymentMethodReportFilter;
};

export type PaymentMethodsOption = {
  label: string;
  value: string;
};

export type PaymentMethodsMetricKind = "money" | "number";

export type PaymentMethodsMetricConfig = {
  key: string;
  kind: PaymentMethodsMetricKind;
  label: string;
};

export type PaymentMethodsRowMetricConfig = PaymentMethodsMetricConfig & {
  field: keyof PaymentMethodReportRow;
  // คีย์ของตัวเลขเดียวกันในก้อน summary ที่ backend ส่งมา — ชื่อไม่ตรงกับ key ของแถวทุกตัว
  // (service_charge vs sum_servicecharge, vat vs sum_vate) จึงต้องผูกไว้ให้ชัดตรงนี้
  // ยอดรวมอ่านจากค่านี้เสมอ ห้ามบวกแถวเอาเองที่ frontend
  summaryKey: string;
};

export type PaymentMethodsSummaryCard = PaymentMethodSummaryCard;

export type PaymentMethodsExportAction = "excel" | "pdf" | "print";

export type PaymentMethodsExportData = PaymentMethodsReportExportData;
