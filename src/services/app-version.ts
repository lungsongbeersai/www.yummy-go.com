import {
  parseAppVersionConfig,
  type AppVersionConfig,
} from "@/lib/app-version";

export async function fetchAppVersionConfig(
  signal?: AbortSignal,
): Promise<AppVersionConfig | null> {
  const response = await fetch(`/app-version.json?t=${Date.now()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) return null;
  return parseAppVersionConfig(await response.json());
}
