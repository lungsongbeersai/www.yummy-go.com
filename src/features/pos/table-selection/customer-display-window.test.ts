import { describe, expect, it, vi } from "vitest";
import { openBrowserCustomerDisplayWindow } from "./customer-display-window";
import type { BrowserCustomerDisplayScreen } from "./customer-display-picker-utils";

const targetScreen: BrowserCustomerDisplayScreen = {
  availHeight: 1040,
  availLeft: -1920,
  availTop: 30,
  availWidth: 1920,
  devicePixelRatio: 1,
  height: 1080,
  isCurrent: false,
  isInternal: false,
  isPrimary: false,
  key: "rear",
  label: "Customer display",
  left: -1920,
  top: 0,
  width: 1920,
};

function popup(closed = false) {
  return {
    closed,
    focus: vi.fn(),
    moveTo: vi.fn(),
    resizeTo: vi.fn(),
  };
}

describe("browser customer display window", () => {
  it("reuses the live popup without reopening or reloading its page", () => {
    const currentWindow = popup();
    const openWindow = vi.fn(() => popup());

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(openBrowserCustomerDisplayWindow({ currentWindow, openWindow })).toBe(currentWindow);
    }

    expect(openWindow).not.toHaveBeenCalled();
    expect(currentWindow.focus).toHaveBeenCalledTimes(3);
    expect(currentWindow.moveTo).not.toHaveBeenCalled();
    expect(currentWindow.resizeTo).not.toHaveBeenCalled();
  });

  it("moves and resizes the existing popup when choosing a different monitor", () => {
    const currentWindow = popup();
    const openWindow = vi.fn(() => popup());

    openBrowserCustomerDisplayWindow({ currentWindow, openWindow, targetScreen });

    expect(openWindow).not.toHaveBeenCalled();
    expect(currentWindow.moveTo).toHaveBeenCalledWith(-1920, 30);
    expect(currentWindow.resizeTo).toHaveBeenCalledWith(1920, 1040);
    expect(currentWindow.focus).toHaveBeenCalledOnce();
  });

  it("replaces a closed reference using the shared customer window name", () => {
    const closedWindow = popup(true);
    const replacement = popup();
    const openWindow = vi.fn(() => replacement);

    expect(openBrowserCustomerDisplayWindow({ currentWindow: closedWindow, openWindow, targetScreen }))
      .toBe(replacement);

    expect(openWindow).toHaveBeenCalledWith(
      "/customer-display",
      "yummy-go-customer-display",
      expect.stringContaining("left=-1920"),
    );
    expect(closedWindow.focus).not.toHaveBeenCalled();
    expect(replacement.moveTo).toHaveBeenCalledWith(-1920, 30);
    expect(replacement.resizeTo).toHaveBeenCalledWith(1920, 1040);
  });

  it("also positions a named popup recovered after losing the local reference", () => {
    const recoveredWindow = popup();
    const openWindow = vi.fn(() => recoveredWindow);

    expect(openBrowserCustomerDisplayWindow({ currentWindow: null, openWindow, targetScreen }))
      .toBe(recoveredWindow);
    expect(openWindow).toHaveBeenCalledOnce();
    expect(recoveredWindow.moveTo).toHaveBeenCalledWith(-1920, 30);
    expect(recoveredWindow.resizeTo).toHaveBeenCalledWith(1920, 1040);
  });

  it("reports a blocked popup without pretending it opened", () => {
    const openWindow = vi.fn(() => null);

    expect(openBrowserCustomerDisplayWindow({ currentWindow: null, openWindow, targetScreen })).toBeNull();
    expect(openWindow).toHaveBeenCalledOnce();
  });
});
