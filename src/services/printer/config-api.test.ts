import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import type { PrintJob, SavePrinterInput } from "@/services/printer";
import { getPrinterDeliveryState } from "@/services/printer/helpers";

const apiMocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const nativeMocks = vi.hoisted(() => ({ native: false, platform: "web", tcp: false }));
vi.mock("@capacitor/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@capacitor/core")>();
  return { ...actual, Capacitor: { ...actual.Capacitor,
    isNativePlatform: () => nativeMocks.native,
    getPlatform: () => nativeMocks.platform,
    isPluginAvailable: (name: string) => name === "TcpSocket" && nativeMocks.tcp,
  } };
});
vi.mock("@/lib/api", () => ({
  apiRequest: apiMocks.apiRequest,
  ServiceError: class extends Error {},
}));

import { getPrinterEmployeeRoles, getPrinters, getPrinterManagementCatalog, registerSunmiNativePrinterOwner, renderMobileEscpos, savePrinter, searchPrinters } from "@/services/printer/config-api";

describe("printer configuration API", () => {
  const input: SavePrinterInput = {
    login_uuid_fk: "login", display_name: "Bar", connect_type: "tcp",
    ip: "192.168.1.20", paper_width_mm: 80, kitchen_cut_mode: "per_ticket",
    role_codes: ["b-001"], mapping_type: "CATEGORY", cate_uuid_fk: ["drinks"],
    sharing_mode: "DEDICATED", agent_url: "http://127.0.0.1:7777",
    agent_id: "agent", agent_name: "Counter", device_code: "device",
  };
  const renderJob: PrintJob = {
    lang: "la", paper_width_mm: 80, printer_type: "receipt", ops: [],
    interface_value: "tcp://192.168.1.20:9100",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    nativeMocks.native = false;
    nativeMocks.platform = "web";
    nativeMocks.tcp = false;
  });

  it("saves an SDK destination without inventing a TCP/USB endpoint or localhost Agent URL", async () => {
    apiMocks.apiRequest.mockResolvedValueOnce({ data: { print_config_uuid: "builtin" } });
    await savePrinter({ ...input, connect_type: "sunmi", interface_value: "sunmi://builtin",
      print_mode: "sunmi_builtin", agent_id: "sunmi-native", device_code: "android-native-device",
      access_mode: "INTERNET", sharing_mode: "SHARED" });
    const options = apiMocks.apiRequest.mock.calls[0][2];
    expect(options.data).toMatchObject({ connect_type: "sunmi", interface_value: "sunmi://builtin",
      print_mode: "sunmi_builtin", agent_url: "", access_mode: "INTERNET", sharing_mode: "SHARED" });
    expect(options.data).not.toHaveProperty("ip");
    expect(options.data).not.toHaveProperty("port");
  });

  it("registers supported paper-out hardware without advertising it as a ready receiver", async () => {
    apiMocks.apiRequest.mockResolvedValueOnce({ data: { supported: true, ready: false } });
    await registerSunmiNativePrinterOwner("cashier", {
      agent_id: "sunmi-native", agent_name: "D2s built-in", device_code: "android-native-device",
      print_mode: "sunmi_builtin", supports_sunmi_builtin: true, sunmi_ready: false,
    });
    expect(apiMocks.apiRequest).toHaveBeenCalledExactlyOnceWith("post", "/api/v1/printer/native/register", {
      timeout: 5000,
      data: { login_uuid_fk: "cashier", device_code: "android-native-device", agent_id: "sunmi-native",
        agent_name: "D2s built-in", platform: "android", ready: false,
        capabilities: { sunmi_builtin: true, protocol_version: 1 } },
    });
  });

  it("never registers an ordinary mobile identity as a SUNMI receiver", async () => {
    await expect(registerSunmiNativePrinterOwner("cashier", {
      agent_id: "mobile", agent_name: "Phone", device_code: "android-native-device", print_mode: "mobile_wifi",
    })).rejects.toMatchObject({ delivery_state: "not_sent" });
    expect(apiMocks.apiRequest).not.toHaveBeenCalled();
  });

  it("registers the native TCP relay independently of built-in paper readiness", async () => {
    nativeMocks.native = true;
    nativeMocks.platform = "android";
    nativeMocks.tcp = true;
    apiMocks.apiRequest.mockResolvedValueOnce({ data: { supported: true, ready: false, tcp_ready: true } });
    await registerSunmiNativePrinterOwner("cashier", {
      agent_id: "sunmi-native", agent_name: "D2s", device_code: "android-native-device",
      print_mode: "sunmi_builtin", supports_sunmi_builtin: true, supports_tcp_relay: true, sunmi_ready: false,
    });
    expect(apiMocks.apiRequest).toHaveBeenCalledExactlyOnceWith("post", "/api/v1/printer/native/register", {
      timeout: 5000,
      data: { login_uuid_fk: "cashier", device_code: "android-native-device", agent_id: "sunmi-native",
        agent_name: "D2s", platform: "android", ready: false, tcp_ready: true,
        capabilities: { sunmi_builtin: true, protocol_version: 1, tcp_relay: true } },
    });
  });

  it.each(["browser", "ios", "missing-plugin"])("never advertises TCP relay from a %s client", async (kind) => {
    nativeMocks.native = kind !== "browser";
    nativeMocks.platform = kind === "ios" ? "ios" : "android";
    nativeMocks.tcp = kind !== "missing-plugin";
    apiMocks.apiRequest.mockResolvedValueOnce({ data: { supported: true, ready: true } });
    await registerSunmiNativePrinterOwner("cashier", {
      agent_id: "sunmi-native", agent_name: "D2s", device_code: "android-native-device",
      print_mode: "sunmi_builtin", supports_sunmi_builtin: true, supports_tcp_relay: true, sunmi_ready: true,
    });
    const data = apiMocks.apiRequest.mock.calls[0][2].data;
    expect(data).not.toHaveProperty("tcp_ready");
    expect(data.capabilities).not.toHaveProperty("tcp_relay");
  });

  it("requests an explicit branch management catalog without changing operational fetches", async () => {
    const rows = [{ print_config_uuid: "remote-lan", sharing_mode: "SHARED", is_shared: true,
      is_owner: false, agent_online: false, access_mode: "LAN", owner_device_code: "other" }];
    apiMocks.apiRequest.mockResolvedValueOnce({ status: "success", data: { catalog_view: true, data: rows } });
    const catalog = await getPrinterManagementCatalog({ login_uuid_fk: "login", device_code: "local", lang: "en" });
    expect(catalog.map((printer) => printer.print_config_uuid)).toEqual(["remote-lan"]);
    expect(apiMocks.apiRequest).toHaveBeenLastCalledWith("get", "/api/v1/printer/fetch", { params: {
      login_uuid_fk: "login", device_code: "local", lang: "eng",
      management_view: "1", include_offline_shared: "1", catalog_view: "1",
    } });

    apiMocks.apiRequest.mockResolvedValueOnce({ status: "success", data: rows });
    expect(await getPrinters({ login_uuid_fk: "login", device_code: "local" })).toEqual([]);
    expect(apiMocks.apiRequest).toHaveBeenLastCalledWith("get", "/api/v1/printer/fetch", {
      params: { login_uuid_fk: "login", device_code: "local", lang: "la" },
    });
  });

  it("refuses to label an older network-filtered response as the full catalog", async () => {
    apiMocks.apiRequest.mockResolvedValueOnce({ status: "success", data: { data: [] } });
    await expect(getPrinterManagementCatalog({ login_uuid_fk: "login" })).rejects.toThrow("management catalog is unavailable");
  });

  it("retains the dedicated-device boundary in the full catalog", async () => {
    apiMocks.apiRequest.mockResolvedValueOnce({ data: { catalog_view: true, data: [
      { print_config_uuid: "mine", device_code: "local", is_owner: true },
      { print_config_uuid: "private-other", device_code: "other", is_owner: false },
    ] } });
    expect((await getPrinterManagementCatalog({ login_uuid_fk: "login", device_code: "local" }))
      .map((printer) => printer.print_config_uuid)).toEqual(["mine"]);
  });

  it.each([
    new Error("Renderer response lost"),
    Object.freeze(new Error("Renderer unavailable")),
    "Renderer failed",
  ])("keeps a failed render safe to retry before printer transport starts: %s", async (failure) => {
    apiMocks.apiRequest.mockRejectedValueOnce(failure);
    const error: unknown = await renderMobileEscpos(renderJob)
      .catch((caught: unknown) => caught);
    expect(getPrinterDeliveryState(error)).toBe("not_sent");
    expect(error).toBeInstanceOf(Error);
  });

  it("keeps a malformed render response safe to retry", async () => {
    apiMocks.apiRequest.mockResolvedValueOnce({ data: {} });
    await expect(renderMobileEscpos(renderJob))
      .rejects.toMatchObject({ delivery_state: "not_sent" });
  });

  it("allows bounded native discovery to finish without a five-second false failure", async () => {
    const request = vi.spyOn(axios, "get").mockResolvedValueOnce({ data: { ok: true, data: [] } });
    await searchPrinters("usb", true);
    expect(request).toHaveBeenCalledWith(expect.stringContaining("/printer/search-printer"), expect.objectContaining({
      params: { mode: "usb", refresh: "1" }, timeout: 40000,
    }));
    request.mockRestore();
  });

  it("loads actual employee roles with API language normalization", async () => {
    const roles = [{ roles_id: 17, roles_name: "Counter", roles_name_la: "ແຄັດເຊຍ", roles_name_eng: "Cashier" }];
    apiMocks.apiRequest.mockResolvedValueOnce({ status: "success", data: roles });
    expect(await getPrinterEmployeeRoles("en")).toEqual(roles);
    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/printer/employee-roles", {
      params: { lang: "eng" },
    });
  });

  it.each([1, 2] as const)("round-trips hidden category rules in mode %s", async (mode) => {
    const permissions = [{ cate_uuid_fk: "drinks", all_roles: false, allowed_role_ids: [17] }];
    apiMocks.apiRequest.mockResolvedValueOnce({
      data: { print_config_uuid: "printer", print_role_mode: mode, category_print_permissions: permissions },
    });
    const printer = await savePrinter({ ...input, print_role_mode: mode, category_print_permissions: permissions });
    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/printer/create", {
      data: expect.objectContaining({ print_role_mode: mode, category_print_permissions: permissions }),
    });
    expect(printer.print_role_mode).toBe(mode);
    expect(printer.category_print_permissions).toEqual(permissions);
  });

  it("omits permission fields for older callers instead of resetting existing settings", async () => {
    apiMocks.apiRequest.mockResolvedValueOnce({ data: { print_config_uuid: "printer" } });
    await savePrinter(input);
    const request = apiMocks.apiRequest.mock.calls[0][2] as { data: Record<string, unknown> };
    expect(request.data).not.toHaveProperty("print_role_mode");
    expect(request.data).not.toHaveProperty("category_print_permissions");
  });

  it.each([
    { connectType: "tcp", printShowLogo: true },
    { connectType: "tcp", printShowLogo: false },
    { connectType: "usb", printShowLogo: true },
    { connectType: "usb", printShowLogo: false },
  ] as const)("round-trips invoice and receipt logos on $connectType printers with setting $printShowLogo", async ({ connectType, printShowLogo }) => {
    apiMocks.apiRequest.mockResolvedValueOnce({
      data: { print_config_uuid: "printer", print_show_logo: printShowLogo },
    });

    const printer = await savePrinter({
      ...input,
      connect_type: connectType,
      interface_value: connectType === "usb" ? "win:Receipt" : "tcp://192.168.1.20:9100",
      role_codes: ["invoice", "receipt"],
      print_show_logo: printShowLogo,
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/printer/create", {
      data: expect.objectContaining({ print_show_logo: printShowLogo }),
    });
    expect(printer.print_show_logo).toBe(printShowLogo);
  });

  it("omits the logo field for older callers to preserve the printer setting", async () => {
    apiMocks.apiRequest.mockResolvedValueOnce({ data: { print_config_uuid: "printer", print_show_logo: true } });
    const printer = await savePrinter(input);
    const request = apiMocks.apiRequest.mock.calls[0][2] as { data: Record<string, unknown> };
    expect(JSON.parse(JSON.stringify(request.data))).not.toHaveProperty("print_show_logo");
    expect(printer.print_show_logo).toBe(true);
  });
});
