import { describe, expect, it } from "vitest";
import { ensureSplitItemUuidMap } from "./mutation-identity";

describe("POS mutation identity", () => {
  it("reuses split item UUIDs across retries and allocates only new selections", () => {
    let sequence = 0;
    const factory = () => `uuid-${++sequence}`;
    const first = ensureSplitItemUuidMap([{ "item-a": 1 }], {}, factory);
    const retry = ensureSplitItemUuidMap(
      [{ "item-a": 1 }, { "item-b": 2 }],
      first,
      factory,
    );

    expect(retry).toEqual({ "item-a": "uuid-1", "item-b": "uuid-2" });
    expect(ensureSplitItemUuidMap([{ "item-a": 1 }], retry, factory)["item-a"])
      .toBe("uuid-1");
  });
});
