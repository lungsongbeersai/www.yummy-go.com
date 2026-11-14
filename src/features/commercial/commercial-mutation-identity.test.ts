import { describe, expect, it, vi } from "vitest";
import { commercialUpdateAttempt } from "@/features/commercial/commercial-mutation-identity";
import type { CreateCommercialDocumentInput } from "@/services/commercial";

const input: CreateCommercialDocumentInput = { branch_uuid: "branch", document_type: "quotation", issued_on: "2026-11-14", customer: { name: "Customer" }, issuer: { name: "PLC" }, tax_rate: 0, show_images: true, items: [{ name: "Printer", quantity: 1, unit_price: 950000 }] };

describe("commercial update retry identities", () => {
  it("reuses one identity for identical retries after an ambiguous response", () => {
    const newUuid = vi.fn(() => "next-operation");
    const first = commercialUpdateAttempt({ requestUuid: "original-operation", payload: null }, input, newUuid);
    expect(commercialUpdateAttempt(first, { ...input, request_uuid: "ignored" }, newUuid)).toEqual(first);
    expect(newUuid).not.toHaveBeenCalled();
  });

  it("rotates the identity when a user changes content after an attempt", () => {
    const newUuid = vi.fn(() => "changed-operation");
    const first = commercialUpdateAttempt({ requestUuid: "original-operation", payload: null }, input, newUuid);
    const changed = commercialUpdateAttempt(first, { ...input, notes: "New notes", discount_type: "amount", discount_value: 1000 }, newUuid);
    expect(changed.requestUuid).toBe("changed-operation");
    expect(commercialUpdateAttempt(changed, { ...input, notes: "New notes", discount_type: "amount", discount_value: 1000 }, newUuid)).toEqual(changed);
    expect(newUuid).toHaveBeenCalledTimes(1);
  });
});
