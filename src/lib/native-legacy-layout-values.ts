export type MarginSide = "top" | "right" | "bottom" | "left";

function words(value: string) {
  return value.match(/(?:[^\s()]+|\([^)]*\))+/g) ?? [];
}

export function legacyAspectRatio(value: string, naturalRatio?: number): number | null {
  if (/\bauto\b/.test(value) && naturalRatio && naturalRatio > 0) return naturalRatio;
  const ratio = /(?:^|\s)(\d*\.?\d+)(?:\s*\/\s*(\d*\.?\d+))?(?:\s|$)/.exec(value.replace(/\bauto\b/g, "").trim());
  if (!ratio) return null;
  const number = Number(ratio[1]) / Number(ratio[2] ?? 1);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function legacyMarginValue(values: Record<string, string>, side: MarginSide) {
  // The compiler supplies every shorthand and longhand in source order; the
  // runtime uses the resolved physical value where one exists.
  const direct = values[`margin-${side}`]?.trim();
  if (direct) return direct;
  const logical = { top: "block-start", bottom: "block-end", left: "inline-start", right: "inline-end" }[side];
  const individual = values[`margin-${logical}`]?.trim();
  if (individual) return individual;
  const pair = words(values[side === "left" || side === "right" ? "margin-inline" : "margin-block"] ?? "");
  if (pair.length) return pair[side === "right" || side === "bottom" ? Math.min(1, pair.length - 1) : 0];
  const shorthand = words(values.margin ?? "");
  return shorthand[{ top: 0, right: Math.min(1, shorthand.length - 1), bottom: shorthand.length >= 3 ? 2 : 0, left: shorthand.length === 4 ? 3 : Math.min(1, shorthand.length - 1) }[side]] ?? "";
}

export function legacyGapPixels(value: string, available: number) {
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return value.trim().endsWith("%") ? Number.isFinite(available) ? available * number / 100 : 0 : number;
}

export function oppositeSide(side: MarginSide): MarginSide {
  return { top: "bottom", bottom: "top", left: "right", right: "left" }[side] as MarginSide;
}

export function legacyGapMargin(authored: string, gap: number): string | null {
  let base = authored.trim();
  if (base === "auto") return null;
  if (!base || /^(?:initial|unset|revert|revert-layer)$/.test(base) || /^[+-]?(?:0+(?:\.0*)?|\.0+)$/.test(base)) base = "0px";
  return `calc(${base} + ${gap}px)`;
}

export function legacyLayoutScope<T>(node: T, parent: (current: T) => T | null, ownsStyles: (current: T) => boolean): T {
  let scope = node;
  while (ownsStyles(scope)) {
    const ancestor = parent(scope);
    if (!ancestor) break;
    scope = ancestor;
  }
  return scope;
}
