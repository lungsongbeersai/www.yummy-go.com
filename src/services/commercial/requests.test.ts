import { describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import { convertQuotation, createCommercialDocument, getCommercialCatalog, getCommercialDocument, getCommercialDocumentRevision, getCommercialDocumentRevisions, getCommercialPaymentProfiles, saveCommercialPaymentProfile, saveCommercialPaymentProfiles, saveCatalogItem, updateCommercialDocument, type CreateCommercialDocumentInput } from "@/services/commercial";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));

describe("commercial API contract", () => {
  it("loads private payment profiles without sending a chosen store, branch or owner", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ status: "success", data: [] });
    await getCommercialPaymentProfiles();
    expect(apiRequest).toHaveBeenLastCalledWith("get", "/api/v1/commercial/payment-profiles", { params: { lang: "la" } }, "Failed to fetch options");
  });

  it("sends reusable account edits and optional QR as multipart", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ status: "success", data: { profile_uuid: "saved" } });
    const qr = new File(["qr"], "bank.png", { type: "image/png" });
    await saveCommercialPaymentProfile({ profile_uuid: "saved", account_name: "Owner", account_number: "001-234", currency: "THB", qr_image: qr, remove_qr: false });
    const form = vi.mocked(apiRequest).mock.calls.at(-1)?.[2]?.data as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("qr_image")).toBe(qr);
    expect(form.get("account_number")).toBe("001-234");
    expect(form.get("remove_qr")).toBe("false");
    expect(form.has("branch_uuid")).toBe(false);
    expect(form.has("label")).toBe(false);
    expect(form.has("bank_name")).toBe(false);
  });

  it("keeps each batch QR bound to its stable account row without including private files in JSON", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ status: "success", data: [] });
    const qr = new File(["cropped QR"], "cropped.png", { type: "image/png" });
    const rows = [{ profile_uuid: "first", account_name: "Owner", account_number: "000001", currency: "LAK" as const },
      { profile_uuid: "second", account_name: "Owner", account_number: "000002", currency: "THB" as const, qr_image: qr }];
    await saveCommercialPaymentProfiles(rows);
    const call = vi.mocked(apiRequest).mock.calls.at(-1);
    expect(call?.slice(0, 2)).toEqual(["post", "/api/v1/commercial/payment-profiles/save-batch"]);
    const form = call?.[2]?.data as FormData;
    expect(JSON.parse(String(form.get("profiles")))).toEqual([rows[0], { ...rows[1], qr_image: undefined }]);
    expect(form.get("qr_image_1")).toBe(qr);
    expect(form.has("qr_image_0")).toBe(false);
    expect(rows[1].qr_image).toBe(qr);
  });

  it("hydrates the exact branch-authorized historical version before viewing", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ status: "success", data: { version: 2, snapshot: {} } });
    await getCommercialDocumentRevision("branch", "document", 2);
    expect(apiRequest).toHaveBeenLastCalledWith("get", "/api/v1/commercial/documents/document/revisions/2", { params: { branch_uuid: "branch" } });
  });
  it("requests inactive catalog items only within the explicit branch", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ status: "success", data: [] });
    await getCommercialCatalog("branch");
    expect(apiRequest).toHaveBeenLastCalledWith("get", "/api/v1/commercial/catalog", { params: { lang: "la", branch_uuid: "branch", include_inactive: true } }, "Failed to fetch options");
  });

  it("sends uploaded images as multipart with boolean fields intact", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ status: "success", data: { item_uuid: "saved" } });
    const image = new File(["image"], "printer.png", { type: "image/png" });
    await saveCatalogItem({ branch_uuid: "branch", name: "Printer", unit_price: 950000, active: true, image_visible: false, image });
    const options = vi.mocked(apiRequest).mock.calls.at(-1)?.[2];
    expect(options?.data).toBeInstanceOf(FormData);
    const form = options?.data as FormData;
    expect(form.get("branch_uuid")).toBe("branch");
    expect(form.get("image_visible")).toBe("false");
    expect(form.get("image")).toBe(image);
  });

  it("saves nested parties and line flags in a JSON document", async () => {
    const input: CreateCommercialDocumentInput = { branch_uuid: "branch", document_type: "quotation", issued_on: "2026-11-14", customer: { name: "Customer" }, issuer: { name: "PLC", logo_url: "/brand/plc-logo.png" }, tax_rate: 10, show_images: false, items: [{ name: "Printer", quantity: 1, unit_price: 950000, show_image: false }] };
    vi.mocked(apiRequest).mockResolvedValueOnce({ status: "success", data: { document_uuid: "saved" } });
    await createCommercialDocument(input);
    expect(apiRequest).toHaveBeenLastCalledWith("post", "/api/v1/commercial/documents/create", { data: input }, "Failed to save data");
  });

  it("includes the branch when reopening an issued document", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ status: "success", data: { document_uuid: "saved" } });
    await getCommercialDocument("branch", "document");
    expect(apiRequest).toHaveBeenLastCalledWith("get", "/api/v1/commercial/documents/document", { params: { branch_uuid: "branch" } });
  });

  it("updates an existing identity with its expected version and saved line identities", async () => {
    const input: CreateCommercialDocumentInput = { branch_uuid: "branch", document_type: "quotation", issued_on: "2026-11-14", customer: { name: "Customer" }, issuer: { name: "PLC" }, tax_rate: 10, show_images: true, discount_type: "percent", discount_value: 5.25, items: [{ line_uuid: "saved-line", item_uuid: "inactive-item", name: "Original printer", quantity: 1, unit_price: 950000 }] };
    vi.mocked(apiRequest).mockResolvedValueOnce({ status: "success", data: { document_uuid: "saved", version: 2 } });
    await updateCommercialDocument({ ...input, document_uuid: "saved", expected_version: 1, request_uuid: "operation" });
    expect(apiRequest).toHaveBeenLastCalledWith("post", "/api/v1/commercial/documents/saved/update", { data: { ...input, expected_version: 1, request_uuid: "operation" } });
  });

  it("loads branch-authorized revisions and pins the displayed quotation version on conversion", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ status: "success", data: [] });
    await getCommercialDocumentRevisions("branch", "saved");
    expect(apiRequest).toHaveBeenLastCalledWith("get", "/api/v1/commercial/documents/saved/revisions", { params: { lang: "la", branch_uuid: "branch" } }, "Failed to fetch options");
    vi.mocked(apiRequest).mockResolvedValueOnce({ status: "success", data: { document_uuid: "receipt" } });
    await convertQuotation({ branch_uuid: "branch", document_uuid: "saved", expected_version: 3, payment_method: "cash" });
    expect(apiRequest).toHaveBeenLastCalledWith("post", "/api/v1/commercial/documents/saved/convert", { data: { branch_uuid: "branch", expected_version: 3, payment_method: "cash" } });
  });
});
