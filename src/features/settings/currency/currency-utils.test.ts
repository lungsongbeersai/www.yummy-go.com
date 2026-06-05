import { describe, expect, it } from "vitest";
import {
  buildCurrencyPayload,
  currencyStatusLabel,
  missingCurrencyField
} from "@/features/settings/currency/currency-utils";

describe("currency utils", () => {
  it("builds create payload with an empty currency id", () => {
    expect(
      buildCurrencyPayload({
        editing: null,
        icon: "la",
        name: "Lao Kip",
        status: "1"
      })
    ).toEqual({
      currency_uuid: "",
      currency_name: "Lao Kip",
      currency_icon: "LA",
      currency_status: 1
    });
  });

  it("keeps the currency id for edit payloads", () => {
    expect(
      buildCurrencyPayload({
        editing: { currency_uuid: "currency-1", currency_name: "USD", currency_icon: "US", currency_status: 1 },
        icon: "us",
        name: "US Dollar",
        status: "2"
      })
    ).toEqual({
      currency_uuid: "currency-1",
      currency_name: "US Dollar",
      currency_icon: "US",
      currency_status: 2
    });
  });

  it("detects required fields", () => {
    expect(missingCurrencyField({ icon: "LA", name: "", status: "1" })).toBe("name");
    expect(missingCurrencyField({ icon: "", name: "Lao Kip", status: "1" })).toBe("flag");
    expect(missingCurrencyField({ icon: "LA", name: "Lao Kip", status: "" })).toBe("status");
    expect(missingCurrencyField({ icon: "LA", name: "Lao Kip", status: "1" })).toBeNull();
  });

  it("maps status labels with numeric fallback", () => {
    expect(currencyStatusLabel("1", "Active", "Inactive")).toBe("Active");
    expect(currencyStatusLabel("2", "Active", "Inactive")).toBe("Inactive");
    expect(currencyStatusLabel("", "Active", "Inactive")).toBe("Active");
  });
});
