function assertCurrent(isCurrent: () => boolean) {
  if (!isCurrent()) throw new DOMException("Image export cancelled", "AbortError");
}

export function pngDataUrlFile(source: string, filename: string) {
  const match = /^data:image\/png;base64,([\da-z+/=\s]+)$/i.exec(source);
  if (!match) throw new Error("The QR image is not a PNG file.");
  const binary = atob(match[1]);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new File([buffer], filename, { type: "image/png" });
}

export async function imageExportFile(source: string, filename: string, isCurrent: () => boolean = () => true) {
  assertCurrent(isCurrent);
  if (source.startsWith("data:image/png;base64,")) return pngDataUrlFile(source, filename);
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = source;
  await image.decode();
  assertCurrent(isCurrent);
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("The QR image is unavailable.");
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The QR image is unavailable.");
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    assertCurrent(isCurrent);
    if (!blob) throw new Error("The QR image could not be prepared.");
    return new File([blob], filename, { type: "image/png" });
  } finally { canvas.width = 0; canvas.height = 0; }
}
