import { describe, expect, it } from "vitest";
import { SETTINGS } from "@/features/settings/shared/settings-config";
import {
  getSettingsStoreAdapter,
  hasSettingsStoreAdapter,
  settingsStoreAdapterKey
} from "@/stores/settings-store-adapters";

describe("settings store adapters", () => {
  it("keeps settings config free of service action bindings", () => {
    Object.values(SETTINGS).forEach((config) => {
      expect(config).not.toHaveProperty("list");
      expect(config).not.toHaveProperty("save");
      expect(config).not.toHaveProperty("remove");
    });
  });

  it("has a store adapter for every settings metadata entry", () => {
    Object.values(SETTINGS).forEach((config) => {
      expect(hasSettingsStoreAdapter(config.slug), config.slug).toBe(true);
    });
  });

  it("keeps the unite alias compatible with the unit adapter", () => {
    expect(SETTINGS.unite?.slug).toBe("unit");
    expect(settingsStoreAdapterKey("unite")).toBe("unit");
    expect(getSettingsStoreAdapter("unite")).toBe(getSettingsStoreAdapter("unit"));
  });
});
