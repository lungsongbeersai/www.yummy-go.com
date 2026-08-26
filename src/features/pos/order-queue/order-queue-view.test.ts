import { describe, expect, it } from "vitest";
import {
  buildOrderQueueTabs,
  canSelectQueueItem,
  queueWaitUrgency,
  resolveProductMedia,
  waitBadgeVariant
} from "@/features/pos/order-queue/order-queue-view";
import type { OrderQueueItem } from "@/services/pos";

function item(overrides: Partial<OrderQueueItem> = {}): OrderQueueItem {
  return {
    order_item_uuid: "item-1",
    table_name: "T01",
    order_it_q: 1,
    order_it_date_time: "2026-08-25 10:00:00",
    open_minutes: 5,
    order_item_status: 1,
    product_name: "Product",
    product_image: "",
    qty: 1,
    note: "",
    kitchen_print_queued: false,
    can_send_to_kitchen: true,
    can_confirm_served: false,
    ...overrides
  };
}

describe("queueWaitUrgency", () => {
  it("marks waits under 10 minutes as fresh", () => {
    expect(queueWaitUrgency(0)).toBe("fresh");
    expect(queueWaitUrgency(9)).toBe("fresh");
  });

  it("marks waits of 10-19 minutes as aging", () => {
    expect(queueWaitUrgency(10)).toBe("aging");
    expect(queueWaitUrgency(19)).toBe("aging");
  });

  it("marks waits of 20 minutes or more as late", () => {
    expect(queueWaitUrgency(20)).toBe("late");
    expect(queueWaitUrgency(2355)).toBe("late");
  });

  it("maps urgency to a built-in Badge variant", () => {
    expect(waitBadgeVariant("fresh")).toBe("secondary");
    expect(waitBadgeVariant("aging")).toBe("outline");
    expect(waitBadgeVariant("late")).toBe("destructive");
  });
});

describe("buildOrderQueueTabs", () => {
  it("orders tabs as working queue then history, not API array order", () => {
    const tabs = buildOrderQueueTabs([
      { status: 1, title: "Wait", total: 2 },
      { status: 2, title: "Kitchen", total: 18 },
      { status: 4, title: "Served", total: 6 },
      { status: 9, title: "Cancelled", total: 2 },
      { status: 0, title: "Customer", total: 1 }
    ]);

    expect(tabs.map((tab) => tab.status)).toEqual([1, 2, 0, 4, 9]);
  });
});

describe("canSelectQueueItem", () => {
  it("allows kitchen send only when the backend flags it", () => {
    expect(canSelectQueueItem(item({ can_send_to_kitchen: true }), 1)).toBe(true);
    expect(canSelectQueueItem(item({ can_send_to_kitchen: false }), 1)).toBe(false);
  });

  it("does not allow selecting customer-pending tickets", () => {
    expect(canSelectQueueItem(item(), 0)).toBe(false);
  });
});

describe("resolveProductMedia", () => {
  it("resolves a URL to an image media", () => {
    expect(resolveProductMedia("https://example.com/a.jpg")).toEqual({
      type: "image",
      src: "https://example.com/a.jpg"
    });
  });

  it.each(["#10B981", "#fff", "#ffffffaa"])(
    "resolves a hex color %s to a color media",
    (hex) => {
      expect(resolveProductMedia(hex)).toEqual({ type: "color", color: hex });
    }
  );

  it("resolves an empty string to empty media", () => {
    expect(resolveProductMedia("")).toEqual({ type: "empty" });
    expect(resolveProductMedia("   ")).toEqual({ type: "empty" });
  });

  it("does not misclassify a non-hex string starting with # as color", () => {
    expect(resolveProductMedia("#not-a-color")).toEqual({
      type: "image",
      src: "#not-a-color"
    });
  });
});
