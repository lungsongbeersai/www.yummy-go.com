import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTestJob,
  dispatchPrintJob,
  resolvePrinterDeviceIdentity,
  type BuildTestJobResponse
} from "@/services/printer";
import { usePrinterStore } from "@/stores/printer-store";

vi.mock("@/services/printer", () => ({
  ackPrintJob: vi.fn(),
  buildTestJob: vi.fn(),
  deletePrinter: vi.fn(),
  dispatchPrintJob: vi.fn(),
  executeKitchenPrintJobs: vi.fn(),
  fetchPrinterCategoryRole: vi.fn(),
  getAgentFiles: vi.fn(),
  getCategoryRoles: vi.fn(),
  getDefaultCategoryByRole: vi.fn(),
  getPendingPrintJobs: vi.fn(),
  getPrinterOptions: vi.fn(),
  getPrinterRoles: vi.fn(),
  getPrinters: vi.fn(),
  printTableQRJob: vi.fn(),
  resolvePrinterDeviceIdentity: vi.fn(),
  resolvePrintersByCategory: vi.fn(),
  saveCategoryPrinter: vi.fn(),
  saveCategoryRole: vi.fn(),
  savePrinter: vi.fn(),
  searchPrinters: vi.fn(),
  togglePrinterActive: vi.fn()
}));

const buildTestJobMock = vi.mocked(buildTestJob);
const dispatchPrintJobMock = vi.mocked(dispatchPrintJob);
const resolvePrinterDeviceIdentityMock = vi.mocked(resolvePrinterDeviceIdentity);

describe("printer store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePrinterStore.setState({
      error: null,
      printing: false
    });
  });

  it("adds local device identity when testing a printer", async () => {
    const job = {
      agent_id: "WINDOWS-AGENT-001",
      device_code: "WINDOWS-001",
      interface_value: "tcp://192.168.1.20:9100",
      lang: "la",
      ops: [{ type: "text", text: "Test" }],
      paper_width_mm: 80,
      printer_type: "receipt"
    };

    resolvePrinterDeviceIdentityMock.mockResolvedValue({
      ok: true,
      agent: {
        agent_id: "WINDOWS-AGENT-001",
        agent_name: "Windows Agent",
        device_code: "WINDOWS-001"
      }
    });
    buildTestJobMock.mockResolvedValue({ data: { job, printer: {} } } as BuildTestJobResponse);
    dispatchPrintJobMock.mockResolvedValue();

    await usePrinterStore.getState().test({
      login_uuid_fk: "login-1",
      print_config_uuid: "printer-1",
      lang: "la"
    });

    expect(buildTestJobMock).toHaveBeenCalledWith({
      login_uuid_fk: "login-1",
      print_config_uuid: "printer-1",
      lang: "la",
      device_code: "WINDOWS-001",
      agent_id: "WINDOWS-AGENT-001",
      agent_name: "Windows Agent",
      print_mode: "windows_agent"
    });
    expect(dispatchPrintJobMock).toHaveBeenCalledWith(job);
  });
});
