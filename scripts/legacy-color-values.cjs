const MODERN_COLOR_FUNCTION = /^(?:color-mix|oklch|oklab|lab|lch|color)$/i;

function closingParenthesis(value, start) {
  let depth = 0;
  let quote = "";
  for (let index = start; index < value.length; index++) {
    const character = value[index];
    if (character === "\\") { index++; continue; }
    if (quote) { if (character === quote) quote = ""; continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === "(") depth++;
    else if (character === ")" && --depth === 0) return index;
  }
  return -1;
}

function splitArguments(value) {
  const values = [];
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "(") index = closingParenthesis(value, index);
    if (index < 0) return [];
    if (value[index] === ",") { values.push(value.slice(start, index).trim()); start = index + 1; }
  }
  values.push(value.slice(start).trim());
  return values;
}

function alphaNumber(value = "1") {
  return value.endsWith("%") ? Number.parseFloat(value) / 100 : Number(value);
}

function parseHex(value) {
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value);
  if (!hex) return null;
  const digits = hex[1].length <= 4 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1];
  return {
    channels: [0, 2, 4].map((offset) => String(Number.parseInt(digits.slice(offset, offset + 2), 16))),
    alpha: digits.length === 8 ? String(Number.parseInt(digits.slice(6), 16) / 255) : "1",
  };
}

function parseRgb(value) {
  const rgb = /^rgba?\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(value);
  if (!rgb) return null;
  return {
    channels: rgb.slice(1, 4).map((channel) => String(channel.endsWith("%") ? Number.parseFloat(channel) * 2.55 : Number(channel))),
    alpha: String(alphaNumber(rgb[4])),
  };
}

function colorStop(value) {
  const weighted = /^(.*\S)\s+([\d.]+%|var\(--[\w-]+(?:,\s*[^)]+)?\))$/.exec(value);
  if (!weighted) return { color: value, weight: null };
  return { color: weighted[1], weight: weighted[2] };
}

function multiply(left, right) {
  if (left === "0" || right === "0") return "0";
  if (left === "1") return right;
  if (right === "1") return left;
  return `calc(${left} * ${right})`;
}

function decimal(value) { return String(Number(value.toFixed(8))); }

function mixColors(left, right, leftWeight, rightWeight) {
  // Variable percentages occur in Tailwind's nested shadow-opacity mix. An
  // alpha value may be a percentage, so preserve its unit instead of dividing
  // by 100% (typed division is unavailable in the target WebViews).
  if (typeof leftWeight === "string" || typeof rightWeight === "string") {
    if (right.alpha === "0" && rightWeight === null && typeof leftWeight === "string") {
      const weight = leftWeight.replace(/^var\((--[\w-]+)\)$/, "var($1, 100%)");
      return { channels: left.channels, alpha: multiply(left.alpha, weight) };
    }
    return null;
  }
  const a = leftWeight ?? (rightWeight === null ? 0.5 : 1 - rightWeight);
  const b = rightWeight ?? (leftWeight === null ? 0.5 : 1 - leftWeight);
  const total = a + b;
  if (a < 0 || b < 0 || total <= 0) return null;
  const multiplier = decimal(Math.min(total, 1));
  const leftAlpha = multiply(left.alpha, decimal(a / total));
  const rightAlpha = multiply(right.alpha, decimal(b / total));
  if (right.alpha === "0") return { channels: left.channels, alpha: multiply(leftAlpha, multiplier) };
  if (left.alpha === "0") return { channels: right.channels, alpha: multiply(rightAlpha, multiplier) };
  const alpha = `calc(${leftAlpha} + ${rightAlpha})`;
  return {
    // Premultiplied alpha avoids dark fringes and preserves translucent tokens.
    // Dynamic perceptual mixes use a deterministic sRGB approximation; static
    // modern colors are converted in their original color space by Lightning CSS.
    channels: left.channels.map((channel, index) =>
      `calc((${channel} * ${leftAlpha} + ${right.channels[index]} * ${rightAlpha}) / max(0.000001, ${alpha}))`
    ),
    alpha: multiply(alpha, multiplier),
  };
}

