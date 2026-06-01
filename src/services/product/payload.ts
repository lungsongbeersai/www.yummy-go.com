import type { SaveProductInput } from "@/services/product/types";

function isEmptyFile(value: unknown) {
  return typeof File !== "undefined" && value instanceof File && value.size === 0;
}

export function normalizeProductImagePayload(value: string) {
  if (!value || value.startsWith("#")) return value;

  if (/^https?:\/\//i.test(value)) {
    try {
      const pathname = new URL(value).pathname;
      return decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? value);
    } catch {
      return value;
    }
  }

  return value;
}

export function productImageUrlValue(filename: string) {
  return filename?.startsWith("#") ? filename : filename;
}

export function saveProductPayload(input: SaveProductInput): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...input };
  const prodUuid = String(payload.prod_uuid ?? "").trim();

  if (!prodUuid) {
    delete payload.prod_uuid;
  } else {
    payload.prod_uuid = prodUuid;
  }

  if (input.details) payload.details = JSON.stringify(input.details);
  if (input.toppings) payload.toppings = JSON.stringify(input.toppings);

  if (input.prod_image === undefined || input.prod_image === null) {
    delete payload.prod_image;
  } else if (typeof input.prod_image === "string") {
    const imagePayload = normalizeProductImagePayload(input.prod_image);
    if (imagePayload) payload.prod_image = imagePayload;
    else delete payload.prod_image;
  } else if (isEmptyFile(input.prod_image)) {
    delete payload.prod_image;
  }

  return payload;
}
