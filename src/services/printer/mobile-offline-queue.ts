"use client";

import {
  deleteBrowserPrintJob,
  getBrowserPrintJob,
  listBrowserApiCacheEntries,
  listBrowserPrintJobsForEvent,
  listBrowserPrintJobs,
  listBrowserSyncQueue,
  updateBrowserPrintJob,
  updateBrowserSyncEvent,
  type BrowserOfflineIdentity,
  type BrowserOfflineStore,
  type BrowserPrintJobEntry,
  type BrowserPrintLine,
} from "@/services/offline-db";
import type { OfflineCartOrder } from "@/services/offline-order/cart-projection";
import type { Printer } from "@/services/printer/types";

const PRINTER_PATH = "/api/v1/printer/fetch";
const TABLE_PATH = "/api/v1/posAll/fetch_table";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function errorRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function printerErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : text(error) || "Unknown printer error";
}

function printerDeliveryState(error: unknown): "not_sent" | "unknown" {
  const explicit = text(errorRecord(error).delivery_state).toLowerCase();
  return explicit === "unknown" ? "unknown" : "not_sent";
}

function uuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function printerRows(response: unknown): Printer[] {
  const body = record(response);
  const data = body.data;
  const rows = Array.isArray(data) ? data : array(record(data).data);
  return rows.map((row) => record(row) as Printer);
}

function tableDetails(response: unknown, tableUuid: string) {
  const body = record(response);
  const zones = array(body.data).length ? array(body.data) : array(record(body.data).data);
  for (const rawZone of zones) {
    const zone = record(rawZone);
    for (const rawTable of array(zone.tables)) {
      const table = record(rawTable);
      if (text(table.table_uuid) !== tableUuid) continue;
      return {
        name: text(table.table_name) || text(table.table_name_la) || text(table.table_name_eng) || "-",
        zoneUuid: text(table.zone_uuid_fk) || text(zone.zone_uuid),
      };
    }
  }
  return { name: "-", zoneUuid: "" };
}

function roleCodes(printer: Printer) {
  return array(printer.role_codes).map((role) => text(role).toLowerCase());
}

function isKitchenRole(role: string) {
  return /^k-/.test(role) || role === "kitchen" || role.startsWith("kitchen_") ||
    /^b-/.test(role) || role === "bar" || role.startsWith("bar_");
}

function mobilePrinterForDevice(printer: Printer, deviceCode: string) {
  const mode = text(printer.print_mode).toLowerCase();
  const endpoint = text(printer.interface_value).toLowerCase();
  return printer.is_active !== false && endpoint.startsWith("tcp://") &&
    (mode === "mobile_wifi" || printer.is_owner === true) &&
    text(printer.device_code || printer.owner_device_code) === deviceCode;
}

function kitchenPrinterMatches(printer: Printer, categoryUuid: string, zoneUuid: string) {
  if (!roleCodes(printer).some(isKitchenRole)) return false;
  if (!printer.cate_uuid_fk?.map(text).includes(categoryUuid)) return false;
  if (text(printer.mapping_type).toUpperCase() !== "ZONE") return true;
  return Boolean(zoneUuid) && (printer.zone_uuid_fk ?? []).map(text).includes(zoneUuid);
}

function receiptPrinterMatches(printer: Printer) {
  return roleCodes(printer).includes("receipt");
}

function formatMoney(value: unknown) {
  const number = Number(value);
  return `${(Number.isFinite(number) ? number : 0).toLocaleString("en-US")} ₭`;
}

type MobileReceiptPrintItem = {
  name: string;
  qty: number;
  total: number;
};

function mobileReceiptNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.round(number * 1_000_000) / 1_000_000
    : 0;
}

function mobileReceiptPerUnit(value: unknown, qty: number) {
  const number = mobileReceiptNumber(value);
  return qty > 0 ? mobileReceiptNumber(number / qty) : number;
}

