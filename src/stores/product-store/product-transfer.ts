import type { SaveProductInput, SaveProductDetailInput, SaveProductSetChoiceGroupInput } from "@/services/product";
import type { ProductTransferRecord } from "@/features/product/list/product-transfer-archive";

export interface ProductTransferReferences {
  branchUuid: string;
  categories: Array<Record<string, unknown>>;
  units: Array<Record<string, unknown>>;
  normalSizes: Array<Record<string, unknown>>;
  setSizes: Array<Record<string, unknown>>;
  toppings: Array<Record<string, unknown>>;
  tastes: Array<Record<string, unknown>>;
  setChildOptions: Array<Record<string, unknown>>;
}

export function productTransferReferenceNames(records: ProductTransferRecord[]) {
  const categoryNames: string[] = [];
  const unitNames: string[] = [];
  const normalSizeNames: string[] = [];
  const setSizeNames: string[] = [];
  const toppingNames: string[] = [];
  const tasteNames: string[] = [];
  const setChildOptionNames: string[] = [];
  records.forEach(({ product }) => {
    categoryNames.push(readText(product, ["cate_name_la", "cate_name", "cate_name_eng"]));
    unitNames.push(readText(product, ["unite_name_la", "unite_name", "unite_name_eng"]));
    const status = Number(product.status_sort_fk ?? 1);
    readRecords(product.details).forEach((detail) => {
      (status === 2 ? setSizeNames : normalSizeNames).push(readText(detail, ["size_name_la", "size_name", "size_name_eng"]));
      readRecords(detail.set_option_groups).forEach((option) => {
        setChildOptionNames.push(readText(option, ["set_child_option_name_la", "size_name_la", "size_name", "set_child_option_name_eng"]));
      });
    });
    readRecords(product.toppings).forEach((row) => toppingNames.push(readText(row, ["topping_name_la", "topping_name", "topping_name_eng"])));
    readRecords(product.tastes).forEach((row) => tasteNames.push(readText(row, ["taste_name_la", "taste_name", "taste_name_eng"])));
    readRecords(product.details).forEach((detail) => {
      readRecords(detail.set_tastes).forEach((row) => tasteNames.push(readText(row, ["taste_name_la", "taste_name", "taste_name_eng"])));
      readRecords(detail.set_option_groups).forEach((option) => readStrings(option.taste_names).forEach((name) => tasteNames.push(name)));
    });
  });
  return {
    categoryNames: unique(categoryNames),
    unitNames: unique(unitNames),
    normalSizeNames: unique(normalSizeNames),
    setSizeNames: unique(setSizeNames),
    toppingNames: unique(toppingNames),
    tasteNames: unique(tasteNames),
    setChildOptionNames: unique(setChildOptionNames),
  };
}

