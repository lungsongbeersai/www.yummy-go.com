import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCategoryOptions,
  getCategoryVisibilityRoles,
  getProductCategoryOptions,
  saveCategory,
} from "@/services/category";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("@/lib/api", () => ({
  apiRequest: mocks.request,
  ServiceError: class extends Error {},
}));

beforeEach(() => { mocks.request.mockReset(); });

describe("category visibility service", () => {
  it("loads product editor categories through the scoped product management view", async () => {
    const categories = [{ cate_uuid: "restricted-category", cate_name: "Restricted drinks" }];
    mocks.request.mockResolvedValue({ data: categories });

    await expect(getProductCategoryOptions("en", "store-1")).resolves.toEqual(categories);
    expect(mocks.request).toHaveBeenCalledExactlyOnceWith(
      "get", "/api/v1/category/fetch_limit", {
        params: {
          search: "", page: 1, orderBy: "1", lang: "eng", limit: "all",
          store_uuid_fk: "store-1", management_view: "product",
        },
      }, "Failed to fetch data",
    );
  });

  it("keeps ordinary category options filtered by the caller's visibility policy", async () => {
    const categories = [{ cate_uuid: "public-category" }];
    mocks.request.mockResolvedValue({ data: categories });

    await expect(getCategoryOptions("la", "store-1")).resolves.toEqual(categories);
    expect(mocks.request).toHaveBeenCalledExactlyOnceWith(
      "get", "/api/v1/category/fetch_limit", {
        params: {
          search: "", page: 1, orderBy: "1", lang: "la", limit: "all", store_uuid_fk: "store-1",
        },
      }, "Failed to fetch data",
    );
  });

  it("loads the employee roles for the selected store and API language", async () => {
    const roles = [
      { roles_id: 3, roles_name: "Admin Sale" },
      { roles_id: 4, roles_name: "Sales staff" },
    ];
    mocks.request.mockResolvedValue({ data: roles });

    await expect(getCategoryVisibilityRoles("store-1", "en")).resolves.toEqual(roles);
    expect(mocks.request).toHaveBeenCalledExactlyOnceWith(
      "get", "/api/v1/category/visibility-roles", {
        params: { store_uuid_fk: "store-1", lang: "eng" },
      },
    );
  });

  it("propagates a denied role lookup so the form cannot treat missing authorization as an empty successful list", async () => {
    const denied = new Error("Category management access denied");
    mocks.request.mockRejectedValue(denied);

    await expect(getCategoryVisibilityRoles("store-1", "la")).rejects.toBe(denied);
  });

  it("sends selected numeric policy role IDs while actor authorization remains in the authenticated API request", async () => {
    const input = {
      cate_uuid: "category-1",
      store_uuid_fk: "store-1",
      group_uuid_fk: "group-1",
      cate_name_la: "Restricted drinks",
      cate_name_eng: "Restricted drinks",
      cate_icon: "mdi:coffee",
      visibility_all_roles: false,
      visibility_role_ids: [3, 4],
    };
    const saved = { cate_uuid: "category-1" };
    mocks.request.mockResolvedValue({ data: saved });

    await expect(saveCategory(input)).resolves.toEqual(saved);
    expect(mocks.request).toHaveBeenCalledExactlyOnceWith(
      "post", "/api/v1/category/create", { data: input }, "Failed to save data",
    );
  });

  it("leaves policy fields absent when an older caller updates only the category details", async () => {
    const input = {
      cate_uuid: "category-1", store_uuid_fk: "store-1", group_uuid_fk: "group-1",
      cate_name_la: "Renamed", cate_name_eng: "", cate_icon: "mdi:coffee",
    };
    mocks.request.mockResolvedValue({ data: { cate_uuid: "category-1" } });

    await saveCategory(input);
    expect(mocks.request).toHaveBeenCalledExactlyOnceWith(
      "post", "/api/v1/category/create", { data: input }, "Failed to save data",
    );
  });
});
