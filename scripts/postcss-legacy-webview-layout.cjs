// Preserve authored values that getComputedStyle resolves to pixels. The
// capability-based native layout fallback needs to distinguish auto margins
// and auto dimensions; these variables have no visual effect by themselves.
const PROPERTIES = new Set(["width", "height", "aspect-ratio", "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "margin-inline", "margin-block", "margin-inline-start", "margin-inline-end", "margin-block-start", "margin-block-end"]);

function metadata(declaration, postcss) {
  const values = postcss.list.space(declaration.value);
  if (declaration.prop === "margin") {
    return ["top", "right", "bottom", "left"].map((side, index) => [`margin-${side}`, values[[0, Math.min(1, values.length - 1), values.length >= 3 ? 2 : 0, values.length === 4 ? 3 : Math.min(1, values.length - 1)][index]]]);
  }
  if (declaration.prop === "margin-inline" || declaration.prop === "margin-block") {
    return (declaration.prop === "margin-inline" ? ["left", "right"] : ["top", "bottom"]).map((side, index) => [`margin-${side}`, values[Math.min(index, values.length - 1)]]);
  }
  const logical = { "margin-inline-start": "margin-left", "margin-inline-end": "margin-right", "margin-block-start": "margin-top", "margin-block-end": "margin-bottom" };
  return [[logical[declaration.prop] || declaration.prop, declaration.value]];
}

module.exports = function legacyWebViewLayout() {
  return {
    postcssPlugin: "yummy-go-legacy-webview-layout",
    OnceExit(root, { postcss, result }) {
      let needed = false;
      root.walkDecls(declaration => { if (PROPERTIES.has(declaration.prop)) needed = true; });
      if (!needed) return;
      const reset = postcss.rule({ selector: ":where(*)" });
      for (const property of ["width", "height", "aspect-ratio", "margin-top", "margin-right", "margin-bottom", "margin-left"]) reset.append({ prop: `--yg-layout-${property}`, value: "initial" });
      // Match preflight's specificity/layer so utility metadata overrides the
      // per-element reset after the Chromium 83 cascade/selector lowering.
      // CSS modules must contain a local selector in every rule. Their nodes
      // already receive this per-element reset from the global stylesheet.
      if (!/\.module\.[^/]+$/.test(result.opts.from || "")) {
        let base;
        root.walkAtRules("layer", rule => { if (!base && rule.params === "base" && rule.nodes) base = rule; });
        if (base) base.prepend(reset);
        else { base = postcss.atRule({ name: "layer", params: "base" }); base.append(reset); root.append(base); }
      }
      root.walkDecls(declaration => {
        if (PROPERTIES.has(declaration.prop)) for (const [property, value] of metadata(declaration, postcss)) declaration.after(declaration.clone({ prop: `--yg-layout-${property}`, value }));
      });
    },
  };
};
module.exports.postcss = true;
