const NATIVE_SCOPE = ":where(.capacitor-android, .capacitor-android *)";
const TRANSFORM_SUPPORT = "not ((translate: 0) and (rotate: 0deg) and (scale: 1))";
const LEGACY_PARTS = {
  translate: "--yg-translate",
  rotate: "--yg-rotate",
  scale: "--yg-scale",
  transform: "--yg-transform",
};
const INITIAL_PARTS = {
  translate: "translate(0, 0)",
  rotate: "rotate(0deg)",
  scale: "scale(1)",
  transform: "translate(0, 0)",
};
const TRANSFORM_PREFIX = "var(--yg-translate) var(--yg-rotate) var(--yg-scale)";
const COMPOSED_TRANSFORM = `${TRANSFORM_PREFIX} var(--yg-transform)`;

function words(value) {
  const result = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  for (let index = 0; index <= value.length; index += 1) {
    const char = value[index] || " ";
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (!depth && /\s/.test(char)) {
      if (index > start) result.push(value.slice(start, index));
      start = index + 1;
    }
  }
  return result;
}

function replaceOutsideStrings(value, pattern, replacement) {
  return value.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^"']+/g, (part) => {
    if (part[0] === '"' || part[0] === "'") return part;
    return part.replace(pattern, replacement);
  });
}

function scaleNumbers(value) {
  return replaceOutsideStrings(value, /(-?(?:\d*\.)?\d+)%/g, (_, number) => String(Number(number) / 100));
}

