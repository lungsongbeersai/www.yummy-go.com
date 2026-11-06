import type { Printer } from "@/services/printer";
import { isLanSharedPrinter } from "@/lib/printer-list-mode";
import { printerHealth, type PrinterHealth, type PrinterSummary } from "./printer-page-utils";

export type PrinterListScope = "here" | "saved";
export interface PrinterListNetworkVisibility {
  state: "local" | "unknown";
  reason: string;
}
export type PrinterListNetworkMap = Readonly<Record<string, PrinterListNetworkVisibility>>;

interface PrinterListPresentationState {
  catalog: Printer[];
  networkVisibilityByPrinter: PrinterListNetworkMap;
  loading: boolean;
  checkingNetwork: boolean;
  error: string | null;
  scopeKey: string;
}

const EMPTY_CATALOG: Printer[] = [];
const EMPTY_NETWORK: PrinterListNetworkMap = {};

export function printerListPresentation(state: PrinterListPresentationState, expectedScopeKey: string) {
  if (state.scopeKey === expectedScopeKey) return state;
  // Auth/device can change before the next effect begins its Agent request.
  // No previous scope's DIRECT/INTERNET rows or error may appear in that gap.
  return {
    catalog: EMPTY_CATALOG,
    networkVisibilityByPrinter: EMPTY_NETWORK,
    loading: true,
    checkingNetwork: false,
    error: null,
    scopeKey: expectedScopeKey,
  };
}

export function printerListNetworkState(printer: Printer, network: PrinterListNetworkMap) {
  return isLanSharedPrinter(printer) ? network[printer.print_config_uuid]?.state ?? "unknown" : null;
}

export function isUnverifiedLanPrinter(printer: Printer, network: PrinterListNetworkMap) {
  return printerListNetworkState(printer, network) === "unknown";
}

export function canManuallyTestListedPrinter(
  printer: Printer,
  operationalPrinters: readonly Pick<Printer, "print_config_uuid">[],
  network: PrinterListNetworkMap,
) {
  // Manual actions resolve their selected UUID through the operational store.
  // A management-only row must never fall through to another active printer.
  return Boolean(printer.print_config_uuid.trim()) &&
    !isUnverifiedLanPrinter(printer, network) &&
    operationalPrinters.some((row) => row.print_config_uuid === printer.print_config_uuid);
}

export function printersInListScope(
  printers: readonly Printer[],
  scope: PrinterListScope,
  network: PrinterListNetworkMap,
) {
  return printers.filter((printer) => scope === "saved" || !isUnverifiedLanPrinter(printer, network));
}

export function printerListHealth(printer: Printer, network: PrinterListNetworkMap): PrinterHealth {
  if (!printer.is_active) return "disabled";
  return isUnverifiedLanPrinter(printer, network) ? "unreachable" : printerHealth(printer);
}

export function summarizePrinterList(printers: readonly Printer[], network: PrinterListNetworkMap): PrinterSummary {
  return printers.reduce<PrinterSummary>((summary, printer) => ({
    total: summary.total + 1,
    active: summary.active + Number(printer.is_active),
    inactive: summary.inactive + Number(!printer.is_active),
    attention: summary.attention + Number(printerListHealth(printer, network) === "unreachable"),
  }), { total: 0, active: 0, inactive: 0, attention: 0 });
}
