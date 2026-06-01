const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

export function uploadedUrl(filename?: string | null, folder = "uploaded") {
  if (!filename) return "";
  if (/^https?:\/\//i.test(filename)) return filename;
  const cleanBase = BASE_URL.replace(/\/+$/, "");
  const cleanFolder = folder.replace(/^\/+|\/+$/g, "");
  const cleanFile = filename.replace(/^\/+/, "");
  return `${cleanBase}/${cleanFolder}/${cleanFile}`;
}
