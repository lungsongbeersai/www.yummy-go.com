import { describe, expect, it } from "vitest";
import type { CartItem, CartOrder } from "@/services/pos";
import {
  draftBackDecision,
  myDraftItems,
} from "./use-draft-cleanup";

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

describe("draftBackDecision", () => {
  it("leaves immediately only when there is no unconfirmed draft", () => {
    expect(draftBackDecision(false, 0)).toBe("leave");
  });

  it("prompts instead of deleting when Back is pressed with a draft", () => {
    expect(draftBackDecision(true, 0)).toBe("prompt");
  });

  it("waits instead of offering deletion while kitchen confirmation is active", () => {
    expect(draftBackDecision(true, 1)).toBe("wait");
  });
});
