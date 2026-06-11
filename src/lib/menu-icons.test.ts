import { describe, expect, it } from "vitest";
import {
  DEFAULT_MENU_ICON,
  MENU_ICON_RESULT_LIMIT,
  buildMenuIconOptions,
  normalizeMenuIconName
} from "@/lib/menu-icons";

describe("menu icon helpers", () => {
  it("normalizes legacy icon names to MDI values", () => {
    expect(normalizeMenuIconName("file-text")).toBe("mdi:file-document-outline");
    expect(normalizeMenuIconName("fa fa-file")).toBe("mdi:file-document-outline");
    expect(normalizeMenuIconName("shopping-cart")).toBe("mdi:cart-outline");
  });

  it("keeps valid MDI icon values", () => {
    expect(normalizeMenuIconName("mdi:printer")).toBe("mdi:printer");
  });

  it("falls back for invalid icon values", () => {
    expect(normalizeMenuIconName("not-real-icon")).toBe(DEFAULT_MENU_ICON);
    expect(normalizeMenuIconName("mdi:not-real-icon")).toBe(DEFAULT_MENU_ICON);
  });

  it("builds searchable options from the MDI collection with a render limit", () => {
    const all = buildMenuIconOptions();
    const printer = buildMenuIconOptions({ search: "printer" });

    expect(MENU_ICON_RESULT_LIMIT).toBe(200);
    expect(all.total).toBeGreaterThan(7000);
    expect(all.options).toHaveLength(MENU_ICON_RESULT_LIMIT);
    expect(printer.options.some((option) => option.value === "mdi:printer")).toBe(true);
  });

  it("filters icon options by initial letter", () => {
    const printer = buildMenuIconOptions({ letter: "P" });

    expect(printer.options.some((option) => option.value === "mdi:printer")).toBe(true);
    expect(printer.options.every((option) => option.letter === "P")).toBe(true);
    expect(printer.filteredTotal).toBeGreaterThan(MENU_ICON_RESULT_LIMIT);
  });

  it("uses global search even when a letter filter is active", () => {
    const printer = buildMenuIconOptions({ letter: "P", search: "printer" });
    const activeF = buildMenuIconOptions({ letter: "F", search: "printer" });

    expect(printer.options.some((option) => option.value === "mdi:printer")).toBe(true);
    expect(activeF.options.some((option) => option.value === "mdi:printer")).toBe(true);
    expect(activeF.filteredTotal).toBe(printer.filteredTotal);
  });

  it("uses the requested result limit without changing the filtered total", () => {
    const limited = buildMenuIconOptions({ letter: "P", limit: 12 });

    expect(limited.options).toHaveLength(12);
    expect(limited.filteredTotal).toBeGreaterThan(12);
  });
});
