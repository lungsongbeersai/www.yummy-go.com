import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTestJob,
  deletePrinter,
  dispatchPrintJob,
  getPendingPrintJobs,
  resolvePrinterDeviceContext,
  togglePrinterActive,
  type BuildTestJobResponse
} from "@/services/printer";
import { usePrinterStore } from "@/stores/printer-store";
import { resetSessionStores } from "@/stores/session-store-registry";

vi.mock("@/services/printer", () => ({
  ackPrintJob: vi.fn(),
  buildTestJob: vi.fn(),
  deletePrinter: vi.fn(),
  dispatchPrintJob: vi.fn(),
  executeInvoicePrintJobs: vi.fn(),
  executeKitchenPrintJobs: vi.fn(),
  fetchPrinterCategoryRole: vi.fn(),
  getAgentFiles: vi.fn(),
  getCategoryRoles: vi.fn(),
  getDefaultCategoryByRole: vi.fn(),
  getPendingPrintJobs: vi.fn(),
  getPrinterOptions: vi.fn(),
  getPrinterRoles: vi.fn(),
  getPrinters: vi.fn(),
  resolvePrinterDeviceContext: vi.fn(),
  resolvePrinterDeviceIdentity: vi.fn(),
  resolvePrintersByCategory: vi.fn(),
  saveCategoryPrinter: vi.fn(),
  saveCategoryRole: vi.fn(),
  savePrinter: vi.fn(),
  searchPrinters: vi.fn(),
  togglePrinterActive: vi.fn()
}));

