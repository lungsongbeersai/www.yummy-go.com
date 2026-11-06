import { describe, expect, it } from "vitest";
import type { Printer } from "@/services/printer";
import {
  isUnverifiedLanPrinter,
  canManuallyTestListedPrinter,
  printerListHealth,
  printerListNetworkState,
  printerListPresentation,
  printersInListScope,
  summarizePrinterList,
  type PrinterListNetworkMap,
} from "./printer-list-visibility";
import { printerListScopeKey } from "@/lib/printer-list-mode";

function printer(id: string, accessMode: "DIRECT" | "LAN" | "INTERNET" = "LAN"): Printer {
  return {
    print_config_uuid: id, printer_name: id, printer_type: "epson", connect_type: "tcp",
    interface_value: "tcp://192.168.1.12:9100", paper_width_mm: 80, is_active: true,
    role_codes: [], cate_uuid_fk: [], access_mode: accessMode,
    sharing_mode: accessMode === "DIRECT" ? "DEDICATED" : "SHARED",
    is_shared: accessMode !== "DIRECT", agent_online: true,
  };
}

describe("printer list location presentation", () => {
  const network: PrinterListNetworkMap = {
    local: { state: "local", reason: "owner_identity_verified" },
    unknown: { state: "unknown", reason: "owner_identity_unconfirmed" },
  };

  it("hides only unverified LAN rows while keeping DIRECT and INTERNET entries", () => {
    const rows = [printer("local"), printer("unknown"), printer("missing"), printer("direct", "DIRECT"), printer("internet", "INTERNET")];
    expect(printersInListScope(rows, "here", network).map((row) => row.print_config_uuid))
      .toEqual(["local", "direct", "internet"]);
    expect(printersInListScope(rows, "saved", network)).toEqual(rows);
    expect(rows).toHaveLength(5);
    expect(rows[1]?.agent_online).toBe(true);
  });

  it("does not treat the same saved TCP address, owner flag or online heartbeat as proof", () => {
    const row = { ...printer("unconfirmed"), is_owner: true, is_local_device: true };
    expect(isUnverifiedLanPrinter(row, network)).toBe(true);
    expect(printerListHealth(row, network)).toBe("unreachable");
    expect(printerListHealth({ ...row, is_active: false }, network)).toBe("disabled");
    expect(printerListHealth(printer("local"), network)).toBe("ready");
  });

  it("counts the selected list scope without rewriting saved configuration or print readiness", () => {
    const rows = [printer("local"), printer("unknown"), { ...printer("internet", "INTERNET"), agent_online: false }];
    expect(summarizePrinterList(printersInListScope(rows, "here", network), network))
      .toEqual({ total: 2, active: 2, inactive: 0, attention: 1 });
    expect(summarizePrinterList(rows, network))
      .toEqual({ total: 3, active: 3, inactive: 0, attention: 2 });
    expect(rows[1]?.agent_online).toBe(true);
    expect(rows[1]?.is_active).toBe(true);
  });

  it("tests only the selected operational UUID, even when a different active printer exists", () => {
    const selected = printer("local");
    const otherActive = printer("another-printer", "INTERNET");
    expect(canManuallyTestListedPrinter(selected, [otherActive], network)).toBe(false);
    expect(canManuallyTestListedPrinter(selected, [otherActive, selected], network)).toBe(true);
    expect(printersInListScope([selected], "here", network)).toEqual([selected]);
    expect(printerListNetworkState(selected, network)).toBe("local");
  });

  it("requires both current operational membership and current LAN verification", () => {
    const lan = printer("unknown");
    const internet = printer("internet", "INTERNET");
    const direct = printer("direct", "DIRECT");
    expect(canManuallyTestListedPrinter(lan, [lan], network)).toBe(false);
    expect(canManuallyTestListedPrinter(internet, [], network)).toBe(false);
    expect(canManuallyTestListedPrinter(internet, [internet], network)).toBe(true);
    expect(canManuallyTestListedPrinter(direct, [direct], network)).toBe(true);
    expect(canManuallyTestListedPrinter(printer("local"), [printer("local")], {})).toBe(false);
  });

  it("hides the previous branch or device's catalog synchronously before a new effect loads it", () => {
    const original = {
      scopeKey: printerListScopeKey("user", "device-a", "branch-a"),
      catalog: [printer("direct", "DIRECT"), printer("internet", "INTERNET"), printer("local")],
      networkVisibilityByPrinter: network,
      loading: false, checkingNetwork: true, error: "Previous branch error",
    };
    for (const expected of [
      printerListScopeKey("user", "device-a", "branch-b"),
      printerListScopeKey("user", "device-b", "branch-a"),
    ]) {
      const view = printerListPresentation(original, expected);
      expect(view.catalog).toEqual([]);
      expect(view.networkVisibilityByPrinter).toEqual({});
      expect(view.error).toBeNull();
      expect(view.checkingNetwork).toBe(false);
      expect(view.loading).toBe(true);
      expect(printersInListScope(view.catalog, "saved", view.networkVisibilityByPrinter)).toEqual([]);
    }
    expect(original.catalog).toHaveLength(3);
    expect(original.error).toBe("Previous branch error");
  });

  it("preserves the current scope's live catalog, proof and loading or error state", () => {
    const current = {
      scopeKey: printerListScopeKey("user", "device-a", "branch-a"),
      catalog: [printer("local")], networkVisibilityByPrinter: network,
      loading: false, checkingNetwork: false, error: null,
    };
    expect(printerListPresentation(current, current.scopeKey)).toBe(current);
    const failed = { ...current, catalog: [], error: "Current API failed" };
    expect(printerListPresentation(failed, current.scopeKey)).toBe(failed);
  });
});
