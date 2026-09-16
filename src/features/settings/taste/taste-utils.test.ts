import { describe, expect, it } from "vitest";
import { buildTastePayload, buildTasteSortPayload, missingTasteField, tasteName, tasteStatus } from "@/features/settings/taste/taste-utils";

describe("taste utils", () => {
  it("builds create payload with an empty taste id", () => {
    expect(
      buildTastePayload({
        editing: null,
        nameEng: "Spicies ",
        nameLa: " ຫວານນ້ອຍ",
        status: "1",
        storeUuid: "store-1"
      })
    ).toEqual({
      store_uuid_fk: "store-1",
      taste_name_la: "ຫວານນ້ອຍ",
      taste_name_eng: "Spicies",
      taste_status: 1
    });
  });

  it("keeps the taste id for edit payloads", () => {
    expect(
      buildTastePayload({
        editing: { taste_uuid: "taste-1", taste_name: "Sweet" },
        nameEng: "Sweet",
        nameLa: "ຫວານ",
        status: "2",
        storeUuid: "store-1"
      })
    ).toEqual({
      store_uuid_fk: "store-1",
      taste_uuid: "taste-1",
      taste_name_la: "ຫວານ",
      taste_name_eng: "Sweet",
      taste_status: 2
    });
  });

  it("detects missing required fields", () => {
    expect(missingTasteField({ nameLa: "", status: "1", storeUuid: "store-1" })).toBe("name");
    expect(missingTasteField({ nameLa: "ຫວານ", status: "1", storeUuid: "" })).toBe("store");
    expect(missingTasteField({ nameLa: "ຫວານ", status: "", storeUuid: "store-1" })).toBe("status");
    expect(missingTasteField({ nameLa: "ຫວານ", status: "1", storeUuid: "store-1" })).toBeNull();
  });

  it("uses taste name fallbacks", () => {
    expect(tasteName({ taste_uuid: "taste-1", taste_name: "Display", taste_name_la: "LA", taste_name_eng: "EN" })).toBe("Display");
    expect(tasteName({ taste_uuid: "taste-1", taste_name_la: "LA", taste_name_eng: "EN" })).toBe("LA");
    expect(tasteName({ taste_uuid: "taste-1", taste_name_eng: "EN" })).toBe("EN");
    expect(tasteName(null)).toBe("-");
  });

  it("defaults status when missing", () => {
    expect(tasteStatus({ taste_uuid: "taste-1" })).toBe("1");
    expect(tasteStatus({ taste_uuid: "taste-1", taste_status: 2 })).toBe("2");
  });

  it("builds a full sort payload preserving existing name/status", () => {
    expect(
      buildTasteSortPayload(
        {
          taste_uuid: "taste-1",
          store_uuid_fk: "store-1",
          taste_name_la: "ຫວານ",
          taste_name_eng: "Sweet",
          taste_status: 2
        },
        3
      )
    ).toEqual({
      taste_uuid: "taste-1",
      store_uuid_fk: "store-1",
      taste_name_la: "ຫວານ",
      taste_name_eng: "Sweet",
      taste_status: 2,
      taste_sort: 3
    });
  });
});
