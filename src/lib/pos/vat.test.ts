import { describe, expect, it } from "vitest";
import { roundLak } from "./lak-money";
import { VAT_EXCLUDED, VAT_EXEMPT, VAT_INCLUDED, calculateVat, normalizeVatStatus } from "./vat";

const roundUnit = (value: number) => Math.round(value);

describe("calculateVat", () => {
  it("charges nothing when the branch is VAT exempt", () => {
    expect(calculateVat({ taxableAmount: 100000, vatStatus: VAT_EXEMPT, vatRate: 10 })).toEqual({
      vatStatus: VAT_EXEMPT,
      vatRate: 0,
      amountBeforeVat: 100000,
      vatAmount: 0,
      totalAfterVat: 100000
    });
  });

  it("extracts VAT from a price that already includes it", () => {
    expect(calculateVat({ taxableAmount: 110000, vatStatus: VAT_INCLUDED, vatRate: 10 })).toEqual({
      vatStatus: VAT_INCLUDED,
      vatRate: 10,
      amountBeforeVat: 100000,
      vatAmount: 10000,
      totalAfterVat: 110000
    });
  });

  it("never adds VAT on top of a VAT-included bill", () => {
    const included = calculateVat({
      taxableAmount: 395000,
      vatStatus: VAT_INCLUDED,
      vatRate: 10,
      roundMoney: roundUnit
    });

    expect(included.amountBeforeVat).toBe(359091);
    expect(included.vatAmount).toBe(35909);
    expect(included.totalAfterVat).toBe(395000);
  });

  it("adds VAT on top when prices exclude it", () => {
    expect(calculateVat({ taxableAmount: 100000, vatStatus: VAT_EXCLUDED, vatRate: 10 }).totalAfterVat).toBe(110000);
    expect(
      calculateVat({ taxableAmount: 100000, vatStatus: VAT_EXCLUDED, vatRate: 7, roundMoney: roundUnit }).vatAmount
    ).toBe(7000);
  });

  it("keeps amountBeforeVat + vatAmount equal to totalAfterVat", () => {
    for (const vatStatus of [VAT_EXEMPT, VAT_INCLUDED, VAT_EXCLUDED]) {
      for (const vatRate of [0, 7, 10, 12.5]) {
        for (const taxableAmount of [0, 1000, 395000, 818310]) {
          for (const roundMoney of [roundLak, roundUnit]) {
            const vat = calculateVat({ taxableAmount, vatStatus, vatRate, roundMoney });
            expect(vat.amountBeforeVat + vat.vatAmount).toBe(vat.totalAfterVat);
          }
        }
      }
    }
  });

  it("falls back to the legacy VAT-excluded behaviour without a snapshot", () => {
    expect(normalizeVatStatus(undefined)).toBe(VAT_EXCLUDED);
    expect(normalizeVatStatus(0)).toBe(VAT_EXCLUDED);
    expect(normalizeVatStatus(2)).toBe(VAT_INCLUDED);
    expect(calculateVat({ taxableAmount: 100000, vatRate: 10 }).totalAfterVat).toBe(110000);
  });
});
