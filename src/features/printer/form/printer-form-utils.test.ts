import { describe, expect, it } from "vitest";
import {
  arraysHaveSameValues,
  cashDrawerEnabledOf,
  formatIpInput,
  kitchenCutModeOf,
  requiresZoneMapping,
} from "@/features/printer/form/printer-form-utils";

describe("formatIpInput", () => {
  it("auto-inserts a dot after every 3 digits while typing forward", () => {
    let value = "";
    for (const key of "192168".split("")) {
      value = formatIpInput(value + key, value);
    }
    expect(value).toBe("192.168.");
  });

  it("builds up to the full example address by incremental typing", () => {
    const keystrokes = "192168100.77".split("");
    let value = "";
    for (const key of keystrokes) {
      value = formatIpInput(value + key, value);
    }
    expect(value).toBe("192.168.100.77");
  });

  it("strips characters other than digits and dots", () => {
    expect(formatIpInput("192a.168b.100c.77d", "")).toBe("192.168.100.77");
  });

  it("collapses consecutive dots and drops a leading dot", () => {
    expect(formatIpInput(".192..168", "")).toBe("192.168.");
  });

  it("caps at 4 octets and ignores extra digits/dots", () => {
    expect(formatIpInput("192.168.100.255.99", "")).toBe("192.168.100.255");
    expect(formatIpInput("192.168.100.2559", "192.168.100.255")).toBe(
      "192.168.100.255",
    );
  });

  it("does not re-insert a trailing dot while deleting", () => {
    expect(formatIpInput("192", "192.")).toBe("192");
    expect(formatIpInput("192.", "192.1")).toBe("192.");
  });

  it("keeps an explicit short octet followed by a user-typed dot", () => {
    expect(formatIpInput("19.", "19")).toBe("19.");
  });
});

describe("cashDrawerEnabledOf", () => {
  it("keeps the legacy default enabled", () => {
    expect(cashDrawerEnabledOf(null)).toBe(true);
    expect(cashDrawerEnabledOf({} as never)).toBe(true);
  });

  it("restores an explicitly disabled cash drawer", () => {
    expect(cashDrawerEnabledOf({ cash_drawer_enabled: false } as never)).toBe(false);
  });
});

describe("kitchenCutModeOf", () => {
  it("keeps the legacy default as cutting every kitchen ticket", () => {
    expect(kitchenCutModeOf(null)).toBe("per_ticket");
    expect(kitchenCutModeOf({} as never)).toBe("per_ticket");
  });

  it("restores a saved no-cut printer setting", () => {
    expect(kitchenCutModeOf({ kitchen_cut_mode: "none" } as never)).toBe("none");
  });
});

describe("requiresZoneMapping", () => {
  it("requires zone mapping for numbered kitchen (k-*) and bar (b-*) station roles", () => {
    expect(requiresZoneMapping(["k-001"])).toBe(true);
    expect(requiresZoneMapping(["k-002"])).toBe(true);
    expect(requiresZoneMapping(["b-001"])).toBe(true);
    expect(requiresZoneMapping(["b-002"])).toBe(true);
    expect(requiresZoneMapping(["invoice", "b-001"])).toBe(true);
  });

  it("does not require zone mapping for invoice/receipt/QR-order/report-only roles", () => {
    expect(requiresZoneMapping(["invoice", "receipt"])).toBe(false);
    expect(requiresZoneMapping(["q-001"])).toBe(false);
    expect(requiresZoneMapping(["report"])).toBe(false);
    expect(requiresZoneMapping([])).toBe(false);
  });
});

describe("arraysHaveSameValues", () => {
  it("ignores order", () => {
    expect(arraysHaveSameValues(["a", "b"], ["b", "a"])).toBe(true);
  });

  it("detects a real difference in the selected set", () => {
    expect(arraysHaveSameValues(["a", "b"], ["a", "c"])).toBe(false);
    expect(arraysHaveSameValues(["a"], ["a", "b"])).toBe(false);
  });
});
