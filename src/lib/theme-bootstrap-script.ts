const THEME_COLORS = ["emerald", "blue", "amber", "rose", "violet"];
const FONT_SCALES = ["sm", "md", "lg"];

// Inlined into the root layout's <head> via next/script (beforeInteractive) so the
// theme/color/font-scale classes land before first paint, avoiding a flash of the
// wrong theme while the app store hydrates from localStorage.
export const themeBootstrapScript = `
(function () {
  try {
    var stored = localStorage.getItem("yummy-go-app");
    var parsed = stored ? JSON.parse(stored) : null;
    var state = parsed && parsed.state ? parsed.state : null;
    var theme = state && state.theme === "dark" ? "dark" : "light";
    var themeColor = state && ${JSON.stringify(THEME_COLORS)}.indexOf(state.themeColor) !== -1 ? state.themeColor : "emerald";
    var fontScale = state && ${JSON.stringify(FONT_SCALES)}.indexOf(state.fontScale) !== -1 ? state.fontScale : "md";
    var root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
    root.dataset.themeColor = themeColor;
    root.dataset.fontScale = fontScale;
    root.style.colorScheme = theme;
  } catch (_) {
    var fallbackRoot = document.documentElement;
    fallbackRoot.classList.remove("dark");
    fallbackRoot.dataset.theme = "light";
    fallbackRoot.dataset.themeColor = "emerald";
    fallbackRoot.dataset.fontScale = "md";
    fallbackRoot.style.colorScheme = "light";
  }
})();
`;
