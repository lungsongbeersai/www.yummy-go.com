import { describe, expect, it } from "vitest";
import en from "../../../../public/locales/en/common.json";
import la from "../../../../public/locales/la/common.json";
import { auditChanges, auditDateTime, auditToday, auditValue, validAuditDateRange } from "./order-audit-utils";

const t = (key: string) => key;

describe("order audit presentation", () => {
  it("uses Vientiane calendar dates without applying a sales-day cutoff", () => {
    expect(auditToday(new Date("2026-09-06T16:59:59Z"))).toBe("2026-09-06");
    expect(auditToday(new Date("2026-09-06T17:00:00Z"))).toBe("2026-09-07");
    expect(auditDateTime("2026-09-06T17:00:00Z", "en")).toContain("07/09/2026");
    expect(auditDateTime("2026-09-06T17:00:00Z", "en")).toContain("00:00:00");
    expect(auditDateTime("invalid", "en")).toBe("—");
  });

  it("validates real dates and a bounded date range", () => {
    expect(validAuditDateRange("2026-09-01", "2026-09-07")).toBe(true);
    expect(validAuditDateRange("2026-01-01", "2026-04-03")).toBe(true);
    for (const [from, to] of [["", ""], ["2026-02-30", "2026-03-01"],
      ["2026-09-07", "2026-09-01"], ["2026-01-01", "2026-04-04"]]) {
      expect(validAuditDateRange(from, to)).toBe(false);
    }
  });

  it("shows percentage points, fixed amounts, zeros and all three VAT modes correctly", () => {
    for (const value of [0.5, 1, 40]) {
      expect(auditValue("order_it_discount_value", value, { order_it_discount_type: "PCT" }, "en", t)).toBe(`${value}%`);
    }
    expect(auditValue("order_it_discount_value", 14000, { order_it_discount_type: "AMT" }, "en", t)).toBe("14,000 ₭");
    expect(auditValue("order_it_discount_amount", 16000, null, "en", t)).toBe("16,000 ₭");
    expect(auditValue("order_it_discount_amount", 0, null, "en", t)).toBe("0 ₭");
    expect(auditValue("order_it_discount_amount", null, null, "en", t)).toBe("—");
    expect(auditValue("order_vat_rate", 1, null, "en", t)).toBe("1%");
    for (const mode of [1, 2, 3]) expect(auditValue("order_vat_status", mode, null, "en", t)).toBe(`orderAudit.vat.${mode}`);
  });

  it("renders changed fields from their own before/after discount modes without recalculating", () => {
    const row = {
      before_data: { order_it_discount_type: "AMT", order_it_discount_value: 14000 },
      after_data: { order_it_discount_type: "PCT", order_it_discount_value: 40 },
      changed_fields: ["order_it_discount_value"],
    };
    const saved = JSON.stringify(row);
    expect(auditChanges(row, "en", t)).toEqual([{
      field: "order_it_discount_value", label: "orderAudit.fields.order_it_discount_value",
      before: "14,000 ₭", after: "40%",
    }]);
    expect(JSON.stringify(row)).toBe(saved);
  });

  it("has matching English/Lao labels for every report field", () => {
    expect(Object.keys(en.orderAudit.fields).sort()).toEqual(Object.keys(la.orderAudit.fields).sort());
    expect(Object.keys(en.orderAudit.actions).sort()).toEqual(Object.keys(la.orderAudit.actions).sort());
    expect(Object.keys(en.orderAudit).sort()).toEqual(Object.keys(la.orderAudit).sort());
  });

  it("orders price, quantity, discount type/value/amount without mutating the saved field list", () => {
    const fields = ["order_it_discount_amount", "order_it_qty", "order_it_discount_value", "order_it_prod_price", "order_it_discount_type"];
    const row = { before_data: null, after_data: null, changed_fields: fields };
    expect(auditChanges(row, "en", t).map(change => change.field)).toEqual([
      "order_it_prod_price", "order_it_qty", "order_it_discount_type", "order_it_discount_value", "order_it_discount_amount",
    ]);
    expect(fields[0]).toBe("order_it_discount_amount");
  });
});
