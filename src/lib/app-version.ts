export type MobileAppPlatform = "android" | "ios";

export interface AppPlatformVersionConfig {
  enabled: boolean;
  latestVersion: string;
  latestBuild: number;
  forceUpdate: boolean;
  storeUrl: string;
  nativeStoreUrl?: string;
}

export interface AppVersionConfig {
  android: AppPlatformVersionConfig;
  ios: AppPlatformVersionConfig;
}

export interface InstalledAppVersion {
  version: string;
  build: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlatformStoreUrl(value: unknown, platform: MobileAppPlatform): value is string {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;

    if (platform === "android") {
      return url.hostname === "play.google.com" && url.pathname === "/store/apps/details";
    }

    return url.hostname === "apps.apple.com" && url.pathname !== "/";
  } catch {
    return false;
  }
}

function isNativeStoreUrl(value: unknown, platform: MobileAppPlatform): value is string {
  if (typeof value !== "string") return false;
  if (platform === "android") return value.startsWith("market://details?id=");
  return value.startsWith("itms-apps://");
}

function parsePlatformVersionConfig(
  value: unknown,
  platform: MobileAppPlatform,
): AppPlatformVersionConfig | null {
  if (!isRecord(value)) return null;

  const {
    enabled,
    forceUpdate,
    latestBuild,
    latestVersion,
    nativeStoreUrl,
    storeUrl,
  } = value;

  if (typeof enabled !== "boolean" || typeof forceUpdate !== "boolean") {
    return null;
  }

  if (!enabled) {
    return {
      enabled: false,
      forceUpdate,
      latestBuild:
        typeof latestBuild === "number" && Number.isSafeInteger(latestBuild)
          ? Math.max(0, latestBuild)
          : 0,
      latestVersion: typeof latestVersion === "string" ? latestVersion.trim() : "",
      nativeStoreUrl: typeof nativeStoreUrl === "string" ? nativeStoreUrl : undefined,
      storeUrl: typeof storeUrl === "string" ? storeUrl : "",
    };
  }

  if (
    typeof latestVersion !== "string" ||
    !latestVersion.trim() ||
    typeof latestBuild !== "number" ||
    !Number.isSafeInteger(latestBuild) ||
    latestBuild < 1 ||
    !isPlatformStoreUrl(storeUrl, platform) ||
    (nativeStoreUrl !== undefined && !isNativeStoreUrl(nativeStoreUrl, platform))
  ) {
    return null;
  }

  return {
    enabled,
    forceUpdate,
    latestBuild,
    latestVersion: latestVersion.trim(),
    nativeStoreUrl,
    storeUrl,
  };
}

export function parseAppVersionConfig(value: unknown): AppVersionConfig | null {
  if (!isRecord(value)) return null;

  const android = parsePlatformVersionConfig(value.android, "android");
  const ios = parsePlatformVersionConfig(value.ios, "ios");
  return android && ios ? { android, ios } : null;
}

export function hasAppUpdate(
  config: AppPlatformVersionConfig,
  installed: InstalledAppVersion,
) {
  return config.enabled && config.latestBuild > installed.build;
}
