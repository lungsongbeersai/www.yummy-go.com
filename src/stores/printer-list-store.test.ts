import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPrinterManagementCatalog, resolvePrinterListVisibility,
  type Printer, type PrinterListNetworkStatus,
} from "@/services/printer";
import { usePrinterListStore } from "./printer-list-store";
import { resetSessionStores } from "@/stores/session-store-registry";

vi.mock("@/services/printer", () => ({
  getPrinterManagementCatalog: vi.fn(), resolvePrinterListVisibility: vi.fn(),
}));
const fetchCatalog = vi.mocked(getPrinterManagementCatalog);
const checkNetwork = vi.mocked(resolvePrinterListVisibility);
const context = {
  agent: { agent_id: "local-agent", device_code: "local-device", agent_name: "Counter" },
  connected: true,
  scopeKey: "user:branch",
};
const params = { login_uuid_fk: "user", device_code: "local-device", lang: "la" };
const printer = (uuid: string): Printer => ({
  print_config_uuid: uuid, printer_name: uuid, connect_type: "tcp",
  interface_value: "tcp://192.168.1.20:9100", paper_width_mm: 80,
  is_active: true, role_codes: [], cate_uuid_fk: [], access_mode: "LAN", is_shared: true,
});
type NetworkMap = Record<string, PrinterListNetworkStatus>;
const local: PrinterListNetworkStatus = { state: "local", reason: "owner_verified" };
const unknown: PrinterListNetworkStatus = { state: "unknown", reason: "owner_unreachable" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (value: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe("printer management list store", () => {
  beforeEach(() => {
    usePrinterListStore.getState().reset();
    vi.resetAllMocks();
    checkNetwork.mockResolvedValue({});
  });

  it("keeps the full saved catalog separate from its visibility observations", async () => {
    const catalog = [printer("here"), printer("elsewhere")];
    fetchCatalog.mockResolvedValue(catalog);
    checkNetwork.mockResolvedValue({ here: local, elsewhere: unknown });
    await usePrinterListStore.getState().load(params, context);
    expect(usePrinterListStore.getState()).toMatchObject({
      catalog, networkVisibilityByPrinter: { here: local, elsewhere: unknown },
      loading: false, checkingNetwork: false, error: null,
    });
    expect(catalog[1]).not.toHaveProperty("network_visibility");
  });

  it("invalidates the previous Wi-Fi proof immediately while refreshing", async () => {
    fetchCatalog.mockResolvedValue([printer("printer")]);
    checkNetwork.mockResolvedValue({ printer: local });
    await usePrinterListStore.getState().load(params, context);
    const nextCatalog = deferred<Printer[]>();
    fetchCatalog.mockReturnValueOnce(nextCatalog.promise);
    const refresh = usePrinterListStore.getState().load(params, context);
    expect(usePrinterListStore.getState().networkVisibilityByPrinter).toEqual({});
    expect(usePrinterListStore.getState().catalog).toHaveLength(1);
    checkNetwork.mockResolvedValueOnce({ printer: unknown });
    nextCatalog.resolve([printer("printer")]);
    await refresh;
    expect(usePrinterListStore.getState().networkVisibilityByPrinter.printer).toEqual(unknown);
  });

  it("clears another user's branch or device catalog before the new read returns", async () => {
    fetchCatalog.mockResolvedValueOnce([printer("old")]);
    await usePrinterListStore.getState().load(params, context);
    const pending = deferred<Printer[]>();
    fetchCatalog.mockReturnValueOnce(pending.promise);
    const load = usePrinterListStore.getState().load({ ...params, device_code: "new-device" }, {
      ...context, scopeKey: "other-user:other-branch",
    });
    expect(usePrinterListStore.getState().catalog).toEqual([]);
    pending.resolve([printer("new")]);
    await load;
    expect(usePrinterListStore.getState().catalog[0]?.print_config_uuid).toBe("new");
  });

  it("never restores an old network check after a newer context wins", async () => {
    const oldProof = deferred<NetworkMap>();
    fetchCatalog.mockResolvedValueOnce([printer("old")]).mockResolvedValueOnce([printer("new")]);
    checkNetwork.mockReturnValueOnce(oldProof.promise).mockResolvedValueOnce({ new: unknown });
    const older = usePrinterListStore.getState().load(params, context);
    await vi.waitFor(() => expect(checkNetwork).toHaveBeenCalledOnce());
    const oldSignal = checkNetwork.mock.calls[0][2];
    await usePrinterListStore.getState().load(params, context);
    expect(oldSignal?.aborted).toBe(true);
    oldProof.resolve({ old: local });
    await older;
    expect(usePrinterListStore.getState().catalog.map((row) => row.print_config_uuid)).toEqual(["new"]);
    expect(usePrinterListStore.getState().networkVisibilityByPrinter).toEqual({ new: unknown });
  });

  it("drops a completed or failed obsolete catalog request", async () => {
    const oldRead = deferred<Printer[]>();
    fetchCatalog.mockReturnValueOnce(oldRead.promise).mockResolvedValueOnce([printer("current")]);
    const older = usePrinterListStore.getState().load(params, context);
    await usePrinterListStore.getState().load(params, context);
    oldRead.reject(new Error("Old network failed"));
    await expect(older).resolves.toBeUndefined();
    expect(usePrinterListStore.getState().error).toBeNull();
    expect(usePrinterListStore.getState().catalog[0]?.print_config_uuid).toBe("current");
  });

  it("clears old settings and proofs when the catalog API fails", async () => {
    fetchCatalog.mockResolvedValueOnce([printer("old")]);
    checkNetwork.mockResolvedValueOnce({ old: local });
    await usePrinterListStore.getState().load(params, context);
    fetchCatalog.mockRejectedValueOnce(new Error("Catalog unavailable"));
    await expect(usePrinterListStore.getState().load(params, context)).rejects.toThrow("Catalog unavailable");
    expect(usePrinterListStore.getState()).toMatchObject({
      catalog: [], networkVisibilityByPrinter: {}, error: "Catalog unavailable", loading: false,
    });
  });

  it("cannot repopulate the catalog after logout", async () => {
    const pending = deferred<Printer[]>();
    fetchCatalog.mockReturnValueOnce(pending.promise);
    const load = usePrinterListStore.getState().load(params, context);
    resetSessionStores();
    pending.resolve([printer("old-session")]);
    await load;
    expect(usePrinterListStore.getState()).toMatchObject({ catalog: [], scopeKey: "", loading: false });
    expect(checkNetwork).not.toHaveBeenCalled();
  });

  it("wakeup invalidation prevents in-flight checks from restoring earlier proof", async () => {
    const pending = deferred<NetworkMap>();
    fetchCatalog.mockResolvedValueOnce([printer("printer")]);
    checkNetwork.mockReturnValueOnce(pending.promise);
    const load = usePrinterListStore.getState().load(params, context);
    await vi.waitFor(() => expect(checkNetwork).toHaveBeenCalledOnce());
    usePrinterListStore.getState().invalidateNetwork();
    pending.resolve({ printer: local });
    await load;
    expect(usePrinterListStore.getState()).toMatchObject({
      networkVisibilityByPrinter: {}, checkingNetwork: false, loading: false,
    });
  });
});