function scaleValue(value) {
  return scaleNumbers(value).replace(/var\(--tw-scale-([xyz])\b/g, "var(--yg-scale-$1");
}

function transformValue(property, value) {
  if (value === "none") return INITIAL_PARTS[property];
  if (property === "transform") return value;
  const parts = words(property === "scale" ? scaleValue(value) : value);
  if (property === "translate") {
    return parts.length === 3 ? `translate3d(${parts.join(", ")})` : `translate(${parts[0]}, ${parts[1] || "0"})`;
  }
  if (property === "scale") {
    return parts.length === 3 ? `scale3d(${parts.join(", ")})` : `scale(${parts.join(", ")})`;
  }
  if (parts.length === 4) return `rotate3d(${parts.join(", ")})`;
  if (parts.length === 2 && /^[xyz]$/i.test(parts[0])) return `rotate${parts[0].toUpperCase()}(${parts[1]})`;
  return `rotate(${value})`;
}

function scopeSelector(selector, selectorParser) {
  return selectorParser((selectors) => {
    selectors.each((entry) => {
      const scope = selectorParser().astSync(NATIVE_SCOPE).first.nodes.map((node) => node.clone());
      const pseudo = entry.nodes.find((node) => node.type === "pseudo" &&
        (node.value.startsWith("::") || /^:(before|after|first-line|first-letter)$/.test(node.value)));
      for (const node of scope) {
        if (pseudo) entry.insertBefore(pseudo, node);
        else entry.append(node);
      }
    });
  }).processSync(selector);
}

function animationNames(value, keyframes) {
  return value.replace(/[\w-]+/g, (word) => keyframes.has(word) ? `yg-legacy-${word}` : word);
}

function transformDeclarations(rule, keyframes) {
  const declarations = [];
  for (const node of rule.nodes || []) {
    if (node.type !== "decl") continue;
    if (Object.hasOwn(LEGACY_PARTS, node.prop)) {
      declarations.push(node.clone({ prop: LEGACY_PARTS[node.prop], value: transformValue(node.prop, node.value) }));
      declarations.push(node.clone({ prop: "transform", value: COMPOSED_TRANSFORM }));
    } else if (/^--tw-scale-[xyz]$/.test(node.prop)) {
      declarations.push(node.clone({ prop: node.prop.replace("--tw-", "--yg-"), value: scaleNumbers(node.value) }));
    } else if (/^--tw-(?:enter|exit)-scale$/.test(node.prop)) {
      const value = scaleNumbers(node.value);
      if (value !== node.value) declarations.push(node.clone({ value }));
    } else if (/^animation(?:-|$)/.test(node.prop) || node.prop.startsWith("--animate-")) {
      const value = animationNames(node.value, keyframes);
      declarations.push(node.clone({ value }));
    } else if (node.prop === "transition-property" || node.prop === "will-change") {
      const value = [...new Set(node.value.split(",").map((part) => /^(translate|rotate|scale)$/.test(part.trim()) ? "transform" : part.trim()))].join(", ");
      declarations.push(node.clone({ value }));
    }
  }
  return declarations;
}

function viewportValue(value) {
  return replaceOutsideStrings(value, /(-?(?:\d*\.)?\d+)[dsl](vh|vw|vmin|vmax|vi|vb)\b/g, "$1$2");
}

function viewportDeclarations(rule, affectedProperties) {
  const declarations = [];
  for (const node of rule.nodes || []) {
    if (node.type !== "decl" || !affectedProperties.has(node.prop)) continue;
    declarations.push(node.clone({ value: viewportValue(node.value) }));
  }
  return declarations;
}

function overflowDeclarations(rule) {
  return (rule.nodes || []).filter((node) => node.type === "decl" && /^overflow(?:-[xy])?$/.test(node.prop))
    .map((node) => node.clone({ value: node.value.replace(/\bclip\b/g, "hidden") }));
}

function cloneKeyframes(rule) {
  const copy = rule.clone({ params: `yg-legacy-${rule.params}` });
  copy.walkRules((step) => {
    let individualTransform = false;
    let baseTransform = false;
    for (const declaration of step.nodes.slice()) {
      if (declaration.type !== "decl") continue;
      if (declaration.prop === "transform") {
        declaration.value = `${TRANSFORM_PREFIX} ${transformValue("transform", declaration.value)}`;
        baseTransform = true;
      } else if (Object.hasOwn(LEGACY_PARTS, declaration.prop)) {
        individualTransform = true;
        declaration.replaceWith(declaration.clone({
          prop: LEGACY_PARTS[declaration.prop], value: transformValue(declaration.prop, declaration.value),
        }));
      }
    }
    if (individualTransform && !baseTransform) step.append({ prop: "transform", value: COMPOSED_TRANSFORM });
  });
  return copy;
}

function cloneRules(node, declarationsForRule, selectorParser, keyframeHandler) {
  if ((node.type !== "rule" && node.type !== "atrule") || !node.nodes || node.name === "property") return null;
  if (node.type === "atrule" && /(?:^|-)keyframes$/.test(node.name)) return keyframeHandler ? keyframeHandler(node) : null;
  const children = [];
  for (const child of node.nodes) {
    if (child.type === "decl") children.push(...declarationsForRule({ nodes: [child] }));
    else {
      const copy = cloneRules(child, declarationsForRule, selectorParser, keyframeHandler);
      if (copy) children.push(copy);
    }
  }
  if (!children.length) return null;
  const copy = node.clone({
    ...(node.type === "rule" ? { selector: scopeSelector(node.selector, selectorParser) } : {}),
    nodes: [],
  });
  copy.append(children);
  return copy;
}

module.exports = function legacyWebViewGeometry() {
  return {
    postcssPlugin: "yummy-go-legacy-webview-geometry",
    async OnceExit(root) {
      const [{ default: postcss }, { default: selectorParser }] = await Promise.all([
        import("postcss"), import("postcss-selector-parser"),
      ]);
      const source = root.nodes.slice();
      const keyframes = new Set();
      root.walkAtRules(/(?:^|-)keyframes$/, (rule) => keyframes.add(rule.params));
      const viewportProperties = new Set();
      let hasClippedOverflow = false;
      root.walkDecls((declaration) => {
        if (viewportValue(declaration.value) !== declaration.value) viewportProperties.add(declaration.prop);
        if (/^overflow(?:-[xy])?$/.test(declaration.prop) && /\bclip\b/.test(declaration.value)) hasClippedOverflow = true;
      });
      const transforms = postcss.atRule({ name: "supports", params: TRANSFORM_SUPPORT });
      const viewport = postcss.atRule({ name: "supports", params: "not (height: 100dvh)" });
      const overflow = postcss.atRule({ name: "supports", params: "not (overflow: clip)" });

      // Registration prevents a translated parent's parts leaking into a child.
      // Chromium 88+, our supported legacy floor, implements @property already.
      for (const [part, property] of Object.entries(LEGACY_PARTS)) {
        const registration = postcss.atRule({ name: "property", params: property });
        registration.append({ prop: "syntax", value: '"*"' });
        registration.append({ prop: "inherits", value: "false" });
        registration.append({ prop: "initial-value", value: INITIAL_PARTS[part] });
        transforms.append(registration);
      }
      // Tailwind initializes unused scale axes to 100%. Old transform:scale()
      // needs numbers, including an axis that no utility explicitly sets.
      for (const axis of ["x", "y", "z"]) {
        const registration = postcss.atRule({ name: "property", params: `--yg-scale-${axis}` });
        registration.append({ prop: "syntax", value: '"*"' });
        registration.append({ prop: "inherits", value: "false" });
        registration.append({ prop: "initial-value", value: "1" });
        transforms.append(registration);
      }

      // An animation's transform normally composes after individual transforms.
      // Give native legacy rules their own keyframe names so centered dialogs
      // and translated loading indicators keep that order throughout animation.
      for (const node of source) {
        const transformCopy = cloneRules(node, (rule) => transformDeclarations(rule, keyframes), selectorParser, cloneKeyframes);
        // A later valid reset (height:auto, animate:none, etc.) must still beat
        // an earlier fallback. Copy competing declarations in their source
        // order, rather than appending only the unsupported values at the end.
        const viewportCopy = cloneRules(node, (rule) => viewportDeclarations(rule, viewportProperties), selectorParser);
        const overflowCopy = hasClippedOverflow ? cloneRules(node, overflowDeclarations, selectorParser) : null;
        if (transformCopy) transforms.append(transformCopy);
        if (viewportCopy) viewport.append(viewportCopy);
        if (overflowCopy) overflow.append(overflowCopy);
      }
      root.append(transforms);
      if (viewport.nodes?.length) root.append(viewport);
      if (overflow.nodes?.length) root.append(overflow);
    },
  };
};

module.exports.postcss = true;
