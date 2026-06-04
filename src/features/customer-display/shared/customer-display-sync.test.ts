import { describe, expect, it } from "vitest";
import {
  CUSTOMER_DISPLAY_CHANNEL,
  CUSTOMER_DISPLAY_STORAGE_KEY,
  publishCustomerDisplayPayload,
  withCustomerDisplayOrderMode,
  withCustomerDisplayPaymentMode,
  type CustomerDisplayPayload
} from "./customer-display-sync";

const payload: CustomerDisplayPayload = {
  discount: 1000,
  grand_total: 12000,
  invoice: "INV-1",
  items: [
    {
      name: "Noodle",
      price: 6000,
      qty: 2,
      total: 12000
    }
  ],
  service: 500,
  subtotal: 11000,
  table_name: "T01",
  total: 12000,
  updated_at: "2026-06-04T00:00:00.000Z",
  vat: 500
};

describe("customer display sync", () => {
  it("builds payment mode payload without dropping order data", () => {
    const paymentPayload = withCustomerDisplayPaymentMode(payload, {
      amount: 12000,
      invoice: "INV-1",
      qrUrl: "https://example.com/branch-qr.png"
    });

    expect(paymentPayload).toMatchObject({
      grand_total: 12000,
      invoice: "INV-1",
      items: payload.items,
      mode: "payment",
      payment: {
        amount: 12000,
        invoice: "INV-1",
        qrUrl: "https://example.com/branch-qr.png"
      },
      table_name: "T01"
    });
  });

  it("builds order mode payload and removes payment QR state", () => {
    const paymentPayload = withCustomerDisplayPaymentMode(payload, {
      amount: 12000,
      invoice: "INV-1",
      qrUrl: "https://example.com/branch-qr.png"
    });
    const orderPayload = withCustomerDisplayOrderMode(paymentPayload);

    expect(orderPayload.mode).toBe("order");
    expect(orderPayload.payment).toBeUndefined();
    expect(orderPayload.items).toEqual(payload.items);
  });

  it("publishes browser payload through localStorage and BroadcastChannel", () => {
    const storage = new Map<string, string>();
    const messages: unknown[] = [];
    const channels: string[] = [];
    let closeCount = 0;

    class FakeBroadcastChannel {
      constructor(channelName: string) {
        channels.push(channelName);
      }

      postMessage(data: unknown) {
        messages.push(data);
      }

      close() {
        closeCount += 1;
      }
    }

    publishCustomerDisplayPayload(payload, {
      browser: true,
      electron: false,
      target: {
        BroadcastChannel: FakeBroadcastChannel,
        localStorage: {
          setItem(key, value) {
            storage.set(key, value);
          }
        }
      }
    });

    expect(storage.get(CUSTOMER_DISPLAY_STORAGE_KEY)).toBe(JSON.stringify(payload));
    expect(channels).toEqual([CUSTOMER_DISPLAY_CHANNEL]);
    expect(messages).toEqual([payload]);
    expect(closeCount).toBe(1);
  });

  it("can repeat browser channel messages for newly opened popup windows", () => {
    const messages: unknown[] = [];
    const timers: Array<() => void> = [];
    let closeCount = 0;

    class FakeBroadcastChannel {
      postMessage(data: unknown) {
        messages.push(data);
      }

      close() {
        closeCount += 1;
      }
    }

    publishCustomerDisplayPayload(payload, {
      browser: true,
      electron: false,
      repeatBrowserMessage: true,
      target: {
        BroadcastChannel: FakeBroadcastChannel,
        localStorage: {
          setItem() {}
        },
        setTimeout(handler) {
          timers.push(handler);
          return 1;
        }
      }
    });

    expect(messages).toEqual([payload]);
    expect(closeCount).toBe(0);

    timers[0]();

    expect(messages).toEqual([payload, payload]);
    expect(closeCount).toBe(1);
  });

  it("publishes electron payload through sendToDisplay", () => {
    const messages: unknown[] = [];

    publishCustomerDisplayPayload(payload, {
      browser: false,
      electron: true,
      target: {
        electronAPI: {
          sendToDisplay(data) {
            messages.push(data);
          }
        }
      }
    });

    expect(messages).toEqual([payload]);
  });
});
