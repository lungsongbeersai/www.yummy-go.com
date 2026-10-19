import type { MenuCategory, MenuProduct } from "./product-menu-utils";

export interface ProductMenuImageOptions {
  onProgress?: (completed: number, total: number) => void;
  existingImages?: Readonly<Record<string, string>>;
  /** Preview loading can stop early; omitted products are not counted as missing. */
  maxProducts?: number;
}

export interface ProductMenuImageResult {
  images: Record<string, string>;
  /** The number of considered dishes which will need a photo placeholder. */
  omissions: number;
}

const IMAGE_TIMEOUT_MS = 8000;
const IMAGE_CONCURRENCY = 4;
const IMAGE_MAX_DIMENSION = 640;

/** Storage migrations may keep valid image bytes with a generic Content-Type. */
export async function normalizeProductMenuImageBlob(blob: Blob): Promise<Blob> {
  if (!(blob instanceof Blob) || !blob.size) throw new Error("Product photo is unavailable.");
  const mime = blob.type.split(";", 1)[0].trim().toLowerCase();
  if (mime.startsWith("image/")) return blob;
  if (!["", "application/octet-stream", "binary/octet-stream", "application/binary"].includes(mime)) {
    throw new Error("Product photo response is not an image.");
  }

  const bytes = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  const matches = (offset: number, signature: readonly number[]) =>
    bytes.length >= offset + signature.length && signature.every((value, index) => bytes[offset + index] === value);
  const ascii = (offset: number, value: string) => matches(offset, Array.from(value, (character) => character.charCodeAt(0)));
  let imageMime = "";
  if (matches(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) imageMime = "image/png";
  else if (matches(0, [0xff, 0xd8, 0xff])) imageMime = "image/jpeg";
  else if (ascii(0, "RIFF") && ascii(8, "WEBP")) imageMime = "image/webp";
  else if (ascii(0, "GIF87a") || ascii(0, "GIF89a")) imageMime = "image/gif";
  else if (ascii(0, "BM")) imageMime = "image/bmp";
  else if (ascii(4, "ftyp") && Array.from({ length: Math.floor((bytes.length - 8) / 4) }, (_, index) => 8 + index * 4)
    .some((offset) => ascii(offset, "avif") || ascii(offset, "avis"))) imageMime = "image/avif";
  if (!imageMime) throw new Error("Product photo response has no supported image signature.");
  // Explicitly restoring the MIME also lets browsers decode storage blobs which
  // would otherwise be treated as download-only binary data.
  return new Blob([blob], { type: imageMime });
}

function isThumbnail(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function cachedThumbnail(item: MenuProduct, existing: ProductMenuImageOptions["existingImages"]): string | undefined {
  for (const id of [item.id, item.originalId]) {
    if (id && existing && Object.hasOwn(existing, id) && isThumbnail(existing[id])) return existing[id];
  }
}

function assignThumbnail(images: Record<string, string>, item: MenuProduct, thumbnail: string) {
  images[item.id] = thumbnail;
  if (item.originalId) images[item.originalId] = thumbnail;
}

async function imageThumbnail(blob: Blob, signal: AbortSignal): Promise<string> {
  if (signal.aborted) throw new Error("Product photo is unavailable.");
  const imageBlob = await normalizeProductMenuImageBlob(blob);
  if (signal.aborted) throw new Error("Product photo loading was canceled.");
  const image = new Image();
  const url = URL.createObjectURL(imageBlob);
  let onAbort: (() => void) | undefined;
  try {
    image.src = url;
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => {
        image.removeAttribute("src");
        reject(new Error("Product photo loading was canceled."));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
    await Promise.race([image.decode(), aborted]);
    if (signal.aborted || !image.naturalWidth || !image.naturalHeight) throw new Error("Product photo could not be decoded.");
    const ratio = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Product photo canvas is unavailable.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Preserve transparency for PNG/WebP rather than adding a background that
    // could clash with the selected menu design.
    const mime = /^image\/jpe?g$/i.test(imageBlob.type) ? "image/jpeg" : "image/png";
    const thumbnail = canvas.toDataURL(mime, 0.88);
    canvas.width = 0;
    canvas.height = 0;
    if (!isThumbnail(thumbnail)) throw new Error("Product photo encoding failed.");
    return thumbnail;
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort);
    image.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}

async function loadThumbnail(filename: string, loadImage: (filename: string) => Promise<Blob>): Promise<string> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => loadImage(filename)).then((blob) => imageThumbnail(blob, controller.signal)),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error("Product photo loading timed out."));
        }, IMAGE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
    // A request may finish after its timeout; it must never decode or assign
    // a late photo to a preview/PDF which has already been prepared.
    controller.abort();
  }
}

/** Loads store-provided photos for every dish, sharing work for repeated files. */
export async function loadProductMenuImages(
  categories: readonly MenuCategory[],
  loadImage: (filename: string) => Promise<Blob>,
  options: ProductMenuImageOptions = {},
): Promise<ProductMenuImageResult> {
  const allItems = categories.flatMap((category) => category.items);
  const limit = options.maxProducts === undefined || !Number.isFinite(options.maxProducts)
    ? allItems.length
    : Math.max(0, Math.floor(options.maxProducts));
  const items = allItems.slice(0, limit);
  const images = Object.create(null) as Record<string, string>;
  const thumbnailsByFilename = new Map<string, string>();
  const itemsByFilename = new Map<string, MenuProduct[]>();
  for (const item of items) {
    const cached = cachedThumbnail(item, options.existingImages);
    const filename = item.imageFilename.trim();
    if (cached) {
      assignThumbnail(images, item, cached);
      if (filename) thumbnailsByFilename.set(filename, cached);
    }
    if (!filename) continue;
    const group = itemsByFilename.get(filename) ?? [];
    group.push(item);
    itemsByFilename.set(filename, group);
  }

  const queue: [string, MenuProduct[]][] = [];
  for (const [filename, group] of itemsByFilename) {
    const cached = thumbnailsByFilename.get(filename);
    if (cached) {
      for (const item of group) assignThumbnail(images, item, cached);
    } else {
      queue.push([filename, group]);
    }
  }
  let completed = items.length - queue.reduce((total, [, group]) => total + group.length, 0);
  options.onProgress?.(completed, items.length);
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const [filename, group] = job;
      try {
        const thumbnail = await loadThumbnail(filename, loadImage);
        for (const item of group) assignThumbnail(images, item, thumbnail);
      } catch {
        // A failed photo must never remove a dish or its price from the menu.
      }
      completed += group.length;
      options.onProgress?.(completed, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(IMAGE_CONCURRENCY, queue.length) }, worker));
  return { images, omissions: items.filter((item) => !images[item.id]).length };
}
