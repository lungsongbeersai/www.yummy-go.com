import { describe, expect, it } from "vitest";
import {
  PUBLIC_PULL_REFRESH_MAX,
  resolvePublicPullGesture,
} from "./pull-refresh-gesture";

describe("public pull-to-refresh gesture", () => {
  it("leaves taps and small vertical movements alone", () => {
    expect(resolvePublicPullGesture(2, 0)).toEqual({ kind: "pending" });
    expect(resolvePublicPullGesture(-4, 7)).toEqual({ kind: "pending" });
  });
  it("abandons horizontal, upward, multi-touch and invalid gestures", () => {
    for (const [x, y, touches] of [
      [45, 20, 1],
      [-100, 70, 1],
      [0, -1, 1],
      [0, 180, 2],
      [0, 180, 0],
      [0, Infinity, 1],
      [NaN, 80, 1],
    ] as const) {
      expect(resolvePublicPullGesture(x, y, touches)).toEqual({
        kind: "cancel",
      });
    }
  });
  it("resists the drag and only arms a deliberate downward pull", () => {
    const short = resolvePublicPullGesture(12, 80),
      ready = resolvePublicPullGesture(10, 130);
    expect(short.kind === "pull" && short.distance < 80 && !short.armed).toBe(
      true
    );
    expect(ready.kind === "pull" && ready.distance < 130 && ready.armed).toBe(
      true
    );
  });
  it("caps a long pull while retaining its armed state", () => {
    expect(resolvePublicPullGesture(0, 1000)).toEqual({
      kind: "pull",
      distance: PUBLIC_PULL_REFRESH_MAX,
      armed: true,
    });
  });
});
