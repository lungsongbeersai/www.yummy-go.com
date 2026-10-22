// Guilloché engraving for the dashboard's revenue plate — the woven security pattern printed on
// a Kip note. Generated once from closed parametric curves rather than shipped as an asset, so it
// costs one SVG raster and nothing per frame. All coordinates fit a -100..100 viewBox.

export interface GuillocheBand {
  /** Ripple depth around the band's base radius. */
  amplitude: number;
  /** Ripples per turn; an integer, so every strand closes on itself at 2π. */
  lobes: number;
  radius: number;
  /** Phase-shifted copies of the ripple; their crossings make the woven lattice. */
  strands: number;
}

export interface GuillocheOptions {
  bands: GuillocheBand[];
  /** Loops of the inner hypotrochoid rosette (integer R/r), 0 to omit it. */
  rosetteLoops: number;
  rosetteRadius: number;
  samples: number;
}

export const DEFAULT_GUILLOCHE: GuillocheOptions = {
  bands: [
    { amplitude: 6, lobes: 18, radius: 88, strands: 4 },
    { amplitude: 8, lobes: 12, radius: 63, strands: 4 },
  ],
  rosetteLoops: 7,
  rosetteRadius: 40,
  samples: 180,
};

type Point = readonly [number, number];

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function closedPath(points: Point[]) {
  const [first, ...rest] = points;
  return `M${round(first[0])} ${round(first[1])}${rest.map(([x, y]) => `L${round(x)} ${round(y)}`).join("")}Z`;
}

function bandStrands(band: GuillocheBand, samples: number) {
  return Array.from({ length: band.strands }, (_, strand) => {
    const phase = (2 * Math.PI * strand) / band.strands;
    const points = Array.from({ length: samples }, (_, index): Point => {
      const t = (2 * Math.PI * index) / samples;
      const r = band.radius + band.amplitude * Math.sin(band.lobes * t + phase);
      return [r * Math.cos(t), r * Math.sin(t)];
    });
    return closedPath(points);
  });
}

// Hypotrochoid with R/r = loops and the pen past the rolling circle's rim (d > r), which draws
// overlapping petals; an integer ratio closes the curve after one turn of t.
function rosette(loops: number, radius: number, samples: number) {
  const fixed = 1;
  const rolling = fixed / loops;
  const pen = rolling * 1.8;
  const scale = radius / (fixed - rolling + pen);
  const steps = samples * 2;
  const points = Array.from({ length: steps }, (_, index): Point => {
    const t = (2 * Math.PI * index) / steps;
    const ratio = (fixed - rolling) / rolling;
    return [
      scale * ((fixed - rolling) * Math.cos(t) + pen * Math.cos(ratio * t)),
      scale * ((fixed - rolling) * Math.sin(t) - pen * Math.sin(ratio * t)),
    ];
  });
  return closedPath(points);
}

export function buildGuillochePath(options: GuillocheOptions = DEFAULT_GUILLOCHE) {
  const strands = options.bands.flatMap((band) => bandStrands(band, options.samples));
  const center = options.rosetteLoops > 0 ? [rosette(options.rosetteLoops, options.rosetteRadius, options.samples)] : [];
  return [...strands, ...center].join("");
}
