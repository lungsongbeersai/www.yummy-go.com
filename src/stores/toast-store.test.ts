import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useToastStore } from "./toast-store";

afterEach(() => { toast.dismiss(); });

describe("document print toasts", () => {
  it("keeps a paid receipt failure available until it is explicitly resolved", () => {
    useToastStore.getState().show({
      id: "paid-receipt-failure",
      title: "Payment recorded. Receipt not printed.",
      tone: "error",
      duration: Infinity,
      action: { label: "Retry receipt", onClick: vi.fn() },
    });

    expect(toast.getToasts().find((entry) => entry.id === "paid-receipt-failure"))
      .toMatchObject({ duration: Infinity, action: { label: "Retry receipt" } });
  });

  it("removes the previous retry action after the same receipt reports success", () => {
    const show = useToastStore.getState().show;
    show({
      id: "receipt-recovery",
      title: "Receipt failed",
      tone: "error",
      duration: Infinity,
      action: { label: "Retry receipt", onClick: vi.fn() },
    });
    show({
      id: "receipt-recovery",
      title: "Receipt printed",
      tone: "success",
      duration: 4000,
    });

    expect(toast.getToasts().find((entry) => entry.id === "receipt-recovery"))
      .toMatchObject({ title: "Receipt printed", duration: 4000, action: null });
  });
});
