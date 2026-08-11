import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import packageJson from "../../package.json";
import type { InstalledAppVersion, MobileAppPlatform } from "@/lib/app-version";

export const WEB_APP_VERSION = packageJson.version;

// แอปรุ่นเก่าที่ไม่มี App plugin ยังต้องมีค่าตั้งต้นสำหรับตรวจอัปเดตและแสดงผล
const LEGACY_ANDROID_VERSION: InstalledAppVersion = {
  version: "1.0.2",
  build: 3,
};

const LEGACY_IOS_VERSION: InstalledAppVersion = {
  version: "1.0",
  build: 1,
};

function legacyVersion(platform: MobileAppPlatform) {
  return platform === "android" ? LEGACY_ANDROID_VERSION : LEGACY_IOS_VERSION;
}

export function getMobileAppPlatform(): MobileAppPlatform | null {
  const platform = Capacitor.getPlatform();
  return platform === "android" || platform === "ios" ? platform : null;
}

export async function getInstalledMobileAppVersion(
  platform: MobileAppPlatform,
): Promise<InstalledAppVersion> {
  if (!Capacitor.isPluginAvailable("App")) return legacyVersion(platform);

  try {
    const info = await App.getInfo();
    const build = Number(info.build);
    if (!Number.isSafeInteger(build) || build < 1) return legacyVersion(platform);
    return { version: info.version, build };
  } catch {
    return legacyVersion(platform);
  }
}

export function formatInstalledAppVersion(installed: InstalledAppVersion) {
  return `${installed.version} (${installed.build})`;
}

export async function getDisplayedAppVersion() {
  if (!Capacitor.isNativePlatform()) return WEB_APP_VERSION;

  const platform = getMobileAppPlatform();
  if (!platform) return WEB_APP_VERSION;

  return formatInstalledAppVersion(await getInstalledMobileAppVersion(platform));
}
