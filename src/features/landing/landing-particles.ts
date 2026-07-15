import type { CSSProperties } from "react";

const PARTICLE_COUNT = 22;
const PARTICLE_DECIMAL_PLACES = 4;

function normalizeParticleValue(value: number): number {
  return Number(value.toFixed(PARTICLE_DECIMAL_PLACES));
}

function particleCssValue(value: number, unit: "%" | "px" | "s"): string {
  return `${normalizeParticleValue(value)}${unit}`;
}

export function createParticleStyles(): CSSProperties[] {
  const styles: CSSProperties[] = [];

  for (let index = 0; index < PARTICLE_COUNT; index++) {
    const random = (seed: number) => {
      const value = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
      return value - Math.floor(value);
    };
    const size = normalizeParticleValue(2 + random(3) * 3);

    // CSSOM ปัดเลขทศนิยมยาวก่อน hydration จึง normalize ค่าให้ server และ client ตรงกันตั้งแต่ต้น
    styles.push({
      left: particleCssValue(random(1) * 100, "%"),
      top: particleCssValue(random(2) * 100, "%"),
      width: `${size}px`,
      height: `${size}px`,
      opacity: normalizeParticleValue(0.2 + random(6) * 0.5),
      animationDuration: particleCssValue(8 + random(5) * 10, "s"),
      animationDelay: particleCssValue(-random(4) * 12, "s")
    });
  }

  return styles;
}
