import { DEFAULT_CATEGORY_ICON } from "@/lib/category-defaults";
import { normalizeProductImportKey } from "@/lib/product-import";
import {
  getCategoryOptions,
  saveCategory,
  type Category,
  type SaveCategoryInput,
} from "@/services/category";
import {
  getGroupOptions,
  saveGroup,
  type Group,
  type SaveGroupInput,
} from "@/services/group";
import { getSizesByStatus } from "@/services/product";
import {
  saveSizeForStatus,
  type SaveSizeForStatusInput,
  type Size,
} from "@/services/size";
import {
  getUnitOptions,
  saveUnit,
  type SaveUnitInput,
  type Unit,
} from "@/services/unit";

export interface ProductImportReferenceNames {
  categoryNames: string[];
  unitNames: string[];
  normalSizeNames: string[];
  setSizeNames: string[];
}

export interface ProductImportReferencePlanInput
  extends ProductImportReferenceNames {
  defaultGroupName: string;
  groups: Group[];
  categories: Category[];
  units: Unit[];
  normalSizes: Size[];
  setSizes: Size[];
}

export interface ProductImportReferenceConflict {
  kind: "group" | "category" | "unit" | "normalSize" | "setSize";
  name: string;
  reason: "ambiguous" | "category-group-mismatch";
}

export interface ProductImportReferencePlan {
  group:
    | { action: "reuse" | "create"; name: string; uuid?: string }
    | null;
  conflicts: ProductImportReferenceConflict[];
  createCategories: string[];
  createUnits: string[];
  createNormalSizes: string[];
  createSetSizes: string[];
}

/**
 * Legacy name fields stay optional until the import workflow switches to an
 * explicit preflight plan in Task 3.
 */
export interface EnsureProductImportReferencesInput
  extends Partial<ProductImportReferenceNames> {
  storeUuid: string;
  language: string;
  plan?: ProductImportReferencePlan;
  defaultGroupName?: string;
}

export interface ProductImportResolvedReferences {
  group: Group | null;
  categories: Category[];
  units: Unit[];
  sizes: Size[];
  setSizes: Size[];
}

export interface ProductImportReferenceDependencies {
  getGroups: (language: string, storeUuid: string) => Promise<Group[]>;
  getCategories: (language: string, storeUuid: string) => Promise<Category[]>;
  getUnits: (language: string, storeUuid: string) => Promise<Unit[]>;
  getSizes: (
    storeUuid: string,
    statusSort: 1 | 2,
    language: string,
  ) => Promise<Size[]>;
  saveGroup: (input: SaveGroupInput) => Promise<Group>;
  saveCategory: (input: SaveCategoryInput) => Promise<Category>;
  saveUnit: (input: SaveUnitInput) => Promise<Unit>;
  saveSizeForStatus: (input: SaveSizeForStatusInput) => Promise<Size>;
}

const defaultDependencies: ProductImportReferenceDependencies = {
  getGroups: getGroupOptions,
  getCategories: getCategoryOptions,
  getUnits: getUnitOptions,
  getSizes: async (storeUuid, statusSort, language) =>
    (await getSizesByStatus(storeUuid, statusSort, language)) as Size[],
  saveGroup,
  saveCategory,
  saveUnit,
  saveSizeForStatus: async (input) => (await saveSizeForStatus(input)) as Size,
};

const GROUP_NAME_KEYS = [
  "group_name",
  "group_name_la",
  "group_name_eng",
];
const CATEGORY_NAME_KEYS = [
  "cate_name",
  "cate_name_la",
  "cate_name_eng",
];
const UNIT_NAME_KEYS = [
  "unite_name",
  "unite_name_la",
  "unite_name_eng",
];
const SIZE_NAME_KEYS = ["size_name", "size_name_la", "size_name_eng"];

