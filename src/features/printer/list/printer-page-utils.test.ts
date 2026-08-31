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