function mobileReceiptItemKey(item: OfflineCartOrder["items"][number]) {
  const qty = mobileReceiptNumber(item.qty);
  const detail = item.detail;
  const toppings = item.toppings
    .map((topping) => {
      const values = record(topping);
      return JSON.stringify([
        text(
          values.prod_topping_uuid_fk ||
            values.prod_topping_uuid ||
            topping.topping_name,
        ),
        mobileReceiptNumber(topping.topping_qty),
        mobileReceiptNumber(topping.topping_price),
        mobileReceiptPerUnit(
          values.topping_line_total ?? values.topping_total,
          qty,
        ),
      ]);
    })
    .sort();

  return JSON.stringify([
    text(item.pro_detail_uuid),
    text(item.prod_uuid),
    text(item.prod_name),
    text(detail.size_name),
    mobileReceiptNumber(detail.unit_price),
    text(detail.order_it_note),
    text(detail.order_it_discount_type),
    mobileReceiptNumber(detail.order_it_discount_value),
    mobileReceiptPerUnit(detail.order_it_discount_amount, qty),
    mobileReceiptPerUnit(item.total, qty),
    toppings,
  ]);
}

export function mobileReceiptItemsForPrint(
  items: OfflineCartOrder["items"],
): MobileReceiptPrintItem[] {
  const merged: MobileReceiptPrintItem[] = [];
  const byKey = new Map<string, MobileReceiptPrintItem>();

  items.forEach((item) => {
    const key = mobileReceiptItemKey(item);
    const existing = byKey.get(key);
    if (existing) {
      existing.qty = mobileReceiptNumber(existing.qty + item.qty);
      existing.total = mobileReceiptNumber(existing.total + item.total);
      return;
    }

    const printable = {
      name: item.prod_name,
      qty: mobileReceiptNumber(item.qty),
      total: mobileReceiptNumber(item.total),
    };
    byKey.set(key, printable);
    merged.push(printable);
  });

  return merged;
}

function kitchenLines(tableName: string, order: OfflineCartOrder, itemUuid: string): BrowserPrintLine[] {
  const item = order.items.find((line) => line.order_it_uuid === itemUuid);
  if (!item) return [];
  const now = new Date();
  return [
    { left: tableName, align: "center", size: 44, bold: true },
    { left: `${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString("en-GB")}`, align: "center", size: 23 },
    { left: "----------------------------------------------------------", align: "center", size: 20 },
    { left: item.prod_name, right: `x ${item.qty}`, size: 34, bold: true },
    ...item.toppings.map((topping) => ({
      left: `- ${text(topping.topping_name)}`,
      right: `x ${Number(record(topping).topping_total_qty ?? topping.topping_qty ?? 1)}`,
      size: 26,
    })),
    ...(item.detail.order_it_note ? [{ left: `ໝາຍເຫດ: ${item.detail.order_it_note}`, size: 28, bold: true }] : []),
  ];
}

function receiptLines(tableName: string, order: OfflineCartOrder, data: Record<string, unknown>): BrowserPrintLine[] {
  const cash = Number(data.cash_payment_amount || 0);
  const transfer = Number(data.transfer_payment_amount || 0);
  const paid = cash + transfer;
  return [
    { left: "YUMMY GO", align: "center", size: 36, bold: true },
    { left: "ໃບຮັບເງິນ / RECEIPT", align: "center", size: 28, bold: true },
    { left: `ເລກບິນ: ${order.order_invoice || "-"}`, size: 24 },
    { left: `ໂຕະ: ${tableName}`, size: 24 },
    { left: "----------------------------------------------------------", align: "center", size: 20 },
    ...mobileReceiptItemsForPrint(order.items).map((item) => ({
      left: `${item.name} x ${item.qty}`,
      right: formatMoney(item.total),
      size: 24,
    })),
    { left: "----------------------------------------------------------", align: "center", size: 20 },
    { left: "ລວມຕ້ອງຊໍາລະ", right: formatMoney(order.grand_total), size: 28, bold: true },
    ...(cash > 0 ? [{ left: "ຮັບເງິນສົດ", right: formatMoney(cash), size: 24 }] : []),
    ...(transfer > 0 ? [{ left: "ເງິນໂອນ", right: formatMoney(transfer), size: 24 }] : []),
    ...(paid > 0 ? [{ left: "ເງິນທອນ", right: formatMoney(data.change_amount), size: 24 }] : []),
    { left: "Thank you", align: "center", size: 24 },
  ];
}

