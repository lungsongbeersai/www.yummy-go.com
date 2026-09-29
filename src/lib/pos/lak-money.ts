export const LAK_ROUNDING_UNIT = 1000;
export const LAK_ROUNDING_VERSION = {
  UNROUNDED: 1,
  NEAREST_1000: 2
} as const;

export function roundLak(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  return Math.round(amount / LAK_ROUNDING_UNIT) * LAK_ROUNDING_UNIT;
}

export function roundLakToUnit(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  return Math.round(amount);
}

export function normalizeLakRoundingVersion(value: unknown) {
  return Number(value) === LAK_ROUNDING_VERSION.NEAREST_1000
    ? LAK_ROUNDING_VERSION.NEAREST_1000
    : LAK_ROUNDING_VERSION.UNROUNDED;
}

export function roundLakForVersion(value: unknown) {
  return normalizeLakRoundingVersion(value) === LAK_ROUNDING_VERSION.NEAREST_1000
    ? roundLak
    : roundLakToUnit;
}
