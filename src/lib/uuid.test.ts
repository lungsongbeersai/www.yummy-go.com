import { afterEach, describe, expect, it, vi } from "vitest";
import { createUuid } from "./uuid";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("UUID creation on older Android WebViews", () => {
  it("uses the native UUID implementation when available", () => {
    const randomUUID = vi.fn(() => "d2f5ba46-4f6c-4991-bddc-5a9b57d466c6");
    vi.stubGlobal("crypto", { randomUUID });

    expect(createUuid()).toBe("d2f5ba46-4f6c-4991-bddc-5a9b57d466c6");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("creates fresh UUID v4 values with getRandomValues when randomUUID is absent", () => {
    let value = 255;
    const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(value--));
    vi.stubGlobal("crypto", { getRandomValues });

    const first = createUuid();
    const second = createUuid();

    expect(first).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    expect(second).toBe("fefefefe-fefe-4efe-befe-fefefefefefe");
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });

  it("retains UUID formatting when the environment has no Web Crypto", () => {
    vi.stubGlobal("crypto", undefined);
    vi.spyOn(Math, "random").mockReturnValue(0);

    expect(createUuid()).toBe("00000000-0000-4000-8000-000000000000");
  });
});
