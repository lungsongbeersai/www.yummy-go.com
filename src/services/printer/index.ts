// Public surface of the printer service; the implementation is split by concern
// into the sibling modules (types, config-api, agent-transport, print-jobs).
// Importers use "@/services/printer" and never reach into the submodules.
export { AGENT_URL } from "@/config/printer-agent";
export {
  getPrinterErrorMessage,
  getRoleColor,
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
  DefaultCategoryByRoleInput,
  DefaultCategoryByRoleResponse,
  DefaultCategoryGroup,
  DefaultCategoryGroupDetail,
  ExecuteInvoicePrintInput,
  ExecuteKitchenPrintInput,
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
  PrinterRole,
  PrinterRolesResponse,
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
  getPendingPrintJobs
} from "@/services/printer/print-jobs";
