export const THEME_COLORS = ["emerald", "blue", "amber", "rose", "violet"] as const;
export type ThemeColor = (typeof THEME_COLORS)[number];

export const DECOR_BACKGROUND_STYLES = ["floral", "leaves", "waves", "geometric", "dots"] as const;
export type DecorBackgroundStyle = (typeof DECOR_BACKGROUND_STYLES)[number];

interface DecorBackgroundPreferences {
  decorBackgroundColor: ThemeColor;
  decorBackgroundStyle: DecorBackgroundStyle;
}

function isThemeColor(value: unknown): value is ThemeColor {
  return THEME_COLORS.some((color) => color === value);
}

function isDecorBackgroundStyle(value: unknown): value is DecorBackgroundStyle {
  return DECOR_BACKGROUND_STYLES.some((style) => style === value);
}

// Normalize before the store's default values are merged in, so an older saved
// accent color also becomes its initial background color instead of emerald.
export function normalizeDecorBackgroundPreferences(value: unknown): DecorBackgroundPreferences {
  const state = value && typeof value === "object" ? value : {};
  const themeColor = "themeColor" in state && isThemeColor(state.themeColor) ? state.themeColor : "emerald";
  const color = "decorBackgroundColor" in state ? state.decorBackgroundColor : undefined;
  const style = "decorBackgroundStyle" in state ? state.decorBackgroundStyle : undefined;

  return {
    decorBackgroundColor: isThemeColor(color) ? color : themeColor,
    decorBackgroundStyle: isDecorBackgroundStyle(style) ? style : "floral",
  };
}
