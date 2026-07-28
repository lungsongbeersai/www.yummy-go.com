import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_SCALE_MIN,
  EMPTY_FPS_SAMPLE,
  getAdaptiveScale,
  getFrameDelta,
  MAX_FRAME_DELTA_SECONDS,
  pushFpsSample,
  type FpsSample
} from "@/features/landing/scene-performance";

describe("getFrameDelta", () => {
  it("never skips a frame — the renderer follows the display refresh rate", () => {
    const at60 = getFrameDelta(1_016.7, 1_000);
    const at120 = getFrameDelta(1_008.3, 1_000);
    const at144 = getFrameDelta(1_006.9, 1_000);

    expect(at60.deltaSeconds).toBeCloseTo(0.0167, 4);
    expect(at120.deltaSeconds).toBeCloseTo(0.0083, 4);
    expect(at144.deltaSeconds).toBeCloseTo(0.0069, 4);
    // frameTime คือ now เสมอ ไม่มีการหักเศษเพื่อจัดเข้ากรอบ fps อีกแล้ว
    expect(at144.frameTime).toBe(1_006.9);
  });

  it("clamps the animation delta when the tab comes back from the background", () => {
    const resumed = getFrameDelta(9_000, 1_000);
    expect(resumed.deltaSeconds).toBe(MAX_FRAME_DELTA_SECONDS);
    // ค่าดิบยังเก็บเวลาจริงไว้ให้ตัววัด FPS ใช้
    expect(resumed.rawSeconds).toBe(8);
  });

  it("starts from zero on the first frame and on a clock that went backwards", () => {
    expect(getFrameDelta(1_000, null)).toEqual({ frameTime: 1_000, deltaSeconds: 0, rawSeconds: 0 });
    expect(getFrameDelta(900, 1_000).deltaSeconds).toBe(0);
  });
});

describe("pushFpsSample", () => {
  // เดินเฟรมจนกว่าหน้าต่างวัดจะปิด — ไม่ผูกกับจำนวนเฟรมเป๊ะๆ เพราะเวลาสะสมเป็น float
  const runUntilSettled = (frameSeconds: number, windowSeconds?: number): FpsSample => {
    let sample: FpsSample = EMPTY_FPS_SAMPLE;
    for (let index = 0; index < 10_000 && !sample.settled; index++) {
      sample = pushFpsSample(sample, frameSeconds, windowSeconds);
    }
    return sample;
  };

  it("measures the real frame rate at 60, 120 and 144Hz", () => {
    expect(runUntilSettled(1 / 60).fps).toBe(60);
    expect(runUntilSettled(1 / 120).fps).toBe(120);
    expect(runUntilSettled(1 / 144).fps).toBe(144);
  });

  it("reports nothing until the first window closes", () => {
    const partial = pushFpsSample(EMPTY_FPS_SAMPLE, 1 / 60);
    expect(partial.settled).toBe(false);
    expect(partial.fps).toBe(0);
    expect(partial.frames).toBe(1);
  });

  it("resets the counters after every settled window", () => {
    const settled = runUntilSettled(1 / 60);
    expect(settled.settled).toBe(true);
    expect(settled.frames).toBe(0);
    expect(settled.elapsedSeconds).toBe(0);
  });

  it("takes about half a second to settle by default, and honours a custom window", () => {
    let sample: FpsSample = EMPTY_FPS_SAMPLE;
    let frames = 0;
    while (!sample.settled) {
      sample = pushFpsSample(sample, 1 / 60);
      frames += 1;
    }
    expect(frames).toBeGreaterThanOrEqual(30);
    expect(frames).toBeLessThanOrEqual(31);
    expect(runUntilSettled(1 / 60, 2).fps).toBe(60);
  });
});

describe("getAdaptiveScale", () => {
  it("scales down when the frame rate collapses, down to the floor", () => {
    expect(getAdaptiveScale(1, 24)).toBe(0.85);

    let scale = 1;
    for (let index = 0; index < 20; index++) scale = getAdaptiveScale(scale, 24);
    expect(scale).toBe(ADAPTIVE_SCALE_MIN);
  });

  it("recovers back to full resolution once the frame rate is healthy", () => {
    let scale = 0.6;
    for (let index = 0; index < 20; index++) scale = getAdaptiveScale(scale, 120);
    expect(scale).toBe(1);
  });

  it("holds steady inside the hysteresis band so the buffer is not resized back and forth", () => {
    expect(getAdaptiveScale(0.8, 45)).toBe(0.8);
    expect(getAdaptiveScale(0.8, 52)).toBe(0.8);
    expect(getAdaptiveScale(0.8, 58)).toBe(0.8);
  });

  it("does nothing before the first measurement or on invalid input", () => {
    expect(getAdaptiveScale(0.8, 0)).toBe(0.8);
    expect(getAdaptiveScale(0.8, Number.NaN)).toBe(0.8);
    expect(getAdaptiveScale(Number.NaN, 120)).toBe(1);
    expect(getAdaptiveScale(4, 120)).toBe(1);
  });
});
