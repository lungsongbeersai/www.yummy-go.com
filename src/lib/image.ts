const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

export function uploadedUrl(filename?: string | null, folder = "uploaded") {
  if (!filename) return "";
  if (/^https?:\/\//i.test(filename)) return filename;
  const cleanBase = BASE_URL.replace(/\/+$/, "");
  const cleanFolder = folder.replace(/^\/+|\/+$/g, "");
  const cleanFile = filename.replace(/^\/+/, "");
  return `${cleanBase}/${cleanFolder}/${cleanFile}`;
}

export function getStoreLogoUrl(filename: string) {
  return uploadedUrl(filename, "uploaded/store");
}

export function getUserProfileUrl(profilePath: string | null) {
  return uploadedUrl(profilePath, "uploaded/profile");
}

export function getBranchQrUrl(filename: string) {
  return uploadedUrl(filename, "uploaded/qrcode");
}

export function getAccountQrUrl(filename: string) {
  return uploadedUrl(filename, "uploaded/qrcode");
}

export function getProductImageUrl(filename: string) {
  if (filename?.startsWith("#")) return filename;
  const storagePath = filename?.replace(/^\/+/, "");
  // The product API can return a complete local storage path as prod_image;
  // only bare filenames need the default product folder added.
  if (storagePath?.startsWith("uploaded/products/")) {
    return `${BASE_URL.replace(/\/+$/, "")}/${storagePath}`;
  }
  return uploadedUrl(filename, "uploaded/products");
}
