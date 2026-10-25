import { describe, expect, it } from "vitest";
import { buildGuillochePath, DEFAULT_GUILLOCHE } from "./dashboard-engraving";

function subpaths(path: string) {
  return path.split("M").filter(Boolean).map((part) => `M${part}`);
}

function coordinates(subpath: string) {
  return Array.from(subpath.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g), (match) => [
    Number(match[1]),
    Number(match[2]),
  ]);
}

describe("buildGuillochePath", () => {
  it("is deterministic", () => {
    expect(buildGuillochePath()).toBe(buildGuillochePath());
  });

  it("draws every band strand plus the rosette as closed subpaths", () => {
    const strandCount = DEFAULT_GUILLOCHE.bands.reduce((sum, band) => sum + band.strands, 0);
    const parts = subpaths(buildGuillochePath());

    expect(parts).toHaveLength(strandCount + 1);
    parts.forEach((part) => expect(part.endsWith("Z")).toBe(true));
  });

  it("keeps every point inside the -100..100 viewBox", () => {
    const points = subpaths(buildGuillochePath()).flatMap(coordinates);

    expect(points.length).toBeGreaterThan(1000);
    points.forEach(([x, y]) => {
      expect(Math.abs(x)).toBeLessThanOrEqual(100);
      expect(Math.abs(y)).toBeLessThanOrEqual(100);
    });
  });

  it("omits the rosette when asked", () => {
    const parts = subpaths(buildGuillochePath({ ...DEFAULT_GUILLOCHE, rosetteLoops: 0 }));
    expect(parts).toHaveLength(8);
  });
});
