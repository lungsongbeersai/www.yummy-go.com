import { describe, expect, it } from "vitest";
import {
  hasAppUpdate,
  parseAppVersionConfig,
  type AppPlatformVersionConfig,
  type AppVersionConfig,
} from "./app-version";

const androidConfig: AppPlatformVersionConfig = {
  enabled: true,
  latestVersion: "1.0.3",
  latestBuild: 4,
  forceUpdate: false,
  storeUrl: "https://play.google.com/store/apps/details?id=com.yummygo.app",
  nativeStoreUrl: "market://details?id=com.yummygo.app",
};

const config: AppVersionConfig = {
  android: androidConfig,
  ios: {
    enabled: false,
    latestVersion: "1.0",
    latestBuild: 1,
    forceUpdate: false,
    storeUrl: "https://apps.apple.com/us/app/yummy-go/id6792033783",
    nativeStoreUrl: "itms-apps://itunes.apple.com/app/id6792033783",
  },
};

describe("app version config", () => {
  it("shows an update only when the configured build is newer", () => {
    expect(hasAppUpdate(androidConfig, { version: "1.0.2", build: 3 })).toBe(true);
    expect(hasAppUpdate(androidConfig, { version: "1.0.3", build: 4 })).toBe(false);
    expect(hasAppUpdate(androidConfig, { version: "1.0.4", build: 5 })).toBe(false);
  });

  it("can disable version checks from the JSON file", () => {
    expect(
      hasAppUpdate(
        { ...androidConfig, enabled: false },
        { version: "1.0.2", build: 3 },
      ),
    ).toBe(false);
  });

  it("accepts a valid Play Store configuration", () => {
    expect(parseAppVersionConfig(config)).toEqual(config);
  });

  it("rejects invalid builds and non-Play-Store links", () => {
    expect(
      parseAppVersionConfig({
        ...config,
        android: { ...androidConfig, latestBuild: 0 },
      }),
    ).toBeNull();
    expect(
      parseAppVersionConfig({
        ...config,
        android: { ...androidConfig, storeUrl: "https://example.com/app" },
      }),
    ).toBeNull();
  });

  it("supports an iOS App Store configuration", () => {
    const iosConfig: AppPlatformVersionConfig = {
      enabled: true,
      latestVersion: "1.0.0",
      latestBuild: 1,
      forceUpdate: false,
      storeUrl: "https://apps.apple.com/us/app/yummy-go/id6792033783",
      nativeStoreUrl: "itms-apps://itunes.apple.com/app/id6792033783",
    };

    expect(parseAppVersionConfig({ ...config, ios: iosConfig })?.ios).toEqual(iosConfig);
    expect(hasAppUpdate(iosConfig, { version: "0.9.0", build: 0 })).toBe(true);
  });
});
