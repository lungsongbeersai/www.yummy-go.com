import { describe, expect, it } from "vitest";
import { listParams } from "@/services/shared/crud";

describe("listParams", () => {
  it("applies stable defaults", () => {
    expect(listParams()).toEqual({
      search: "",
      page: 1,
      orderBy: "ASC",
      lang: "la",
      limit: 20
    });
  });

  it("normalizes All limit for generic CRUD endpoints", () => {
    expect(listParams({ limit: "All", search: "tea" })).toMatchObject({
      search: "tea",
      limit: "all"
    });
  });

  it("preserves extra params without overwriting normalized keys", () => {
    expect(listParams({ page: 3, branch_uuid_fk: "b1", limit: null })).toEqual({
      search: "",
      page: 3,
      orderBy: "ASC",
      lang: "la",
      branch_uuid_fk: "b1"
    });
  });
});
