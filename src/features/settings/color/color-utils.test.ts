import { describe, expect, it } from "vitest";
import {
  buildColorPayload,
  colorName,
  colorStyle,
  missingColorField,
  pickerColor
} from "@/features/settings/color/color-utils";

describe("color utils", () => {
  it("builds create payload with an empty color id", () => {
    expect(buildColorPayload({ code: " #18a058 ", editing: null })).toEqual({
      color_uuid: "",
      color_code: "#18a058"
    });
  });

  it("keeps the color id for edit payloads", () => {
    expect(buildColorPayload({ code: "#ffcc00", editing: { color_uuid: "color-1", color_code: "#000000" } })).toEqual({
      color_uuid: "color-1",
      color_code: "#ffcc00"
    });
  });

  it("detects missing required fields", () => {
    expect(missingColorField({ code: "" })).toBe("code");
    expect(missingColorField({ code: "   " })).toBe("code");
    expect(missingColorField({ code: "#ffffff" })).toBeNull();
  });

  it("uses color name fallback", () => {
    expect(colorName({ color_uuid: "color-1", color_name: "Green", color_code: "#00ff00" })).toBe("Green");
    expect(colorName({ color_uuid: "color-1", color_code: "#00ff00" })).toBe("#00ff00");
    expect(colorName(null)).toBe("-");
  });

  it("supports picker and swatch fallbacks", () => {
    expect(pickerColor("#abc")).toBe("#aabbcc");
    expect(pickerColor("#aabbcc")).toBe("#aabbcc");
    expect(pickerColor("custom-color")).toBe("#000000");
    expect(colorStyle("#abcdef")).toEqual({ backgroundColor: "#abcdef" });
    expect(colorStyle("custom-color")).toBeUndefined();
  });
});
