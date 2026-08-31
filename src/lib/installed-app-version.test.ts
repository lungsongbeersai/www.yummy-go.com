import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import {
  formatInstalledAppVersion,
  supportsAndroidOfflineSync,
  WEB_APP_VERSION,
} from "./installed-app-version";

describe("installed app version", () => {
  it("formats the native marketing version and build number", () => {
    expect(formatInstalledAppVersion({ version: "1.0", build: 2 })).toBe("1.0 (2)");
  });

  it("uses the package version as the web fallback", () => {
    expect(WEB_APP_VERSION).toBe(packageJson.version);
  });

  it("keeps build 5 on the legacy Agent transport and enables Local Sync from build 6", () => {
    expect(supportsAndroidOfflineSync(5)).toBe(false);
    expect(supportsAndroidOfflineSync(6)).toBe(true);
  });
});