function cleanImportName(value: unknown) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function uniqueNames(names: string[]) {
  const values = new Map<string, string>();
  names.forEach((name) => {
    const cleaned = cleanImportName(name);
    const key = normalizeProductImportKey(cleaned);
    if (key && !values.has(key)) values.set(key, cleaned);
  });
  return [...values.values()];
}

function rowMatches(
  row: Record<string, unknown>,
  name: string,
  keys: string[],
) {
  const target = normalizeProductImportKey(name);
  return keys.some(
    (key) => normalizeProductImportKey(row[key]) === target,
  );
}

function matchingRows<T extends Record<string, unknown>>(
  rows: T[],
  name: string,
  nameKeys: string[],
) {
  return rows.filter((row) => rowMatches(row, name, nameKeys));
}

function distinctIds<T extends Record<string, unknown>>(
  rows: T[],
  idKey: string,
) {
  return new Set(
    rows.map((row) => cleanImportName(row[idKey])).filter(Boolean),
  );
}

function requiredUuid(
  row: Record<string, unknown> | null | undefined,
  key: string,
  label: string,
) {
  const uuid = cleanImportName(row?.[key]);
  if (!uuid) throw new Error(`${label} API did not return ${key}`);
  return uuid;
}

function planNamedReferences<T extends Record<string, unknown>>({
  kind,
  names,
  rows,
  idKey,
  nameKeys,
  conflicts,
}: {
  kind: "unit" | "normalSize" | "setSize";
  names: string[];
  rows: T[];
  idKey: string;
  nameKeys: string[];
  conflicts: ProductImportReferenceConflict[];
}) {
  const creates: string[] = [];
  uniqueNames(names).forEach((name) => {
    const matches = matchingRows(rows, name, nameKeys);
    if (!matches.length) {
      creates.push(name);
      return;
    }
    if (distinctIds(matches, idKey).size !== 1) {
      conflicts.push({ kind, name, reason: "ambiguous" });
    }
  });
  return creates;
}

export function planProductImportReferences(
  input: ProductImportReferencePlanInput,
): ProductImportReferencePlan {
  const conflicts: ProductImportReferenceConflict[] = [];
  const categoryNames = uniqueNames(input.categoryNames);
  const defaultGroupName = cleanImportName(input.defaultGroupName);
  let group: ProductImportReferencePlan["group"] = null;
  let targetGroupUuid = "";
  let canPlanCategories = categoryNames.length > 0;

  if (categoryNames.length) {
    const groupMatches = matchingRows(
      input.groups,
      defaultGroupName,
      GROUP_NAME_KEYS,
    );
    const groupIds = distinctIds(groupMatches, "group_uuid");
    if (groupMatches.length && groupIds.size !== 1) {
      conflicts.push({
        kind: "group",
        name: defaultGroupName,
        reason: "ambiguous",
      });
      canPlanCategories = false;
    } else if (groupIds.size === 1) {
      targetGroupUuid = [...groupIds][0] ?? "";
      group = {
        action: "reuse",
        name: defaultGroupName,
        uuid: targetGroupUuid,
      };
    }
  }

  const createCategories: string[] = [];
  if (canPlanCategories) {
    categoryNames.forEach((name) => {
      const matches = matchingRows(
        input.categories,
        name,
        CATEGORY_NAME_KEYS,
      );
      if (!matches.length) {
        createCategories.push(name);
        return;
      }

      if (!targetGroupUuid) {
        conflicts.push({
          kind: "category",
          name,
          reason: "category-group-mismatch",
        });
        return;
      }

      const targetMatches = matches.filter(
        (category) =>
          cleanImportName(category.group_uuid_fk) === targetGroupUuid,
      );
      const otherGroupMatches = matches.filter(
        (category) =>
          cleanImportName(category.group_uuid_fk) !== targetGroupUuid,
      );
      if (otherGroupMatches.length) {
        conflicts.push({
          kind: "category",
          name,
          reason: "category-group-mismatch",
        });
        return;
      }
      if (distinctIds(targetMatches, "cate_uuid").size === 1) return;

      conflicts.push({
        kind: "category",
        name,
        reason: targetMatches.length
          ? "ambiguous"
          : "category-group-mismatch",
      });
    });
  }

  if (!targetGroupUuid && createCategories.length) {
    group = { action: "create", name: defaultGroupName };
  }

  const createUnits = planNamedReferences({
    kind: "unit",
    names: input.unitNames,
    rows: input.units,
    idKey: "unite_uuid",
    nameKeys: UNIT_NAME_KEYS,
    conflicts,
  });
  const createNormalSizes = planNamedReferences({
    kind: "normalSize",
    names: input.normalSizeNames,
    rows: input.normalSizes,
    idKey: "size_uuid",
    nameKeys: SIZE_NAME_KEYS,
    conflicts,
  });
  const createSetSizes = planNamedReferences({
    kind: "setSize",
    names: input.setSizeNames,
    rows: input.setSizes,
    idKey: "size_uuid",
    nameKeys: SIZE_NAME_KEYS,
    conflicts,
  });

  return {
    group,
    conflicts,
    createCategories,
    createUnits,
    createNormalSizes,
    createSetSizes,
  };
}

