export const LAK_ROUNDING_UNIT = 1000;

export function roundLak(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  return Math.round(amount / LAK_ROUNDING_UNIT) * LAK_ROUNDING_UNIT;
}
