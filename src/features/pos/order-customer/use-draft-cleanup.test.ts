import { describe, expect, it } from "vitest";
import type { CartItem, CartOrder } from "@/services/pos";
import { draftSignature, myDraftItems } from "./use-draft-cleanup";

const USER_A = "user-a";
const USER_B = "user-b";

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    order_it_uuid: "item-1",
    qty: 1,
    detail: {
      order_it_status: 1,
      order_it_created_by: USER_A,
      order_it_note: "",
    },
    ...overrides,
  };
}

function cart(items: CartItem[]): CartOrder {
  return { order_uuid: "order-1", items };
}

describe("myDraftItems", () => {
  it("keeps only WAITING_CONFIRM items created by the given user", () => {
    const beer = item({ order_it_uuid: "beer" });
    const foodConfirmed = item({
      order_it_uuid: "food",
      detail: { order_it_status: 2, order_it_created_by: USER_A },
    });
    const waterOtherEmployee = item({
      order_it_uuid: "water",
      detail: { order_it_status: 1, order_it_created_by: USER_B },
    });

    expect(myDraftItems(cart([beer, foodConfirmed, waterOtherEmployee]), USER_A)).toEqual([
      beer,
    ]);
  });

  it("returns nothing when the cart is empty, missing, or the user uuid is blank", () => {
    expect(myDraftItems(null, USER_A)).toEqual([]);
    expect(myDraftItems(cart([]), USER_A)).toEqual([]);
    expect(myDraftItems(cart([item()]), "")).toEqual([]);
  });

  it("only counts the caller's own drafts, never another employee's on the same table", () => {
    const mine = item({ order_it_uuid: "mine" });
    const theirs = item({
      order_it_uuid: "theirs",
      detail: { order_it_status: 1, order_it_created_by: USER_B },
    });

    const result = myDraftItems(cart([mine, theirs]), USER_A);
    expect(result.map((row) => row.order_it_uuid)).toEqual(["mine"]);
  });
});

describe("draftSignature", () => {
  it("changes when a new item is added", () => {
    const before = draftSignature([item({ order_it_uuid: "a" })]);
    const after = draftSignature([
      item({ order_it_uuid: "a" }),
      item({ order_it_uuid: "b" }),
    ]);
    expect(before).not.toEqual(after);
  });

  it("changes when quantity or note is edited", () => {
    const original = draftSignature([item({ order_it_uuid: "a", qty: 1 })]);
    const qtyChanged = draftSignature([item({ order_it_uuid: "a", qty: 2 })]);
    const noteChanged = draftSignature([
      item({
        order_it_uuid: "a",
        qty: 1,
        detail: { order_it_status: 1, order_it_created_by: USER_A, order_it_note: "no ice" },
      }),
    ]);

    expect(qtyChanged).not.toEqual(original);
    expect(noteChanged).not.toEqual(original);
  });

  it("is stable across reordering, so a re-fetch alone never resets the timer", () => {
    const a = item({ order_it_uuid: "a" });
    const b = item({ order_it_uuid: "b" });
    expect(draftSignature([a, b])).toEqual(draftSignature([b, a]));
  });

  it("is empty for no items, matching the confirmed/cleaned state", () => {
    expect(draftSignature([])).toEqual("");
  });
});
