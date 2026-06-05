import { describe, expect, it } from "vitest";
import { buildUnitPayload, missingUnitField, unitName } from "@/features/settings/unit/unit-utils";

describe("unit utils", () => {
  it("builds create payload with an empty unit id", () => {
    expect(
      buildUnitPayload({
        editing: null,
        nameEng: "Bottle ",
        nameLa: " Unit Lao ",
        storeUuid: "store-1"
      })
    ).toEqual({
      store_uuid_fk: "store-1",
      unite_uuid: "",
      unite_name_la: "Unit Lao",
      unite_name_eng: "Bottle"
    });
  });

  it("keeps the unit id for edit payloads", () => {
    expect(
      buildUnitPayload({
        editing: { unite_uuid: "unit-1", unite_name: "Display" },
        nameEng: "Pack",
        nameLa: "Pack Lao",
        storeUuid: "store-1"
      })
    ).toEqual({
      store_uuid_fk: "store-1",
      unite_uuid: "unit-1",
      unite_name_la: "Pack Lao",
      unite_name_eng: "Pack"
    });
  });

  it("detects missing required fields", () => {
    expect(missingUnitField({ nameLa: "" })).toBe("name");
    expect(missingUnitField({ nameLa: "   " })).toBe("name");
    expect(missingUnitField({ nameLa: "Piece" })).toBeNull();
  });

  it("uses unit name fallbacks", () => {
    expect(unitName({ unite_uuid: "unit-1", unite_name: "Display", unite_name_la: "LA", unite_name_eng: "EN" })).toBe("Display");
    expect(unitName({ unite_uuid: "unit-1", unite_name_la: "LA", unite_name_eng: "EN" })).toBe("LA");
    expect(unitName({ unite_uuid: "unit-1", unite_name_eng: "EN" })).toBe("EN");
    expect(unitName(null)).toBe("-");
  });
});
