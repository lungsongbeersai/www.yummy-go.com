import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import type { PrintJob, SavePrinterInput } from "@/services/printer";
import { getPrinterDeliveryState } from "@/services/printer/helpers";

const apiMocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/api", () => ({
  apiRequest: apiMocks.apiRequest,
  ServiceError: class extends Error {},
}));

import { getPrinterEmployeeRoles, renderMobileEscpos, savePrinter, searchPrinters } from "@/services/printer/config-api";

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

  beforeEach(() => vi.clearAllMocks());

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
