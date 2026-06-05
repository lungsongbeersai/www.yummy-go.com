import { describe, expect, it } from "vitest";
import { categoryIconName, normalizeCategoryIconValue } from "@/features/settings/category/category-icons";
import {
  buildCategoryPayload,
  categoryName,
  groupLabel,
  missingCategoryField
} from "@/features/settings/category/category-utils";

describe("category utils", () => {
  it("builds create payload without a category id", () => {
    expect(
      buildCategoryPayload({
        editing: null,
        groupUuid: " group-1 ",
        icon: " mdi:coffee ",
        nameEng: " Drinks ",
        nameLa: "Drinks LA ",
        storeUuid: "store-1"
      })
    ).toEqual({
      store_uuid_fk: "store-1",
      group_uuid_fk: "group-1",
      cate_name_la: "Drinks LA",
      cate_name_eng: "Drinks",
      cate_icon: "mdi:coffee"
    });
  });

  it("keeps the category id for edit payloads", () => {
    expect(
      buildCategoryPayload({
        editing: { cate_uuid: "category-1", cate_name: "Old" },
        groupUuid: "group-1",
        icon: "mdi:rice",
        nameEng: "Rice",
        nameLa: "Rice LA",
        storeUuid: "store-1"
      })
    ).toEqual({
      store_uuid_fk: "store-1",
      group_uuid_fk: "group-1",
      cate_name_la: "Rice LA",
      cate_name_eng: "Rice",
      cate_icon: "mdi:rice",
      cate_uuid: "category-1"
    });
  });

  it("detects missing required fields", () => {
    expect(missingCategoryField({ storeUuid: "", groupUuid: "group-1", nameLa: "Name", icon: "mdi:food" })).toBe("store");
    expect(missingCategoryField({ storeUuid: "store-1", groupUuid: "", nameLa: "Name", icon: "mdi:food" })).toBe("group");
    expect(missingCategoryField({ storeUuid: "store-1", groupUuid: "group-1", nameLa: "   ", icon: "mdi:food" })).toBe("name");
    expect(missingCategoryField({ storeUuid: "store-1", groupUuid: "group-1", nameLa: "Name", icon: "" })).toBe("icon");
    expect(missingCategoryField({ storeUuid: "store-1", groupUuid: "group-1", nameLa: "Name", icon: "mdi:food" })).toBeNull();
  });

  it("normalizes and falls back category icons", () => {
    expect(normalizeCategoryIconValue("coffee")).toBe("mdi:coffee");
    expect(normalizeCategoryIconValue(" mdi:rice ")).toBe("mdi:rice");
    expect(categoryIconName("mdi:soup")).toBe("mdi:bowl-mix");
    expect(categoryIconName("mdi:not-real")).toBe("mdi:folder-outline");
  });

  it("uses category and group name fallbacks", () => {
    expect(categoryName({ cate_uuid: "category-1", cate_name: "Display", cate_name_la: "LA", cate_name_eng: "EN" })).toBe("Display");
    expect(categoryName({ cate_uuid: "category-1", cate_name_la: "LA", cate_name_eng: "EN" })).toBe("LA");
    expect(categoryName({ cate_uuid: "category-1", cate_name_eng: "EN" })).toBe("EN");
    expect(categoryName(null)).toBe("-");
    expect(groupLabel({ group_uuid: "group-1", group_name: "Group", group_name_la: "LA" })).toBe("Group");
    expect(groupLabel({ group_uuid: "group-1", group_name_la: "LA", group_name_eng: "EN" })).toBe("LA");
  });
});
