import { describe, expect, it } from "vitest";
import { SETTINGS, SETTINGS_MODULE_SLUGS } from "@/features/settings/shared/settings-config";
import { hasSettingsStoreAdapter } from "@/stores/settings-store-adapters";

describe("settings store adapters", () => {
  it("keeps settings config free of service action bindings", () => {
    Object.values(SETTINGS).forEach((config) => {
      expect(config).not.toHaveProperty("list");
      expect(config).not.toHaveProperty("save");
      expect(config).not.toHaveProperty("remove");
    });
  });

  it("has a store adapter for every settings module", () => {
    SETTINGS_MODULE_SLUGS.forEach((slug) => {
      expect(hasSettingsStoreAdapter(slug), slug).toBe(true);
    });
  });

  it("only exposes dynamic-route configs for entities without a static route", () => {
    expect(Object.keys(SETTINGS).sort()).toEqual(["branch", "district", "province", "store"]);
  });
});