async function resolveCreatedRow<T extends Record<string, unknown>>({
  created,
  idKey,
  name,
  nameKeys,
  reload,
}: {
  created: T;
  idKey: string;
  name: string;
  nameKeys: string[];
  reload: () => Promise<T[]>;
}) {
  if (cleanImportName(created[idKey])) return created;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const matches = matchingRows(await reload(), name, nameKeys);
    if (distinctIds(matches, idKey).size === 1) {
      return matches.find((row) => cleanImportName(row[idKey]));
    }
  }
  return undefined;
}

async function createPlannedRows<T extends Record<string, unknown>>({
  names,
  rows,
  idKey,
  label,
  nameKeys,
  create,
  reload,
}: {
  names: string[];
  rows: T[];
  idKey: string;
  label: string;
  nameKeys: string[];
  create: (name: string) => Promise<T>;
  reload: () => Promise<T[]>;
}) {
  const resolvedRows = [...rows];
  for (const name of uniqueNames(names)) {
    const existingMatches = matchingRows(resolvedRows, name, nameKeys);
    if (distinctIds(existingMatches, idKey).size === 1) continue;

    const created = await create(name);
    const resolved = await resolveCreatedRow({
      created,
      idKey,
      name,
      nameKeys,
      reload,
    });
    requiredUuid(resolved, idKey, label);
    resolvedRows.push(resolved!);
  }
  return resolvedRows;
}

