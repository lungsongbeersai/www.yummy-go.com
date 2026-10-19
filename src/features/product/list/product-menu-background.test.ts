import { describe, expect, it } from "vitest";
import {
  DEFAULT_MENU_BACKGROUND,
  DEFAULT_MENU_BACKGROUND_COLOR,
  normalizeMenuBackground,
  readMenuBackgroundImage,
} from "./product-menu-background";

describe("menu PDF backgrounds", () => {
  it("defaults to the selected template's own background", () => {
    expect(DEFAULT_MENU_BACKGROUND).toEqual({ mode: "template" });
    expect(normalizeMenuBackground()).toEqual({ mode: "template" });
    expect(normalizeMenuBackground({ mode: "template" })).toEqual({ mode: "template" });
  });

  it("canonicalizes full and shorthand hex colors without changing the supplied object", () => {
    const source = { mode: "color" as const, color: "  #a3c  " };
    expect(normalizeMenuBackground(source)).toEqual({ mode: "color", color: "#AA33CC" });
    expect(source.color).toBe("  #a3c  ");
    expect(normalizeMenuBackground({ mode: "color", color: "#f0F4df" })).toEqual({ mode: "color", color: "#F0F4DF" });
    expect(normalizeMenuBackground({ mode: "color", color: DEFAULT_MENU_BACKGROUND_COLOR })).toEqual({ mode: "color", color: "#FFFFFF" });
  });

  it.each(["white", "red", "123456", "#12", "#12345", "#1234567", "#ff000080", "#gg0000", "rgb(1, 2, 3)", "url(https://example.com/image.png)"])(
    "falls back to the template for invalid color '%s'",
    (color) => expect(normalizeMenuBackground({ mode: "color", color })).toEqual({ mode: "template" }),
  );

  it.each(["jpeg", "png", "webp"])("keeps local %s base64 image data", (format) => {
    const image = `data:image/${format};base64,AQIDBA==`;
    expect(normalizeMenuBackground({ mode: "image", image })).toEqual({ mode: "image", image });
  });

  it("canonicalizes the MIME of image data and trims surrounding whitespace", () => {
    expect(normalizeMenuBackground({ mode: "image", image: "  DATA:IMAGE/PNG;BASE64,AQIDBA==\n" }))
      .toEqual({ mode: "image", image: "data:image/png;base64,AQIDBA==" });
  });

  it.each([
    "https://example.com/background.jpg",
    "http://example.com/background.jpg",
    "/uploaded/background.jpg",
    "blob:https://example.com/temporary-id",
    "javascript:alert(1)",
    "data:text/html;base64,PHN2Zz4=",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:image/gif;base64,R0lGODlh",
    "data:image/png;base64,",
    "data:image/png;base64,A",
    "data:image/png;base64,AQI",
    "data:image/png;base64,A===",
    "data:image/png;base64,AQ=IDBA=",
    "data:image/png;base64,AQID BA==",
    "data:image/png,AQIDBA==",
    "data:image/png;base64,%41QIDBA==",
  ])("falls back to the template for an external, active, or malformed image URL '%s'", (image) => {
    expect(normalizeMenuBackground({ mode: "image", image })).toEqual({ mode: "template" });
  });
});

describe("menu background file validation", () => {
  it("rejects an upload larger than 10 MiB before browser decoding", async () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });
    await expect(readMenuBackgroundImage(file)).rejects.toThrow("MENU_BACKGROUND_SIZE");
  });

  it.each(["text/html", "application/json", "application/pdf", "application/octet-stream", ""])(
    "rejects a non-image body with MIME '%s' before browser decoding",
    async (type) => {
      const file = new File(["<!DOCTYPE html><title>Error response</title>"], "background.png", { type });
      await expect(readMenuBackgroundImage(file)).rejects.toThrow("MENU_BACKGROUND_TYPE");
    },
  );

  it.each([
    { type: "image/svg+xml", name: "background.svg", content: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" />' },
    { type: "image/gif", name: "background.gif", content: "GIF89a" },
    { type: "image/avif", name: "background.avif", content: "\u0000\u0000\u0000\u0018ftypavif" },
    { type: "application/octet-stream", name: "background.gif", content: "GIF89a" },
  ])("rejects unsupported $name uploads before browser decoding even with MIME $type", async ({ type, name, content }) => {
    await expect(readMenuBackgroundImage(new File([content], name, { type }))).rejects.toThrow("MENU_BACKGROUND_TYPE");
  });

  it("reports an empty image as a decoding error", async () => {
    await expect(readMenuBackgroundImage(new File([], "empty.png", { type: "image/png" }))).rejects.toThrow("MENU_BACKGROUND_DECODE");
  });
});
