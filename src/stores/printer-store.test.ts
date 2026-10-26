import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTestJob,
  deletePrinter,
  dispatchPrintJob,
  dispatchCashDrawer,
  renderMobileEscpos,
  printPrinterSelfTest,
  completePrinterSelfTest,
  getPrinterSelfTestStatus,
  getPrinterReadiness,
  getPrinters,
  getPendingPrintJobs,
  getInternetPrintSettings,
  getPrinterEmployeeRoles,
  registerPrinterAgent,
  resolvePrinterDeviceContext,
  resolvePrinterDeviceIdentity,
  searchPrinters,
  togglePrinterActive,
  type BuildTestJobResponse,
  type PrintJob,
  type Printer,
  type PrinterEmployeeRole,
} from "@/services/printer";
import { usePrinterStore } from "@/stores/printer-store";
import { resetSessionStores } from "@/stores/session-store-registry";

vi.mock("@/services/printer", () => ({
  ackPrintJob: vi.fn(),
  buildTestJob: vi.fn(),
  deletePrinter: vi.fn(),
  dispatchPrintJob: vi.fn(),
  dispatchCashDrawer: vi.fn(),
  renderMobileEscpos: vi.fn(),
  printPrinterSelfTest: vi.fn(),
  completePrinterSelfTest: vi.fn(),
  getPrinterSelfTestStatus: vi.fn(),
  getPrinterReadiness: vi.fn(),
  executeInvoicePrintJobs: vi.fn(),
  executeKitchenPrintJobs: vi.fn(),
  fetchPrinterCategoryRole: vi.fn(),
  getAgentFiles: vi.fn(),
  getCategoryRoles: vi.fn(),
  getDefaultCategoryByRole: vi.fn(),
  getPendingPrintJobs: vi.fn(),
  getInternetPrintSettings: vi.fn(),
  getPrinterOptions: vi.fn(),
  getPrinterErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Unknown printer error",
  getPrinterDeliveryState: (error: unknown) =>
    error && typeof error === "object" && "delivery_state" in error && error.delivery_state === "not_sent"
      ? "not_sent" : "unknown",
  getPrinterRoles: vi.fn(),
  getPrinterEmployeeRoles: vi.fn(),
  getPrinters: vi.fn(),
  registerPrinterAgent: vi.fn(),
  isBrowserPrinterAgentId: (agentId: unknown) =>
    agentId === "desktop" || agentId === "mobile",
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
const dispatchCashDrawerMock = vi.mocked(dispatchCashDrawer);
const getPrintersMock = vi.mocked(getPrinters);
const getPendingPrintJobsMock = vi.mocked(getPendingPrintJobs);
const registerPrinterAgentMock = vi.mocked(registerPrinterAgent);
const resolvePrinterDeviceContextMock = vi.mocked(resolvePrinterDeviceContext);
const resolvePrinterDeviceIdentityMock = vi.mocked(resolvePrinterDeviceIdentity);
const searchPrintersMock = vi.mocked(searchPrinters);
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
    vi.mocked(getPrinterSelfTestStatus).mockReset();
    registerPrinterAgentMock.mockResolvedValue(undefined);
    usePrinterStore.setState({
      agent: null,
      agentStatus: "unchecked",
      agentError: null,
      agentConnectionUrl: null,
      printerDiagnostics: [],
      loadingPrinterDiagnostics: false,
      error: null,
      printing: false,
      pendingSelfTest: null,
      selfTestPhase: "idle",
      printers: [],
      saving: false,
      searching: false,
      internetPrintSettings: null,
      loadingInternetPrintSettings: false,
      internetPrintSettingsError: null,
      employeeRoles: [],
      loadingEmployeeRoles: false,
      employeeRolesLoaded: false,
      employeeRolesError: null,
    });
  });

  it("sends an unsaved self-test target and clears its busy state", async () => {
    const command = deferred<{ ok: true; status: "command_sent" }>();
    vi.mocked(printPrinterSelfTest).mockReturnValueOnce(command.promise);
    const target = { connect_type: "tcp" as const, interface_value: "tcp://192.168.1.20:9100" };
    const request = usePrinterStore.getState().selfTest(target);
    expect(usePrinterStore.getState().printing).toBe(true);
    expect(printPrinterSelfTest).toHaveBeenCalledWith(target);
    await expect(usePrinterStore.getState().selfTest(target)).rejects.toThrow("already running");
    command.resolve({ ok: true, status: "command_sent" });
    await request;
    expect(usePrinterStore.getState().printing).toBe(false);
    expect(usePrinterStore.getState().pendingSelfTest).toEqual(target);
    expect(buildTestJobMock).not.toHaveBeenCalled();
  });

  it("automatically releases a confirmed ready self-test and allows the next print", async () => {
    const target = { connect_type: "usb" as const, interface_value: "cups:Receipt" };
    const ready = { ok: true as const, status: "command_sent" as const, readiness: "ready" as const, self_test_id: "8aa530cf-0736-470b-9d0f-4e5d2bc960bc" };
    vi.mocked(printPrinterSelfTest).mockResolvedValueOnce(ready).mockResolvedValueOnce(ready);
    await usePrinterStore.getState().selfTest(target);
    expect(usePrinterStore.getState()).toMatchObject({ pendingSelfTest: null, printing: false, selfTestPhase: "idle" });
    await usePrinterStore.getState().selfTest(target);
    expect(printPrinterSelfTest).toHaveBeenCalledTimes(2);
    expect(completePrinterSelfTest).not.toHaveBeenCalled();
  });

  it("keeps loading while the tracked operation is pending and closes only after ready", async () => {
    vi.useFakeTimers();
    try {
      const self_test_id = "8aa530cf-0736-470b-9d0f-4e5d2bc960bc";
      const target = { connect_type: "usb" as const, interface_value: "cups:Receipt" };
      vi.mocked(printPrinterSelfTest).mockResolvedValueOnce({ ok: true, status: "command_sent", readiness: "pending", self_test_id });
      vi.mocked(getPrinterSelfTestStatus).mockResolvedValueOnce({ ok: true, readiness: "pending", self_test_id }).mockResolvedValueOnce({ ok: true, readiness: "ready", self_test_id });
      const request = usePrinterStore.getState().selfTest(target);
      await vi.advanceTimersByTimeAsync(0);
      expect(usePrinterStore.getState()).toMatchObject({ printing: true, selfTestPhase: "checking", pendingSelfTest: { ...target, self_test_id } });
      await vi.advanceTimersByTimeAsync(500);
      await request;
      expect(usePrinterStore.getState()).toMatchObject({ printing: false, selfTestPhase: "idle", pendingSelfTest: null });
      expect(printPrinterSelfTest).toHaveBeenCalledTimes(1);
      expect(getPrinterSelfTestStatus).toHaveBeenCalledTimes(2);
      expect(completePrinterSelfTest).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("retains a sent operation after status failure and retries only its status", async () => {
    const self_test_id = "8aa530cf-0736-470b-9d0f-4e5d2bc960bc";
    const target = { connect_type: "usb" as const, interface_value: "cups:Receipt" };
    vi.mocked(printPrinterSelfTest).mockResolvedValueOnce({ ok: true, status: "command_sent", readiness: "pending", self_test_id });
    vi.mocked(getPrinterSelfTestStatus).mockRejectedValueOnce(Object.assign(new Error("Status identity read failed"), { delivery_state: "not_sent" }));
    await expect(usePrinterStore.getState().selfTest(target)).rejects.toThrow("Status identity read failed");
    expect(usePrinterStore.getState()).toMatchObject({ printing: false, selfTestPhase: "error", pendingSelfTest: { ...target, self_test_id } });
    vi.mocked(getPrinterSelfTestStatus).mockResolvedValueOnce({ ok: true, readiness: "ready", self_test_id });
    await usePrinterStore.getState().checkSelfTest();
    expect(usePrinterStore.getState().pendingSelfTest).toBeNull();
    expect(printPrinterSelfTest).toHaveBeenCalledTimes(1);
    expect(completePrinterSelfTest).not.toHaveBeenCalled();
  });

  it("retains the exact recovery ID after an ambiguous start and uses it for manual completion", async () => {
    const self_test_id = "8aa530cf-0736-470b-9d0f-4e5d2bc960bc";
    const target = { connect_type: "usb" as const, interface_value: "cups:Receipt" };
    vi.mocked(printPrinterSelfTest).mockRejectedValueOnce(Object.assign(new Error("Submission uncertain"), { self_test_id, readiness: "manual_required", delivery_state: "unknown" }));
    await expect(usePrinterStore.getState().selfTest(target)).rejects.toThrow("Submission uncertain");
    expect(usePrinterStore.getState()).toMatchObject({ pendingSelfTest: { ...target, self_test_id }, printing: false, selfTestPhase: "error" });
    vi.mocked(completePrinterSelfTest).mockResolvedValueOnce({ ok: true, status: "ready" });
    await usePrinterStore.getState().completeSelfTest();
    expect(completePrinterSelfTest).toHaveBeenCalledWith({ ...target, self_test_id });
    expect(printPrinterSelfTest).toHaveBeenCalledTimes(1);
  });

  it("falls back to explicit readiness when the Agent cannot track completion", async () => {
    const self_test_id = "8aa530cf-0736-470b-9d0f-4e5d2bc960bc";
    const target = { connect_type: "usb" as const, interface_value: "cups:Receipt" };
    vi.mocked(printPrinterSelfTest).mockResolvedValueOnce({ ok: true, status: "command_sent", readiness: "pending", self_test_id });
    vi.mocked(getPrinterSelfTestStatus).mockResolvedValueOnce({ ok: true, readiness: "manual_required" });
    await usePrinterStore.getState().selfTest(target);
    expect(usePrinterStore.getState()).toMatchObject({ pendingSelfTest: { ...target, self_test_id }, printing: false, selfTestPhase: "manual" });
    expect(completePrinterSelfTest).not.toHaveBeenCalled();
    expect(printPrinterSelfTest).toHaveBeenCalledTimes(1);
  });

  it("ends loading at the watchdog without declaring the pending printer ready", async () => {
    vi.useFakeTimers();
    try {
      const self_test_id = "8aa530cf-0736-470b-9d0f-4e5d2bc960bc";
      const target = { connect_type: "usb" as const, interface_value: "cups:Receipt", self_test_id };
      usePrinterStore.setState({ pendingSelfTest: target });
      vi.mocked(getPrinterSelfTestStatus).mockResolvedValue({ ok: true, readiness: "pending", self_test_id });
      const request = usePrinterStore.getState().checkSelfTest();
      const rejected = expect(request).rejects.toThrow("could not be confirmed");
      await vi.advanceTimersByTimeAsync(45000);
      await rejected;
      expect(usePrinterStore.getState()).toMatchObject({ printing: false, selfTestPhase: "error", pendingSelfTest: target });
      expect(printPrinterSelfTest).not.toHaveBeenCalled();
      expect(completePrinterSelfTest).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("does not let a late status response clear a newer operation at the same printer", async () => {
    const firstId = "8aa530cf-0736-470b-9d0f-4e5d2bc960bc";
    const target = { connect_type: "usb" as const, interface_value: "cups:Receipt", self_test_id: firstId };
    const next = { ...target, self_test_id: "bed2d087-4e42-4e72-87d0-bbe7b8563d62" };
    const status = deferred<{ ok: true; readiness: "ready"; self_test_id: string }>();
    vi.mocked(getPrinterSelfTestStatus).mockReturnValueOnce(status.promise);
    usePrinterStore.setState({ pendingSelfTest: target });
    const request = usePrinterStore.getState().checkSelfTest();
    usePrinterStore.setState({ pendingSelfTest: next, printing: true, selfTestPhase: "checking" });
    status.resolve({ ok: true, readiness: "ready", self_test_id: firstId });
    await request;
    expect(usePrinterStore.getState()).toMatchObject({ pendingSelfTest: next, printing: true, selfTestPhase: "checking" });
  });

  it("restores the tracked operation after reload and checks it without reprinting", async () => {
    const target = { connect_type: "usb" as const, interface_value: "cups:Receipt", self_test_id: "8aa530cf-0736-470b-9d0f-4e5d2bc960bc", command_profile: "xprinter" as const };
    const storage = new Map([["yummy_pending_printer_self_test", JSON.stringify(target)]]);
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    } });
    try {
      usePrinterStore.getState().restoreSelfTest();
      expect(usePrinterStore.getState()).toMatchObject({ pendingSelfTest: target, selfTestPhase: "restored" });
      vi.mocked(getPrinterSelfTestStatus).mockResolvedValueOnce({ ok: true, readiness: "ready", self_test_id: target.self_test_id });
      await usePrinterStore.getState().checkSelfTest();
      expect(usePrinterStore.getState().pendingSelfTest).toBeNull();
      expect(storage.size).toBe(0);
      expect(printPrinterSelfTest).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });

  it("surfaces a self-test failure instead of reporting print success", async () => {
    vi.mocked(printPrinterSelfTest).mockRejectedValueOnce(Object.assign(new Error("Printer agent update required"), { delivery_state: "not_sent" }));
    await expect(usePrinterStore.getState().selfTest({
      connect_type: "usb", interface_value: "cups:Receipt",
    })).rejects.toThrow("Printer agent update required");
    expect(usePrinterStore.getState()).toMatchObject({
      printing: false, pendingSelfTest: null, error: "Printer agent update required",
    });
  });

  it("retains maintenance after an uncertain send until the user confirms readiness", async () => {
    const target = { connect_type: "tcp" as const, interface_value: "tcp://192.168.1.20:9100" };
    vi.mocked(printPrinterSelfTest).mockRejectedValueOnce(new Error("Response lost"));
    await expect(usePrinterStore.getState().selfTest(target)).rejects.toThrow("Response lost");
    expect(usePrinterStore.getState().pendingSelfTest).toEqual(target);
    vi.mocked(completePrinterSelfTest).mockRejectedValueOnce(new Error("Agent disconnected"));
    await expect(usePrinterStore.getState().completeSelfTest()).rejects.toThrow("Agent disconnected");
    expect(usePrinterStore.getState().pendingSelfTest).toEqual(target);
    vi.mocked(completePrinterSelfTest).mockResolvedValueOnce({ ok: true, status: "ready" });
    await usePrinterStore.getState().completeSelfTest();
    expect(completePrinterSelfTest).toHaveBeenLastCalledWith(target);
    expect(usePrinterStore.getState()).toMatchObject({ printing: false, pendingSelfTest: null });
  });

  it("recovers the readiness dialog when the Agent is already in self-test maintenance", async () => {
    const target = { connect_type: "tcp" as const, interface_value: "tcp://192.168.1.20:9100" };
    vi.mocked(printPrinterSelfTest).mockRejectedValueOnce(Object.assign(new Error("Self-test already in progress"), {
      code: "PRINTER_SELF_TEST_IN_PROGRESS", delivery_state: "not_sent",
    }));
    await expect(usePrinterStore.getState().selfTest(target)).rejects.toThrow("already in progress");
    expect(usePrinterStore.getState()).toMatchObject({ pendingSelfTest: target, printing: false });
    vi.mocked(completePrinterSelfTest).mockResolvedValueOnce({ ok: true, status: "ready" });
    await usePrinterStore.getState().completeSelfTest();
    expect(usePrinterStore.getState().pendingSelfTest).toBeNull();
  });

  it.each([undefined, "epson", "xprinter", "rongta"] as const)("restores the pending %s profile after a page reload and forgets it after readiness", async (profile) => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
    try {
      const target = {
        connect_type: "usb" as const, interface_value: "cups:Receipt",
        expected_agent_id: "local-agent", expected_device_code: "local-device",
        ...(profile ? { command_profile: profile } : {}),
      };
      vi.mocked(printPrinterSelfTest).mockResolvedValueOnce({ ok: true, status: "command_sent" });
      await usePrinterStore.getState().selfTest(target);
      usePrinterStore.setState({ pendingSelfTest: null });
      usePrinterStore.getState().restoreSelfTest();
      expect(usePrinterStore.getState().pendingSelfTest).toEqual(target);
      vi.mocked(completePrinterSelfTest).mockResolvedValueOnce({ ok: true, status: "ready" });
      await usePrinterStore.getState().completeSelfTest();
      usePrinterStore.getState().restoreSelfTest();
      expect(usePrinterStore.getState().pendingSelfTest).toBeNull();
      expect(storage.size).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not erase a newer tab's maintenance for a different profile after late readiness", async () => {
    const first = { connect_type: "usb" as const, interface_value: "cups:Receipt", command_profile: "epson" as const };
    const next = { ...first, command_profile: "xprinter" as const };
    const storage = new Map([["yummy_pending_printer_self_test", JSON.stringify(first)]]);
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    } });
    try {
      usePrinterStore.setState({ pendingSelfTest: first });
      const ready = deferred<{ ok: true; status: "ready" }>();
      vi.mocked(completePrinterSelfTest).mockReturnValueOnce(ready.promise);
      const completion = usePrinterStore.getState().completeSelfTest();
      storage.set("yummy_pending_printer_self_test", JSON.stringify(next));
      ready.resolve({ ok: true, status: "ready" });
      await completion;
      expect(storage.get("yummy_pending_printer_self_test")).toBe(JSON.stringify(next));
      usePrinterStore.getState().restoreSelfTest();
      expect(usePrinterStore.getState().pendingSelfTest).toEqual(next);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps a late self-test response from clearing the next session's print state", async () => {
    const command = deferred<{ ok: true; status: "command_sent" }>();
    vi.mocked(printPrinterSelfTest).mockReturnValueOnce(command.promise);
    const request = usePrinterStore.getState().selfTest({
      connect_type: "tcp", interface_value: "tcp://192.168.1.20:9100",
    });
    resetSessionStores();
    usePrinterStore.setState({ printing: true });
    command.resolve({ ok: true, status: "command_sent" });
    await request;
    expect(usePrinterStore.getState().printing).toBe(true);
  });

  it("does not erase the next session's recovery data after a late readiness response", async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
    try {
      const first = { connect_type: "usb" as const, interface_value: "cups:Receipt" };
      const next = { connect_type: "tcp" as const, interface_value: "tcp://192.168.1.30:9100" };
      vi.mocked(printPrinterSelfTest).mockResolvedValueOnce({ ok: true, status: "command_sent" });
      await usePrinterStore.getState().selfTest(first);
      const ready = deferred<{ ok: true; status: "ready" }>();
      vi.mocked(completePrinterSelfTest).mockReturnValueOnce(ready.promise);
      const finishing = usePrinterStore.getState().completeSelfTest();
      resetSessionStores();
      storage.set("yummy_pending_printer_self_test", JSON.stringify(next));
      usePrinterStore.setState({ pendingSelfTest: next, printing: true });
      ready.resolve({ ok: true, status: "ready" });
      await finishing;
      expect(usePrinterStore.getState()).toMatchObject({ pendingSelfTest: next, printing: true });
      expect([...storage.values()]).toEqual([JSON.stringify(next)]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the last receiver status when loading fails", async () => {
    const settings = { available: true, enabled: false, can_manage: true, receivers: [] };
    vi.mocked(getInternetPrintSettings).mockResolvedValueOnce(settings);
    await usePrinterStore.getState().loadInternetPrintSettings();
    vi.mocked(getInternetPrintSettings).mockRejectedValueOnce(new Error("Connection failed"));
    await expect(usePrinterStore.getState().loadInternetPrintSettings()).rejects.toThrow("Connection failed");
    expect(usePrinterStore.getState().internetPrintSettings).toEqual(settings);
    expect(usePrinterStore.getState().loadingInternetPrintSettings).toBe(false);
  });

  it("does not leak a late settings response into the next login session", async () => {
    const pending = deferred<{ available: boolean; enabled: boolean; can_manage: boolean; receivers: [] }>();
    vi.mocked(getInternetPrintSettings).mockReturnValue(pending.promise);
    const request = usePrinterStore.getState().loadInternetPrintSettings();
    resetSessionStores();
    pending.resolve({ available: true, enabled: true, can_manage: true, receivers: [] });
    await request;
    expect(usePrinterStore.getState().internetPrintSettings).toBeNull();
    expect(usePrinterStore.getState().loadingInternetPrintSettings).toBe(false);
  });

  it("loads employee print roles independently of printer station roles and surfaces failures", async () => {
    const roles: PrinterEmployeeRole[] = [{
      roles_id: 17, roles_name: "Counter", roles_name_la: "ແຄັດເຊຍ", roles_name_eng: "Cashier",
    }];
    const stationRoles = [{ role_code: "b-001", role_name: "Bar 1" }];
    usePrinterStore.setState({ roles: stationRoles });
    vi.mocked(getPrinterEmployeeRoles).mockResolvedValueOnce(roles);
    expect(await usePrinterStore.getState().loadEmployeeRoles("en")).toEqual(roles);
    expect(getPrinterEmployeeRoles).toHaveBeenCalledWith("en");
    expect(usePrinterStore.getState().employeeRoles).toEqual(roles);
    expect(usePrinterStore.getState().employeeRolesLoaded).toBe(true);
    expect(usePrinterStore.getState().roles).toEqual(stationRoles);
    vi.mocked(getPrinterEmployeeRoles).mockRejectedValueOnce(new Error("Role list unavailable"));
    await expect(usePrinterStore.getState().loadEmployeeRoles("en")).rejects.toThrow("Role list unavailable");
    expect(usePrinterStore.getState()).toMatchObject({
      employeeRoles: roles, loadingEmployeeRoles: false, employeeRolesLoaded: false, employeeRolesError: "Role list unavailable",
    });
  });

  it("does not leak a late employee role list into another login session", async () => {
    const pending = deferred<PrinterEmployeeRole[]>();
    vi.mocked(getPrinterEmployeeRoles).mockReturnValueOnce(pending.promise);
    const request = usePrinterStore.getState().loadEmployeeRoles("la");
    expect(usePrinterStore.getState().loadingEmployeeRoles).toBe(true);
    resetSessionStores();
    pending.resolve([{ roles_id: 17, roles_name: "Counter", roles_name_la: "", roles_name_eng: "" }]);
    await request;
    expect(usePrinterStore.getState()).toMatchObject({
      employeeRoles: [], loadingEmployeeRoles: false, employeeRolesLoaded: false, employeeRolesError: null,
    });
  });

  it("keeps management printers visible when the desktop Agent is unavailable", async () => {
    resolvePrinterDeviceIdentityMock.mockResolvedValue({
      ok: true,
      connected: false,
      error: "Agent is restarting",
      agent: {
        agent_id: "cached-agent",
        agent_name: "Cached POS",
        device_code: "POS-01",
        agent_url: "http://192.168.100.78:7777",
        network_addresses: ["192.168.100.78"],
      },
    });
    getPrintersMock.mockResolvedValue([
      {
        print_config_uuid: "shared-offline",
        printer_name: "Shared Kitchen",
        connect_type: "usb",
        interface_value: "win:Kitchen",
        paper_width_mm: 80,
        is_active: true,
        role_codes: ["k-001"],
        cate_uuid_fk: [],
        is_shared: true,
        agent_online: false,
      },
    ]);

    await expect(
      usePrinterStore.getState().loadPrintersForLocalAgent({
        login_uuid_fk: "login-1",
        lang: "la",
      }),
    ).resolves.toHaveLength(1);

    expect(getPrintersMock).toHaveBeenCalledWith({
      login_uuid_fk: "login-1",
      lang: "la",
      agent_id: "cached-agent",
      device_code: "POS-01",
      requester_network_hints: [
        "192.168.100.78",
        "http://192.168.100.78:7777",
      ],
      include_offline_shared: true,
      management_view: true,
    });
    expect(usePrinterStore.getState()).toMatchObject({
      agentStatus: "offline",
      agentError: "Agent is restarting",
      printers: [expect.objectContaining({ print_config_uuid: "shared-offline" })],
    });
  });

  it("forwards explicit USB refresh to Printer Agent discovery", async () => {
    searchPrintersMock.mockResolvedValue({ agent: null, printers: [] });

    await usePrinterStore.getState().discover("usb", true);

    expect(searchPrintersMock).toHaveBeenCalledWith("usb", true);
  });

  it.each(["checkAgent", "resolveDeviceIdentity"] as const)("keeps cached offline ownership without a false connected state in %s", async (action) => {
    const cachedAgent = { agent_id: "counter-agent", agent_name: "Counter", device_code: "counter-device" };
    resolvePrinterDeviceIdentityMock.mockResolvedValueOnce({
      ok: true, agent: cachedAgent, connected: false, error: "Agent is restarting",
    });
    const result = await usePrinterStore.getState()[action]();
    expect(result).toEqual(action === "checkAgent" ? false : cachedAgent);
    expect(usePrinterStore.getState()).toMatchObject({
      agent: cachedAgent, agentStatus: "offline", agentError: "Agent is restarting",
    });
  });

  it.each(["checkAgent", "resolveDeviceIdentity"] as const)("does not treat a desktop browser identity as a running Agent in %s", async (action) => {
    resolvePrinterDeviceIdentityMock.mockResolvedValueOnce({
      ok: true, agent: { agent_id: "desktop", agent_name: "Browser", device_code: "desktop-web-device" },
    });
    await usePrinterStore.getState()[action]();
    expect(usePrinterStore.getState()).toMatchObject({ agent: null, agentStatus: "offline" });
  });

  it("keeps a responding but unauthorized Agent distinct from an offline Agent", async () => {
    resolvePrinterDeviceIdentityMock.mockResolvedValueOnce({
      ok: true, agent: { agent_id: "counter-agent", agent_name: "Counter", device_code: "counter-device" },
      connected: false, authorizationFailed: true, error: "Invalid Agent secret",
    });
    await expect(usePrinterStore.getState().checkAgent()).resolves.toBe(false);
    expect(usePrinterStore.getState()).toMatchObject({
      agentStatus: "unauthorized", agentError: "Invalid Agent secret",
    });
  });

  it("keeps the Agent connected when enumeration fails but its identity endpoint responds", async () => {
    searchPrintersMock.mockRejectedValueOnce(new Error("Printer enumeration failed"));
    resolvePrinterDeviceIdentityMock.mockResolvedValueOnce({
      ok: true, agent: { agent_id: "counter-agent", agent_name: "Counter", device_code: "counter-device" },
    });
    await expect(usePrinterStore.getState().discover()).rejects.toThrow("Printer enumeration failed");
    expect(usePrinterStore.getState()).toMatchObject({
      searching: false, error: "Printer enumeration failed", agentStatus: "connected", agentError: null,
    });
  });

  it("does not let an older failed health read overwrite a successful newer read", async () => {
    const previous = deferred<Awaited<ReturnType<typeof resolvePrinterDeviceIdentity>>>();
    resolvePrinterDeviceIdentityMock.mockReturnValueOnce(previous.promise).mockResolvedValueOnce({
      ok: true, agent: { agent_id: "new-agent", agent_name: "New Agent", device_code: "new-device" },
    });
    const older = usePrinterStore.getState().checkAgent();
    await usePrinterStore.getState().checkAgent();
    previous.resolve({ ok: false, error: "Old timeout" });
    await older;
    expect(usePrinterStore.getState()).toMatchObject({
      agentStatus: "connected", agentError: null, agent: { agent_id: "new-agent", device_code: "new-device" },
    });
  });

  it("forwards the connected Agent LAN addresses when loading shared printers", async () => {
    resolvePrinterDeviceIdentityMock.mockResolvedValue({
      ok: true,
      agent: {
        agent_id: "friend-agent",
        agent_name: "Friend POS",
        device_code: "FRIEND-PC",
        agent_url: "http://192.168.100.78:7777",
        network_addresses: ["192.168.100.78"],
      },
    });
    getPrintersMock.mockResolvedValue([]);

    await usePrinterStore.getState().loadPrintersForLocalAgent({
      login_uuid_fk: "login-1",
      lang: "la",
    });

    expect(getPrintersMock).toHaveBeenCalledWith({
      login_uuid_fk: "login-1",
      lang: "la",
      agent_id: "friend-agent",
      device_code: "FRIEND-PC",
      requester_network_hints: [
        "192.168.100.78",
        "http://192.168.100.78:7777",
      ],
      include_offline_shared: true,
      management_view: true,
    });
    expect(registerPrinterAgentMock).toHaveBeenCalledWith({
      login_uuid_fk: "login-1",
      agent_id: "friend-agent",
      agent_name: "Friend POS",
      agent_url: "http://192.168.100.78:7777",
      agent_secret_hash: "",
      device_code: "FRIEND-PC",
      platform: "",
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

  it("tests an offline shared TCP printer through the requesting desktop Agent", async () => {
    const localAgent = {
      agent_id: "mac-agent",
      agent_name: "MacBook Agent",
      agent_url: "http://192.168.100.22:7777",
      device_code: "MACBOOK",
    };
    const remoteJob = {
      agent_id: "owner-agent",
      agent_name: "Owner Agent",
      agent_url: "http://192.168.100.78:7777",
      device_code: "INCLUDEPRO",
      interface_value: "tcp://192.168.100.78:9100",
      lang: "la",
      ops: [{ type: "text" as const, text: "Test" }],
      paper_width_mm: 80,
      printer_type: "receipt",
    };
    usePrinterStore.setState({
      agent: localAgent,
      printers: [{
        print_config_uuid: "shared-tcp-1",
        printer_name: "print1",
        connect_type: "tcp",
        interface_value: remoteJob.interface_value,
        paper_width_mm: 80,
        is_active: true,
        role_codes: ["kitchen"],
        cate_uuid_fk: ["category-1"],
        is_shared: true,
        agent_online: false,
        agent_id: remoteJob.agent_id,
        agent_name: remoteJob.agent_name,
        device_code: remoteJob.device_code,
      }],
    });
    resolvePrinterDeviceContextMock.mockResolvedValue({
      agent_id: remoteJob.agent_id,
      agent_name: remoteJob.agent_name,
      device_code: remoteJob.device_code,
    });
    buildTestJobMock.mockResolvedValue({
      data: { job: remoteJob, printer: {} },
    } as BuildTestJobResponse);
    dispatchPrintJobMock.mockResolvedValue();

    await usePrinterStore.getState().test({
      login_uuid_fk: "login-1",
      print_config_uuid: "shared-tcp-1",
      lang: "la",
    });

    expect(dispatchPrintJobMock).toHaveBeenCalledWith(
      {
        ...remoteJob,
        agent_id: localAgent.agent_id,
        agent_name: localAgent.agent_name,
        agent_url: localAgent.agent_url,
        device_code: localAgent.device_code,
      },
      localAgent,
    );
  });

  function drawerFixture(overrides: Partial<Printer> = {}) {
    const printer: Printer = {
      print_config_uuid: "drawer-printer",
      printer_name: "Receipt",
      connect_type: "tcp",
      interface_value: "tcp://192.168.1.20:9100",
      paper_width_mm: 80,
      is_active: true,
      role_codes: ["receipt"],
      cate_uuid_fk: [],
      device_code: "saved-device",
      agent_id: "saved-agent",
      agent_name: "Saved Agent",
      print_mode: "agent",
      cash_drawer_enabled: true,
      ...overrides,
    };
    const job: PrintJob = {
      type: "cash_drawer",
      cash_drawer_only: true,
      open_cash_drawer: true,
      cut_after: false,
      ops: [],
      interface_value: printer.interface_value,
      print_config_uuid: printer.print_config_uuid,
      agent_id: printer.agent_id,
      device_code: printer.device_code,
      lang: "la",
      paper_width_mm: 80,
      printer_type: "epson",
    };
    usePrinterStore.setState({ printers: [printer] });
    resolvePrinterDeviceContextMock.mockResolvedValue({
      agent_id: "current-agent", agent_name: "Current Agent", device_code: "current-device", print_mode: "local_agent",
    });
    buildTestJobMock.mockResolvedValue({ data: { job, printer: {}, cash_drawer_enabled: true } });
    dispatchCashDrawerMock.mockResolvedValue();
    return { printer, job, input: { login_uuid_fk: "login-1", print_config_uuid: printer.print_config_uuid, lang: "la" } };
  }

  it("builds a drawer-only command for the selected config and never dispatches a receipt", async () => {
    const { input, job } = drawerFixture();
    await expect(usePrinterStore.getState().testDrawer(input)).resolves.toEqual({ routingWarning: null, cashDrawerEnabled: true });
    expect(buildTestJobMock).toHaveBeenCalledExactlyOnceWith({
      ...input, cash_drawer_only: true, open_cash_drawer: true,
      agent_id: "saved-agent", agent_name: "Saved Agent", device_code: "saved-device", print_mode: "agent",
    });
    expect(dispatchCashDrawerMock).toHaveBeenCalledExactlyOnceWith(job);
    expect(dispatchPrintJobMock).not.toHaveBeenCalled();
    expect(renderMobileEscpos).not.toHaveBeenCalled();
    expect(usePrinterStore.getState()).toMatchObject({ printing: false, error: null });
  });

  it("skips a disabled drawer without building or sending any job", async () => {
    const { input } = drawerFixture({ cash_drawer_enabled: false });
    await expect(usePrinterStore.getState().testDrawer(input)).resolves.toEqual({ routingWarning: null, cashDrawerEnabled: false });
    expect(buildTestJobMock).not.toHaveBeenCalled();
    expect(resolvePrinterDeviceContextMock).not.toHaveBeenCalled();
    expect(dispatchCashDrawerMock).not.toHaveBeenCalled();
    expect(dispatchPrintJobMock).not.toHaveBeenCalled();
  });

  it("skips a drawer disabled in the current backend response", async () => {
    const { input, job } = drawerFixture();
    buildTestJobMock.mockResolvedValueOnce({ data: { job, printer: {}, cash_drawer_enabled: false } });
    await expect(usePrinterStore.getState().testDrawer(input)).resolves.toEqual({ routingWarning: null, cashDrawerEnabled: false });
    expect(dispatchCashDrawerMock).not.toHaveBeenCalled();
    expect(dispatchPrintJobMock).not.toHaveBeenCalled();
  });

  it("uses the local Agent for an offline shared TCP drawer without changing the selected address", async () => {
    const { input, job } = drawerFixture({ is_shared: true, agent_online: false });
    const agent = { agent_id: "local-agent", agent_name: "Local", device_code: "local-device", agent_url: "http://192.168.1.5:7777" };
    usePrinterStore.setState({ agent });
    buildTestJobMock.mockResolvedValueOnce({ data: { job, printer: {}, routing_warning: "Duplicate address", cash_drawer_enabled: true } });
    await expect(usePrinterStore.getState().testDrawer(input)).resolves.toEqual({ routingWarning: "Duplicate address", cashDrawerEnabled: true });
    expect(dispatchCashDrawerMock).toHaveBeenCalledExactlyOnceWith({
      ...job, agent_id: agent.agent_id, agent_name: agent.agent_name, device_code: agent.device_code, agent_url: agent.agent_url,
    }, agent);
    expect(dispatchPrintJobMock).not.toHaveBeenCalled();
  });

  it("keeps shared USB drawer ownership for relay instead of retargeting the command locally", async () => {
    const { input, job } = drawerFixture({ is_shared: true, connect_type: "usb", interface_value: "win:Receipt" });
    usePrinterStore.setState({ agent: { agent_id: "local-agent", agent_name: "Local", device_code: "local-device" } });
    await usePrinterStore.getState().testDrawer(input);
    expect(dispatchCashDrawerMock).toHaveBeenCalledExactlyOnceWith(job);
  });

  it("rejects a drawer response built for another config", async () => {
    const { input, job } = drawerFixture();
    buildTestJobMock.mockResolvedValueOnce({ data: { job: { ...job, print_config_uuid: "other-printer" }, printer: {} } });
    await expect(usePrinterStore.getState().testDrawer(input)).rejects.toThrow("does not match the selected printer");
    expect(dispatchCashDrawerMock).not.toHaveBeenCalled();
    expect(dispatchPrintJobMock).not.toHaveBeenCalled();
    expect(usePrinterStore.getState().printing).toBe(false);
  });

  it("blocks drawer testing during another command or unfinished self-test", async () => {
    const { input } = drawerFixture();
    usePrinterStore.setState({ printing: true });
    await expect(usePrinterStore.getState().testDrawer(input)).rejects.toThrow("already running");
    usePrinterStore.setState({ printing: false, pendingSelfTest: { connect_type: "usb", interface_value: "win:Receipt" } });
    await expect(usePrinterStore.getState().testDrawer(input)).rejects.toThrow("Confirm the printer is ready");
    expect(buildTestJobMock).not.toHaveBeenCalled();
    expect(dispatchCashDrawerMock).not.toHaveBeenCalled();
  });

  it("does not send a drawer command built for the previous session", async () => {
    const { input, job } = drawerFixture();
    const result = deferred<BuildTestJobResponse>();
    buildTestJobMock.mockReturnValueOnce(result.promise);
    const request = usePrinterStore.getState().testDrawer(input);
    await vi.waitFor(() => expect(buildTestJobMock).toHaveBeenCalledOnce());
    resetSessionStores();
    result.resolve({ data: { job, printer: {} } });
    await request;
    expect(dispatchCashDrawerMock).not.toHaveBeenCalled();
    expect(dispatchPrintJobMock).not.toHaveBeenCalled();
  });

  it("clears the drawer busy state and surfaces the command error without printing fallback", async () => {
    const { input } = drawerFixture();
    dispatchCashDrawerMock.mockRejectedValueOnce(new Error("Agent disconnected"));
    await expect(usePrinterStore.getState().testDrawer(input)).rejects.toThrow("[dispatchCashDrawer] Agent disconnected");
    expect(usePrinterStore.getState()).toMatchObject({ printing: false, error: "[dispatchCashDrawer] Agent disconnected" });
    expect(dispatchPrintJobMock).not.toHaveBeenCalled();
    expect(renderMobileEscpos).not.toHaveBeenCalled();
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

    await expect(test).resolves.toBeNull();
    expect(dispatchPrintJobMock).not.toHaveBeenCalled();
  });
});

describe("printer diagnostics store", () => {
  const agent = { agent_id: "local", agent_name: "Cashier", device_code: "MAC1", supports_printer_readiness: true };
  const printer: Printer = {
    print_config_uuid: "receipt", printer_name: "Receipt", agent_id: "local", device_code: "MAC1",
    interface_value: "cups:Receipt", connect_type: "usb", paper_width_mm: 80, is_active: true, role_codes: ["INVOICE"], cate_uuid_fk: [],
  };
  beforeEach(() => {
    resetSessionStores();
    vi.clearAllMocks();
    vi.mocked(getPrinterReadiness).mockReset();
    usePrinterStore.setState({ agent, agentStatus: "connected", printers: [printer] });
  });

  it("checks the full local owner tuple once even when multiple saved rows share a queue", async () => {
    usePrinterStore.setState({ agentConnectionUrl: "http://127.0.0.1:8888", printers: [
      printer, { ...printer, print_config_uuid: "same-queue" }, { ...printer, print_config_uuid: "remote", agent_id: "remote" },
    ] });
    vi.mocked(getPrinterReadiness).mockResolvedValue({ state: "blocked", reason: "printer_paused" });
    await usePrinterStore.getState().refreshPrinterDiagnostics();
    expect(getPrinterReadiness).toHaveBeenCalledExactlyOnceWith({
      interface_value: "cups:Receipt", expected_agent_id: "local", expected_device_code: "MAC1",
    }, { agentUrl: "http://127.0.0.1:8888", signal: expect.any(AbortSignal) });
    expect(usePrinterStore.getState().printerDiagnostics).toHaveLength(2);
    expect(usePrinterStore.getState().printerDiagnostics[0].status.reason).toBe("printer_paused");
    expect(usePrinterStore.getState().loadingPrinterDiagnostics).toBe(false);
  });

  it("coalesces overlapping refreshes without issuing a second queue query", async () => {
    const pending = deferred<{ state: "unknown"; reason: string }>();
    vi.mocked(getPrinterReadiness).mockReturnValue(pending.promise);
    const first = usePrinterStore.getState().refreshPrinterDiagnostics();
    const second = usePrinterStore.getState().refreshPrinterDiagnostics();
    expect(first).toBe(second);
    await Promise.resolve();
    pending.resolve({ state: "unknown", reason: "printer_offline_reported" });
    await first;
    expect(getPrinterReadiness).toHaveBeenCalledTimes(1);
  });

  it("aborts on logout and ignores a late diagnostics response", async () => {
    const pending = deferred<{ state: "blocked"; reason: string }>();
    vi.mocked(getPrinterReadiness).mockReturnValue(pending.promise);
    const check = usePrinterStore.getState().refreshPrinterDiagnostics();
    await Promise.resolve();
    resetSessionStores();
    expect(vi.mocked(getPrinterReadiness).mock.calls[0][1]?.signal?.aborted).toBe(true);
    pending.resolve({ state: "blocked", reason: "printer_paused" });
    await check;
    expect(usePrinterStore.getState()).toMatchObject({ agent: null, printerDiagnostics: [], loadingPrinterDiagnostics: false });
  });

  it("does not attach an old read to a changed printer owner or saved interface", async () => {
    const pending = deferred<{ state: "blocked"; reason: string }>();
    vi.mocked(getPrinterReadiness).mockReturnValue(pending.promise);
    const check = usePrinterStore.getState().refreshPrinterDiagnostics();
    await Promise.resolve();
    usePrinterStore.setState({ printers: [{ ...printer, interface_value: "cups:New" }] });
    pending.resolve({ state: "blocked", reason: "printer_paused" });
    await check;
    expect(usePrinterStore.getState().printerDiagnostics).toEqual([]);
  });

  it("does not overwrite a reconnected Agent's newer diagnostics", async () => {
    const pending = deferred<{ state: "blocked"; reason: string }>();
    vi.mocked(getPrinterReadiness).mockReturnValueOnce(pending.promise).mockResolvedValueOnce({ state: "unknown", reason: "printer_offline_reported" });
    const old = usePrinterStore.getState().refreshPrinterDiagnostics();
    await Promise.resolve();
    resolvePrinterDeviceIdentityMock.mockResolvedValueOnce({ ok: true, agent });
    await usePrinterStore.getState().checkAgent();
    await usePrinterStore.getState().refreshPrinterDiagnostics();
    pending.resolve({ state: "blocked", reason: "printer_paused" });
    await old;
    expect(usePrinterStore.getState().printerDiagnostics[0].status.reason).toBe("printer_offline_reported");
  });

  it("keeps old Agents compatible and failed reads unknown without marking them ready", async () => {
    usePrinterStore.setState({ agent: { ...agent, supports_printer_readiness: undefined } });
    await usePrinterStore.getState().refreshPrinterDiagnostics();
    expect(getPrinterReadiness).not.toHaveBeenCalled();
    usePrinterStore.setState({ agent });
    vi.mocked(getPrinterReadiness).mockRejectedValueOnce(new Error("offline"));
    await usePrinterStore.getState().refreshPrinterDiagnostics();
    expect(usePrinterStore.getState().printerDiagnostics[0].status.state).toBe("unknown");
  });
});
