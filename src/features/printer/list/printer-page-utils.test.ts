import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Printer } from "@/services/printer";
import {
  agentDownloadUrl,
  canDeletePrinter,
  canEditPrinter,
  isOwnedPrinter,
  matchesPrinterOwnership,
  matchesPrinterStatus,
  OWNER_ALL,
  OWNER_MINE,
  OWNER_SHARED,
  printerCategories,
  printerHealth,
  printerReachable,
  printerZones,
  summarizePrinters,
} from "./printer-page-utils";

describe("agent download URL", () => {
  it("adds a fresh cache key without changing the installer path", () => {
    expect(
      agentDownloadUrl(
        {
          download_url:
            "https://files.example.com/agent/Yummy-Go%20Printer%20Agent%20Setup%201.0.0.exe",
        },
        12345,
      ),
    ).toBe(
      "https://files.example.com/agent/Yummy-Go%20Printer%20Agent%20Setup%201.0.0.exe?agent_download=12345",
    );
  });

  it("preserves existing query parameters", () => {
    expect(
      agentDownloadUrl(
        { download_url: "https://files.example.com/agent.exe?token=abc" },
        "latest",
      ),
    ).toBe(
      "https://files.example.com/agent.exe?token=abc&agent_download=latest",
    );
  });
});

function printer(isOwner?: boolean): Printer {
  return {
    print_config_uuid: "printer-1",
    printer_name: "Printer",
    printer_type: "epson",
    connect_type: "usb",
    interface_value: "cups:Printer",
    paper_width_mm: 80,
    is_active: true,
    role_codes: [],
    cate_uuid_fk: [],
    is_owner: isOwner,
  };
}

describe("printer ownership filter", () => {
  it("separates own and shared printers while preserving legacy ownership", () => {
    expect(matchesPrinterOwnership(printer(true), OWNER_MINE)).toBe(true);
    expect(matchesPrinterOwnership(printer(true), OWNER_SHARED)).toBe(false);
    expect(matchesPrinterOwnership(printer(false), OWNER_SHARED)).toBe(true);
    expect(matchesPrinterOwnership(printer(false), OWNER_MINE)).toBe(false);
    expect(matchesPrinterOwnership(printer(), OWNER_MINE)).toBe(true);
    expect(matchesPrinterOwnership(printer(false), OWNER_ALL)).toBe(true);
  });

  it("keeps a foreign shared printer read-only when legacy permissions are absent", () => {
    const shared = {
      ...printer(),
      sharing_mode: "SHARED" as const,
      is_shared: true,
      is_owner: undefined,
    };

    expect(isOwnedPrinter(shared)).toBe(false);
    expect(canEditPrinter(shared)).toBe(false);
    expect(canDeletePrinter(shared)).toBe(false);
  });

  it("never edits or deletes a printer marked as belonging to another device", () => {
    const foreign = {
      ...printer(true),
      is_local_device: false,
    };

    expect(canEditPrinter(foreign)).toBe(false);
    expect(canDeletePrinter(foreign)).toBe(false);
  });
});

describe("printerZones / printerCategories", () => {
  it("dedupes zones by uuid when backend embeds the same zone twice", () => {
    const row: Printer = {
      ...printer(),
      mapping_type: "ZONE",
      zone_uuid_fk: ["zone-a", "zone-a"],
      zones: [
        { zone_uuid: "zone-a", zone_name_eng: "Zone A" },
        { zone_uuid: "zone-a", zone_name_eng: "Zone A" },
        { zone_uuid: "zone-b", zone_name_eng: "Zone B" },
      ],
    };

    expect(printerZones(row, []).map((zone) => zone.zone_uuid)).toEqual([
      "zone-a",
      "zone-b",
    ]);
  });

  it("dedupes categories by uuid when backend embeds the same category twice", () => {
    const row: Printer = {
      ...printer(),
      cate_uuid_fk: ["cate-a", "cate-a"],
      categories: [
        { cate_uuid: "cate-a", cate_name_eng: "Drink" },
        { cate_uuid: "cate-a", cate_name_eng: "Drink" },
        { cate_uuid: "cate-b", cate_name_eng: "Food" },
      ],
    };

    expect(printerCategories(row, []).map((category) => category.cate_uuid)).toEqual([
      "cate-a",
      "cate-b",
    ]);
  });
});

describe("printers page online-only controls", () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const pageSource = readFileSync(join(testDir, "printer-page.tsx"), "utf8");
  const hookSource = readFileSync(join(testDir, "use-printer-page.ts"), "utf8");

  it("keeps setup downloads and add-printer available", () => {
    // ปุ่มดาวน์โหลดทั้ง 4 รวมเข้าเมนู "ติดตั้ง & ดาวน์โหลด" เดียว (printer-downloads-menu.tsx) ที่หน้าเรียกใช้ทุกขนาดจอ
    const menuSource = readFileSync(join(testDir, "printer-downloads-menu.tsx"), "utf8");
    expect(pageSource).toContain('href="/printers/form"');
    expect(pageSource).toContain("<PrinterDownloadsMenu");
    for (const download of [
      "XPRINTER_DRIVER_URL",
      "/downloads/laoscript8.msi",
      "PRINTER_SETUP_DOWNLOAD_URL",
      "printer.downloadAgent",
    ]) {
      expect(menuSource).toContain(download);
    }
  });

  it("contains no retired transport-mode hooks", () => {
    expect(hookSource).not.toContain("useOfflineRefetchEpoch");
    expect(pageSource).not.toContain("useOfflineReadOnly");
  });
});

describe("printer health", () => {
  it("separates disabled, unreachable and ready printers", () => {
    expect(printerHealth({ ...printer(true), is_active: false })).toBe("disabled");
    expect(printerHealth({ ...printer(false), is_shared: true, agent_online: false })).toBe("unreachable");
    expect(printerHealth({ ...printer(true), is_local_device: false })).toBe("unreachable");
    expect(printerHealth({ ...printer(false), is_shared: true, agent_online: true })).toBe("ready");
    expect(printerHealth(printer())).toBe("ready");
  });

  it("keeps test prints available on disabled but reachable printers", () => {
    expect(printerReachable({ ...printer(true), is_active: false })).toBe(true);
    expect(printerReachable({ ...printer(false), is_shared: true, agent_online: false })).toBe(false);
    expect(printerReachable({ ...printer(true), is_local_device: false })).toBe(false);
  });

  it("filters and counts printers by status", () => {
    const rows = [
      printer(true),
      { ...printer(true), is_active: false },
      { ...printer(false), is_shared: true, agent_online: false },
    ];

    expect(rows.filter((row) => matchesPrinterStatus(row, "attention"))).toHaveLength(1);
    expect(rows.filter((row) => matchesPrinterStatus(row, "inactive"))).toHaveLength(1);
    expect(rows.filter((row) => matchesPrinterStatus(row, "all"))).toHaveLength(3);
    expect(summarizePrinters(rows)).toEqual({ active: 2, attention: 1, inactive: 1, total: 3 });
  });
});
