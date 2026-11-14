import { describe, expect, it } from "vitest";
import { commercialQrContainArea, commercialQrImageMime, commercialQrPixelArea, isCommercialQrDataUrl, validateCommercialQrFile, validateCommercialQrSize, COMMERCIAL_QR_MAX_INPUT_BYTES, COMMERCIAL_QR_MAX_PIXELS } from "./commercial-qr-crop";

describe("commercial QR crop boundaries", () => {
  it("contains a full portrait or landscape image instead of cutting its quiet zone", () => {
    expect(commercialQrContainArea({ width: 400, height: 200 })).toEqual({ x: 0, y: -100, width: 400, height: 400 });
    expect(commercialQrContainArea({ width: 201, height: 400 })).toEqual({ x: -100, y: 0, width: 400, height: 400 });
    expect(commercialQrPixelArea({ width: 300, height: 300 })).toEqual({ x: 0, y: 0, width: 300, height: 300 });
  });

  it("uses integer natural pixels, keeping square bounds centered after rounding", () => {
    expect(commercialQrPixelArea({ width: 1000, height: 800 }, { x: 14.4, y: 10.1, width: 500.2, height: 500.8 })).toEqual({ x: 14, y: 10, width: 501, height: 501 });
    expect(commercialQrPixelArea({ width: 800, height: 600 }, { x: -10, y: -20, width: 500, height: 500 })).toEqual({ x: -10, y: -20, width: 500, height: 500 });
  });

  it("rejects invalid files and decoded dimensions at the same input limits as Backend", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"]) expect(() => validateCommercialQrFile({ type, size: COMMERCIAL_QR_MAX_INPUT_BYTES })).not.toThrow();
    for (const file of [{ type: "image/svg+xml", size: 100 }, { type: "image/png", size: 0 }, { type: "image/png", size: COMMERCIAL_QR_MAX_INPUT_BYTES + 1 }]) expect(() => validateCommercialQrFile(file)).toThrow();
    expect(() => validateCommercialQrSize({ width: 4000, height: 2000 })).not.toThrow();
    for (const size of [{ width: 4001, height: 2000 }, { width: 0, height: 100 }, { width: 100.1, height: 10 }]) expect(() => validateCommercialQrSize(size)).toThrow();
  });

  it("rejects oversized or wholly empty squares without silently downsampling", () => {
    const size = { width: 4000, height: 2000 };
    expect(() => commercialQrPixelArea(size)).toThrow();
    expect(commercialQrPixelArea(size, { x: 1000, y: 0, width: 2000, height: 2000 }).width ** 2).toBeLessThanOrEqual(COMMERCIAL_QR_MAX_PIXELS);
    for (const area of [{ x: 4000, y: 0, width: 100, height: 100 }, { x: 0, y: 0, width: NaN, height: 100 }, { x: -100, y: 0, width: 10, height: 10 }]) expect(() => commercialQrPixelArea(size, area)).toThrow();
  });

  it("accepts only canonical local PNG data URLs for editing an existing private QR", () => {
    expect(isCommercialQrDataUrl("data:image/png;base64,iVBORw0KGgoAAA==")).toBe(true);
    for (const value of ["https://example.com/qr.png", "blob:private", "data:image/svg+xml;base64,iVBORw0KGgo=", 'data:image/png;base64,iVBORw0KGgo" onload="x']) expect(isCommercialQrDataUrl(value)).toBe(false);
  });

  it("checks image bytes before decoding, rather than trusting a spoofed MIME type", () => {
    expect(commercialQrImageMime(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png");
    expect(commercialQrImageMime(Uint8Array.from([255, 216, 255, 224]))).toBe("image/jpeg");
    expect(commercialQrImageMime(new TextEncoder().encode("RIFF0000WEBP"))).toBe("image/webp");
    expect(commercialQrImageMime(new TextEncoder().encode("<svg onload="))).toBeNull();
    expect(commercialQrImageMime(new TextEncoder().encode("GIF89a"))).toBeNull();
  });
});
