import { describe, expect, it } from "vitest";
import { employeeWorkSwipeScope } from "./employee-work-swipe";

describe("employee work scope swipes", () => {
  it("moves forward and backward without wrapping the end tabs", () => {
    expect(employeeWorkSwipeScope("current", -90, 8)).toBe("carryover");
    expect(employeeWorkSwipeScope("carryover", -90, 8)).toBe("undated");
    expect(employeeWorkSwipeScope("undated", 90, 8)).toBe("carryover");
    expect(employeeWorkSwipeScope("carryover", 90, 8)).toBe("current");
    expect(employeeWorkSwipeScope("current", 90, 8)).toBeNull();
    expect(employeeWorkSwipeScope("undated", -90, 8)).toBeNull();
  });

  it.each([[15, 2], [-47, 0], [70, 90], [-60, 45], [Number.NaN, 0], [0, Number.POSITIVE_INFINITY]])("keeps taps, short drags and vertical scrolling in the same scope (%s,%s)", (x, y) => {
    expect(employeeWorkSwipeScope("carryover", x, y)).toBeNull();
  });
});
