import { describe, expect, it } from "vitest";
import type { Exchange } from "@/services/exchange";
import {
  buildExchangePayload,
  exchangeStatusLabel,
  missingExchangeField
} from "./exchange-utils";

describe("exchange settings utils", () => {
  it("builds a create payload without an exchange id", () => {
    expect(
      buildExchangePayload({
        currencyUuid: "currency-1",
        editing: null,
        price: "21000",
        status: "1",
        storeUuid: "store-1"
      })
    ).toEqual({
      currency_uuid_fk: "currency-1",
      ex_price: "21000",
      ex_status: 1,
      store_uuid_fk: "store-1"
    });
  });

  it("keeps the existing exchange id for edit payloads", () => {
    expect(
      buildExchangePayload({
        currencyUuid: "currency-2",
        editing: { ex_uuid: "exchange-1" } as Exchange,
        price: "20.5",
        status: "2",
        storeUuid: "store-1"
      })
    ).toMatchObject({
      currency_uuid_fk: "currency-2",
      ex_price: "20.5",
      ex_status: 2,
      ex_uuid: "exchange-1",
      store_uuid_fk: "store-1"
    });
  });

  it("detects missing required fields before save", () => {
    expect(missingExchangeField({ currencyUuid: "currency-1", price: "10", storeUuid: "" })).toBe("store");
    expect(missingExchangeField({ currencyUuid: "", price: "10", storeUuid: "store-1" })).toBe("currency");
    expect(missingExchangeField({ currencyUuid: "currency-1", price: " ", storeUuid: "store-1" })).toBe("rate");
    expect(missingExchangeField({ currencyUuid: "currency-1", price: "10", storeUuid: "store-1" })).toBeNull();
  });

  it("maps exchange status labels", () => {
    expect(exchangeStatusLabel("1", "Active", "Inactive")).toBe("Active");
    expect(exchangeStatusLabel("2", "Active", "Inactive")).toBe("Inactive");
    expect(exchangeStatusLabel("", "Active", "Inactive")).toBe("Active");
  });
});
