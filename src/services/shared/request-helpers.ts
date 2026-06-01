import { toApiLanguage } from "@/lib/language";

export const langParam = (value?: string) => toApiLanguage(value);

export function withLang<T extends Record<string, unknown>>(params: T, lang?: string) {
  return { ...params, lang: toApiLanguage(lang ?? String(params.lang ?? "la")) };
}

export function dataOrEmpty<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}
