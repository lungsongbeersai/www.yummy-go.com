import { strFromU8, strToU8, Unzip, UnzipInflate, zipSync } from "fflate";

export const PRODUCT_TRANSFER_FORMAT = "yummy-go-product-transfer";
export const PRODUCT_TRANSFER_VERSION = 1;

export const PRODUCT_TRANSFER_LIMITS = {
  maxArchiveBytes: 100 * 1024 * 1024,
  maxExpandedBytes: 200 * 1024 * 1024,
  maxProducts: 10_000,
  maxEntries: 10_000,
  maxManifestBytes: 20 * 1024 * 1024,
} as const;

export interface ProductTransferFile {
  readonly name: string;
  readonly size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export interface ProductTransferRecord {
  product: Record<string, unknown>;
  imagePath?: string;
  imageMime?: string;
  imageUnavailable?: boolean;
}

export interface ProductTransferManifest {
  format: typeof PRODUCT_TRANSFER_FORMAT;
  version: typeof PRODUCT_TRANSFER_VERSION;
  exportedAt: string;
  products: ProductTransferRecord[];
}

export class ProductTransferArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductTransferArchiveError";
  }
}

export function buildProductTransferArchive(
  manifest: ProductTransferManifest,
  images: Record<string, Uint8Array>,
) {
  if (manifest.products.length > PRODUCT_TRANSFER_LIMITS.maxProducts) {
    throw new ProductTransferArchiveError("The export contains too many products for a transfer archive.");
  }
  const files: Record<string, Uint8Array> = {
    "products.json": strToU8(JSON.stringify(manifest, null, 2)),
  };
  if (files["products.json"].byteLength > PRODUCT_TRANSFER_LIMITS.maxManifestBytes) {
    throw new ProductTransferArchiveError("The product manifest is too large for a transfer archive.");
  }
  Object.entries(images).forEach(([path, bytes]) => {
    const safePath = safeArchivePath(path);
    if (!safePath.startsWith("images/")) {
      throw new ProductTransferArchiveError("Image paths must be inside images/.");
    }
    files[safePath] = bytes;
  });
  const archive = zipSync(files, { level: 6 });
  if (archive.byteLength > PRODUCT_TRANSFER_LIMITS.maxArchiveBytes) {
    throw new ProductTransferArchiveError("The export is larger than 100 MB. Remove some product photos and try again.");
  }
  return archive;
}

export async function parseProductTransferArchive(
  file: ProductTransferFile,
): Promise<{ manifest: ProductTransferManifest; images: Map<string, Uint8Array> }> {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    throw new ProductTransferArchiveError("Select a product transfer .zip file.");
  }
  if (file.size <= 0 || file.size > PRODUCT_TRANSFER_LIMITS.maxArchiveBytes) {
    throw new ProductTransferArchiveError("The archive must be between 1 byte and 100 MB.");
  }

  const source = new Uint8Array(await file.arrayBuffer());
  const entries = await unzipLimited(source);
  const manifestBytes = entries.get("products.json");
  if (!manifestBytes) throw new ProductTransferArchiveError("The archive is missing products.json.");
  if (manifestBytes.byteLength > PRODUCT_TRANSFER_LIMITS.maxManifestBytes) {
    throw new ProductTransferArchiveError("The product manifest is too large.");
  }

  let value: unknown;
  try {
    value = JSON.parse(strFromU8(manifestBytes)) as unknown;
  } catch {
    throw new ProductTransferArchiveError("The product manifest is not valid JSON.");
  }
  if (!isManifest(value)) {
    throw new ProductTransferArchiveError("The archive uses an unsupported or invalid product format.");
  }
  const images = new Map<string, Uint8Array>();
  entries.forEach((bytes, path) => {
    if (path.startsWith("images/")) images.set(path, bytes);
  });
  value.products.forEach((record) => {
    if (record.imagePath && !images.has(record.imagePath)) {
      record.imageUnavailable = true;
      delete record.imagePath;
    }
  });
  return { manifest: value, images };
}

