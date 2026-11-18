const SUPPORTS_83 = "not selector(:where(*))";
// The same catalog and stride apply to the main sheet AND lazy CSS modules.
// Reserve one original ID per selector; fail on a future overflow instead of
// letting an earlier layer defeat a later layer in another stylesheet.
const LAYER_ORDER = ["yummy-legacy-properties", "properties", "theme", "base", "components", "utilities"];
const MAX_ORIGINAL_IDS = 1;
const LAYER_STRIDE = MAX_ORIGINAL_IDS + 1;
const UNLAYERED_TIER = LAYER_ORDER.length * LAYER_STRIDE;

function isKeyframeStep(rule) {
  for (let parent = rule.parent; parent; parent = parent.parent) {
    if (parent.type === "atrule" && /(?:^|-)keyframes$/i.test(parent.name)) return true;
  }
  return false;
}

function expandLogicalShorthands(root, postcss) {
  root.walkDecls((declaration) => {
    // Lightning preserves var-bearing shorthands as unparsed token lists. Axis
    // longhands are supported in83, and let Lightning lower positioning/radii
    // further where needed. Split at CSS token boundaries, never inside calc().
    const axis = /^(margin|padding|scroll-margin|scroll-padding|inset)-(inline|block)$/.exec(declaration.prop);
    const border = /^border-(inline|block)(?:-(width|style|color))?$/.exec(declaration.prop);
    let replacements;
    if (axis) {
      const values = postcss.list.space(declaration.value);
      if (values.length > 2) throw declaration.error(`Unsupported logical axis value: ${declaration.value}`);
      replacements = [
        [`${axis[1]}-${axis[2]}-start`, values[0]],
        [`${axis[1]}-${axis[2]}-end`, values[1] || values[0]],
      ];
    } else if (border) {
      const values = border[2] ? postcss.list.space(declaration.value) : [declaration.value];
      if (values.length > 2) throw declaration.error(`Unsupported logical border value: ${declaration.value}`);
      const suffix = border[2] ? `-${border[2]}` : "";
      replacements = [
        [`border-${border[1]}-start${suffix}`, values[0]],
        [`border-${border[1]}-end${suffix}`, values[1] || values[0]],
      ];
    } else if (declaration.prop === "inset") {
      const values = postcss.list.space(declaration.value);
      if (values.length > 4) throw declaration.error(`Unsupported inset value: ${declaration.value}`);
      replacements = [
        ["top", values[0]], ["right", values[1] || values[0]],
        ["bottom", values[2] || values[0]], ["left", values[3] || values[1] || values[0]],
      ];
    }
    if (!replacements) return;
    for (const [prop, value] of replacements) declaration.cloneBefore({ prop, value });
    declaration.remove();
  });
}

