import type { PrintJob } from "@/services/printer";
import type { PrintInvoiceResponse } from "@/services/pos/types";

export function isPrintableJob(value: unknown): value is PrintJob {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as { ops?: unknown }).ops)
  );
}

export function getPrintableJob(value: unknown): PrintJob | null {
  if (isPrintableJob(value)) return value;
  if (!value || typeof value !== "object") return null;

  const record = value as {
    job?: unknown;
    jobs?: unknown[];
    new_order?: { job?: unknown };
    payload?: unknown;
    source_order?: { job?: unknown };
  };

  if (Array.isArray(record.jobs)) {
    for (const item of record.jobs) {
      const job = getPrintableJob(item);
      if (job) return job;
    }
  }

  return (
    getPrintableJob(record.job) ??
    getPrintableJob(record.source_order?.job) ??
    getPrintableJob(record.new_order?.job) ??
    (record.payload === value ? null : getPrintableJob(record.payload))
  );
}

export function getPrintInvoiceJob(response: PrintInvoiceResponse) {
  return getPrintableJob(response.print_job);
}
