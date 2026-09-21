export function normalizeLoginEmail(value: string) {
  const cleaned = String(value || "")
    .normalize("NFKC")
    .replace(/[。｡]/g, ".")
    .replace(/[\u0000-\u001f\u007f-\u009f\u00a0\u200b-\u200d\u2060\ufeff\s]+/g, "");

  const atIndex = cleaned.lastIndexOf("@");
  if (atIndex <= 0) return cleaned;

  const localPart = cleaned
    .slice(0, atIndex)
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");
  const domainPart = cleaned
    .slice(atIndex + 1)
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");

  return `${localPart}@${domainPart}`;
}