export async function ensureProductImportReferences(
  input: EnsureProductImportReferencesInput,
  deps: ProductImportReferenceDependencies = defaultDependencies,
): Promise<ProductImportResolvedReferences> {
  const storeUuid = cleanImportName(input.storeUuid);
  if (!storeUuid) throw new Error("Store is required");

  const [groups, categories, units, sizes, setSizes] = await Promise.all([
    deps.getGroups(input.language, storeUuid),
    deps.getCategories(input.language, storeUuid),
    deps.getUnits(input.language, storeUuid),
    deps.getSizes(storeUuid, 1, input.language),
    deps.getSizes(storeUuid, 2, input.language),
  ]);
  const plan =
    input.plan ??
    planProductImportReferences({
      defaultGroupName: input.defaultGroupName ?? "",
      groups,
      categories,
      units,
      normalSizes: sizes,
      setSizes,
      categoryNames: input.categoryNames ?? [],
      unitNames: input.unitNames ?? [],
      normalSizeNames: input.normalSizeNames ?? [],
      setSizeNames: input.setSizeNames ?? [],
    });

  if (!input.plan && plan.conflicts.length) {
    throw new Error(
      `Import reference conflict: ${plan.conflicts
        .map((conflict) => conflict.name)
        .join(", ")}`,
    );
  }
  if (plan.conflicts.some((conflict) => conflict.kind === "group")) {
    throw new Error(`Default Group is ambiguous: ${plan.group?.name ?? ""}`);
  }

  let group: Group | null = null;
  if (plan.group?.action === "reuse") {
    group =
      groups.find(
        (row) => cleanImportName(row.group_uuid) === plan.group?.uuid,
      ) ?? null;
    requiredUuid(group, "group_uuid", "Group");
  } else if (plan.group?.action === "create") {
    const concurrentMatches = matchingRows(
      groups,
      plan.group.name,
      GROUP_NAME_KEYS,
    );
    if (concurrentMatches.length) {
      if (distinctIds(concurrentMatches, "group_uuid").size !== 1) {
        throw new Error(`Default Group is ambiguous: ${plan.group.name}`);
      }
      group =
        concurrentMatches.find((row) => cleanImportName(row.group_uuid)) ??
        null;
    } else {
      const created = await deps.saveGroup({
        store_uuid_fk: storeUuid,
        group_name_la: plan.group.name,
        group_name_eng: plan.group.name,
      });
      group =
        (await resolveCreatedRow({
          created,
          idKey: "group_uuid",
          name: plan.group.name,
          nameKeys: GROUP_NAME_KEYS,
          reload: () => deps.getGroups(input.language, storeUuid),
        })) ?? null;
    }
    requiredUuid(group, "group_uuid", "Group");
  }

  if (plan.createCategories.length && !group) {
    throw new Error("Default Group is required for Category creation");
  }
  const groupUuid = group ? requiredUuid(group, "group_uuid", "Group") : "";

  const resolvedCategories = await createPlannedRows({
    names: plan.createCategories,
    rows: categories,
    idKey: "cate_uuid",
    label: "Category",
    nameKeys: CATEGORY_NAME_KEYS,
    reload: () => deps.getCategories(input.language, storeUuid),
    create: (name) =>
      deps.saveCategory({
        store_uuid_fk: storeUuid,
        group_uuid_fk: groupUuid,
        cate_name_la: name,
        cate_name_eng: name,
        cate_icon: DEFAULT_CATEGORY_ICON,
      }),
  });
  const resolvedUnits = await createPlannedRows({
    names: plan.createUnits,
    rows: units,
    idKey: "unite_uuid",
    label: "Unit",
    nameKeys: UNIT_NAME_KEYS,
    reload: () => deps.getUnits(input.language, storeUuid),
    create: (name) =>
      deps.saveUnit({
        unite_uuid: "",
        store_uuid_fk: storeUuid,
        unite_name_la: name,
        unite_name_eng: name,
      }),
  });
  const resolvedSizes = await createPlannedRows({
    names: plan.createNormalSizes,
    rows: sizes,
    idKey: "size_uuid",
    label: "Size",
    nameKeys: SIZE_NAME_KEYS,
    reload: () => deps.getSizes(storeUuid, 1, input.language),
    create: (name) =>
      deps.saveSizeForStatus({
        size_uuid: "",
        store_uuid_fk: storeUuid,
        size_name_la: name,
        size_name_eng: name,
        status_sort_fk: 1,
      }),
  });
  const resolvedSetSizes = await createPlannedRows({
    names: plan.createSetSizes,
    rows: setSizes,
    idKey: "size_uuid",
    label: "Set size",
    nameKeys: SIZE_NAME_KEYS,
    reload: () => deps.getSizes(storeUuid, 2, input.language),
    create: (name) =>
      deps.saveSizeForStatus({
        size_uuid: "",
        store_uuid_fk: storeUuid,
        size_name_la: name,
        size_name_eng: name,
        status_sort_fk: 2,
      }),
  });

  return {
    group,
    categories: resolvedCategories,
    units: resolvedUnits,
    sizes: resolvedSizes,
    setSizes: resolvedSetSizes,
  };
}
