import { describe, expect, it } from "vitest";
import { buildSizePayload, missingSizeField, sizeName } from "@/features/settings/size/size-utils";

describe("size utils", () => {
  it("builds create payload with an empty size id", () => {
    expect(
      buildSizePayload({
        editing: null,
        nameEng: "Small ",
        nameLa: " ນ້ອຍ",
        storeUuid: "store-1"
      })
    ).toEqual({
      store_uuid_fk: "store-1",
      size_uuid: "",
      size_name_la: "ນ້ອຍ",
      size_name_eng: "Small"
    });
  });

  it("keeps the size id for edit payloads", () => {
    expect(
      buildSizePayload({
        editing: { size_uuid: "size-1", size_name: "Medium" },
        nameEng: "Medium",
        nameLa: "ກາງ",
        storeUuid: "store-1"
      })
    ).toEqual({
      store_uuid_fk: "store-1",
      size_uuid: "size-1",
      size_name_la: "ກາງ",
      size_name_eng: "Medium"
    });
  });

  it("detects missing required fields", () => {
    expect(missingSizeField({ nameLa: "" })).toBe("name");
    expect(missingSizeField({ nameLa: "   " })).toBe("name");
    expect(missingSizeField({ nameLa: "Large" })).toBeNull();
  });

  it("uses size name fallbacks", () => {
    expect(sizeName({ size_uuid: "size-1", size_name: "Display", size_name_la: "LA", size_name_eng: "EN" })).toBe("Display");
    expect(sizeName({ size_uuid: "size-1", size_name_la: "LA", size_name_eng: "EN" })).toBe("LA");
    expect(sizeName({ size_uuid: "size-1", size_name_eng: "EN" })).toBe("EN");
    expect(sizeName(null)).toBe("-");
  });
});
