import { describe, expect, it } from "vitest";
import {
  isManageQueueUrgent,
  manageQueueUrgencyTier,
  manageQueueWaitBadgeBlinkClass,
  manageQueueWaitBadgeVariant
} from "@/features/pos/order-queue/order-queue-urgency";

describe("manageQueueUrgencyTier", () => {
  it("is normal under 3 minutes", () => {
    expect(manageQueueUrgencyTier(0)).toBe("normal");
    expect(manageQueueUrgencyTier(2)).toBe("normal");
  });

  it("is elevated from 3 up to (not including) 5 minutes", () => {
    expect(manageQueueUrgencyTier(3)).toBe("elevated");
    expect(manageQueueUrgencyTier(4)).toBe("elevated");
  });

  it("is high from 5 up to (not including) 10 minutes", () => {
    expect(manageQueueUrgencyTier(5)).toBe("high");
    expect(manageQueueUrgencyTier(9)).toBe("high");
  });

  it("is critical from 10 up to (not including) 15 minutes", () => {
    expect(manageQueueUrgencyTier(10)).toBe("critical");
    expect(manageQueueUrgencyTier(14)).toBe("critical");
  });

  it("is blocking at 15 minutes or more", () => {
    expect(manageQueueUrgencyTier(15)).toBe("blocking");
    expect(manageQueueUrgencyTier(999)).toBe("blocking");
  });
});

describe("isManageQueueUrgent", () => {
  it("treats anything under 3 minutes as not urgent", () => {
    expect(isManageQueueUrgent(2)).toBe(false);
  });

  it("treats 3 minutes or more as urgent", () => {
    expect(isManageQueueUrgent(3)).toBe(true);
    expect(isManageQueueUrgent(30)).toBe(true);
  });
});

describe("manageQueueWaitBadgeVariant", () => {
  it("maps tiers to the built-in Badge variants", () => {
    expect(manageQueueWaitBadgeVariant("normal")).toBe("secondary");
    expect(manageQueueWaitBadgeVariant("elevated")).toBe("outline");
    expect(manageQueueWaitBadgeVariant("high")).toBe("outline");
    expect(manageQueueWaitBadgeVariant("critical")).toBe("destructive");
    expect(manageQueueWaitBadgeVariant("blocking")).toBe("destructive");
  });
});

describe("manageQueueWaitBadgeBlinkClass", () => {
  it("does not blink for normal or elevated tiers", () => {
    expect(manageQueueWaitBadgeBlinkClass("normal")).toBe("");
    expect(manageQueueWaitBadgeBlinkClass("elevated")).toBe("");
  });

  it("blinks yellow for the high tier", () => {
    expect(manageQueueWaitBadgeBlinkClass("high")).toBe("order-queue-row-blink-warning");
  });

  it("blinks red for critical and blocking tiers", () => {
    expect(manageQueueWaitBadgeBlinkClass("critical")).toBe("order-queue-row-blink-destructive");
    expect(manageQueueWaitBadgeBlinkClass("blocking")).toBe("order-queue-row-blink-destructive");
  });
});
