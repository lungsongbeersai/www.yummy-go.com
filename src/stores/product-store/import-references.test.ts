import { describe, expect, it, vi } from "vitest";
import {
  ensureProductImportReferences,
  planProductImportReferences,
  type ProductImportReferencePlanInput,
} from "./import-references";

function planInput(
  overrides: Partial<ProductImportReferencePlanInput> = {},
): ProductImportReferencePlanInput {
  return {
    defaultGroupName: "Imported",
    groups: [],
    categories: [],
    units: [],
    normalSizes: [],
    setSizes: [],
    categoryNames: [],
    unitNames: [],
    normalSizeNames: [],
    setSizeNames: [],
    ...overrides,
  };
}

describe("planProductImportReferences", () => {
  it("reuses unique references and creates missing names in separate size namespaces", () => {
    const plan = planProductImportReferences(
      planInput({
        groups: [{ group_uuid: "group-import", group_name_la: "Imported" }],
        categories: [
          {
            cate_uuid: "cat-food",
            cate_name_la: "Food",
            group_uuid_fk: "group-import",
          },
        ],
        units: [{ unite_uuid: "unit-plate", unite_name_la: "Plate" }],
        normalSizes: [{ size_uuid: "size-normal", size_name_la: "Regular" }],
        setSizes: [{ size_uuid: "size-set", size_name_la: "Regular" }],
        categoryNames: ["Food", "Drinks"],
        unitNames: ["Plate", "Bowl"],
        normalSizeNames: ["Regular", "Large"],
        setSizeNames: ["Regular", "Combo"],
      }),
    );

    expect(plan).toMatchObject({
      group: {
        action: "reuse",
        name: "Imported",
        uuid: "group-import",
      },
      conflicts: [],
      createCategories: ["Drinks"],
      createUnits: ["Bowl"],
      createNormalSizes: ["Large"],
      createSetSizes: ["Combo"],
    });
  });

  it("reports ambiguous references and a same-name category in another group", () => {
    const plan = planProductImportReferences(
      planInput({
        groups: [{ group_uuid: "group-import", group_name_la: "Imported" }],
        categories: [
          {
            cate_uuid: "cat-other",
            cate_name_la: "Food",
            group_uuid_fk: "group-other",
          },
        ],
        units: [
          { unite_uuid: "unit-1", unite_name_la: "Plate" },
          { unite_uuid: "unit-2", unite_name_eng: "Ｐｌａｔｅ" },
        ],
        categoryNames: ["Food"],
        unitNames: ["Plate"],
      }),
    );

    expect(plan.createCategories).toEqual([]);
    expect(plan.createUnits).toEqual([]);
    expect(plan.conflicts).toEqual(
      expect.arrayContaining([
        {
          kind: "category",
          name: "Food",
          reason: "category-group-mismatch",
        },
        { kind: "unit", name: "Plate", reason: "ambiguous" },
      ]),
    );
  });

  it("does not reuse a target-group category when the same name also exists elsewhere", () => {
    const plan = planProductImportReferences(
      planInput({
        groups: [{ group_uuid: "group-import", group_name_la: "Imported" }],
        categories: [
          {
            cate_uuid: "cat-target",
            cate_name_la: "Food",
            group_uuid_fk: "group-import",
          },
          {
            cate_uuid: "cat-other",
            cate_name_eng: "Ｆｏｏｄ",
            group_uuid_fk: "group-other",
          },
        ],
        categoryNames: ["Food"],
      }),
    );

    expect(plan.conflicts).toContainEqual({
      kind: "category",
      name: "Food",
      reason: "category-group-mismatch",
    });
  });

  it("does not create a default group when no valid category needs it", () => {
    const plan = planProductImportReferences(planInput({ unitNames: ["Plate"] }));

    expect(plan.group).toBeNull();
    expect(plan.createCategories).toEqual([]);
    expect(plan.createUnits).toEqual(["Plate"]);
  });

  it("treats multiple matching default groups as a blocking conflict", () => {
    const plan = planProductImportReferences(
      planInput({
        groups: [
          { group_uuid: "group-1", group_name_la: "Imported" },
          { group_uuid: "group-2", group_name_eng: "Ｉｍｐｏｒｔｅｄ" },
        ],
        categoryNames: ["Food"],
      }),
    );

    expect(plan.group).toBeNull();
    expect(plan.createCategories).toEqual([]);
    expect(plan.conflicts).toContainEqual({
      kind: "group",
      name: "Imported",
      reason: "ambiguous",
    });
  });
});