module.exports = function legacyWebView83() {
  return {
    postcssPlugin: "yummy-go-legacy-webview-83",
    async OnceExit(root, { postcss, result }) {
      const [{ transform, Features }, { default: selectorParser }, { createSelectorCompiler }] = await Promise.all([
        import("lightningcss"), import("postcss-selector-parser"), import("./legacy-selectors.cjs"),
      ]);
      const { lowerSelectorList, specificity } = createSelectorCompiler(selectorParser);
      const layers = root.nodes.find((node) => node.type === "atrule"
        && node.name === "supports" && /^not\s*\(\s*color\s*:\s*revert-layer\s*\)$/.test(node.params));
      let isAppStylesheet = false;
      root.walkDecls("--yummy-go-styles-ready", () => { isAppStylesheet = true; });
      // The preceding layer plugin has already solved layer and !important
      // precedence. Reuse its complete flattened sheet, including native color,
      // transform, property defaults and source-order resets, exactly once.
      let source = layers ? postcss.root({ nodes: layers.nodes.map((node) => node.clone()) }) : root.clone();
      source.walkRules((rule) => {
          if (isKeyframeStep(rule)) return;
          if (layers) {
            if (typeof rule.raws.yummyGoOriginalSelectors !== "string") throw rule.error("Missing native83 layer provenance");
            rule.selector = rule.raws.yummyGoOriginalSelectors;
          }
          rule.selector = selectorParser((selectors) => selectors.each((entry) => {
            const scope = selectorParser().astSync(":where(.capacitor-android,.capacitor-android *):not(:where(#native-startup-fallback,#native-startup-fallback *))").first.nodes;
            const element = entry.nodes.find((node) => node.type === "pseudo" && (node.value.startsWith("::")
              || [":before", ":after", ":first-line", ":first-letter"].includes(node.value)));
            for (const node of scope) { if (element) entry.insertBefore(element, node.clone()); else entry.append(node.clone()); }
          })).processSync(rule.selector);
      });
      expandLogicalShorthands(source, postcss);
      let hasNesting = false;
      source.walkRules((rule) => {
        if (isKeyframeStep(rule)) return;
        for (let parent = rule.parent; parent; parent = parent.parent) {
          if (parent.type === "rule") hasNesting = true;
        }
        selectorParser().astSync(rule.selector).walkNesting(() => { hasNesting = true; });
      });
      if (hasNesting) {
        if (layers) throw source.error("Native83 layered CSS must be flattened before the layer compatibility pass");
        // Establish complete selectors before recording their weights. Native
        // logical conversion is deferred until the weighted pass below.
        const flat = transform({
          filename: result.opts.from || "native-83.css", code: Buffer.from(source.toString()),
          targets: { chrome: 83 << 16 }, include: Features.Nesting,
          exclude: Features.LogicalProperties | Features.DirSelector | Features.IsSelector | Features.NotSelectorList,
          errorRecovery: false,
        });
        source = postcss.parse(flat.code.toString());
      }
      // The layer plugin already separates importance when it has layers. A
      // separate unlayered module still needs separate normal/important ranks.
      source.walkRules((rule) => {
        if (isKeyframeStep(rule)) return;
        const hasImportant = rule.nodes.some((node) => node.type === "decl" && node.important);
        const hasNormal = rule.nodes.some((node) => node.type === "decl" && !node.important);
        if (!hasImportant || !hasNormal) return;
        const important = rule.clone();
        important.each((node) => { if (node.type !== "decl" || !node.important) node.remove(); });
        rule.each((node) => { if (node.type === "decl" && node.important) node.remove(); });
        rule.before(important);
      });
      const weights = new Map();
      const rules = [];
      source.walkRules((rule) => { if (!isKeyframeStep(rule)) rules.push(rule); });
      for (const rule of rules) {
        const wrappers = selectorParser().astSync(rule.selector).nodes.map((entry) => {
          const original = specificity(entry);
          if (original[0] > MAX_ORIGINAL_IDS) throw rule.error(`Native83 original ID specificity exceeds shared budget ${MAX_ORIGINAL_IDS}: ${entry}`);
          const layer = rule.raws.yummyGoOriginalLayer || "";
          const index = LAYER_ORDER.indexOf(layer);
          if (layer && index < 0) throw rule.error(`Add CSS layer to the shared native83 catalog: ${layer}`);
          const important = rule.nodes.some((node) => node.type === "decl" && node.important);
          const tier = layer ? (important ? LAYER_ORDER.length - index : index) * LAYER_STRIDE : important ? 0 : UNLAYERED_TIER;
          const name = `yummy-go-native-weight-${weights.size}`;
          weights.set(name, { weight: [original[0] + tier, original[1], original[2]], important });
          return postcss.atRule({ name: "layer", params: name, nodes: [rule.clone({ selector: entry.toString() })] });
        });
        rule.replaceWith(...wrappers);
      }
      // Lower logical declarations only in the native copy. Keep selector
      // lowering here: Lightning CSS intentionally preserves complex :is/where.
      const compiled = transform({
        filename: result.opts.from || "native-83.css", code: Buffer.from(source.toString()),
        targets: { chrome: 83 << 16 }, minify: false,
        include: Features.DirSelector,
        exclude: Features.IsSelector | Features.NotSelectorList,
        errorRecovery: false,
      });
      const fallback = postcss.atRule({ name: "supports", params: SUPPORTS_83 });
      fallback.append(postcss.parse(compiled.code.toString()).nodes);
      fallback.walkRules((rule) => {
        if (isKeyframeStep(rule)) return;
        if (!rule.selector.trim()) { rule.remove(); return; }
        let original;
        for (let parent = rule.parent; parent; parent = parent.parent) {
          if (parent.type === "atrule" && parent.name === "layer" && weights.has(parent.params)) {
            original = weights.get(parent.params); break;
          }
        }
        if (!original) throw rule.error("Missing native83 selector weight");
        // Lightning's directional conversion can omit !important on unparsed
        // logical values. Each envelope contains one importance level only.
        rule.walkDecls((declaration) => { declaration.important = original.important; });
        try { rule.selector = lowerSelectorList(rule.selector, original.weight); }
        catch (error) { throw rule.error(`${error.message}; selector: ${rule.selector}`); }
        if (!rule.selector) rule.remove();
      });
      // These layers are compile-only envelopes, retaining source identity when
      // Lightning splits logical declarations into directional selector rules.
      // They must never affect either the final cascade or83's CSS parser.
      fallback.walkAtRules("layer", (layer) => {
        if (weights.has(layer.params)) layer.replaceWith(...(layer.nodes || []));
      });
      // A lazy font/CSS module must not report readiness for stale global CSS.
      if (isAppStylesheet) fallback.append(postcss.rule({ selector: "html.capacitor-android", nodes: [
        postcss.decl({ prop: "--yummy-go-legacy83-ready", value: "1" }),
      ] }));
      root.append(fallback);
      if (/\.module\.css(?:$|\?)/i.test(result.opts.from || "")) {
        // css-loader runs after PostCSS. Native classes belong to the host html,
        // so never let CSS Modules rename them; keep authored module classes
        // local in both the88 and83 copies, preserving pure-module validation.
        root.walkRules((rule) => {
          if (isKeyframeStep(rule)) return;
          rule.selector = selectorParser((selectors) => selectors.walkClasses((node) => {
            if (!["capacitor-android", "android-webview-compat", "android-webview-83"].includes(node.value)) return;
            for (let parent = node.parent; parent; parent = parent.parent) {
              if (parent.type === "pseudo" && parent.value === ":global") return;
            }
            const global = selectorParser.pseudo({ value: ":global" });
            const entry = selectorParser.selector(); entry.append(node.clone()); global.append(entry);
            node.replaceWith(global);
          })).processSync(rule.selector);
        });
      }
    },
  };
};
module.exports.postcss = true;
module.exports.UNLAYERED_TIER = UNLAYERED_TIER;
