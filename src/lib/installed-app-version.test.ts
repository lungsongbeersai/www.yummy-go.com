import { describe, expect, it } from "vitest";
import { formatInstalledAppVersion, WEB_APP_VERSION } from "./installed-app-version";

describe("installed app version", () => {
  it("formats the native marketing version and build number", () => {
    expect(formatInstalledAppVersion({ version: "1.0", build: 2 })).toBe("1.0 (2)");
  });

  it("uses the package version as the web fallback", () => {
    expect(WEB_APP_VERSION).toBe("1.0.0");
  });
});