async function cachedPrinterContext(
  scope: BrowserOfflineIdentity,
  tableUuid: string,
  store?: BrowserOfflineStore,
) {
  const [printerEntries, tableEntries] = await Promise.all([
    listBrowserApiCacheEntries(scope, PRINTER_PATH, store),
    listBrowserApiCacheEntries(scope, TABLE_PATH, store),
  ]);
  if (!printerEntries.length) throw new Error("MOBILE_OFFLINE_PRINTER_CONFIG_NOT_PREPARED");
  const printers = printerRows(printerEntries.at(-1)?.response);
  const table = tableEntries.reduce(
    (found, entry) => found.name !== "-" ? found : tableDetails(entry.response, tableUuid),
    { name: "-", zoneUuid: "" },
  );
  return { printers, table };
}

export async function planMobileOfflinePrintJobs(input: {
  eventUuid: string;
  operation: "KITCHEN_CONFIRM" | "PAYMENT";
  scope: BrowserOfflineIdentity;
  data: Record<string, unknown>;
  order: OfflineCartOrder;
  deviceCode: string;
  store?: BrowserOfflineStore;
}) {
  const existing = await listBrowserPrintJobsForEvent(input.eventUuid, input.scope, input.store);
  if (existing.length) return existing;
  const tableUuid = text(input.order.table_uuid_fk || input.data.table_uuid || input.data.table_uuid_fk);
  const { printers, table } = await cachedPrinterContext(input.scope, tableUuid, input.store);
  const eligible = printers.filter((printer) => mobilePrinterForDevice(printer, input.deviceCode));
  const now = Date.now();
  const jobs: BrowserPrintJobEntry[] = [];
  const addJob = (printer: Printer, orderItemUuids: string[], lines: BrowserPrintLine[], documentType: "KITCHEN" | "RECEIPT") => {
    jobs.push({
      printJobUuid: uuid(),
      eventUuid: input.eventUuid,
      storeUuid: input.scope.storeUuid,
      branchUuid: input.scope.branchUuid,
      actorLoginUuid: input.scope.actorLoginUuid,
      orderUuid: input.order.order_uuid,
      orderItemUuids,
      documentType,
      printConfigUuid: text(printer.print_config_uuid),
      interfaceValue: text(printer.interface_value),
      printerName: text(printer.printer_name),
      paperWidthMm: Number(printer.paper_width_mm) === 58 ? 58 : 80,
      openCashDrawer: documentType === "RECEIPT" && printer.cash_drawer_enabled !== false,
      lines,
      status: "PENDING",
      attempts: 0,
      lastError: null,
      createdAt: now + jobs.length,
      updatedAt: now,
    });
  };

  if (input.operation === "PAYMENT") {
    const required = printers.filter((printer) => printer.is_active !== false && receiptPrinterMatches(printer));
    if (required.some((printer) => !eligible.includes(printer))) {
      throw new Error("MOBILE_OFFLINE_REMOTE_RECEIPT_PRINTER_REQUIRED");
    }
    for (const printer of required) {
      addJob(printer, [], receiptLines(table.name, input.order, input.data), "RECEIPT");
    }
    return jobs;
  }

  const requested = array(input.data.order_item_uuids).map(text).filter(Boolean);
  const itemUuids = requested.length ? requested : input.order.items
    .filter((item) => item.detail.order_it_status <= 1).map((item) => item.order_it_uuid);
  for (const itemUuid of itemUuids) {
    const item = input.order.items.find((line) => line.order_it_uuid === itemUuid);
    if (!item?.cate_uuid_fk) throw new Error("MOBILE_OFFLINE_PRODUCT_ROUTING_NOT_PREPARED");
    const required = printers.filter((candidate) =>
      candidate.is_active !== false && kitchenPrinterMatches(candidate, item.cate_uuid_fk, table.zoneUuid));
    if (required.some((printer) => !eligible.includes(printer))) {
      throw new Error("MOBILE_OFFLINE_REMOTE_KITCHEN_PRINTER_REQUIRED");
    }
    for (const printer of required) {
      addJob(printer, [itemUuid], kitchenLines(table.name, input.order, itemUuid), "KITCHEN");
    }
  }
  return jobs;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function concatBytes(parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

function wrapText(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  const words = [...value];
  const rows: string[] = [];
  let current = "";
  for (const character of words) {
    if (context.measureText(current + character).width <= maxWidth) current += character;
    else { if (current) rows.push(current); current = character; }
  }
  if (current || !rows.length) rows.push(current);
  return rows;
}

function rasterBand(image: ImageData, startY: number, height: number) {
  const widthBytes = Math.ceil(image.width / 8);
  const data = new Uint8Array(widthBytes * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const source = ((startY + y) * image.width + x) * 4;
      const alpha = image.data[source + 3] / 255;
      const luminance = (image.data[source] * 0.299 + image.data[source + 1] * 0.587 + image.data[source + 2] * 0.114) * alpha + 255 * (1 - alpha);
      if (luminance < 160) data[y * widthBytes + Math.floor(x / 8)] |= 0x80 >> (x % 8);
    }
  }
  return concatBytes([
    new Uint8Array([0x1d, 0x76, 0x30, 0x00, widthBytes & 0xff, (widthBytes >> 8) & 0xff, height & 0xff, (height >> 8) & 0xff]),
    data,
  ]);
}

export async function renderBrowserPrintJob(job: BrowserPrintJobEntry) {
  if (typeof document === "undefined") throw new Error("MOBILE_PRINT_CANVAS_UNAVAILABLE");
  await document.fonts?.ready;
  const width = job.paperWidthMm === 58 ? 384 : 576;
  const margin = job.paperWidthMm === 58 ? 14 : 20;
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("MOBILE_PRINT_CANVAS_UNAVAILABLE");
  const rendered = job.lines.map((line) => {
    const size = Math.max(18, Math.min(48, Number(line.size || 24)));
    measure.font = `${line.bold ? "700" : "400"} ${size}px \"Noto Sans Lao\", \"Phetsarath OT\", sans-serif`;
    const rightWidth = line.right ? measure.measureText(line.right).width + 16 : 0;
    return { ...line, size, rows: wrapText(measure, line.left, width - margin * 2 - rightWidth) };
  });
  const height = Math.max(80, rendered.reduce((total, line) => total + line.rows.length * (line.size + 9), 0) + 24);
  if (height > 30000) throw new Error("MOBILE_PRINT_DOCUMENT_TOO_LONG");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("MOBILE_PRINT_CANVAS_UNAVAILABLE");
  context.fillStyle = "white";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "black";
  let y = 10;
  for (const line of rendered) {
    context.font = `${line.bold ? "700" : "400"} ${line.size}px \"Noto Sans Lao\", \"Phetsarath OT\", sans-serif`;
    context.textBaseline = "top";
    for (const [rowIndex, row] of line.rows.entries()) {
      const rowWidth = context.measureText(row).width;
      const x = line.align === "center" ? (width - rowWidth) / 2 : line.align === "right" ? width - margin - rowWidth : margin;
      context.fillText(row, x, y);
      if (line.right && rowIndex === 0) context.fillText(line.right, width - margin - context.measureText(line.right).width, y);
      y += line.size + 9;
    }
  }
  const image = context.getImageData(0, 0, width, height);
  const commands: Uint8Array[] = [new Uint8Array([0x1b, 0x40])];
  if (job.openCashDrawer) commands.push(new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]));
  for (let startY = 0; startY < height; startY += 24) {
    commands.push(rasterBand(image, startY, Math.min(24, height - startY)));
  }
  commands.push(new Uint8Array([0x1b, 0x64, 0x08, 0x1d, 0x56, 0x42, 0x00]));
  return bytesToBase64(concatBytes(commands));
}

