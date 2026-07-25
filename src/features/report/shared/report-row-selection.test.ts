import { describe, expect, it } from "vitest";
import {
  nextRowSelectionIds,
  nextRowsSelectionIds,
  selectedRowsForIds,
  selectionStateForVisibleIds,
} from "./report-row-selection-utils";

interface TestRow {
  id: string;
  name: string;
}

const rows: TestRow[] = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
  { id: "c", name: "Charlie" },
];

describe("report row selection helpers", () => {
  it("returns rows matching selected ids", () => {
    const selected = new Set(["a", "c"]);

    expect(selectedRowsForIds(rows, selected, (row) => row.id)).toEqual([
      rows[0],
      rows[2],
    ]);
  });

  it("computes visible select all and indeterminate state", () => {
    expect(
      selectionStateForVisibleIds(["a", "b"], new Set(["a", "b"])),
    ).toEqual({
      allVisibleSelected: true,
      someVisibleSelected: true,
    });

    expect(selectionStateForVisibleIds(["a", "b"], new Set(["a"]))).toEqual({
      allVisibleSelected: false,
      someVisibleSelected: true,
    });

    expect(selectionStateForVisibleIds(["a", "b"], new Set())).toEqual({
      allVisibleSelected: false,
      someVisibleSelected: false,
    });
  });

  it("toggles a single row id without mutating the original set", () => {
    const original = new Set(["a"]);
    const added = nextRowSelectionIds(original, "b", true);
    const removed = nextRowSelectionIds(added, "a", false);

    expect(Array.from(original)).toEqual(["a"]);
    expect(Array.from(added).sort()).toEqual(["a", "b"]);
    expect(Array.from(removed)).toEqual(["b"]);
  });

  it("toggles multiple row ids", () => {
    const selected = nextRowsSelectionIds(new Set(["a"]), ["b", "c"], true);
    expect(Array.from(selected).sort()).toEqual(["a", "b", "c"]);

    const cleared = nextRowsSelectionIds(selected, ["a", "c"], false);
    expect(Array.from(cleared)).toEqual(["b"]);
  });
});