function isManifest(value: unknown): value is ProductTransferManifest {
  if (!isRecord(value)) return false;
  if (value.format !== PRODUCT_TRANSFER_FORMAT || value.version !== PRODUCT_TRANSFER_VERSION) return false;
  if (typeof value.exportedAt !== "string" || !Array.isArray(value.products)) return false;
  if (value.products.length > PRODUCT_TRANSFER_LIMITS.maxProducts) return false;
  return value.products.every((record) =>
    isRecord(record) && isRecord(record.product) &&
    [record.product.prod_name_la, record.product.prod_name_eng, record.product.prod_name]
      .some((name) => typeof name === "string" && name.trim().length > 0) &&
    (record.product.details === undefined || Array.isArray(record.product.details)) &&
    (record.product.toppings === undefined || Array.isArray(record.product.toppings)) &&
    (record.product.tastes === undefined || Array.isArray(record.product.tastes)) &&
    (record.product.set_choice_groups === undefined || Array.isArray(record.product.set_choice_groups)) &&
    (record.imagePath === undefined || (typeof record.imagePath === "string" && safeArchivePath(record.imagePath) === record.imagePath)) &&
    (record.imageMime === undefined || (typeof record.imageMime === "string" && record.imageMime.startsWith("image/"))) &&
    (record.imageUnavailable === undefined || typeof record.imageUnavailable === "boolean"),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeArchivePath(value: string) {
  const normalized = value.replace(/\\/g, "/");
  if (
    normalized.startsWith("/") ||
    /^[a-zA-Z]:/.test(normalized) ||
    normalized.split("/").some((part) => part === ".." || part === "")
  ) {
    throw new ProductTransferArchiveError("The archive contains an unsafe file path.");
  }
  return normalized;
}

function unzipLimited(source: Uint8Array) {
  return new Promise<Map<string, Uint8Array>>((resolve, reject) => {
    const entries = new Map<string, Uint8Array>();
    const chunksByPath = new Map<string, Uint8Array[]>();
    let expandedBytes = 0;
    let pendingFiles = 0;
    let finishedInput = false;
    let settled = false;
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      reject(new ProductTransferArchiveError(message));
    };
    const complete = () => {
      if (!settled && finishedInput && pendingFiles === 0) {
        settled = true;
        resolve(entries);
      }
    };
    const unzip = new Unzip((file) => {
      if (settled) return;
      if (entries.size + pendingFiles >= PRODUCT_TRANSFER_LIMITS.maxEntries) {
        fail("The archive contains too many files.");
        return;
      }
      let path: string;
      try {
        path = safeArchivePath(file.name);
      } catch {
        fail("The archive contains an unsafe file path.");
        return;
      }
      if (entries.has(path) || chunksByPath.has(path)) {
        fail("The archive contains duplicate file paths.");
        return;
      }
      if (file.originalSize !== undefined && file.originalSize > PRODUCT_TRANSFER_LIMITS.maxExpandedBytes) {
        fail("The expanded archive is too large.");
        return;
      }
      chunksByPath.set(path, []);
      pendingFiles += 1;
      file.ondata = (error, chunk, final) => {
        if (settled) return;
        if (error) {
          fail("The product archive could not be decompressed.");
          return;
        }
        expandedBytes += chunk.byteLength;
        if (expandedBytes > PRODUCT_TRANSFER_LIMITS.maxExpandedBytes) {
          fail("The expanded archive is too large.");
          return;
        }
        chunksByPath.get(path)?.push(chunk);
        if (!final) return;
        const chunks = chunksByPath.get(path) ?? [];
        const output = new Uint8Array(chunks.reduce((sum, part) => sum + part.byteLength, 0));
        let offset = 0;
        chunks.forEach((part) => { output.set(part, offset); offset += part.byteLength; });
        chunksByPath.delete(path);
        entries.set(path, output);
        pendingFiles -= 1;
        complete();
      };
      try {
        file.start();
      } catch {
        fail("The archive uses an unsupported compression format.");
      }
    });
    try {
      unzip.register(UnzipInflate);
      unzip.push(source, true);
      finishedInput = true;
      complete();
    } catch {
      fail("The file is not a valid ZIP archive.");
    }
  });
}
