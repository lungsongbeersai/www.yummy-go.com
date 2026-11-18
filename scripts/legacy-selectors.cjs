// A fixed offset, shared by every generated stylesheet, preserves comparisons
// between lazy CSS chunks as well as within a stylesheet. Fail the build if a
// future selector exceeds this budget instead of silently changing the cascade.
const SPECIFICITY_OFFSET = [0, 8, 2];
const POSITIVE = new Set([":is", ":where", ":-webkit-any", ":matches"]);
const OLD_ELEMENTS = new Set([":before", ":after", ":first-line", ":first-letter"]);
const NATIVE_CLASSES = new Set(["capacitor-android", "android-webview-compat"]);

function createSelectorCompiler(parser) {

function pseudoElement(node) {
  return node.type === "pseudo" && (node.value.startsWith("::") || OLD_ELEMENTS.has(node.value));
}

function specificity(selector) {
  const total = [0, 0, 0];
  for (const node of selector.nodes) {
    if (node.type === "id") total[0]++;
    else if (node.type === "class" || node.type === "attribute") total[1]++;
    else if (node.type === "tag" || pseudoElement(node)) total[2]++;
    else if (node.type === "pseudo" && node.value !== ":where") {
      if (node.value === ":-webkit-any") total[1]++;
      else if (POSITIVE.has(node.value) || node.value === ":not" || node.value === ":has") {
        const highest = (node.nodes || []).map(specificity).sort(compare).at(-1) || [0, 0, 0];
        highest.forEach((number, index) => { total[index] += number; });
      } else total[1]++;
    }
  }
  return total;
}

function compare(a, b) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function chain(nodes) {
  const compounds = [[]];
  const edges = [];
  for (const node of nodes) {
    if (node.type === "combinator") {
      edges.push(node.value.trim() || " ");
      compounds.push([]);
    } else if (node.type !== "comment") compounds.at(-1).push(node.clone());
  }
  if (compounds.some((compound) => compound.length === 0)) {
    throw new Error(`Unsupported relative legacy selector: ${nodes.map(String).join("")}`);
  }
  return { compounds, edges };
}

function toSelector(value) {
  const selector = parser.selector();
  value.compounds.forEach((compound, index) => {
    if (index) selector.append(parser.combinator({ value: value.edges[index - 1] }));
    compound.forEach((node) => selector.append(node.clone()));
  });
  return selector;
}

function mergeCompound(left, right) {
  const nodes = [...left, ...right].map((node) => node.clone());
  const tags = new Set(nodes.filter((node) => node.type === "tag").map((node) => node.toString()));
  const ids = new Set(nodes.filter((node) => node.type === "id").map((node) => node.value));
  const elements = new Set(nodes.filter(pseudoElement).map((node) => node.toString()));
  if (tags.size > 1 || ids.size > 1 || elements.size > 1) return null;
  const result = [];
  // Compound intersections put a type first and a pseudo-element last. Repeated
  // positive atoms can be removed: specificity is restored separately below.
  const seen = new Set();
  for (const node of nodes) {
    if (node.type === "universal") continue;
    const key = node.toString();
    if (!seen.has(key)) { seen.add(key); result.push(node); }
  }
  result.sort((a, b) => Number(b.type === "tag") - Number(a.type === "tag")
    || Number(pseudoElement(a)) - Number(pseudoElement(b)));
  return result.length ? result : [parser.universal()];
}

function appendPrefix(prefix, compound, edge) {
  return { compounds: [...prefix.compounds, compound], edges: [...prefix.edges, edge] };
}

// Both prefixes select constraints to the left of the SAME subject. Enumerate
// their possible document order, including the same ancestor/sibling. Simply
// substituting `.dark *` into `:is()` loses `.dark.foo` and interleaved groups.
function unifyPrefixes(left, right) {
  if (!left.compounds.length) return [right];
  if (!right.compounds.length) return [left];
  const lc = left.compounds.at(-1), rc = right.compounds.at(-1);
  const le = left.edges.at(-1), re = right.edges.at(-1);
  const lp = { compounds: left.compounds.slice(0, -1), edges: left.edges.slice(0, -1) };
  const rp = { compounds: right.compounds.slice(0, -1), edges: right.edges.slice(0, -1) };
  const la = le === " " || le === ">", ra = re === " " || re === ">";
  const result = [];
  if (la === ra) {
    const merged = mergeCompound(lc, rc);
    if (merged) {
      const strict = la ? ">" : "+";
      const edge = le === strict || re === strict ? strict : le;
      for (const prefix of unifyPrefixes(lp, rp)) result.push(appendPrefix(prefix, merged, edge));
    }
    if (re === (la ? " " : "~")) {
      for (const prefix of unifyPrefixes(lp, right)) result.push(appendPrefix(prefix, lc, le));
    }
    if (le === (la ? " " : "~")) {
      for (const prefix of unifyPrefixes(left, rp)) result.push(appendPrefix(prefix, rc, re));
    }
  } else if (!la) {
    for (const prefix of unifyPrefixes(lp, right)) result.push(appendPrefix(prefix, lc, le));
  } else {
    for (const prefix of unifyPrefixes(left, rp)) result.push(appendPrefix(prefix, rc, re));
  }
  return result;
}

function isNativeScope(node) {
  return node.type === "pseudo" && node.value === ":where" && node.nodes?.length === 2
    && node.nodes.every((entry) => entry.nodes[0]?.type === "class"
      && NATIVE_CLASSES.has(entry.nodes[0].value)
      && (entry.nodes.length === 1 || (entry.nodes.length === 3
        && entry.nodes[1].type === "combinator" && entry.nodes[1].value.trim() === ""
        && entry.nodes[2].type === "universal")));
}

function prepare(selector) {
  const result = selector.clone();
  // All compiler scopes constrain the subject. Collapse these equivalent native
  // scopes before Cartesian expansion; authored ancestor selectors stay intact.
  let nativeScope;
  result.each((node) => {
    if (!isNativeScope(node)) return;
    if (nativeScope) node.remove();
    else { nativeScope = node; node.replaceWith(parser().astSync(":where(.capacitor-android,.capacitor-android *)").first.first); }
  });
  result.walkPseudos((node) => {
    if (node.value === ":focus-visible") node.value = ":focus";
    if (node.value === "::file-selector-button") node.value = "::-webkit-file-upload-button";
    if (node.value !== ":not") return;
    const text = node.toString().replace(/\s/g, "");
    if (text === ":not(:where(#native-startup-fallback,#native-startup-fallback*))") {
      node.replaceWith(parser().astSync(":not([data-native-startup-content])").first.first);
    } else if (/^:not\(:where\(\[data-yg-theme=(?:light|['"]light['"])\]\*\)\)$/.test(text)) {
      node.replaceWith(parser().astSync(":not([data-yg-legacy-light-ancestor])").first.first);
    }
  });
  return result;
}

function expand(selector, depth = 0, insideNot = false) {
  if (depth > 24) throw new Error(`Legacy selector expansion is too deep: ${selector}`);
  if (selector.nodes.some((node) => node.type === "pseudo" && node.value === ":has")) return [];
  const value = chain(selector.nodes);
  for (let ci = 0; ci < value.compounds.length; ci++) {
    const compound = value.compounds[ci];
    for (let ni = 0; ni < compound.length; ni++) {
      const node = compound[ni];
      if (node.type !== "pseudo" || (!POSITIVE.has(node.value) && node.value !== ":not")) continue;
      if (node.value === ":-webkit-any" && node.nodes.length === 1 && node.first.nodes.every((atom) =>
        atom.type === "pseudo" && atom.value === ":not" && atom.first?.nodes.length === 1
        && atom.first.first.value === ":lang")) continue;
      // Old Blink's :-webkit-any() accepts compound-free class/pseudo choices.
      // Each choice here weighs one class, exactly like the legacy pseudo. This
      // also keeps Lightning's :dir() language negation at one class of weight.
      if (!insideNot && POSITIVE.has(node.value) && node.nodes.length > 1 && node.nodes.every((entry) =>
        entry.nodes.length === 1 && ["class", "attribute", "pseudo"].includes(entry.first.type)
        && ![":where", ":is", ":not", ":has", ":-webkit-any"].includes(entry.first.value)
        && compare(specificity(entry), [0, 1, 0]) === 0)) {
        node.value = ":-webkit-any";
        continue;
      }
      if (node.value === ":not") {
        // CSS3 accepts only one simple selector in :not(). Lists become ANDs;
        // negated compounds use De Morgan's law and become selector branches.
        const arguments_ = node.nodes.flatMap((entry) => expand(entry, depth + 1, true));
        if (arguments_.some((entry) => entry.nodes.some((atom) => atom.type === "combinator"))) {
          throw new Error(`Complex :not() needs an explicit legacy DOM marker: ${node}`);
        }
        let variants = [[]];
        for (const argument of arguments_) {
          variants = variants.flatMap((prefix) => argument.nodes.map((atom) => {
            if (atom.type === "pseudo" && atom.value === ":not") return [...prefix, ...atom.nodes[0].nodes.map((part) => part.clone())];
            const not = parser.pseudo({ value: ":not" });
            const inner = parser.selector(); inner.append(atom.clone()); not.append(inner);
            return [...prefix, not];
          }));
        }
        // Blink83 rejects :not(:-webkit-any(...)), but accepts the equivalent
        // positive legacy-any around a compound of simple language negations.
        // Its specificity is one pseudo-class, preserving :dir()'s weight.
        if (variants.length === 1 && variants[0].length > 8 && variants[0].every((atom) =>
          atom.value === ":not" && atom.first?.nodes.length === 1 && atom.first.first.value === ":lang")) {
          const any = parser.pseudo({ value: ":-webkit-any" });
          const inner = parser.selector(); variants[0].forEach((atom) => inner.append(atom)); any.append(inner);
          variants = [[any]];
        }
        // A single simple negation already belongs to the CSS3 grammar.
        if (variants.length === 1 && variants[0].length === 1 && variants[0][0].toString() === node.toString()) continue;
        return variants.flatMap((replacement) => {
          const copy = selector.clone();
          const target = chain(copy.nodes);
          target.compounds[ci].splice(ni, 1, ...replacement);
          return expand(toSelector(target), depth + 1, insideNot);
        });
      }
      const rest = compound.filter((_, index) => index !== ni);
      const prefix = { compounds: value.compounds.slice(0, ci), edges: value.edges.slice(0, ci) };
      const suffix = { compounds: value.compounds.slice(ci + 1), edges: value.edges.slice(ci) };
      const branches = [];
      for (const entry of node.nodes) for (const argument of expand(entry, depth + 1, insideNot)) {
        const argumentChain = chain(argument.nodes);
        const merged = mergeCompound(rest, argumentChain.compounds.at(-1));
        if (!merged) continue;
        const argumentPrefix = { compounds: argumentChain.compounds.slice(0, -1), edges: argumentChain.edges };
        for (const unified of unifyPrefixes(prefix, argumentPrefix)) {
          const combined = { compounds: [...unified.compounds, merged, ...suffix.compounds], edges: [...unified.edges, ...suffix.edges] };
          branches.push(...expand(toSelector(combined), depth + 1, insideNot));
        }
      }
      if (branches.length > 4096) throw new Error(`Legacy selector expands excessively: ${selector}`);
      return branches;
    }
  }
  return [toSelector(value)];
}

const SENTINELS = [":not(#\\#)", ":not(.\\#)", ":not(yg-legacy-specificity)"];

function lowerSelectorList(text, originalWeight) {
  const original = parser().astSync(text);
  const output = new Map();
  for (const entry of original.nodes) {
    let hasRelationalSelector = false;
    entry.walkPseudos((node) => { if (node.value === ":has") hasRelationalSelector = true; });
    if (hasRelationalSelector) continue;
    const expected = (originalWeight || specificity(entry)).map((number, index) => number + SPECIFICITY_OFFSET[index]);
    for (const branch of expand(prepare(entry))) {
      const actual = specificity(branch);
      const padding = expected.map((number, index) => number - actual[index]);
      if (padding.some((number) => number < 0)) {
        throw new Error(`Legacy selector exceeds specificity budget ${SPECIFICITY_OFFSET}: ${entry} -> ${branch}`);
      }
      const element = branch.nodes.find(pseudoElement);
      padding.forEach((count, index) => {
        for (let i = 0; i < count; i++) {
          const sentinel = parser().astSync(SENTINELS[index]).first.first;
          if (element) branch.insertBefore(element, sentinel); else branch.append(sentinel);
        }
      });
      output.set(branch.toString(), branch);
    }
  }
  return [...output.keys()].join(",");
}

return { lowerSelectorList, specificity, SPECIFICITY_OFFSET };
}

module.exports = { createSelectorCompiler };
