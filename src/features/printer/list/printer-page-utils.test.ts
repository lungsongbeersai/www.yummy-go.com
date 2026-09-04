import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Printer } from "@/services/printer";
import {
  agentDownloadUrl,
  matchesPrinterOwnership,
  OWNER_ALL,
  OWNER_MINE,
  OWNER_SHARED,
  printerCategories,
  printerZones,
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

describe("what the printers page keeps working while offline", () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const pageSource = readFileSync(join(testDir, "printer-page.tsx"), "utf8");
  const hookSource = readFileSync(join(testDir, "use-printer-page.ts"), "utf8");

  it("gates only the Backend-backed action on the offline verdict", () => {
    // Losing Backend is exactly when someone is installing a Driver or the Agent,
    // and those are static files this app serves itself. Hiding the whole row
    // took them away at the one moment they are needed.
    const toolbar = pageSource.slice(
      pageSource.indexOf('<div className="flex shrink-0 items-center gap-2">'),
    );
    const gated = toolbar.split("readOnly ? null : (");
    expect(gated).toHaveLength(2);
    expect(gated[1]).toContain('href="/printers/form"');
    for (const download of [
      "XPRINTER_DRIVER_URL",
      "/downloads/laoscript8.msi",
      "PRINTER_SETUP_DOWNLOAD_URL",
      "printer.downloadAgent",
    ]) {
      expect(gated[0]).toContain(download);
    }
  });

  it("refetches when the transport verdict settles, so it can leave offline again", () => {
    // The mount load is the only request this page makes. A read the Agent
    // served latches offlineSession, and only a successful Backend response
    // clears it — so without this the page never asked again and stayed
    // read-only after the connection came back.
    expect(hookSource).toContain("useOfflineRefetchEpoch()");
    const effect = hookSource.slice(hookSource.indexOf("if (refetchEpoch === 0) return;"));
    expect(effect.slice(0, effect.indexOf("}, ["))).toContain("void load();");
    expect(effect).toContain("}, [load, refetchEpoch]);");
  });
});