async function executeBrowserPrintJobNow(
  printJobUuid: string,
  onProgress?: (progress: { total: number; completed: number; successCount: number; failedCount: number; phase: "fetching" | "printing" | "done" }) => void,
  store?: BrowserOfflineStore,
) {
  const first = await getBrowserPrintJob(printJobUuid, store);
  if (!first) return null;
  const jobs = await listBrowserPrintJobsForEvent(first.eventUuid, first, store);
  const uncertain = jobs.filter((job) => job.status === "UNCERTAIN");
  if (uncertain.length) return { successCount: 0, failedCount: 0, total: jobs.length, pending: true, errorMessage: uncertain[0].lastError ?? undefined };
  let successCount = jobs.filter((job) => job.status === "PRINTED").length;
  let failedCount = 0;
  onProgress?.({ total: jobs.length, completed: successCount, successCount, failedCount, phase: "printing" });
  for (const job of jobs) {
    if (job.status === "PRINTED") continue;
    if (job.status === "PRINTING") {
      await updateBrowserPrintJob(job.printJobUuid, { status: "UNCERTAIN", lastError: "APP_CLOSED_DURING_PRINT" }, store);
      return { successCount, failedCount, total: jobs.length, pending: true, errorMessage: "APP_CLOSED_DURING_PRINT" };
    }
    await updateBrowserPrintJob(job.printJobUuid, { status: "PRINTING", lastError: null, incrementAttempts: true }, store);
    try {
      const escposBase64 = await renderBrowserPrintJob(job);
      const { printMobileEscposOverTcp } = await import("./mobile-tcp");
      await printMobileEscposOverTcp({
        interface_value: job.interfaceValue,
        escpos_base64: escposBase64,
        require_completion_confirmation: job.documentType === "KITCHEN",
      });
      await updateBrowserPrintJob(job.printJobUuid, { status: "PRINTED", lastError: null }, store);
      successCount += 1;
    } catch (error) {
      const delivery = printerDeliveryState(error);
      const message = printerErrorMessage(error);
      await updateBrowserPrintJob(job.printJobUuid, {
        status: delivery === "unknown" ? "UNCERTAIN" : "FAILED",
        lastError: message,
      }, store);
      if (delivery === "unknown") return { successCount, failedCount, total: jobs.length, pending: true, errorMessage: message };
      failedCount += 1;
      break;
    }
    onProgress?.({ total: jobs.length, completed: successCount + failedCount, successCount, failedCount, phase: "printing" });
  }
  if (jobs.every((job) => job.documentType !== "KITCHEN") || successCount === jobs.length) {
    await updateBrowserSyncEvent(first.eventUuid, { status: "PENDING", lastError: null }, store);
  }
  onProgress?.({ total: jobs.length, completed: successCount + failedCount, successCount, failedCount, phase: "done" });
  return { successCount, failedCount, total: jobs.length, ...(failedCount ? { errorMessage: "MOBILE_PRINT_FAILED" } : {}) };
}