const buildTestJobMock = vi.mocked(buildTestJob);
const deletePrinterMock = vi.mocked(deletePrinter);
const dispatchPrintJobMock = vi.mocked(dispatchPrintJob);
const getPendingPrintJobsMock = vi.mocked(getPendingPrintJobs);
const resolvePrinterDeviceContextMock = vi.mocked(resolvePrinterDeviceContext);
const togglePrinterActiveMock = vi.mocked(togglePrinterActive);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("printer store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePrinterStore.setState({
      agent: null,
      error: null,
      printing: false,
      printers: [],
      saving: false
    });
  });

  it("uses the local Agent device identity for owned shared-printer mutations", async () => {
    usePrinterStore.setState({
      agent: {
        agent_id: "agent-1",
        agent_name: "Local Agent",
        device_code: "INCLUDE"
      },
      printers: [
        {
          print_config_uuid: "printer-1",
          printer_name: "Shared Kitchen",
          connect_type: "tcp",
          interface_value: "tcp://192.168.100.78:9100",
          paper_width_mm: 80,
          is_active: true,
          role_codes: ["kitchen"],
          cate_uuid_fk: [],
          is_shared: true,
          is_owner: true
        }
      ]
    });
    togglePrinterActiveMock.mockResolvedValue({});
    deletePrinterMock.mockResolvedValue({});

    await usePrinterStore.getState().toggleActive("printer-1");
    expect(togglePrinterActiveMock).toHaveBeenCalledWith("printer-1", "INCLUDE");

    await usePrinterStore.getState().remove("printer-1");
    expect(deletePrinterMock).toHaveBeenCalledWith("printer-1", "INCLUDE");
  });

  it("builds a test job with the selected config identity instead of the browser Agent identity", async () => {
    usePrinterStore.setState({
      printers: [
        {
          print_config_uuid: "printer-1",
          printer_name: "Kitchen TCP",
          connect_type: "tcp",
          interface_value: "tcp://192.168.100.78:9100",
          paper_width_mm: 80,
          is_active: true,
          role_codes: ["kitchen"],
          cate_uuid_fk: ["category-1"],
          device_code: "mac-laptop-web-owner",
          agent_id: "saved-agent",
          agent_name: "Saved Agent",
          print_mode: "agent"
        }
      ]
    });
    resolvePrinterDeviceContextMock.mockResolvedValue({
      device_code: "installed-agent-device",
      agent_id: "installed-agent",
      agent_name: "Installed Agent",
      print_mode: "local_agent"
    });
    buildTestJobMock.mockResolvedValue({
      data: {
        printer: {},
        job: {
          interface_value: "tcp://192.168.100.78:9100",
          lang: "la",
          ops: [],
          paper_width_mm: 80,
          printer_type: "receipt"
        }
      }
    } as BuildTestJobResponse);
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
      device_code: "mac-laptop-web-owner",
      agent_id: "saved-agent",
      agent_name: "Saved Agent",
      print_mode: "agent"
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

    resolvePrinterDeviceContextMock.mockResolvedValue({
      agent_id: "include-f8e4f9",
      agent_name: "Include Agent",
      device_code: "INCLUDE",
      print_mode: "mobile_wifi"
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
      device_code: "INCLUDE",
      agent_id: "include-f8e4f9",
      agent_name: "Include Agent",
      print_mode: "mobile_wifi"
    });
    expect(dispatchPrintJobMock).toHaveBeenCalledWith(job);
  });

  it("loads pending jobs with local printer identity", async () => {
    const jobs = [{ print_job_uuid: "job-1", print_items: [] }];
    resolvePrinterDeviceContextMock.mockResolvedValue({
      agent_id: "include-f8e4f9",
      agent_name: "Include Agent",
      device_code: "INCLUDE",
      print_mode: "mobile_wifi"
    });
    getPendingPrintJobsMock.mockResolvedValue({
      jobs,
      batchPayloads: [],
      hasBatchPayloads: false,
      ackSuccess: null,
      ackFailed: null,
      printSummary: {}
    } as Awaited<ReturnType<typeof getPendingPrintJobs>>);

    await expect(usePrinterStore.getState().loadPendingJobs("job-1", "login-1")).resolves.toEqual(jobs);

    expect(getPendingPrintJobsMock).toHaveBeenCalledWith({
      print_job_uuid: "job-1",
      login_uuid_fk: "login-1",
      device_code: "INCLUDE",
      agent_id: "include-f8e4f9",
      print_mode: "mobile_wifi"
    });
  });

  it("does not start a follow-up pending-jobs request after the session changes", async () => {
    const context = deferred<Awaited<ReturnType<typeof resolvePrinterDeviceContext>>>();
    resolvePrinterDeviceContextMock.mockReturnValueOnce(context.promise);

    const load = usePrinterStore.getState().loadPendingJobs("job-1", "login-1");
    resetSessionStores();
    context.resolve({
      agent_id: "agent-1",
      device_code: "device-1",
      print_mode: "local_agent"
    });

    await expect(load).resolves.toEqual([]);
    expect(getPendingPrintJobsMock).not.toHaveBeenCalled();
  });

  it("does not dispatch a test job built for a previous session", async () => {
    const result = deferred<BuildTestJobResponse>();
    const job = {
      agent_id: "agent-1",
      device_code: "device-1",
      interface_value: "tcp://192.168.1.20:9100",
      lang: "la",
      ops: [{ type: "text", text: "Test" }],
      paper_width_mm: 80,
      printer_type: "receipt"
    };
    resolvePrinterDeviceContextMock.mockResolvedValueOnce({
      agent_id: "agent-1",
      device_code: "device-1",
      print_mode: "local_agent"
    });
    buildTestJobMock.mockReturnValueOnce(result.promise);

    const test = usePrinterStore.getState().test({
      login_uuid_fk: "login-1",
      print_config_uuid: "printer-1",
      lang: "la"
    });
    await vi.waitFor(() => expect(buildTestJobMock).toHaveBeenCalledOnce());
    resetSessionStores();
    result.resolve({ data: { job, printer: {} } } as BuildTestJobResponse);

    await expect(test).resolves.toBeUndefined();
    expect(dispatchPrintJobMock).not.toHaveBeenCalled();
  });
});
