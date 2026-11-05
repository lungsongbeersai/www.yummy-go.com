import {
  CAPACITOR_ANDROID_USER_AGENT,
  CAPACITOR_IOS_USER_AGENT,
} from "@/lib/capacitor-platform";

export type MobileAppDownloadPlatform = "android" | "ios";

interface MobileAppDownloadEnvironment {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  isNativeApp?: boolean;
}

export function detectMobileAppDownloadPlatform({
  userAgent,
  platform = "",
  maxTouchPoints = 0,
  isNativeApp = false,
}: MobileAppDownloadEnvironment): MobileAppDownloadPlatform | null {
  if (isNativeApp || userAgent.includes(CAPACITOR_ANDROID_USER_AGENT)
    || userAgent.includes(CAPACITOR_IOS_USER_AGENT)) return null;

  if (/Android/i.test(userAgent)) return "android";
  if (/iPhone|iPod|iPad/i.test(userAgent)) return "ios";
  // iPadOS can request desktop Safari pages and identify itself as a Mac.
  if (platform === "MacIntel" && maxTouchPoints > 1) return "ios";
  return null;
}
