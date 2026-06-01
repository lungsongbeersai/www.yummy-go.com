export type Language = "la" | "en";

export const DEFAULT_LANGUAGE: Language = "la";
export const LANGUAGE_COOKIE = "yummy-go-language";

export const LANGUAGES: Array<{
  code: Language;
  label: string;
  apiCode: "la" | "eng";
}> = [
  { code: "la", label: "ລາວ", apiCode: "la" },
  { code: "en", label: "EN", apiCode: "eng" }
];

export function toLanguage(value?: string | null): Language {
  const normalized = String(value ?? "").toLowerCase();
  return normalized === "eng" || normalized.startsWith("en") ? "en" : "la";
}

export function toApiLanguage(value?: string | null): "la" | "eng" {
  return toLanguage(value) === "en" ? "eng" : "la";
}
