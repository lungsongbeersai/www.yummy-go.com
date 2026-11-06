import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { DECOR_BACKGROUND_STYLES, THEME_COLORS } from "@/lib/appearance-preferences";
import { themeBootstrapScript } from "@/lib/theme-bootstrap-script";

function bootstrap(stored: string | null, storageThrows = false) {
  const classes = new Set<string>();
  const root = {
    dataset: {} as Record<string, string>,
    style: {} as Record<string, string>,
    classList: {
      toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name),
      remove: (name: string) => classes.delete(name),
    },
  };

  runInNewContext(themeBootstrapScript, {
    document: { documentElement: root },
    localStorage: {
      getItem: () => {
        if (storageThrows) throw new Error("Storage unavailable");
        return stored;
      },
    },
  });

  return { root, classes };
}

describe("background preferences before first paint", () => {
  it("uses the original background for a new installation", () => {
    expect(bootstrap(null).root.dataset).toMatchObject({
      decorBackground: "on",
      decorBackgroundColor: "emerald",
      decorBackgroundStyle: "floral",
    });
  });

  it.each(DECOR_BACKGROUND_STYLES.map((style, index) => [THEME_COLORS[index], style] as const))(
    "restores %s and %s independently from the accent color",
    (decorBackgroundColor, decorBackgroundStyle) => {
      const { root, classes } = bootstrap(JSON.stringify({ state: {
        theme: "dark",
        themeColor: "emerald",
        decorBackground: true,
        decorBackgroundColor,
        decorBackgroundStyle,
      } }));

      expect(root.dataset).toMatchObject({
        themeColor: "emerald",
        decorBackground: "on",
        decorBackgroundColor,
        decorBackgroundStyle,
      });
      expect(classes.has("dark")).toBe(true);
    },
  );

  it("retains the accent color and disabled flag from an older installation", () => {
    expect(bootstrap(JSON.stringify({ state: { themeColor: "blue", decorBackground: false } })).root.dataset)
      .toMatchObject({ decorBackground: "off", decorBackgroundColor: "blue", decorBackgroundStyle: "floral" });
  });

  it("falls back to the saved accent color when new preference values are invalid", () => {
    expect(bootstrap(JSON.stringify({ state: {
      themeColor: "violet",
      decorBackgroundColor: "unknown",
      decorBackgroundStyle: null,
    } })).root.dataset).toMatchObject({ decorBackgroundColor: "violet", decorBackgroundStyle: "floral" });
  });

  it("falls back to emerald when both saved colors are invalid", () => {
    expect(bootstrap(JSON.stringify({ state: {
      themeColor: "unknown",
      decorBackgroundColor: false,
    } })).root.dataset).toMatchObject({ decorBackgroundColor: "emerald", decorBackgroundStyle: "floral" });
  });

  it.each([
    ["invalid JSON", "{", false],
    ["unavailable storage", null, true],
  ] as const)("provides complete background defaults for %s", (_label, stored, storageThrows) => {
    expect(bootstrap(stored, storageThrows).root.dataset).toMatchObject({
      decorBackground: "on",
      decorBackgroundColor: "emerald",
      decorBackgroundStyle: "floral",
    });
  });
});
