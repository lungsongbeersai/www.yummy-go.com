// Thin barrel re-exporting the printer service's full public surface.
// The implementation lives in src/services/printer/{types,config-api,
// agent-transport,print-jobs}.ts (P3.4 split) — kept as a barrel so
// printer-store.ts and every other importer needs zero changes.
export { AGENT_URL } from "@/config/printer-agent";
export {
  getPrinterErrorMessage,
  parseInterfaceValue,
  tcpInterfaceValue
} from "@/services/printer/helpers";
export {
  BROWSER_PRINTER_AGENT_ID,
  BROWSER_PRINTER_AGENT_URL,
  isBrowserPrinterAgentId
} from "@/services/printer/browser-device";

export type {
  AckAppliedItem,
  AckPayload,
  AckResponse,
  AckResultItem,
  AgentFile,
  AgentFilesResponse,
  AgentInfo,
  BuildTestJobRequest,
  BuildTestJobResponse,
  CategoryRole,
  CheckPrinterAgentConnectionResult,
  DefaultCategoryByRoleData,
  DefaultCategoryByRoleInput,
  DefaultCategoryByRoleResponse,
  DefaultCategoryCategoryDetail,
  DefaultCategoryGroup,
  DefaultCategoryGroupDetail,
  DefaultCategoryZoneDetail,
  ExecuteInvoicePrintInput,
  ExecuteKitchenPrintInput,
  ExecuteReportPrintInput,
  FetchPrinterResponse,
  FetchPrintersForLocalAgentParams,
  FetchPrintersParams,
  KitchenPrintResult,
  MobileEscposPayload,
  PendingPrintItem,
  PendingPrintJobData,
  PendingPrintJobsParams,
  PendingPrintJobsResponse,
  PendingPrintJobsResult,
  PrintAckPayload,
  PrintJob,
  PrintOpsAgentResponse,
  PrintOpsBatchAgentResponse,
  PrintOpsBatchPayload,
  PrintProgress,
  Printer,
  PrinterCategory,
  PrinterCategoryItem,
  PrinterCategoryRole,
  PrinterDeviceContext,
  PrinterDeviceContextParams,
  PrinterMappingType,
  PrinterRole,
  PrinterRolesResponse,
  PrinterSharingMode,
  PrinterZone,
  ResolvedPrinter,
  SaveCategoryPrinterInput,
  SaveCategoryRoleInput,
  SavePrinterInput,
  SavePrinterResponse,
  SearchPrinterResult
} from "@/services/printer/types";

export {
  buildTestJob,
  deletePrinter,
  fetchPrinterCategoryRole,
  getAgentFiles,
  getCategoryRoles,
  getDefaultCategoryByRole,
  getPrinterOptions,
  getPrinterRoles,
  getPrinters,
  renderMobileEscpos,
  resolvePrintersByCategory,
  saveCategoryPrinter,
  saveCategoryRole,
  savePrinter,
  searchPrinters,
  sendMobileBackendPrintJob,
  togglePrinterActive
} from "@/services/printer/config-api";

export {
  checkPrinterAgentConnection,
  dispatchPrintJob,
  getLocalPrinterAgentInfo,
  printBatchWithLocalAgent,
  printWithLocalAgent,
  resolvePrinterDeviceContext,
  resolvePrinterDeviceIdentity
} from "@/services/printer/agent-transport";

export {
  ackPrintJob,
  executeInvoicePrintJobs,
  executeKitchenPrintJobs,
  executeReportPrintJobs,
  getPendingPrintJobs
} from "@/services/printer/print-jobs";
