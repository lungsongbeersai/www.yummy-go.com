const LEGACY_SCOPE = ":where(.android-webview-compat, .android-webview-compat *):not(:where(#native-startup-fallback, #native-startup-fallback *))";
const LEGACY_PSEUDO_ELEMENTS = new Set([":before", ":after", ":first-line", ":first-letter"]);

function isKeyframeStep(rule) {
  for (let parent = rule.parent; parent; parent = parent.parent) {
    if (parent.type === "atrule" && /(?:^|-)keyframes$/i.test(parent.name)) return true;
  }
  return false;
}

function scopeSelector(selector, selectorParser) {
  return selectorParser((selectors) => {
    selectors.each((entry) => {
      // Constrain the selected element, including <html>, rather than requiring
      // a native ancestor. :where() keeps the polyfilled cascade specificity.
      // The independent startup screen must retain its inline styles: transformed
      // preflight selectors otherwise have enough specificity to reset its UI.
      const scope = selectorParser().astSync(LEGACY_SCOPE).first.nodes.map((node) => node.clone());
      const pseudoElement = entry.nodes.find((node) =>
        node.type === "pseudo" && (node.value.startsWith("::") || LEGACY_PSEUDO_ELEMENTS.has(node.value))
      );
      for (const node of scope) {
        if (pseudoElement) entry.insertBefore(pseudoElement, node);
        else entry.append(node);
      }
    });
  }).processSync(selector);
}

module.exports = function legacyWebViewLayers() {
  return {
    postcssPlugin: "yummy-go-legacy-webview-layers",
    async OnceExit(root, { result }) {
      let hasLayers = false;
      root.walkAtRules("layer", () => { hasLayers = true; });
      if (!hasLayers) return;

      // Tailwind has already bundled imports and the Android opacity fallbacks.
      // Flattening @layer alone changes both specificity and !important order;
      // transform a complete clone with the standards-based cascade polyfill.
      const [{ default: postcss }, { default: selectorParser }, { default: cascadeLayers }] = await Promise.all([
        import("postcss"),
        import("postcss-selector-parser"),
        import("@csstools/postcss-cascade-layers"),
      ]);
      const legacy = await postcss([cascadeLayers()]).process(root.clone(), {
        from: result.opts.from,
        map: false,
      });
      result.messages.push(...legacy.messages);

      legacy.root.walkRules((rule) => {
        if (!isKeyframeStep(rule)) rule.selector = scopeSelector(rule.selector, selectorParser);
      });

      // revert-layer shipped with cascade layers in Chromium. Keep the original
      // CSS untouched for capable engines; the early native bootstrap supplies
      // the scope only on Android WebViews that can parse :where() (Chromium 88+).
      const fallback = postcss.atRule({ name: "supports", params: "not (color: revert-layer)" });
      fallback.append(legacy.root.nodes);
      root.append(fallback);
    },
  };
};

module.exports.postcss = true;
