import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  useResetOnChange,
  useResetOnDeps
} from "@/hooks/use-reset-on-change";

function ResetHarness({
  onChangeReset,
  onDepsReset,
  runOnMount
}: {
  onChangeReset: () => void;
  onDepsReset: () => void;
  runOnMount?: boolean;
}) {
  useResetOnChange("record-1", onChangeReset, { runOnMount });
  useResetOnDeps(["record-1"], onDepsReset, { runOnMount });
  return null;
}

describe("render-time reset hooks", () => {
  it("does not reset on mount by default", () => {
    let changeResetCount = 0;
    let depsResetCount = 0;

    renderToString(createElement(ResetHarness, {
      onChangeReset: () => {
        changeResetCount += 1;
      },
      onDepsReset: () => {
        depsResetCount += 1;
      }
    }));

    expect(changeResetCount).toBe(0);
    expect(depsResetCount).toBe(0);
  });

  it("resets exactly once on mount when requested", () => {
    let changeResetCount = 0;
    let depsResetCount = 0;

    renderToString(createElement(ResetHarness, {
      onChangeReset: () => {
        changeResetCount += 1;
      },
      onDepsReset: () => {
        depsResetCount += 1;
      },
      runOnMount: true
    }));

    expect(changeResetCount).toBe(1);
    expect(depsResetCount).toBe(1);
  });
});
