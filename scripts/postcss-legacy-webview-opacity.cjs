// Tailwind v4 emits an opaque var() fallback for color-mix() opacity utilities.
// Keep that global fallback unchanged; every native Android WebView receives a
// deterministic rgba() version so normal phones and Swan 1 render alike.
const CAPACITOR_ANDROID_SELECTOR = ".capacitor-android";
const COLOR_TOKENS = new Set([
  "accent", "accent-foreground", "background", "border", "card",
  "card-foreground", "destructive", "destructive-foreground", "foreground",
  "info", "info-foreground", "info-text", "input", "muted",
  "muted-foreground", "pending", "pending-foreground", "popover",
  "popover-foreground", "primary", "primary-foreground", "primary-text",
  "ring", "secondary", "secondary-foreground", "sidebar",
  "sidebar-accent", "sidebar-accent-foreground", "sidebar-border",
  "sidebar-foreground", "sidebar-primary", "sidebar-primary-foreground",
  "sidebar-ring", "success", "success-foreground", "warning",
  "warning-foreground", "warning-text", "yg-accent", "yg-bg", "yg-bg2",
]);

function isColorToken(token) {
  return COLOR_TOKENS.has(token) || /^color-(?:black|white|[a-z]+-\d+)$/.test(token);
}

function hslToRgb(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = (((hue % 360) + 360) % 360) / 60;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const base = lightness - chroma / 2;
  const channels = sector < 1 ? [chroma, secondary, 0]
    : sector < 2 ? [secondary, chroma, 0]
      : sector < 3 ? [0, chroma, secondary]
        : sector < 4 ? [0, secondary, chroma]
          : sector < 5 ? [secondary, 0, chroma] : [chroma, 0, secondary];
  return channels.map((channel) => Math.round((channel + base) * 255));
}

function colorChannels(value) {
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value);
  if (hex) {
    const digits = hex[1].length <= 4
      ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1];
    const rgb = [0, 2, 4].map((offset) => Number.parseInt(digits.slice(offset, offset + 2), 16));
    const alpha = digits.length === 8
      ? Number.parseInt(digits.slice(6), 16) / 255 : 1;
    return { rgb: rgb.join(", "), alpha: String(alpha) };
  }

  const hsl = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i.exec(value);
  if (hsl) {
    const rgb = hslToRgb(Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100);
    return { rgb: rgb.join(", "), alpha: "1" };
  }

  const alias = /^var\(--([\w-]+)\)$/.exec(value);
  if (alias && isColorToken(alias[1])) {
    return {
      rgb: `var(--legacy-${alias[1]}-rgb)`,
      alpha: `var(--legacy-${alias[1]}-alpha)`,
    };
  }

  return null;
}

module.exports = function legacyWebViewOpacity() {
  return {
    postcssPlugin: "yummy-go-legacy-webview-opacity",
    OnceExit(root) {
      root.walkDecls((declaration) => {
        const token = declaration.prop.startsWith("--") ? declaration.prop.slice(2) : "";
        if (!isColorToken(token)) return;

        const channels = colorChannels(declaration.value);
        if (!channels) return;

        declaration.after({ prop: `--legacy-${token}-alpha`, value: channels.alpha });
        declaration.after({ prop: `--legacy-${token}-rgb`, value: channels.rgb });
      });

      root.walkAtRules("supports", (supports) => {
        if (!supports.params.includes("color-mix")) return;
        const fallbackRule = supports.prev();
        if (!fallbackRule || fallbackRule.type !== "rule") return;

        supports.walkRules((modernRule) => {
          if (!fallbackRule.selectors.includes(modernRule.selector)) return;
          modernRule.walkDecls((declaration) => {
            const mix = /^color-mix\(in (?:oklab|oklch),\s*var\(--([\w-]+)\)\s+([\d.]+)%,\s*transparent\)$/.exec(declaration.value);
            if (!mix || !isColorToken(mix[1])) return;

            const fallback = fallbackRule.nodes.find((node) =>
              node.type === "decl" && node.prop === declaration.prop && node.value === `var(--${mix[1]})`
            );
            if (!fallback) return;

            const fraction = Number(mix[2]) / 100;
            const legacyColor = `rgba(var(--legacy-${mix[1]}-rgb), calc(var(--legacy-${mix[1]}-alpha) * ${fraction}))`;
            fallbackRule.after({
              selector: modernRule.selectors.map((selector) => `${CAPACITOR_ANDROID_SELECTOR} ${selector}`).join(", "),
              nodes: [{ prop: declaration.prop, value: legacyColor }],
            });
          });
        });
      });
    },
  };
};

module.exports.postcss = true;
