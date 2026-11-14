import { describe, expect, it } from "vitest";
import { COMMERCIAL_PAPER, commercialContentHeightForWidth } from "./commercial-paper";

describe("commercial A4 paper geometry", () => {
  it("keeps the content box inside A4 with narrower symmetric side margins", () => {
    const paper = COMMERCIAL_PAPER;
    expect([paper.widthMm, paper.heightMm]).toEqual([210, 297]);
    expect(paper.horizontalMarginMm).toBe(8);
    expect(paper.verticalMarginMm).toBe(14);
    expect(paper.contentWidthMm).toBe(194);
    expect(paper.contentHeightMm).toBe(269);
    expect(paper.horizontalMarginMm * 2 + paper.contentWidthMm).toBe(paper.widthMm);
    expect(paper.verticalMarginMm * 2 + paper.contentHeightMm).toBe(paper.heightMm);
    expect(Object.isFrozen(paper)).toBe(true);
  });

  it("fits the same physical content height at different measured browser scales", () => {
    for (const scale of [0.5, 1, 96 / 25.4, 3.125]) {
      expect(commercialContentHeightForWidth(COMMERCIAL_PAPER.contentWidthMm * scale))
        .toBeCloseTo(COMMERCIAL_PAPER.contentHeightMm * scale, 8);
    }
  });

  it("rejects missing, nonfinite and overflowing measurements before pagination", () => {
    for (const width of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_VALUE]) {
      expect(() => commercialContentHeightForWidth(width)).toThrow(RangeError);
    }
  });
});
