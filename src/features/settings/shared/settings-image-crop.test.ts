import { describe, expect, it } from "vitest";
import { containCropArea, getContainZoom } from "./settings-image-crop";

describe("getContainZoom", () => {
  it("computes the zoom below react-easy-crop's cover baseline that reveals the whole image", () => {
    // ค่าเหล่านี้ตรวจแล้วว่าตรงกับสูตร computeCroppedArea จริงของ react-easy-crop
    // (จำลองแยกด้วยฟังก์ชันภายในของไลบรารีตอนพัฒนา ไม่ใช่แค่เดาจากสูตรของเราเอง)
    expect(getContainZoom(1200 / 800, 4 / 3)).toBeCloseTo(0.8889, 3);
    expect(getContainZoom(900 / 1600, 1)).toBeCloseTo(0.5625, 3);
    expect(getContainZoom(2000 / 600, 1)).toBeCloseTo(0.3, 3);
  });

  it("returns exactly 1 when the image already matches the target aspect (no letterbox needed)", () => {
    expect(getContainZoom(4 / 3, 4 / 3)).toBe(1);
    expect(getContainZoom(1, 1)).toBe(1);
  });
});

describe("containCropArea", () => {
  it("letterboxes a wide image inside a narrower frame (extends past image height)", () => {
    expect(containCropArea({ naturalWidth: 1200, naturalHeight: 800 }, 4 / 3)).toEqual({
      width: 1200,
      height: 900,
      x: 0,
      y: -50
    });
  });

  it("letterboxes a tall image inside a wider frame (extends past image width)", () => {
    expect(containCropArea({ naturalWidth: 900, naturalHeight: 1600 }, 1)).toEqual({
      width: 1600,
      height: 1600,
      x: -350,
      y: 0
    });
  });

  it("letterboxes a very wide panorama inside a square frame", () => {
    expect(containCropArea({ naturalWidth: 2000, naturalHeight: 600 }, 1)).toEqual({
      width: 2000,
      height: 2000,
      x: 0,
      y: -700
    });
  });

  it("needs no letterbox when the image already matches the target aspect", () => {
    expect(containCropArea({ naturalWidth: 640, naturalHeight: 480 }, 4 / 3)).toEqual({
      width: 640,
      height: 480,
      x: 0,
      y: 0
    });
  });
});
