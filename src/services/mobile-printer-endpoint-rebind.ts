"use client";

import type {
  BrowserOfflineScope,
  BrowserOfflineStore,
  BrowserPrintJobEntry,
} from "@/services/offline-db";
import {
  listBrowserPrintJobs,
  updateBrowserPrintJob,
} from "@/services/offline-db";

interface PrinterEndpoint {
  printConfigUuid: string;
  printerName: string;
  interfaceValue: string;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function responseRows(response: unknown) {
  const wrapper = record(response);
  const payload = wrapper.data ?? response;
  if (Array.isArray(payload)) return payload;
  const nested = record(payload).data;
  return Array.isArray(nested) ? nested : [];
}

function printerEndpoints(response: unknown): PrinterEndpoint[] {
  return responseRows(response).flatMap((value) => {
    const row = record(value);
    const printConfigUuid = text(row.print_config_uuid);
    const printerName = text(row.printer_name ?? row.display_name);
    const interfaceValue = text(row.interface_value);
    if (
      row.is_active === false ||
      !printConfigUuid ||
      !printerName ||
      !/^tcp:\/\/[^:/]+:\d+$/i.test(interfaceValue)
    ) return [];
    return [{ printConfigUuid, printerName, interfaceValue }];
  });
}

function uniqueEndpointsByName(endpoints: PrinterEndpoint[]) {
  const grouped = new Map<string, PrinterEndpoint[]>();
  for (const endpoint of endpoints) {
    const key = endpoint.printerName.toLocaleLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), endpoint]);
  }
  return new Map(
    [...grouped.entries()].flatMap(([name, rows]) => rows.length === 1
      ? [[name, rows[0]] as const]
      : []),
  );
}

function retryable(job: BrowserPrintJobEntry) {
  // FAILED is used only when the TCP connect/send never started. Once delivery
  // might have begun the spooler records UNCERTAIN, which must never be rebound
  // or retried automatically because that could emit a duplicate kitchen slip.
  return job.status === "PENDING" || job.status === "FAILED";
}

/**
 * Refreshes durable mobile print work after an operator changes a printer IP.
 * The config UUID is authoritative. A unique exact printer name is the safe
 * fallback for older edits that recreated the config with a fresh UUID.
 */
export async function rebindRetryableMobilePrintEndpoints(
  scope: BrowserOfflineScope,
  printerResponse: unknown,
  browserStore?: BrowserOfflineStore,
) {
  const endpoints = printerEndpoints(printerResponse);
  if (!endpoints.length) return 0;
  const byUuid = new Map(endpoints.map((row) => [row.printConfigUuid, row]));
  const byUniqueName = uniqueEndpointsByName(endpoints);
  const jobs = await listBrowserPrintJobs(scope, browserStore);
  let rebound = 0;

  for (const job of jobs) {
    if (!retryable(job)) continue;
    const endpoint = byUuid.get(job.printConfigUuid) ??
      byUniqueName.get(job.printerName.toLocaleLowerCase());
    if (!endpoint) continue;
    if (
      job.interfaceValue === endpoint.interfaceValue &&
      job.printConfigUuid === endpoint.printConfigUuid
    ) continue;

    await updateBrowserPrintJob(job.printJobUuid, {
      status: "PENDING",
      lastError: null,
      interfaceValue: endpoint.interfaceValue,
      printConfigUuid: endpoint.printConfigUuid,
    }, browserStore);
    rebound += 1;
  }

  return rebound;
}
