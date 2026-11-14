const widthMm = 210;
const heightMm = 297;
const horizontalMarginMm = 8;
const verticalMarginMm = 14;

// Preview, browser printing and PDF export must use the same physical content box.
export const COMMERCIAL_PAPER = Object.freeze({
  widthMm,
  heightMm,
  horizontalMarginMm,
  verticalMarginMm,
  contentWidthMm: widthMm - horizontalMarginMm * 2,
  contentHeightMm: heightMm - verticalMarginMm * 2,
});

export function commercialContentHeightForWidth(widthPx: number): number {
  const heightPx = widthPx * (COMMERCIAL_PAPER.contentHeightMm / COMMERCIAL_PAPER.contentWidthMm);
  if (!Number.isFinite(widthPx) || widthPx <= 0 || !Number.isFinite(heightPx) || heightPx <= 0) {
    throw new RangeError("The commercial paper content width must be finite and positive");
  }
  return heightPx;
}
