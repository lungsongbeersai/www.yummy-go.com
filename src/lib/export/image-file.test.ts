import { describe, expect, it } from "vitest";
import { imageExportFile, pngDataUrlFile } from "./image-file";

describe("QR image export files", () => {
  it("preserves PNG bytes and supplies the filename and MIME type for native saving", async () => {
    const file = pngDataUrlFile("data:image/png;base64,iVBORw0KGgo=", "table-qr.png");
    expect(file.name).toBe("table-qr.png");
    expect(file.type).toBe("image/png");
    expect(Array.from(new Uint8Array(await file.arrayBuffer()))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it("rejects stale requests before decoding or opening a native picker", async () => {
    await expect(imageExportFile("data:image/png;base64,iVBORw0KGgo=", "qr.png", () => false))
      .rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects other data URL types instead of relabeling them as a PNG", () => {
    expect(() => pngDataUrlFile("data:text/plain;base64,SGVsbG8=", "qr.png")).toThrow();
  });
});