describe("ensureProductImportReferences", () => {
  it("creates only planned references and creates the group before categories", async () => {
    const saveGroup = vi.fn().mockResolvedValue({
      group_uuid: "group-import",
      group_name_la: "Imported",
    });
    const saveCategory = vi.fn().mockImplementation(async (input) => ({
      ...input,
      cate_uuid: `category-${input.cate_name_la}`,
    }));
    const saveUnit = vi.fn().mockImplementation(async (input) => ({
      ...input,
      unite_uuid: `unit-${input.unite_name_la}`,
    }));
    const saveSizeForStatus = vi.fn().mockImplementation(async (input) => ({
      ...input,
      size_uuid: `size-${input.status_sort_fk}-${input.size_name_la}`,
    }));

    const result = await ensureProductImportReferences(
      {
        storeUuid: "store-1",
        language: "la",
        plan: {
          group: { action: "create", name: "Imported" },
          conflicts: [],
          createCategories: ["Food"],
          createUnits: ["Bowl"],
          createNormalSizes: ["Regular"],
          createSetSizes: ["Combo"],
        },
      },
      {
        getGroups: vi.fn().mockResolvedValue([]),
        getCategories: vi.fn().mockResolvedValue([]),
        getUnits: vi.fn().mockResolvedValue([]),
        getSizes: vi.fn().mockResolvedValue([]),
        saveGroup,
        saveCategory,
        saveUnit,
        saveSizeForStatus,
      },
    );

    expect(saveGroup).toHaveBeenCalledTimes(1);
    expect(saveCategory).toHaveBeenCalledWith({
      store_uuid_fk: "store-1",
      group_uuid_fk: "group-import",
      cate_name_la: "Food",
      cate_name_eng: "Food",
      cate_icon: "mdi:folder-outline",
    });
    expect(saveGroup.mock.invocationCallOrder[0]).toBeLessThan(
      saveCategory.mock.invocationCallOrder[0] ?? 0,
    );
    expect(saveUnit).toHaveBeenCalledTimes(1);
    expect(saveSizeForStatus).toHaveBeenCalledTimes(2);
    expect(result.group?.group_uuid).toBe("group-import");
    expect(result.categories).toContainEqual(
      expect.objectContaining({ cate_uuid: "category-Food" }),
    );
  });

  it("reuses a concurrently-created group instead of creating a duplicate", async () => {
    const saveGroup = vi.fn();

    const result = await ensureProductImportReferences(
      {
        storeUuid: "store-1",
        language: "la",
        plan: {
          group: { action: "create", name: "Imported" },
          conflicts: [],
          createCategories: [],
          createUnits: [],
          createNormalSizes: [],
          createSetSizes: [],
        },
      },
      {
        getGroups: vi.fn().mockResolvedValue([
          { group_uuid: "group-existing", group_name_la: "Imported" },
        ]),
        getCategories: vi.fn().mockResolvedValue([]),
        getUnits: vi.fn().mockResolvedValue([]),
        getSizes: vi.fn().mockResolvedValue([]),
        saveGroup,
        saveCategory: vi.fn(),
        saveUnit: vi.fn(),
        saveSizeForStatus: vi.fn(),
      },
    );

    expect(saveGroup).not.toHaveBeenCalled();
    expect(result.group?.group_uuid).toBe("group-existing");
  });

  it("rejects a stale category-create plan when the name now exists in another group", async () => {
    const saveCategory = vi.fn();

    await expect(
      ensureProductImportReferences(
        {
          storeUuid: "store-1",
          language: "la",
          plan: {
            group: {
              action: "reuse",
              name: "Imported",
              uuid: "group-import",
            },
            conflicts: [],
            createCategories: ["Food"],
            createUnits: [],
            createNormalSizes: [],
            createSetSizes: [],
          },
        },
        {
          getGroups: vi.fn().mockResolvedValue([
            { group_uuid: "group-import", group_name_la: "Imported" },
          ]),
          getCategories: vi.fn().mockResolvedValue([
            {
              cate_uuid: "cat-other",
              cate_name_la: "Food",
              group_uuid_fk: "group-other",
            },
          ]),
          getUnits: vi.fn().mockResolvedValue([]),
          getSizes: vi.fn().mockResolvedValue([]),
          saveGroup: vi.fn(),
          saveCategory,
          saveUnit: vi.fn(),
          saveSizeForStatus: vi.fn(),
        },
      ),
    ).rejects.toThrow(/category.*group/i);

    expect(saveCategory).not.toHaveBeenCalled();
  });

  it("rejects a stale create plan when a reference name is now ambiguous", async () => {
    const saveUnit = vi.fn();

    await expect(
      ensureProductImportReferences(
        {
          storeUuid: "store-1",
          language: "la",
          plan: {
            group: null,
            conflicts: [],
            createCategories: [],
            createUnits: ["Plate"],
            createNormalSizes: [],
            createSetSizes: [],
          },
        },
        {
          getGroups: vi.fn().mockResolvedValue([]),
          getCategories: vi.fn().mockResolvedValue([]),
          getUnits: vi.fn().mockResolvedValue([
            { unite_uuid: "unit-1", unite_name_la: "Plate" },
            { unite_uuid: "unit-2", unite_name_eng: "Plate" },
          ]),
          getSizes: vi.fn().mockResolvedValue([]),
          saveGroup: vi.fn(),
          saveCategory: vi.fn(),
          saveUnit,
          saveSizeForStatus: vi.fn(),
        },
      ),
    ).rejects.toThrow(/unit.*ambiguous/i);

    expect(saveUnit).not.toHaveBeenCalled();
  });

  it("refetches the status bucket when Size create omits size_uuid", async () => {
    let normalSizeReads = 0;
    const getSizes = vi.fn().mockImplementation(
      async (_storeUuid: string, statusSort: 1 | 2) => {
        if (statusSort !== 1) return [];
        normalSizeReads += 1;
        return normalSizeReads < 2
          ? []
          : [
              {
                size_uuid: "size-cow",
                size_name_la: "ງົວ",
                size_name_eng: "ງົວ",
              },
            ];
      },
    );

    const result = await ensureProductImportReferences(
      {
        storeUuid: "store-1",
        language: "la",
        plan: {
          group: null,
          conflicts: [],
          createCategories: [],
          createUnits: [],
          createNormalSizes: ["ງົວ"],
          createSetSizes: [],
        },
      },
      {
        getGroups: vi.fn().mockResolvedValue([]),
        getCategories: vi.fn().mockResolvedValue([]),
        getUnits: vi.fn().mockResolvedValue([]),
        getSizes,
        saveGroup: vi.fn(),
        saveCategory: vi.fn(),
        saveUnit: vi.fn(),
        saveSizeForStatus: vi.fn().mockResolvedValue({
          size_name_la: "ງົວ",
          size_name_eng: "ງົວ",
        }),
      },
    );

    expect(result.sizes).toContainEqual(
      expect.objectContaining({ size_uuid: "size-cow" }),
    );
  });
});