export function buildProductTransferSaveInput(
  record: ProductTransferRecord,
  references: ProductTransferReferences,
  image?: File,
): SaveProductInput {
  const product = record.product;
  const setProduct = Number(product.status_sort_fk ?? 1) === 2;
  const categoryId = resolveId(references.categories, readText(product, ["cate_name_la", "cate_name", "cate_name_eng"]), ["cate_uuid"], ["cate_name_la", "cate_name", "cate_name_eng"]);
  const unitId = resolveId(references.units, readText(product, ["unite_name_la", "unite_name", "unite_name_eng"]), ["unite_uuid"], ["unite_name_la", "unite_name", "unite_name_eng"]);
  const sizes = setProduct ? references.setSizes : references.normalSizes;
  const groupInputs = readRecords(product.set_choice_groups).map((group, index) => ({
    client_ref: `transfer-choice-${index + 1}`,
    group_name_la: readText(group, ["group_name_la", "group_name", "transfer_name"]),
    group_name_eng: readText(group, ["group_name_eng", "group_name", "transfer_name"]),
    max_select: asNumber(group.max_select, 1),
    group_sort: asNumber(group.group_sort, index + 1),
  })) satisfies SaveProductSetChoiceGroupInput[];
  const choiceRefs = new Map(groupInputs.map((group) => [normalize(group.group_name_la), group.client_ref]));

  const details = readRecords(product.details).map((detail, index) => {
    const sizeName = readText(detail, ["size_name_la", "size_name", "size_name_eng"]);
    const setChildGroups = readRecords(detail.set_option_groups).map((option, optionIndex) => {
      const childName = readText(option, ["set_child_option_name_la", "size_name_la", "size_name", "set_child_option_name_eng"]);
      const childId = resolveId(references.setChildOptions, childName, ["set_child_option_uuid"], ["set_child_option_name_la", "set_child_option_name", "set_child_option_name_eng"]);
      const tastes = resolveTasteNames(readStrings(option.taste_names), references.tastes);
      return {
        client_ref: `transfer-option-${index + 1}-${optionIndex + 1}`,
        set_child_option_uuid_fk: childId,
        group_name_la: readText(option, ["group_name_la", "group_name", "set_child_group_name_la"]) || childName,
        group_name_eng: readText(option, ["group_name_eng", "group_name", "set_child_group_name_eng"]) || childName,
        max_select: asNumber(option.max_select, 0),
        taste_uuid_fks: tastes,
        group_sort: asNumber(option.group_sort, optionIndex + 1),
      };
    });
    const groupNames = readStrings(detail.set_choice_group_names);
    const clientRefs = groupNames.map((name) => {
      const ref = choiceRefs.get(normalize(name));
      if (!ref) throw new Error(`Set choice group was not found: ${name}`);
      return ref;
    });
    const setTasteNames = readStrings(detail.set_taste_names).length
      ? readStrings(detail.set_taste_names)
      : readRecords(detail.set_tastes).map((taste) => readText(taste, ["taste_name_la", "taste_name", "taste_name_eng"]));
    const sizeId = resolveId(sizes, sizeName, ["size_uuid"], ["size_name_la", "size_name", "size_name_eng"]);
    const result: SaveProductDetailInput = {
      size_uuid_fk: sizeId,
      pro_detail_bprice: asNumber(detail.pro_detail_bprice, 0),
      pro_detail_sprice: asNumber(detail.pro_detail_sprice, 0),
      pro_detail_qty_stock: 0,
      pro_detail_stock: asNumber(detail.pro_detail_stock, 2),
      pro_detail_setqty_cut_stock: asNumber(detail.pro_detail_setqty_cut_stock, 1),
      pro_detail_enabled: asNumber(detail.pro_detail_enabled, 1),
      pro_detail_status: asNumber(detail.pro_detail_status, 2),
      pro_detail_cus_qtyBuy: asNumber(detail.pro_detail_cus_qtyBuy, 0),
      pro_detail_cus_qtyFree: asNumber(detail.pro_detail_cus_qtyFree, 0),
      pro_detail_sDate: optionalText(detail.pro_detail_sDate),
      pro_detail_eDate: optionalText(detail.pro_detail_eDate),
      pro_detail_sTime: optionalText(detail.pro_detail_sTime),
      pro_detail_eTime: optionalText(detail.pro_detail_eTime),
      set_choice_group_client_refs: clientRefs,
      set_taste_max_select: asNumber(detail.set_taste_max_select, 0),
      set_taste_uuid_fks: resolveTasteNames(setTasteNames, references.tastes),
      set_child_option_max_select: asNumber(detail.set_child_option_max_select, 0),
      set_option_groups: setChildGroups,
    };
    return result;
  });

  const imageValue = image ? image : portableImageValue(product);
  return {
    branch_uuid_fk: references.branchUuid,
    cate_uuid_fk: categoryId,
    unite_uuid_fk: unitId,
    prod_code: readText(product, ["prod_code"]),
    prod_name_la: readText(product, ["prod_name_la", "prod_name"]),
    prod_name_eng: readText(product, ["prod_name_eng", "prod_name_la", "prod_name"]),
    prod_order_point: asNumber(product.prod_order_point, 0),
    prod_notification: asNumber(product.prod_notification, 1),
    status_sort_fk: asNumber(product.status_sort_fk, 1),
    prod_set_price: asNumber(product.prod_set_price, 0),
    prod_status_imge: asNumber(product.prod_status_imge, image ? 1 : 2),
    prod_image: imageValue,
    prod_topping_status: asNumber(product.prod_topping_status, 1),
    prod_topping_max_select: asNumber(product.prod_topping_max_select, 0),
    prod_taste_max_select: asNumber(product.prod_taste_max_select, 0),
    toppings: readRecords(product.toppings).map((topping) => ({
      topping_uuid_fk: resolveId(references.toppings, readText(topping, ["topping_name_la", "topping_name", "topping_name_eng"]), ["topping_uuid"], ["topping_name_la", "topping_name", "topping_name_eng"]),
      topping_price: asNumber(topping.topping_price, 0),
    })),
    tastes: readRecords(product.tastes).map((taste, index) => ({
      taste_uuid: resolveId(references.tastes, readText(taste, ["taste_name_la", "taste_name", "taste_name_eng"]), ["taste_uuid"], ["taste_name_la", "taste_name", "taste_name_eng"]),
      taste_sort: asNumber(taste.taste_sort, index + 1),
    })),
    set_choice_groups: setProduct ? groupInputs : undefined,
    details,
  };
}

function resolveTasteNames(names: string[], rows: Array<Record<string, unknown>>) {
  return names.map((name) => resolveId(rows, name, ["taste_uuid"], ["taste_name_la", "taste_name", "taste_name_eng"]));
}

function resolveId(
  rows: Array<Record<string, unknown>>,
  name: string,
  idKeys: string[],
  nameKeys: string[],
) {
  const key = normalize(name);
  const matches = rows.filter((row) => nameKeys.some((nameKey) => normalize(String(row[nameKey] ?? "")) === key));
  const ids = [...new Set(matches.map((row) => readText(row, idKeys)).filter(Boolean))];
  if (ids.length !== 1) throw new Error(ids.length ? `Reference name is ambiguous: ${name}` : `Reference was not found: ${name}`);
  return ids[0]!;
}

function normalize(value: string) {
  return value.replace(/\s+/gu, " ").trim().toLocaleLowerCase();
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = String(record[key] ?? "").replace(/\s+/gu, " ").trim();
    if (value) return value;
  }
  return "";
}

function optionalText(value: unknown) {
  return value === null || value === undefined || value === "" ? undefined : String(value);
}

function asNumber(value: unknown, fallback: number) {
  const result = Number(value ?? fallback);
  return Number.isFinite(result) ? result : fallback;
}

function readRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null && !Array.isArray(row)) : [];
}

function readStrings(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
}

function portableImageValue(product: Record<string, unknown>) {
  const image = String(product.prod_image ?? "");
  if (image.startsWith("#")) return image;
  return String(product.prod_image_raw ?? "").startsWith("#") ? product.prod_image_raw as string : "";
}
