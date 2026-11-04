export const PUBLIC_PULL_REFRESH_THRESHOLD = 56;
export const PUBLIC_PULL_REFRESH_MAX = 84;

export type PublicPullGesture =
  | { kind: "cancel" }
  | { kind: "pending" }
  | { kind: "pull"; distance: number; armed: boolean };

export function resolvePublicPullGesture(
  deltaX: number,
  deltaY: number,
  touchCount = 1
): PublicPullGesture {
  if (
    touchCount !== 1 ||
    !Number.isFinite(deltaX) ||
    !Number.isFinite(deltaY) ||
    deltaY < 0 ||
    Math.abs(deltaX) > Math.max(12, deltaY)
  )
    return { kind: "cancel" };
  if (deltaY < 8) return { kind: "pending" };
  const distance = Math.min(PUBLIC_PULL_REFRESH_MAX, deltaY * 0.48);
  return {
    kind: "pull",
    distance,
    armed: distance >= PUBLIC_PULL_REFRESH_THRESHOLD,
  };
}
