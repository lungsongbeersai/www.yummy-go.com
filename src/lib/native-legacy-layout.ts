import { legacyAspectRatio, legacyBodyLayoutStyleSignature, legacyGapMargin, legacyGapPixels, legacyLayoutRoots, legacyMarginValue, oppositeSide, type MarginSide } from "@/lib/native-legacy-layout-values";

type StyledElement = HTMLElement | SVGElement;
interface OwnedValue { owner: Element; original: string; cssPriority: string; written: string; requested: string; crossAxis: boolean }
interface PlannedValue { owner: Element; value: string; crossAxis: boolean }
type OwnedStyles = Map<string, OwnedValue>;
const MARGINS = ["margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "margin-inline", "margin-block", "margin-inline-start", "margin-inline-end", "margin-block-start", "margin-block-end"];

function hasFlexGap() {
  const flex = document.createElement("div");
  flex.style.cssText = "position:absolute;visibility:hidden;display:flex;flex-direction:column;row-gap:1px;top:-10000px";
  for (let index = 0; index < 2; index++) { const item = document.createElement("div"); item.style.height = "1px"; flex.appendChild(item); }
  document.body.appendChild(flex);
  const supported = flex.scrollHeight === 3;
  flex.remove();
  return supported;
}

/** Native-only support for engines without flex gaps and aspect-ratio.
 * Each flex/aspect owner updates only its own styles. Opening a portal must not
 * restore, remeasure and rewrite every product already visible behind it. */
export function installNativeLegacyLayout() {
  if (!document.documentElement.classList.contains("capacitor-android")) return () => {};
  const fixGap = !hasFlexGap();
  const fixAspect = !CSS.supports("aspect-ratio", "1");
  if (!fixGap && !fixAspect) return () => {};
  const owned = new Map<StyledElement, OwnedStyles>();
  const lastStyles = new WeakMap<Element, string | null>();
  const dirty = new Set<Element>();
  const dirtySubtrees = new Set<Element>();
  const markedLight = new Set<Element>();
  const observed = new Set<Element>();
  let frame = 0;
  let stopped = false;
  function bodyLayoutStyleSignature() {
    const style = document.body.style;
    return legacyBodyLayoutStyleSignature(Array.from(style, property =>
      [property, style.getPropertyValue(property), style.getPropertyPriority(property)] as const));
  }
  let bodyLayoutStyle = bodyLayoutStyleSignature();

  function currentOriginal(element: StyledElement, property: string, entry: OwnedValue) {
    if (element.style.getPropertyValue(property) !== entry.written || element.style.getPropertyPriority(property) !== "important") {
      entry.original = element.style.getPropertyValue(property);
      entry.cssPriority = element.style.getPropertyPriority(property);
    }
  }
  function restore(element: StyledElement, property: string, entry: OwnedValue) {
    currentOriginal(element, property, entry);
    if (element.style.getPropertyValue(property) !== entry.original || element.style.getPropertyPriority(property) !== entry.cssPriority) {
      if (entry.original) element.style.setProperty(property, entry.original, entry.cssPriority);
      else element.style.removeProperty(property);
    }
    lastStyles.set(element, element.getAttribute("style"));
  }
  function enqueue(element: Element, subtree = false) {
    if (stopped) return;
    dirty.add(element);
    if (subtree) dirtySubtrees.add(element);
    if (!frame) frame = requestAnimationFrame(refresh);
  }
  const resize = new ResizeObserver(entries => {
    // Descendant flex/aspect owners receive their own size notifications.
    for (const entry of entries) enqueue(entry.target);
  });
  function watch(element: Element) {
    if (!observed.has(element)) { observed.add(element); resize.observe(element); }
  }
  function refresh() {
    frame = 0;
    const nodes = new Set(Array.from(dirty).filter(node => node.isConnected));
    const roots = legacyLayoutRoots(Array.from(dirtySubtrees).filter(node => node.isConnected), node => node.parentElement);
    for (const root of roots) for (const child of Array.from(root.querySelectorAll("*"))) nodes.add(child);
    dirty.clear(); dirtySubtrees.clear();
    for (const element of observed) if (!element.isConnected) { resize.unobserve(element); observed.delete(element); }
    for (const element of markedLight) if (!element.isConnected) markedLight.delete(element);

    // Old cross-axis margins move a formerly wrapped item below its new row.
    // Measure row membership without only those margins, in one local batch.
    // Main-axis gaps and owners outside this refresh remain untouched.
    const temporaryCrossRestores = new Set<OwnedValue>();
    for (const [element, properties] of owned) {
      for (const [property, entry] of properties) {
        if (entry.crossAxis && nodes.has(entry.owner)) {
          restore(element, property, entry);
          temporaryCrossRestores.add(entry);
        }
      }
    }

    // Group marker writes before reads; interleaving them reruns the old
    // engine's large compatibility cascade separately for every element.
    for (const node of nodes) {
      const lightAncestor = Boolean(node.parentElement?.closest('[data-yg-theme="light"]'));
      if (lightAncestor && !node.hasAttribute("data-yg-legacy-light-ancestor")) { node.setAttribute("data-yg-legacy-light-ancestor", ""); markedLight.add(node); }
      else if (!lightAncestor && node.hasAttribute("data-yg-legacy-light-ancestor")) { node.removeAttribute("data-yg-legacy-light-ancestor"); markedLight.delete(node); }
    }
    const styles = new Map<Element, CSSStyleDeclaration>();
    const margins = new Map<StyledElement, Record<string, string>>();
    const planned = new Map<StyledElement, Map<string, PlannedValue>>();
    const processedOwners = new Set<Element>();
    const wrappedOwners = new Set<Element>();
    function styleOf(element: Element) {
      let style = styles.get(element);
      if (!style) { style = getComputedStyle(element); styles.set(element, style); }
      return style;
    }
    function inlineValue(element: StyledElement, property: string) {
      const entry = owned.get(element)?.get(property);
      if (!entry) return element.style.getPropertyValue(property);
      currentOriginal(element, property, entry);
      return entry.original;
    }
    function authoredMargin(element: StyledElement, side: MarginSide) {
      let values = margins.get(element);
      if (!values) {
        const style = styleOf(element);
        values = Object.fromEntries(MARGINS.map(property => [property, style.getPropertyValue(`--yg-layout-${property}`)]));
        for (const margin of ["top", "right", "bottom", "left"] as const) {
          const property = `margin-${margin}`;
          const inline = inlineValue(element, property);
          if (inline) values[property] = inline;
        }
        margins.set(element, values);
      }
      return legacyMarginValue(values, side);
    }
    function plan(owner: Element, element: StyledElement, property: string, value: string, crossAxis = false) {
      let values = planned.get(element);
      if (!values) { values = new Map(); planned.set(element, values); }
      values.set(property, { owner, value, crossAxis });
    }
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      processedOwners.add(node);
      const style = styleOf(node);
      if (style.display === "none") continue;
      if (fixAspect) {
        const ratio = legacyAspectRatio(node.style.aspectRatio || style.getPropertyValue("--yg-layout-aspect-ratio"), node instanceof HTMLImageElement && node.naturalHeight ? node.naturalWidth / node.naturalHeight : undefined);
        if (ratio) {
          const height = (inlineValue(node, "height") || style.getPropertyValue("--yg-layout-height")).trim();
          const width = (inlineValue(node, "width") || style.getPropertyValue("--yg-layout-width")).trim();
          const pixelHeight = Number.parseFloat(style.height);
          const pixelWidth = Number.parseFloat(style.width);
          if ((!width || width === "auto") && height && height !== "auto" && Number.isFinite(pixelHeight)) plan(node, node, "width", `${pixelHeight * ratio}px`);
          else if ((!height || height === "auto") && Number.isFinite(pixelWidth)) plan(node, node, "height", `${pixelWidth / ratio}px`);
          watch(node);
        }
      }
      if (!fixGap || !/^(inline-)?flex$/.test(style.display) || !(Number.parseFloat(style.rowGap) > 0 || Number.parseFloat(style.columnGap) > 0)) continue;
      const column = style.flexDirection.startsWith("column");
      const reverse = style.flexDirection.endsWith("reverse") !== (!column && style.direction === "rtl");
      const side: MarginSide = column ? reverse ? "bottom" : "top" : reverse ? "right" : "left";
      const gap = legacyGapPixels(column ? style.rowGap : style.columnGap, Number.parseFloat(column ? style.height : style.width));
      const children = Array.from(node.childNodes).filter(child => {
        if (child.nodeType === Node.TEXT_NODE) return Boolean(child.textContent?.trim());
        if (!(child instanceof HTMLElement || child instanceof SVGElement)) return false;
        const childStyle = styleOf(child);
        return childStyle.display !== "none" && childStyle.display !== "contents" && !/^(absolute|fixed)$/.test(childStyle.position);
      }).map(child => ({ node: child, order: child instanceof Element ? Number.parseInt(styleOf(child).order) || 0 : 0 }))
        .sort((a, b) => a.order - b.order).map(child => child.node);
      const additions = new Map<StyledElement, Map<MarginSide, number>>();
      function add(child: Node, marginSide: MarginSide, amount: number) {
        if (!(child instanceof HTMLElement || child instanceof SVGElement)) return false;
        if (authoredMargin(child, marginSide) === "auto") return false;
        let values = additions.get(child);
        if (!values) { values = new Map(); additions.set(child, values); }
        values.set(marginSide, (values.get(marginSide) ?? 0) + amount);
        return true;
      }
      for (let index = 1; index < children.length; index++) if (gap && !add(children[index], side, gap)) add(children[index - 1], oppositeSide(side), gap);
      for (const [child, values] of additions) {
        for (const [marginSide, amount] of values) {
          const margin = legacyGapMargin(authoredMargin(child, marginSide), amount);
          if (margin) plan(node, child, `margin-${marginSide}`, margin);
        }
      }
      if (style.flexWrap !== "nowrap") {
        wrappedOwners.add(node);
        const crossReverse = style.flexWrap === "wrap-reverse";
        const crossSide: MarginSide = column ? (style.direction === "rtl") !== crossReverse ? "right" : "left" : crossReverse ? "bottom" : "top";
        const crossGap = legacyGapPixels(column ? style.columnGap : style.rowGap, Number.parseFloat(column ? style.width : style.height));
        const first = children.find(child => child instanceof Element) as Element | undefined;
        if (first && crossGap) {
          const firstRect = first.getBoundingClientRect();
          for (const child of children) {
            if (!(child instanceof HTMLElement || child instanceof SVGElement)) continue;
            const rect = child.getBoundingClientRect();
            const beyondFirst = column ? rect.left >= firstRect.right - 1 || rect.right <= firstRect.left + 1 : crossReverse ? rect.bottom <= firstRect.top + 1 : rect.top >= firstRect.bottom - 1;
            if (beyondFirst) {
              const margin = legacyGapMargin(authoredMargin(child, crossSide), crossGap);
              if (margin) plan(node, child, `margin-${crossSide}`, margin, true);
            }
          }
        }
      }
      watch(node);
    }

    // Reads above are complete. Keep unchanged declarations in place; release
    // a declaration only when its own layout no longer needs it.
    const changedOwners = new Set<Element>();
    for (const [element, properties] of owned) {
      for (const [property, entry] of properties) {
        if (element.isConnected && entry.owner.isConnected && !processedOwners.has(entry.owner)) continue;
        const next = planned.get(element)?.get(property);
        if (element.isConnected && next?.owner === entry.owner) continue;
        restore(element, property, entry);
        properties.delete(property); changedOwners.add(entry.owner);
      }
      if (!properties.size) owned.delete(element);
    }
    for (const [element, values] of planned) {
      let properties = owned.get(element);
      if (!properties) { properties = new Map(); owned.set(element, properties); }
      for (const [property, next] of values) {
        let entry = properties.get(property);
        if (!entry) {
          entry = { owner: next.owner, original: element.style.getPropertyValue(property), cssPriority: element.style.getPropertyPriority(property), written: "", requested: "", crossAxis: next.crossAxis };
          properties.set(property, entry);
        } else currentOriginal(element, property, entry);
        // CSSOM can normalize calc()/fractional pixels. Compare both the last
        // request and its serialized result instead of rewriting it forever.
        if (entry.requested !== next.value || element.style.getPropertyValue(property) !== entry.written || element.style.getPropertyPriority(property) !== "important") {
          element.style.setProperty(property, next.value, "important");
          if (!temporaryCrossRestores.has(entry) || entry.requested !== next.value) changedOwners.add(next.owner);
        }
        entry.owner = next.owner; entry.requested = next.value; entry.crossAxis = next.crossAxis; entry.written = element.style.getPropertyValue(property);
      }
      lastStyles.set(element, element.getAttribute("style"));
    }
    // A changed main-axis margin may wrap items without resizing a fixed
    // container. Recheck only that owner until its margins settle.
    for (const owner of changedOwners) if (owner.isConnected && wrappedOwners.has(owner)) enqueue(owner);
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (!(record.target instanceof Element)) continue;
      if (record.type === "childList") {
        enqueue(record.target);
        for (const node of Array.from(record.addedNodes)) if (node instanceof Element) enqueue(node, true);
        continue;
      }
      if (record.attributeName === "style" && lastStyles.get(record.target) === record.target.getAttribute("style")) continue;
      if (record.attributeName === "style" && record.target === document.body) {
        const nextBodyLayoutStyle = bodyLayoutStyleSignature();
        const layoutChanged = nextBodyLayoutStyle !== bodyLayoutStyle;
        bodyLayoutStyle = nextBodyLayoutStyle;
        // Opening a real Radix modal locks body pointer events. That must not
        // rescan the product catalog behind it. Padding, width, font and all
        // other declarations still retain the existing conservative refresh.
        if (!layoutChanged) continue;
      }
      enqueue(record.target, true);
      if (record.target.parentElement) enqueue(record.target.parentElement);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden", "width", "height", "dir", "data-yg-theme", "data-state", "data-checked", "data-selected", "aria-expanded", "aria-checked", "aria-selected", "disabled"] });
  const rootObserver = new MutationObserver(() => enqueue(document.body, true));
  rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-font-scale", "data-lao-font", "dir"] });
  const onResize = () => enqueue(document.body, true);
  window.addEventListener("resize", onResize);
  enqueue(document.body, true);
  return () => {
    stopped = true; observer.disconnect(); rootObserver.disconnect(); resize.disconnect(); window.removeEventListener("resize", onResize);
    if (frame) cancelAnimationFrame(frame);
    for (const [element, properties] of owned) for (const [property, entry] of properties) restore(element, property, entry);
    for (const element of markedLight) element.removeAttribute("data-yg-legacy-light-ancestor");
    owned.clear(); dirty.clear(); dirtySubtrees.clear(); markedLight.clear(); observed.clear();
  };
}
