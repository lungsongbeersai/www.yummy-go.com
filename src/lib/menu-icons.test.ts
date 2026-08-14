import { describe, expect, it } from "vitest";
import {
  DEFAULT_MENU_ICON,
  LEGACY_MDI_ICON_ALIASES,
  MENU_ICON_RESULT_LIMIT,
  menuIconLabel,
  normalizeMenuIconValue
} from "@/lib/menu-icons";
import {
  buildMenuIconOptions,
  normalizeMenuIconName
} from "@/lib/menu-icon-catalog";

describe("menu icon value normalization", () => {
  it("keeps already-valid lucide icon names", () => {
    expect(normalizeMenuIconValue("printer")).toBe("printer");
    expect(normalizeMenuIconValue("shopping-cart")).toBe("shopping-cart");
  });

  it("maps legacy mdi: values saved before the lucide migration", () => {
    for (const [legacyValue, expected] of Object.entries(LEGACY_MDI_ICON_ALIASES)) {
      expect(normalizeMenuIconValue(legacyValue)).toBe(expected);
    }
  });

  it("falls back to the default icon for empty or malformed values", () => {
    expect(normalizeMenuIconValue("")).toBe(DEFAULT_MENU_ICON);
    expect(normalizeMenuIconValue("fa fa-file")).toBe(DEFAULT_MENU_ICON);
    expect(normalizeMenuIconValue("javascript:alert(1)")).toBe(DEFAULT_MENU_ICON);
    expect(normalizeMenuIconValue("mdi:not-a-legacy-value")).toBe(DEFAULT_MENU_ICON);
  });

  it("builds a title-cased label from the icon name", () => {
    expect(menuIconLabel("shopping-cart")).toBe("Shopping Cart");
    expect(menuIconLabel("")).toBe(menuIconLabel(DEFAULT_MENU_ICON));
  });
});

describe("menu icon catalog", () => {
  it("normalizes legacy mdi: values to their lucide equivalent", () => {
    expect(normalizeMenuIconName("mdi:file-document-outline")).toBe(DEFAULT_MENU_ICON);
    expect(normalizeMenuIconName("mdi:cart-outline")).toBe("shopping-cart");
  });

  it("keeps valid lucide icon names", () => {
    expect(normalizeMenuIconName("printer")).toBe("printer");
  });

  it("falls back for values that are not real lucide icons", () => {
    expect(normalizeMenuIconName("not-real-icon")).toBe(DEFAULT_MENU_ICON);
    expect(normalizeMenuIconName("mdi:not-real-icon")).toBe(DEFAULT_MENU_ICON);
  });

  it("builds searchable options from the lucide icon set with a render limit", () => {
    const all = buildMenuIconOptions();
    const printer = buildMenuIconOptions({ search: "printer" });

    expect(MENU_ICON_RESULT_LIMIT).toBe(200);
    expect(all.total).toBeGreaterThan(1500);
    expect(all.options).toHaveLength(MENU_ICON_RESULT_LIMIT);
    expect(printer.options.some((option) => option.value === "printer")).toBe(true);
  });

  it("filters icon options by initial letter", () => {
    const category = buildMenuIconOptions({ letter: "C" });

    expect(category.options.some((option) => option.value === "calendar")).toBe(true);
    expect(category.options.every((option) => option.letter === "C")).toBe(true);
    expect(category.filteredTotal).toBeGreaterThan(MENU_ICON_RESULT_LIMIT);
  });

  it("uses global search even when a letter filter is active", () => {
    const printer = buildMenuIconOptions({ letter: "P", search: "printer" });
    const activeF = buildMenuIconOptions({ letter: "F", search: "printer" });

    expect(printer.options.some((option) => option.value === "printer")).toBe(true);
    expect(activeF.options.some((option) => option.value === "printer")).toBe(true);
    expect(activeF.filteredTotal).toBe(printer.filteredTotal);
  });

  it("uses the requested result limit without changing the filtered total", () => {
    const limited = buildMenuIconOptions({ letter: "P", limit: 12 });

    expect(limited.options).toHaveLength(12);
    expect(limited.filteredTotal).toBeGreaterThan(12);
  });
});
