import { describe, expect, it, vi } from "vitest";
import { canShareCommercialPdf, CommercialShareUnavailableError, isCommercialShareCancelled, shareCommercialPdf, type CommercialShareNavigator } from "./commercial-share";

const pdf = () => new File(["%PDF-synthetic"], "quotation.pdf", { type: "application/pdf" });

describe("commercial PDF sharing", () => {
  it("requires file-sharing capability instead of assuming text sharing supports attachments", () => {
    expect(canShareCommercialPdf({}, pdf())).toBe(false);
    expect(canShareCommercialPdf({ share: vi.fn() }, pdf())).toBe(false);
    expect(canShareCommercialPdf({ canShare: () => true }, pdf())).toBe(false);
    expect(canShareCommercialPdf({ canShare: () => false, share: vi.fn() }, pdf())).toBe(false);
  });

  it("does not offer native sharing for missing, empty or non-PDF files", () => {
    const canShare = vi.fn(() => true);
    const target = { canShare, share: vi.fn() };
    for (const file of [null, new File([], "empty.pdf", { type: "application/pdf" }), new File(["text"], "file.pdf", { type: "text/plain" }), new File(["%PDF"], "file.txt", { type: "application/pdf" })]) {
      expect(canShareCommercialPdf(target, file)).toBe(false);
    }
    expect(canShare).not.toHaveBeenCalled();
  });

  it("treats capability errors as unsupported without starting a share", () => {
    const share = vi.fn();
    expect(canShareCommercialPdf({ canShare: () => { throw new TypeError("unsupported"); }, share }, pdf())).toBe(false);
    expect(share).not.toHaveBeenCalled();
  });

  it("invokes the native method synchronously in the original receiver with only the prepared file and title", async () => {
    const file = pdf();
    const calls: string[] = [];
    const target: CommercialShareNavigator = {
      canShare(data) {
        expect(this).toBe(target);
        expect(data).toEqual({ files: [file] });
        return true;
      },
      share(data) {
        expect(this).toBe(target);
        expect(data).toEqual({ files: [file], title: "Synthetic quotation" });
        calls.push("native");
        return Promise.resolve();
      },
    };
    const result = shareCommercialPdf(target, file, "Synthetic quotation");
    calls.push("returned");
    expect(calls).toEqual(["native", "returned"]);
    await result;
  });

  it("throws before opening a chooser when the platform cannot attach the PDF", () => {
    const share = vi.fn();
    expect(() => shareCommercialPdf({ canShare: () => false, share }, pdf(), "PDF")).toThrow(CommercialShareUnavailableError);
    expect(share).not.toHaveBeenCalled();
  });

  it("preserves synchronous native failures for the explicit download fallback", () => {
    const failure = new DOMException("No user activation", "NotAllowedError");
    expect(() => shareCommercialPdf({ canShare: () => true, share: () => { throw failure; } }, pdf(), "PDF")).toThrow(failure);
    expect(isCommercialShareCancelled(failure)).toBe(false);
  });

  it("preserves asynchronous cancellations without converting them to failures or sends", async () => {
    const cancel = new DOMException("Cancelled", "AbortError");
    await expect(shareCommercialPdf({ canShare: () => true, share: () => Promise.reject(cancel) }, pdf(), "PDF")).rejects.toBe(cancel);
    expect(isCommercialShareCancelled(cancel)).toBe(true);
    expect(isCommercialShareCancelled({ name: "AbortError" })).toBe(true);
    for (const error of [null, "AbortError", new TypeError("bad data"), { name: "DataError" }]) expect(isCommercialShareCancelled(error)).toBe(false);
  });
});
