import type { Product } from "@/services/product";
import { DEFAULT_COLOR } from "./product-import-utils";
import {
  buildProductTransferArchive,
  PRODUCT_TRANSFER_FORMAT,
  PRODUCT_TRANSFER_VERSION,
  type ProductTransferManifest,
  type ProductTransferRecord,
} from "./product-transfer-archive";

export interface ProductTransferExportResult {
  bytes: Uint8Array;
  imageOmissions: number;
}

export async function exportProductTransfer(
  products: Product[],
  imageLoader: (product: Product) => Promise<Blob | null>,
): Promise<ProductTransferExportResult> {
  const images: Record<string, Uint8Array> = {};
  let imageOmissions = 0;
  const records: ProductTransferRecord[] = [];

  for (const [index, product] of products.entries()) {
    const portable = makePortableProduct(product);
    const imageValue = imageFilename(product);
    if (imageValue) {
      portable.prod_image = "";
      portable.prod_image_raw = "";
      try {
        const blob = await imageLoader(product);
        if (!blob || !blob.type.startsWith("image/")) {
          imageOmissions += 1;
          applyMissingImageFallback(portable);
          records.push({ product: portable, imageUnavailable: true });
          continue;
        }
        const imagePath = `images/product-${index + 1}.${extensionForMime(blob.type)}`;
        images[imagePath] = new Uint8Array(await blob.arrayBuffer());
        records.push({ product: portable, imagePath, imageMime: blob.type });
        continue;
      } catch {
        imageOmissions += 1;
        applyMissingImageFallback(portable);
        records.push({ product: portable, imageUnavailable: true });
        continue;
      }
    }
    const color = productColorValue(product);
    if (color) {
      portable.prod_status_imge = 2;
      portable.prod_image = color;
      portable.prod_image_raw = color;
    }
    records.push({ product: portable });
  }

  const manifest: ProductTransferManifest = {
    format: PRODUCT_TRANSFER_FORMAT,
    version: PRODUCT_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    products: records,
  };
  return { bytes: buildProductTransferArchive(manifest, images), imageOmissions };
}

function applyMissingImageFallback(product: Record<string, unknown>) {
  product.prod_status_imge = 2;
  product.prod_image = DEFAULT_COLOR;
  product.prod_image_raw = DEFAULT_COLOR;
}

function imageFilename(product: Product) {
  const image = String(product.prod_image ?? "").trim();
  const raw = String(product.prod_image_raw ?? "").trim();
  const value = image && !image.startsWith("#") ? image : raw && !raw.startsWith("#") ? raw : "";
  return value;
}

function productColorValue(product: Product) {
  const image = String(product.prod_image ?? "").trim();
  const raw = String(product.prod_image_raw ?? "").trim();
  const value = image.startsWith("#") ? image : raw.startsWith("#") ? raw : "";
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : "";
}

function extensionForMime(mime: string) {
  switch (mime.toLowerCase().split(";")[0]) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    case "image/avif": return "avif";
    default: return "bin";
  }
}

function makePortableProduct(product: Product) {
  const source = JSON.parse(JSON.stringify(product)) as unknown;
  const portable = isRecord(source) ? replaceSetChoiceIds(source) : source;
  const cleaned = stripOriginIds(portable);
  if (!isRecord(cleaned)) return {};
  delete cleaned.branch_name;
  delete cleaned.status_name;
  return cleaned;
}

function replaceSetChoiceIds(product: Record<string, unknown>) {
  const tastes = Array.isArray(product.tastes) ? product.tastes.filter(isRecord) : [];
  const detailRows = Array.isArray(product.details) ? product.details.filter(isRecord) : [];
  detailRows.forEach((detail) => {
    if (Array.isArray(detail.set_tastes)) {
      detail.set_tastes.filter(isRecord).forEach((taste) => tastes.push(taste));
    }
    if (Array.isArray(detail.set_option_groups)) {
      detail.set_option_groups.filter(isRecord).forEach((group) => {
        if (Array.isArray(group.tastes)) group.tastes.filter(isRecord).forEach((taste) => tastes.push(taste));
      });
    }
  });
  const tasteNames = new Map<string, string>();
  tastes.forEach((taste) => {
    const id = firstText(taste, ["taste_uuid", "taste_uuid_fk"]);
    const name = firstText(taste, ["taste_name_la", "taste_name", "taste_name_eng"]);
    if (id && name) tasteNames.set(id, name);
  });
  const groups = Array.isArray(product.set_choice_groups)
    ? product.set_choice_groups.filter(isRecord)
    : [];
  const groupNames = new Map<string, string>();
  groups.forEach((group, index) => {
    const id = firstText(group, ["set_choice_group_uuid"]);
    const name = firstText(group, ["group_name_la", "group_name", "group_name_eng"]) || `Choice ${index + 1}`;
    if (id) groupNames.set(id, name);
    group.transfer_name = name;
  });
  product.details = detailRows.map((detail) => {
    if (!isRecord(detail)) return detail;
    const ids = Array.isArray(detail.set_choice_group_uuid_fks)
      ? detail.set_choice_group_uuid_fks
      : [];
    detail.set_choice_group_names = ids
      .map((id) => groupNames.get(String(id ?? "")))
      .filter((name): name is string => Boolean(name));
    const setTasteIds = Array.isArray(detail.set_taste_uuid_fks) ? detail.set_taste_uuid_fks : [];
    detail.set_taste_names = setTasteIds
      .map((id) => tasteNames.get(String(id ?? "")))
      .filter((name): name is string => Boolean(name));
    const optionGroups = Array.isArray(detail.set_option_groups) ? detail.set_option_groups : [];
    detail.set_option_groups = optionGroups.map((optionGroup) => {
      if (!isRecord(optionGroup)) return optionGroup;
      const tasteIds = Array.isArray(optionGroup.taste_uuid_fks) ? optionGroup.taste_uuid_fks : [];
      optionGroup.taste_names = tasteIds
        .map((id) => tasteNames.get(String(id ?? "")))
        .filter((name): name is string => Boolean(name));
      return optionGroup;
    });
    return detail;
  });
  return product;
}

function firstText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = String(record[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function stripOriginIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripOriginIds);
  if (!isRecord(value)) return value;

  const output: Record<string, unknown> = {};
  Object.entries(value).forEach(([key, item]) => {
    if (/(?:^|_)(?:uuid|id)(?:_|$)/i.test(key) || /uuid|_id$/i.test(key)) return;
    output[key] = stripOriginIds(item);
  });
  return output;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
