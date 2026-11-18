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
  "chart-cat-1", "chart-cat-2", "chart-cat-3", "chart-cat-4", "chart-cat-5",
  "table-cashier", "table-staff", "table-payment",
]);

function isColorToken(token) {
  return COLOR_TOKENS.has(token) || /^color-(?:black|white|[a-z]+-\d+)$/.test(token);
}

const MODERN_COLOR = /(?:color-mix|oklch|oklab|\blab|\blch|\bcolor)\(/;
const NATIVE_SCOPE = ":where(.capacitor-android, .capacitor-android *):not(:where(#native-startup-fallback, #native-startup-fallback *))";

function inKeyframes(rule) {
  for (let parent = rule.parent; parent; parent = parent.parent) {
    if (parent.type === "atrule" && /(?:^|-)keyframes$/i.test(parent.name)) return true;
  }
  return false;
}

function scopedSelector(selector, selectorParser) {
  return selectorParser((root) => root.each((entry) => {
    const pseudoElement = entry.nodes.find((node) => node.type === "pseudo"
      && (node.value.startsWith("::") || [":before", ":after", ":first-line", ":first-letter"].includes(node.value)));
    for (const node of selectorParser().astSync(NATIVE_SCOPE).first.nodes) {
      if (pseudoElement) entry.insertBefore(pseudoElement, node.clone());
      else entry.append(node.clone());
    }
  })).processSync(selector);
}

module.exports = function legacyWebViewOpacity() {
  return {
    postcssPlugin: "yummy-go-legacy-webview-opacity",
    async OnceExit(root, { postcss }) {
      const [{ transform }, { default: selectorParser }, { createColorCompiler }] = await Promise.all([
        import("lightningcss"), import("postcss-selector-parser"), import("./legacy-color-values.cjs"),
      ]);
      const compiler = createColorCompiler(transform);
      const declarations = [];
      root.walkDecls((declaration) => {
        if (declaration.prop.startsWith("--") && !declaration.prop.startsWith("--legacy-")) declarations.push(declaration);
      });
      const tokens = new Set(COLOR_TOKENS);
      // Discover public-menu, toast, chart and future semantic aliases from their
      // definitions instead of silently omitting colors outside a fixed allowlist.
      let changed = true;
      while (changed) {
        changed = false;
        for (const declaration of declarations) {
          const token = declaration.prop.slice(2);
          if (!tokens.has(token) && compiler.colorChannels(declaration.value, tokens)) {
            tokens.add(token); changed = true;
          }
        }
      }
      for (const declaration of declarations) {
        const token = declaration.prop.slice(2);
        if (!tokens.has(token)) continue;
        const channels = compiler.colorChannels(declaration.value, tokens);
        if (!channels) continue;
        declaration.after({ prop: `--legacy-${token}-alpha`, value: channels.alpha });
        declaration.after({ prop: `--legacy-${token}-rgb`, value: channels.channels.join(", ") });
        ["r", "g", "b"].forEach((channel, index) => {
          declaration.after({ prop: `--legacy-${token}-${channel}`, value: channels.channels[index] });
        });
      }

      const opacityHandled = new WeakSet();
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
              nodes: [{ prop: declaration.prop, value: legacyColor, important: declaration.important }],
            });
            opacityHandled.add(declaration);
          });
        });
      });

      const animationAliases = new Map();
      const keyframes = [];
      root.walkAtRules((rule) => {
        if (/(?:^|-)keyframes$/i.test(rule.name)) keyframes.push(rule);
      });
      for (const keyframe of keyframes) {
        if (!/^[\w-]+$/.test(keyframe.params)) continue;
        const copy = keyframe.clone();
        let converted = false;
        copy.walkDecls((declaration) => {
          if (!MODERN_COLOR.test(declaration.value)) return;
          const value = compiler.transformValue(declaration.value, tokens);
          if (MODERN_COLOR.test(value)) return;
          declaration.value = value;
          converted = true;
        });
        if (!converted) continue;
        copy.params = `${keyframe.params}-yummy-android-srgb`;
        animationAliases.set(keyframe.params, copy.params);
        const fallback = postcss.atRule({ name: "supports", params: "not (color: color-mix(in srgb, black, white))" });
        fallback.append(copy);
        keyframe.after(fallback);
      }

      const containers = new Set();
      root.walkDecls((declaration) => {
        const owner = declaration.parent;
        if (!owner || inKeyframes(owner)) return;
        let hasSelector = owner.type === "rule";
        for (let parent = owner.parent; parent && !hasSelector; parent = parent.parent) hasSelector = parent.type === "rule";
        if (hasSelector) containers.add(owner);
      });
      const insertions = new Map();
      for (const rule of containers) {
        const converted = rule.nodes.filter((node) => node.type === "decl").flatMap((declaration) => {
          // The existing compact rgba fallback already covers these utilities;
          // emitting the generic per-channel form would duplicate hundreds of rules.
          if (opacityHandled.has(declaration)) return [];
          let value = MODERN_COLOR.test(declaration.value) ? compiler.transformValue(declaration.value, tokens) : declaration.value;
          if (/^(?:animation(?:-name)?|--animate-)/.test(declaration.prop)) {
            for (const [name, alias] of animationAliases) {
              value = value.replace(new RegExp(`(?<![\\w-])${name}(?![\\w-])`, "g"), alias);
            }
          }
          return value !== declaration.value && !MODERN_COLOR.test(value) ? [declaration.clone({ value })] : [];
        });
        if (!converted.length) continue;

        let gate = null;
        for (let parent = rule.parent; parent; parent = parent.parent) {
          if (parent.type === "atrule" && parent.name === "supports" && MODERN_COLOR.test(parent.params)
            && !/^\s*not\b/.test(parent.params)) gate = parent;
        }
        let copy = rule.clone({ nodes: [] });
        copy.append(converted);
        if (rule.type === "rule") copy.selector = scopedSelector(rule.selector, selectorParser);
        else copy = postcss.rule({ selector: scopedSelector("&", selectorParser) }).append(copy);
        if (gate) {
          for (let parent = rule.parent; parent !== gate; parent = parent.parent) {
            if (parent.type === "atrule" && parent.name === "supports" && MODERN_COLOR.test(parent.params)
              && !/^\s*not\b/.test(parent.params)) continue;
            copy = parent.clone({ nodes: [] }).append(copy);
          }
        }
        // Lift out of positive modern-color feature queries while retaining
        // hover, dark, responsive and state conditions and original !important.
        const fallback = postcss.atRule({ name: "supports", params: "not (color: color-mix(in srgb, black, white))" });
        fallback.append(copy);
        const anchor = gate ?? rule;
        (insertions.get(anchor) ?? anchor).after(fallback);
        insertions.set(anchor, fallback);
      }
    },
  };
};

module.exports.postcss = true;
