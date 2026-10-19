import { normalizeProductMenuImageBlob } from "./product-menu-images";

export type ProductMenuBackground =
  | { mode: "template" }
  | { mode: "color"; color: string }
  | { mode: "image"; image: string };

export const DEFAULT_MENU_BACKGROUND: ProductMenuBackground = { mode: "template" };
export const DEFAULT_MENU_BACKGROUND_COLOR = "#FFFFFF";

const BACKGROUND_MAX_BYTES = 10 * 1024 * 1024;
const BACKGROUND_MAX_DIMENSION = 2000;

export function normalizeMenuBackground(input?: ProductMenuBackground): ProductMenuBackground {
  if (input?.mode === "color" && typeof input.color === "string") {
    const color = input.color.trim();
    if (/^#[\da-f]{6}$/i.test(color)) return { mode: "color", color: color.toUpperCase() };
    if (/^#[\da-f]{3}$/i.test(color)) {
      return { mode: "color", color: `#${Array.from(color.slice(1), (character) => character.repeat(2)).join("")}`.toUpperCase() };
    }
  }
  if (input?.mode === "image" && typeof input.image === "string") {
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(input.image.trim());
    if (match && match[2].length % 4 === 0) {
      return { mode: "image", image: `data:image/${match[1].toLowerCase()};base64,${match[2]}` };
    }
  }
  return DEFAULT_MENU_BACKGROUND;
}

/** Background uploads are flattened locally so the PDF needs no external URL. */
export async function readMenuBackgroundImage(file: File): Promise<string> {
  if (!(file instanceof Blob)) throw new Error("MENU_BACKGROUND_TYPE");
  if (file.size > BACKGROUND_MAX_BYTES) throw new Error("MENU_BACKGROUND_SIZE");
  if (!file.size) throw new Error("MENU_BACKGROUND_DECODE");

  let blob: Blob;
  try {
    blob = await normalizeProductMenuImageBlob(file);
  } catch {
    throw new Error("MENU_BACKGROUND_TYPE");
  }
  const mime = blob.type.split(";", 1)[0].trim().toLowerCase();
  if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(mime)) {
    throw new Error("MENU_BACKGROUND_TYPE");
  }

  let image: HTMLImageElement | undefined;
  let url: string | undefined;
  let canvas: HTMLCanvasElement | undefined;
  try {
    image = new Image();
    url = URL.createObjectURL(blob);
    image.src = url;
    await image.decode();
    const { naturalWidth, naturalHeight } = image;
    if (!Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight) || naturalWidth <= 0 || naturalHeight <= 0) {
      throw new Error("MENU_BACKGROUND_DECODE");
    }
    const ratio = Math.min(1, BACKGROUND_MAX_DIMENSION / Math.max(naturalWidth, naturalHeight));
    canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("MENU_BACKGROUND_DECODE");
    context.fillStyle = DEFAULT_MENU_BACKGROUND_COLOR;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = normalizeMenuBackground({ mode: "image", image: canvas.toDataURL("image/jpeg", 0.92) });
    if (result.mode !== "image") throw new Error("MENU_BACKGROUND_DECODE");
    return result.image;
  } catch {
    throw new Error("MENU_BACKGROUND_DECODE");
  } finally {
    image?.removeAttribute("src");
    if (url) URL.revokeObjectURL(url);
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
