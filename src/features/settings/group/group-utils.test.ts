import { describe, expect, it } from "vitest";
import { buildGroupPayload, groupName, missingGroupField } from "@/features/settings/group/group-utils";

describe("group utils", () => {
  it("builds create payload without a group id", () => {
    expect(
      buildGroupPayload({
        editing: null,
        nameEng: "Food ",
        nameLa: " Food Lao ",
        storeUuid: "store-1"
      })
    ).toEqual({
      store_uuid_fk: "store-1",
      group_name_la: "Food Lao",
      group_name_eng: "Food"
    });
  });

  it("keeps the group id for edit payloads", () => {
    expect(
      buildGroupPayload({
        editing: { group_uuid: "group-1", group_name: "Display" },
        nameEng: "Drink",
        nameLa: "Drink Lao",
        storeUuid: "store-1"
      })
    ).toEqual({
      store_uuid_fk: "store-1",
      group_uuid: "group-1",
      group_name_la: "Drink Lao",
      group_name_eng: "Drink"
    });
  });

  it("detects missing required fields", () => {
    expect(missingGroupField({ storeUuid: "", nameLa: "Name" })).toBe("store");
    expect(missingGroupField({ storeUuid: "store-1", nameLa: "" })).toBe("name");
    expect(missingGroupField({ storeUuid: "store-1", nameLa: "   " })).toBe("name");
    expect(missingGroupField({ storeUuid: "store-1", nameLa: "Food" })).toBeNull();
  });

  it("uses group name fallbacks", () => {
    expect(groupName({ group_uuid: "group-1", group_name: "Display", group_name_la: "LA", group_name_eng: "EN" })).toBe("Display");
    expect(groupName({ group_uuid: "group-1", group_name_la: "LA", group_name_eng: "EN" })).toBe("LA");
    expect(groupName({ group_uuid: "group-1", group_name_eng: "EN" })).toBe("EN");
    expect(groupName(null)).toBe("-");
  });
});