function rgba(color) { return `rgba(${color.channels.join(", ")}, ${color.alpha})`; }

module.exports.createColorCompiler = function createColorCompiler(transform) {
  const staticColors = new Map();
  function staticColor(value) {
    if (staticColors.has(value)) return staticColors.get(value);
    let result = parseHex(value) || parseRgb(value);
    if (!result && !/\bvar\(|currentcolor|\bfrom\b/i.test(value)) {
      try {
        const css = new TextDecoder().decode(transform({
          filename: "legacy-color.css",
          code: new TextEncoder().encode(`a{color:${value}}`),
          targets: { chrome: 88 << 16 },
          minify: true,
        }).code);
        const declaration = /(?:^|[;{])color:([^;}]+)/.exec(css);
        if (declaration) result = parseHex(declaration[1]) || parseRgb(declaration[1]);
        // Keep authored alpha precision; 50% must remain 0.5 rather than 128/255.
        const alpha = /\/\s*([\d.]+%?)\s*\)$/.exec(value);
        if (result && alpha && !value.startsWith("color-mix(")) result.alpha = String(alphaNumber(alpha[1]));
        const legacyHslAlpha = /^hsla\([^,]+,[^,]+,[^,]+,\s*([\d.]+%?)\s*\)$/i.exec(value);
        if (result && legacyHslAlpha) result.alpha = String(alphaNumber(legacyHslAlpha[1]));
      } catch { /* A non-color custom property is expected to fail color parsing. */ }
    }
    staticColors.set(value, result);
    return result;
  }

  function colorChannels(value, tokens) {
    value = value.trim();
    const literal = staticColor(value);
    if (literal) return literal;
    const alias = /^var\(--([\w-]+)\)$/.exec(value);
    if (alias && tokens.has(alias[1])) return {
      channels: ["r", "g", "b"].map((channel) => `var(--legacy-${alias[1]}-${channel})`),
      alpha: `var(--legacy-${alias[1]}-alpha)`,
    };
    if (!value.startsWith("color-mix(") || !value.endsWith(")")) return null;
    const arguments_ = splitArguments(value.slice(10, -1));
    if (arguments_.length !== 3 || !/^in (?:srgb|oklab|oklch)(?:\s|$)/.test(arguments_[0])) return null;
    const left = colorStop(arguments_[1]);
    const right = colorStop(arguments_[2]);
    const leftColor = colorChannels(left.color, tokens);
    const rightColor = colorChannels(right.color, tokens);
    if (!leftColor || !rightColor) return null;
    const weight = (value) => value === null ? null : value.endsWith("%") ? alphaNumber(value) : value;
    return mixColors(leftColor, rightColor, weight(left.weight), weight(right.weight));
  }

  function transformValue(value, tokens) {
    let output = "";
    let index = 0;
    while (index < value.length) {
      const quote = value[index];
      if (quote === '"' || quote === "'") {
        let end = index + 1;
        while (end < value.length) {
          if (value[end] === "\\") { end += 2; continue; }
          if (value[end++] === quote) break;
        }
        output += value.slice(index, end); index = end; continue;
      }
      const function_ = /^([a-z-]+)\(/i.exec(value.slice(index));
      if (!function_) { output += value[index++]; continue; }
      const open = index + function_[1].length;
      const end = closingParenthesis(value, open);
      if (end < 0) return value;
      const original = value.slice(index, end + 1);
      const converted = MODERN_COLOR_FUNCTION.test(function_[1]) ? colorChannels(original, tokens) : null;
      output += converted ? rgba(converted) : `${function_[1]}(${transformValue(value.slice(open + 1, end), tokens)})`;
      index = end + 1;
    }
    return output;
  }

  return { colorChannels, transformValue, rgba };
};
