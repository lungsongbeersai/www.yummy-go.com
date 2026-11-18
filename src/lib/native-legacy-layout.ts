import { legacyAspectRatio, legacyGapMargin, legacyGapPixels, legacyLayoutScope, legacyMarginValue, oppositeSide, type MarginSide } from "@/lib/native-legacy-layout-values";

interface OwnedValue { original: string; cssPriority: string; written: string }
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

/** Native-only, capability-tested layout support for the shop's WebView 83.
 * Uses existing flex items; never inserts React-unmanaged wrappers or changes
 * a container's background, border, width or hit target. */
export function installNativeLegacyLayout() {
  if (!document.documentElement.classList.contains("capacitor-android")) return () => {};
  const fixGap = !hasFlexGap();
  const fixAspect = !CSS.supports("aspect-ratio", "1");
  if (!fixGap && !fixAspect) return () => {};
  const owned = new Map<HTMLElement | SVGElement, OwnedStyles>();
  const lastStyles = new WeakMap<Element, string | null>();
  const dirty = new Set<Element>();
  const markedLight = new Set<Element>();
  const observed = new Set<Element>();
  let frame = 0;
  let stopped = false;

  function write(element: HTMLElement | SVGElement, property: string, value: string) {
    let properties = owned.get(element);
    if (!properties) { properties = new Map(); owned.set(element, properties); }
    let entry = properties.get(property);
    if (!entry) { entry = { original: element.style.getPropertyValue(property), cssPriority: element.style.getPropertyPriority(property), written: "" }; properties.set(property, entry); }
    if (element.style.getPropertyValue(property) !== value || element.style.getPropertyPriority(property) !== "important") element.style.setProperty(property, value, "important");
    entry.written = element.style.getPropertyValue(property);
  }
  function restore(element: HTMLElement | SVGElement, properties: OwnedStyles) {
    for (const [property, entry] of properties) {
      if (element.style.getPropertyValue(property) !== entry.written || element.style.getPropertyPriority(property) !== "important") {
        entry.original = element.style.getPropertyValue(property); entry.cssPriority = element.style.getPropertyPriority(property);
      }
      if (entry.original) element.style.setProperty(property, entry.original, entry.cssPriority);
      else element.style.removeProperty(property);
    }
  }
  function authoredMargin(element: HTMLElement | SVGElement, side: MarginSide) {
    const style = getComputedStyle(element);
    const authored = Object.fromEntries(MARGINS.map(property => [property, style.getPropertyValue(`--yg-layout-${property}`)]));
    for (const margin of ["top", "right", "bottom", "left"] as const) {
      const property = `margin-${margin}`;
      const entry = owned.get(element)?.get(property);
      const inline = entry ? entry.original : element.style.getPropertyValue(property);
      if (inline) authored[property] = inline;
    }
    return legacyMarginValue(authored, side);
  }
  function enqueue(element: Element) {
    if (stopped) return;
    dirty.add(element);
    if (!frame) frame = requestAnimationFrame(refresh);
  }
  const resize = new ResizeObserver(entries => { for (const entry of entries) enqueue(entry.target); });
  function watch(element: Element) { if (!observed.has(element)) { observed.add(element); resize.observe(element); } }
  function refresh() {
    frame = 0;
    const nodes = new Set<Element>();
    const scopes = [...new Set(Array.from(dirty).filter(root => root.isConnected).map(root => legacyLayoutScope<Element>(
      root === document.body ? root : root.parentElement ?? root,
      current => current === document.body ? null : current.parentElement,
      current => (current instanceof HTMLElement || current instanceof SVGElement) && owned.has(current),
    )))];
    for (const scope of scopes) {
      if (scopes.some(parent => parent !== scope && parent.contains(scope))) continue;
      // A parent's gap pass owns sibling margins, so restore and reapply the
      // same complete subtree. Partial coverage could strip an aspect-sized
      // sibling's height and alternate ResizeObserver updates indefinitely.
      // If the scope itself has a managed margin, include its outside owner as
      // well; otherwise changing a checkbox can silently remove its row gap.
      nodes.add(scope);
      for (const child of Array.from(scope.querySelectorAll("*"))) nodes.add(child);
    }
    dirty.clear();
    for (const element of observed) if (!element.isConnected) { resize.unobserve(element); observed.delete(element); }
    for (const element of markedLight) if (!element.isConnected) markedLight.delete(element);
    for (const [element, properties] of owned) {
      // Restore before reading authored/computed styles, including margins
      // changed by React since the preceding native fallback pass.
      if (!element.isConnected || nodes.has(element) || element.parentElement && nodes.has(element.parentElement)) {
        restore(element, properties); owned.delete(element);
      }
    }
    const flexes: Array<{ element: HTMLElement; style: CSSStyleDeclaration }> = [];
    for (const node of nodes) {
      const lightAncestor = Boolean(node.parentElement?.closest('[data-yg-theme="light"]'));
      if (lightAncestor && !node.hasAttribute("data-yg-legacy-light-ancestor")) { node.setAttribute("data-yg-legacy-light-ancestor", ""); markedLight.add(node); }
      else if (!lightAncestor && node.hasAttribute("data-yg-legacy-light-ancestor")) { node.removeAttribute("data-yg-legacy-light-ancestor"); markedLight.delete(node); }
      if (!(node instanceof HTMLElement)) continue;
      const style = getComputedStyle(node);
      if (style.display === "none") continue;
      if (fixAspect) {
        const ratio = legacyAspectRatio(node.style.aspectRatio || style.getPropertyValue("--yg-layout-aspect-ratio"), node instanceof HTMLImageElement && node.naturalHeight ? node.naturalWidth / node.naturalHeight : undefined);
        if (ratio) {
          const height = (node.style.getPropertyValue("height") || style.getPropertyValue("--yg-layout-height")).trim();
          const width = (node.style.getPropertyValue("width") || style.getPropertyValue("--yg-layout-width")).trim();
          const pixelHeight = Number.parseFloat(style.height);
          const pixelWidth = Number.parseFloat(style.width);
          if ((!width || width === "auto") && height && height !== "auto" && Number.isFinite(pixelHeight)) write(node, "width", `${pixelHeight * ratio}px`);
          else if ((!height || height === "auto") && Number.isFinite(pixelWidth)) write(node, "height", `${pixelWidth / ratio}px`);
          watch(node);
        }
      }
      if (fixGap && /^(inline-)?flex$/.test(style.display) && (Number.parseFloat(style.rowGap) > 0 || Number.parseFloat(style.columnGap) > 0)) flexes.push({ element: node, style });
    }
    for (const { element, style } of flexes) {
      const column = style.flexDirection.startsWith("column");
      const reverse = style.flexDirection.endsWith("reverse") !== (!column && style.direction === "rtl");
      const side: MarginSide = column ? reverse ? "bottom" : "top" : reverse ? "right" : "left";
      const gap = legacyGapPixels(column ? style.rowGap : style.columnGap, Number.parseFloat(column ? style.height : style.width));
      const children = Array.from(element.childNodes).filter(node => {
        if (node.nodeType === Node.TEXT_NODE) return Boolean(node.textContent?.trim());
        if (!(node instanceof HTMLElement || node instanceof SVGElement)) return false;
        const childStyle = getComputedStyle(node);
        return childStyle.display !== "none" && childStyle.display !== "contents" && !/^(absolute|fixed)$/.test(childStyle.position);
      }).sort((a, b) => (a instanceof Element ? Number.parseInt(getComputedStyle(a).order) || 0 : 0) - (b instanceof Element ? Number.parseInt(getComputedStyle(b).order) || 0 : 0));
      const additions = new Map<HTMLElement | SVGElement, Map<MarginSide, number>>();
      function add(node: Node, marginSide: MarginSide, amount: number) {
        if (!(node instanceof HTMLElement || node instanceof SVGElement)) return false;
        if (authoredMargin(node, marginSide) === "auto") return false;
        let margins = additions.get(node); if (!margins) { margins = new Map(); additions.set(node, margins); }
        margins.set(marginSide, (margins.get(marginSide) ?? 0) + amount);
        return true;
      }
      for (let index = 1; index < children.length; index++) if (gap && !add(children[index], side, gap)) add(children[index - 1], oppositeSide(side), gap);
      for (const [child, margins] of additions) {
        for (const [marginSide, amount] of margins) {
          // Read authored metadata, never the interpolated margin we wrote on
          // the previous frame. Even reduced-motion's 0.01ms transitions can
          // otherwise feed that old gap back into the next measurement.
          const margin = legacyGapMargin(authoredMargin(child, marginSide), amount);
          if (margin) write(child, `margin-${marginSide}`, margin);
        }
      }
      // Wrapped lines keep their item spacing. Add the cross-axis gap only
      // beyond the first line, without negative margins on painted containers.
      if (style.flexWrap !== "nowrap") {
        const crossReverse = style.flexWrap === "wrap-reverse";
        const crossSide: MarginSide = column ? (style.direction === "rtl") !== crossReverse ? "right" : "left" : crossReverse ? "bottom" : "top";
        const crossGap = legacyGapPixels(column ? style.columnGap : style.rowGap, Number.parseFloat(column ? style.width : style.height));
        const first = children.find(node => node instanceof Element) as Element | undefined;
        if (first && crossGap) {
          const firstRect = first.getBoundingClientRect();
          for (const child of children) {
            if (!(child instanceof HTMLElement || child instanceof SVGElement)) continue;
            const rect = child.getBoundingClientRect();
            const beyondFirst = column ? rect.left >= firstRect.right - 1 || rect.right <= firstRect.left + 1 : crossReverse ? rect.bottom <= firstRect.top + 1 : rect.top >= firstRect.bottom - 1;
            if (beyondFirst) { const margin = legacyGapMargin(authoredMargin(child, crossSide), crossGap); if (margin) write(child, `margin-${crossSide}`, margin); }
          }
        }
      }
      watch(element);
    }
    for (const node of nodes) if (node instanceof Element) lastStyles.set(node, node.getAttribute("style"));
    for (const element of owned.keys()) lastStyles.set(element, element.getAttribute("style"));
  }
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (!(record.target instanceof Element)) continue;
      if (record.type === "attributes" && record.attributeName === "style" && lastStyles.get(record.target) === record.target.getAttribute("style")) continue;
      enqueue(record.target);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden", "width", "height", "dir", "data-yg-theme", "data-state", "data-checked", "data-selected", "aria-expanded", "aria-checked", "aria-selected", "disabled"] });
  const onResize = () => enqueue(document.body);
  window.addEventListener("resize", onResize);
  enqueue(document.body);
  return () => {
    stopped = true; observer.disconnect(); resize.disconnect(); window.removeEventListener("resize", onResize);
    if (frame) cancelAnimationFrame(frame);
    for (const [element, properties] of owned) restore(element, properties);
    for (const element of markedLight) element.removeAttribute("data-yg-legacy-light-ancestor");
    owned.clear(); dirty.clear(); markedLight.clear(); observed.clear();
  };
}
