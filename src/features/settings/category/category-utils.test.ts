import { describe, expect, it } from "vitest";
import { categoryIconName, normalizeCategoryIconValue } from "@/features/settings/category/category-icons";
import {
  buildCategoryPayload,
  categoryGroupId,
  categoryId,
  categoryName,
  categoryValue,
  categoryVisibility,
  categoryVisibilityFromFormData,
  categoryVisibilityRoleLabel,
  groupLabel,
  missingCategoryField,
  rowStoreUuid
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

  it("keeps existing and new categories visible to all roles until a restriction is configured", () => {
    expect(categoryVisibility(null)).toEqual({ visibility_all_roles: true, visibility_role_ids: [] });
    expect(categoryVisibility({ cate_uuid: "legacy-category" })).toEqual({
      visibility_all_roles: true, visibility_role_ids: [],
    });
  });

  it("restores distinct selected role IDs when editing a restricted category", () => {
    expect(categoryVisibility({
      cate_uuid: "restricted-category",
      visibility_all_roles: false,
      visibility_role_ids: [3, 4, 3],
    })).toEqual({ visibility_all_roles: false, visibility_role_ids: [3, 4] });
  });

  it("reads multiple selected role IDs as distinct numbers from the category form", () => {
    const formData = new FormData();
    formData.set("visibility_all_roles", "false");
    formData.append("visibility_role_ids", "3");
    formData.append("visibility_role_ids", "4");
    formData.append("visibility_role_ids", "3");

    expect(categoryVisibilityFromFormData(formData)).toEqual({
      visibility_all_roles: false, visibility_role_ids: [3, 4],
    });
  });

  it("clears selected role restrictions when the form switches back to all roles", () => {
    const formData = new FormData();
    formData.set("visibility_all_roles", "true");
    formData.append("visibility_role_ids", "3");
    formData.append("visibility_role_ids", "4");

    const visibility = categoryVisibilityFromFormData(formData);
    expect(visibility).toEqual({ visibility_all_roles: true, visibility_role_ids: [] });
    expect(buildCategoryPayload({
      editing: { cate_uuid: "restricted-category", visibility_all_roles: false, visibility_role_ids: [3] },
      storeUuid: "store-1", groupUuid: "group-1", nameLa: "Name", nameEng: "Name", icon: "mdi:food",
      visibility: { visibility_all_roles: true, visibility_role_ids: [3, 4] },
    })).toMatchObject({ visibility_all_roles: true, visibility_role_ids: [] });
  });

  it("preserves the saved policy when an older edit form omits visibility fields", () => {
    const formData = new FormData();
    formData.set("cate_name_la", "Updated name");
    const visibility = categoryVisibilityFromFormData(formData);
    expect(visibility).toBeUndefined();

    const payload = buildCategoryPayload({
      editing: { cate_uuid: "restricted-category", visibility_all_roles: false, visibility_role_ids: [3] },
      storeUuid: "store-1", groupUuid: "group-1", nameLa: "Updated name", nameEng: "", icon: "mdi:food",
      visibility,
    });
    expect(payload).toMatchObject({ cate_uuid: "restricted-category", cate_name_la: "Updated name" });
    expect(payload).not.toHaveProperty("visibility_all_roles");
    expect(payload).not.toHaveProperty("visibility_role_ids");
  });

  it("requires at least one selected role only when restricted visibility is enabled", () => {
    const fields = { storeUuid: "store-1", groupUuid: "group-1", nameLa: "Name", icon: "mdi:food" };
    expect(missingCategoryField({
      ...fields, visibility: { visibility_all_roles: false, visibility_role_ids: [] },
    })).toBe("visibility_roles");
    expect(missingCategoryField({
      ...fields, visibility: { visibility_all_roles: false, visibility_role_ids: [4] },
    })).toBeNull();
    expect(missingCategoryField({
      ...fields, visibility: { visibility_all_roles: true, visibility_role_ids: [] },
    })).toBeNull();
  });

  it("builds the selected category policy without replacing its role IDs with the acting user", () => {
    expect(buildCategoryPayload({
      editing: null, storeUuid: "store-1", groupUuid: "group-1", nameLa: "Name", nameEng: "", icon: "mdi:food",
      visibility: { visibility_all_roles: false, visibility_role_ids: [3, 4] },
    })).toEqual({
      store_uuid_fk: "store-1", group_uuid_fk: "group-1", cate_name_la: "Name", cate_name_eng: "", cate_icon: "mdi:food",
      visibility_all_roles: false, visibility_role_ids: [3, 4],
    });
  });

  it("uses translated employee role labels with a readable fallback", () => {
    const role = { roles_id: 4, roles_name: "Sales", roles_name_la: "ພະນັກງານຂາຍ", roles_name_eng: "Sales staff" };
    expect(categoryVisibilityRoleLabel(role, "la")).toBe("ພະນັກງານຂາຍ");
    expect(categoryVisibilityRoleLabel(role, "en")).toBe("Sales staff");
    expect(categoryVisibilityRoleLabel({ roles_id: 4, roles_name: "Sales" }, "en")).toBe("Sales");
    expect(categoryVisibilityRoleLabel({ roles_id: 4 }, "la")).toBe("4");
  });

  it("normalizes and falls back category icons", () => {
    expect(normalizeCategoryIconValue("coffee")).toBe("mdi:coffee");
    expect(normalizeCategoryIconValue(" mdi:rice ")).toBe("mdi:rice");
    expect(categoryIconName("mdi:soup")).toBe("mdi:bowl-mix");
    expect(categoryIconName("mdi:not-real")).toBe("mdi:not-real");
  });

  it("uses category and group name fallbacks", () => {
    expect(categoryName({ cate_uuid: "category-1", cate_name: "Display", cate_name_la: "LA", cate_name_eng: "EN" })).toBe("Display");
    expect(categoryName({ cate_uuid: "category-1", cate_name_la: "LA", cate_name_eng: "EN" })).toBe("LA");
    expect(categoryName({ cate_uuid: "category-1", cate_name_eng: "EN" })).toBe("EN");
    expect(categoryName(null)).toBe("-");
    expect(groupLabel({ group_uuid: "group-1", group_name: "Group", group_name_la: "LA" })).toBe("Group");
    expect(groupLabel({ group_uuid: "group-1", group_name_la: "LA", group_name_eng: "EN" })).toBe("LA");
  });

  it("uses value and id fallbacks", () => {
    expect(categoryValue({ cate_uuid: "category-1", cate_name: "" }, "cate_name", "-")).toBe("-");
    expect(categoryValue({ cate_uuid: "category-1", cate_name: "Name" }, "cate_name", "-")).toBe("Name");
    expect(categoryId({ cate_uuid: "category-1" })).toBe("category-1");
    expect(categoryId(null)).toBe("");
  });

  it("reads the category group id from canonical and legacy API fields", () => {
    expect(categoryGroupId({ cate_uuid: "category-1", group_uuid_fk: "group-canonical", group_uuid: "group-legacy" })).toBe(
      "group-canonical"
    );
    expect(categoryGroupId({ cate_uuid: "category-1", group_uuid: "group-legacy" })).toBe("group-legacy");
    expect(categoryGroupId(null)).toBe("");
  });

  it("reads the store uuid from the first row only", () => {
    expect(rowStoreUuid([{ cate_uuid: "category-1", store_uuid_fk: "store-1" }])).toBe("store-1");
    expect(rowStoreUuid([])).toBe("");
  });
});
