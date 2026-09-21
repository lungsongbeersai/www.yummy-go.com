import { describe, expect, it } from "vitest";
import type { DepositRow } from "@/services/deposit";
import {
  depositBadgeVariant,
  expireDateFromToday,
  toDepositQtyInput,
  validateDepositCreate,
  validateDepositWithdraw
} from "./deposit-utils";

function makeDeposit(overrides: Partial<DepositRow> = {}): DepositRow {
  return {
    deposit_uuid: "deposit-1",
    deposit_no: "DP-0001",
    branch_uuid_fk: "branch-1",
    customer_uuid_fk: "customer-1",
    customer_name: "customer",
    customer_phone: "",
    pro_detail_uuid_fk: "detail-1",
    product_name: "Whisky",
    unit_name: "bottle",
    deposit_qty: 2,
    remaining_qty: 2,
    deposit_date: "2026-09-16T00:00:00.000Z",
    expire_date: "2099-12-31",
    status: "ACTIVE",
    status_text: "Active",
    is_expired: false,
    note: "",
    created_by: null,
    created_at: "2026-09-16T00:00:00.000Z",
    updated_at: "2026-09-16T00:00:00.000Z",
    ...overrides
  };
}

describe("toDepositQtyInput", () => {
  it("parses a numeric string and clamps below zero to zero", () => {
    expect(toDepositQtyInput("1.5")).toBe(1.5);
    expect(toDepositQtyInput("-3")).toBe(0);
    expect(toDepositQtyInput("")).toBe(0);
    expect(toDepositQtyInput(undefined)).toBe(0);
  });
});

describe("validateDepositCreate", () => {
  const base = {
    customerUuid: "customer-1",
    items: [{ proDetailUuid: "detail-1", qty: 1 }],
    expireDate: ""
  };

  it("requires a customer and at least one item", () => {
    expect(validateDepositCreate({ ...base, customerUuid: "" })).toBe("customerRequired");
    expect(validateDepositCreate({ ...base, items: [] })).toBe("itemsRequired");
  });

  it("requires every item to have a product and a positive quantity", () => {
    expect(validateDepositCreate({ ...base, items: [{ proDetailUuid: "", qty: 1 }] })).toBe(
      "productRequired"
    );
    expect(validateDepositCreate({ ...base, items: [{ proDetailUuid: "detail-1", qty: 0 }] })).toBe(
      "qtyInvalid"
    );
    expect(
      validateDepositCreate({
        ...base,
        items: [
          { proDetailUuid: "detail-1", qty: 1 },
          { proDetailUuid: "detail-2", qty: 0 }
        ]
      })
    ).toBe("qtyInvalid");
  });

  it("accepts an empty expire date (store default applies server-side)", () => {
    expect(validateDepositCreate(base)).toBeNull();
  });

  it("rejects a malformed or past expire date", () => {
    expect(validateDepositCreate({ ...base, expireDate: "31-12-2026" })).toBe("expireDateInvalid");
    expect(validateDepositCreate({ ...base, expireDate: "2000-01-01" })).toBe("expireDatePast");
  });

  it("accepts a future expire date", () => {
    expect(validateDepositCreate({ ...base, expireDate: "2099-12-31" })).toBeNull();
  });

  it("accepts multiple items in one deposit", () => {
    expect(
      validateDepositCreate({
        ...base,
        items: [
          { proDetailUuid: "detail-1", qty: 1 },
          { proDetailUuid: "detail-2", qty: 3 }
        ]
      })
    ).toBeNull();
  });
});

describe("expireDateFromToday", () => {
  it("returns an empty string when no store default is configured", () => {
    expect(expireDateFromToday(null)).toBe("");
    expect(expireDateFromToday(undefined)).toBe("");
    expect(expireDateFromToday(0)).toBe("");
  });

  it("adds the given number of days to today", () => {
    const expected = new Date();
    expected.setDate(expected.getDate() + 30);
    expect(expireDateFromToday(30)).toBe(expected.toISOString().slice(0, 10));
  });
});

describe("validateDepositWithdraw", () => {
  it("requires a positive quantity", () => {
    expect(validateDepositWithdraw({ qtyWithdrawn: 0, deposit: makeDeposit() })).toBe("qtyInvalid");
  });

  it("rejects when no deposit is selected, or it is not active/expired", () => {
    expect(validateDepositWithdraw({ qtyWithdrawn: 1, deposit: null })).toBe("depositNotActive");
    expect(
      validateDepositWithdraw({ qtyWithdrawn: 1, deposit: makeDeposit({ status: "WITHDRAWN" }) })
    ).toBe("depositNotActive");
    expect(
      validateDepositWithdraw({ qtyWithdrawn: 1, deposit: makeDeposit({ is_expired: true }) })
    ).toBe("depositNotActive");
  });

  it("rejects a quantity above what remains", () => {
    expect(
      validateDepositWithdraw({ qtyWithdrawn: 3, deposit: makeDeposit({ remaining_qty: 2 }) })
    ).toBe("qtyExceedsRemaining");
  });

  it("accepts a valid partial withdrawal", () => {
    expect(
      validateDepositWithdraw({ qtyWithdrawn: 1, deposit: makeDeposit({ remaining_qty: 2 }) })
    ).toBeNull();
  });
});

describe("depositBadgeVariant", () => {
  it("maps status/expiry to a badge variant", () => {
    expect(depositBadgeVariant({ status: "ACTIVE", is_expired: false })).toBe("default");
    expect(depositBadgeVariant({ status: "ACTIVE", is_expired: true })).toBe("destructive");
    expect(depositBadgeVariant({ status: "EXPIRED", is_expired: false })).toBe("destructive");
    expect(depositBadgeVariant({ status: "WITHDRAWN", is_expired: false })).toBe("secondary");
    expect(depositBadgeVariant({ status: "CANCELLED", is_expired: false })).toBe("outline");
  });
});
