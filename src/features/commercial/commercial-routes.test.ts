import { describe, expect, it } from "vitest";
import { commercialCreateHref, commercialDocumentType, commercialEditHref, commercialHistoryHref, commercialRequestedScopeMatches, commercialTab } from "@/features/commercial/commercial-routes";

describe("commercial page URLs", () => {
  const scope = { storeUuid: "store-1", branchUuid: "branch-2" };

  it("creates a shareable quotation or receipt URL with the selected scope", () => {
    const url = new URL(commercialCreateHref(scope, "receipt"), "https://app.example.test");
    expect(url.pathname).toBe("/commercial/new");
    expect(Object.fromEntries(url.searchParams)).toEqual({ store_uuid: "store-1", branch_uuid: "branch-2", type: "receipt" });
  });

  it("uses an explicit edit path and encodes dynamic identities", () => {
    const url = new URL(commercialEditHref(scope, "doc/with?characters"), "https://app.example.test");
    expect(url.pathname).toBe("/commercial/doc%2Fwith%3Fcharacters/edit");
    expect(url.searchParams.get("branch_uuid")).toBe("branch-2");
  });

  it("returns to the chosen history tab and can reveal a saved document after reload", () => {
    const url = new URL(commercialHistoryHref(scope, "quotations", "saved-document"), "https://app.example.test");
    expect(url.pathname).toBe("/commercial");
    expect(Object.fromEntries(url.searchParams)).toEqual({ store_uuid: "store-1", branch_uuid: "branch-2", tab: "quotations", document_uuid: "saved-document" });
  });

  it("accepts only known document types and history tabs", () => {
    expect(commercialDocumentType("receipt")).toBe("receipt");
    expect(commercialDocumentType("//foreign.example")).toBe("quotation");
    expect(commercialTab("receipts")).toBe("receipts");
    expect(commercialTab("unknown")).toBe("catalog");
  });

  it("rejects a requested write scope that resolved to a different authorized fallback", () => {
    expect(commercialRequestedScopeMatches(scope, scope)).toBe(true);
    expect(commercialRequestedScopeMatches({}, scope)).toBe(true);
    expect(commercialRequestedScopeMatches(scope, { storeUuid: "another-store", branchUuid: "branch-2" })).toBe(false);
    expect(commercialRequestedScopeMatches(scope, { storeUuid: "store-1", branchUuid: "fallback-branch" })).toBe(false);
  });
});
