export const COMMERCIAL_QR_MAX_INPUT_BYTES = 5 * 1024 * 1024;
export const COMMERCIAL_QR_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
export const COMMERCIAL_QR_MAX_PIXELS = 8_000_000;

export interface CommercialQrSize { width: number; height: number }
export interface CommercialQrCropArea extends CommercialQrSize { x: number; y: number }
export type CommercialQrErrorCode = "input" | "dimensions" | "crop-size" | "output-size" | "decode";

export class CommercialQrCropError extends Error {
  constructor(readonly code: CommercialQrErrorCode) {
    super(`Unable to prepare payment QR: ${code}`);
    this.name = "CommercialQrCropError";
  }
}

export function validateCommercialQrFile(file: Pick<File, "type" | "size">) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > COMMERCIAL_QR_MAX_INPUT_BYTES) {
    throw new CommercialQrCropError("input");
  }
}

export function validateCommercialQrSize(size: CommercialQrSize) {
  if (![size.width, size.height].every(value => Number.isSafeInteger(value) && value > 0) || size.width * size.height > COMMERCIAL_QR_MAX_PIXELS) {
    throw new CommercialQrCropError("dimensions");
  }
}

export function commercialQrImageMime(header: Uint8Array): string | null {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => header[index] === value)) return "image/png";
  if (header[0] === 255 && header[1] === 216 && header[2] === 255) return "image/jpeg";
  if (header.length >= 12 && String.fromCharCode(...header.slice(0, 4)) === "RIFF" && String.fromCharCode(...header.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/** The initial square contains the entire image, including its QR quiet zone. */
export function commercialQrContainArea(size: CommercialQrSize): CommercialQrCropArea {
  const side = Math.max(size.width, size.height);
  return { x: Math.floor((size.width - side) / 2), y: Math.floor((size.height - side) / 2), width: side, height: side };
}

/** Snap to natural pixels; never resize QR modules to an arbitrary output size. */
export function commercialQrPixelArea(size: CommercialQrSize, area?: CommercialQrCropArea | null): CommercialQrCropArea {
  validateCommercialQrSize(size);
  const selected = area ?? commercialQrContainArea(size);
  if (![selected.x, selected.y, selected.width, selected.height].every(Number.isFinite) || selected.width <= 0 || selected.height <= 0) {
    throw new CommercialQrCropError("crop-size");
  }
  const side = Math.max(1, Math.round(Math.max(selected.width, selected.height)));
  if (!Number.isSafeInteger(side) || side * side > COMMERCIAL_QR_MAX_PIXELS) throw new CommercialQrCropError("crop-size");
  const x = Math.round(selected.x + (selected.width - side) / 2);
  const y = Math.round(selected.y + (selected.height - side) / 2);
  if (x >= size.width || y >= size.height || x + side <= 0 || y + side <= 0) throw new CommercialQrCropError("crop-size");
  return { x, y, width: side, height: side };
}

function assertActive(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("QR operation cancelled", "AbortError");
}

async function loadCommercialQrImage(file: File, signal?: AbortSignal) {
  validateCommercialQrFile(file);
  assertActive(signal);
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  assertActive(signal);
  if (commercialQrImageMime(header) !== file.type) throw new CommercialQrCropError("input");
  const url = URL.createObjectURL(file);
  const image = new window.Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const abort = () => { image.src = ""; reject(new DOMException("QR operation cancelled", "AbortError")); };
      image.onload = () => { signal?.removeEventListener("abort", abort); resolve(); };
      image.onerror = () => { signal?.removeEventListener("abort", abort); reject(new CommercialQrCropError("decode")); };
      signal?.addEventListener("abort", abort, { once: true });
      image.src = url;
    });
    assertActive(signal);
    validateCommercialQrSize({ width: image.naturalWidth, height: image.naturalHeight });
    return image;
  } finally { URL.revokeObjectURL(url); }
}

export async function readCommercialQrSize(file: File, signal?: AbortSignal): Promise<CommercialQrSize> {
  const image = await loadCommercialQrImage(file, signal);
  return { width: image.naturalWidth, height: image.naturalHeight };
}

export function isCommercialQrDataUrl(value: string | undefined): value is string {
  return Boolean(value && value.length <= 7_000_000 && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value));
}

/** Existing private QR bytes stay local; do not fetch a remote image URL. */
export function commercialQrFileFromDataUrl(value: string): File {
  if (!isCommercialQrDataUrl(value)) throw new CommercialQrCropError("decode");
  try {
    const bytes = Uint8Array.from(atob(value.slice(value.indexOf(",") + 1)), character => character.charCodeAt(0));
    const file = new File([bytes], "payment-qr.png", { type: "image/png" });
    validateCommercialQrFile(file);
    return file;
  } catch (error) {
    throw error instanceof CommercialQrCropError ? error : new CommercialQrCropError("decode");
  }
}

export async function cropCommercialQrFile(file: File, area?: CommercialQrCropArea | null, signal?: AbortSignal): Promise<File> {
  const image = await loadCommercialQrImage(file, signal);
  const crop = commercialQrPixelArea({ width: image.naturalWidth, height: image.naturalHeight }, area);
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new CommercialQrCropError("decode");
    // White padding preserves the QR quiet zone when the square extends beyond the original.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    const x = Math.max(0, crop.x), y = Math.max(0, crop.y);
    const width = Math.min(image.naturalWidth, crop.x + crop.width) - x;
    const height = Math.min(image.naturalHeight, crop.y + crop.height) - y;
    context.drawImage(image, x, y, width, height, x - crop.x, y - crop.y, width, height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    assertActive(signal);
    if (!blob || blob.type !== "image/png") throw new CommercialQrCropError("decode");
    if (blob.size > COMMERCIAL_QR_MAX_OUTPUT_BYTES) throw new CommercialQrCropError("output-size");
    return new File([blob], "payment-qr-cropped.png", { type: "image/png" });
  } finally { canvas.width = 0; canvas.height = 0; }
}
