import { describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import { createCommercialDocument, getCommercialCatalog, getCommercialDocument, saveCatalogItem, type CreateCommercialDocumentInput } from "@/services/commercial";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));

describe("commercial API contract", () => {
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
});