const browserPrintExecutions = new Map<string, Promise<Awaited<ReturnType<typeof executeBrowserPrintJobNow>>>>();

const PRINTED_JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function browserPrintRetryDelayMs(attempts: number) {
  const exponent = Math.max(0, Math.min(4, Math.floor(attempts) - 1));
  return 30_000 * (2 ** exponent);
}

export async function executeBrowserPrintJob(
  printJobUuid: string,
  onProgress?: Parameters<typeof executeBrowserPrintJobNow>[1],
  store?: BrowserOfflineStore,
) {
  const job = await getBrowserPrintJob(printJobUuid, store);
  if (!job) return null;
  const running = browserPrintExecutions.get(job.eventUuid);
  if (running) return running;
  const execution = executeBrowserPrintJobNow(printJobUuid, onProgress, store);
  browserPrintExecutions.set(job.eventUuid, execution);
  const cleanup = () => {
    if (browserPrintExecutions.get(job.eventUuid) === execution) browserPrintExecutions.delete(job.eventUuid);
  };
  void execution.then(cleanup, cleanup);
  return execution;
}

/** Durable spooler used after an app restart and while the internet is down. */
export async function drainBrowserPrintQueue(
  scope: BrowserOfflineIdentity,
  store?: BrowserOfflineStore,
) {
  const now = Date.now();
  const jobs = await listBrowserPrintJobs(scope, store);
  const queue = await listBrowserSyncQueue(scope, store);
  const eventStatus = new Map(queue.map((entry) => [entry.eventUuid, entry.status]));
  for (const job of jobs) {
    if (job.status === "PRINTED" && now - job.updatedAt >= PRINTED_JOB_RETENTION_MS &&
      (eventStatus.get(job.eventUuid) === "SYNCED" || !eventStatus.has(job.eventUuid))) {
      await deleteBrowserPrintJob(job.printJobUuid, store);
    }
  }
  const eventUuids = [...new Set(jobs
    .filter((job) => job.status === "PENDING" || job.status === "PRINTING" ||
      (job.status === "FAILED" && now - job.updatedAt >= browserPrintRetryDelayMs(job.attempts)))
    .map((job) => job.eventUuid))];
  for (const eventUuid of eventUuids) {
    const job = jobs.find((candidate) => candidate.eventUuid === eventUuid);
    if (job) await executeBrowserPrintJob(job.printJobUuid, undefined, store);
  }
}
