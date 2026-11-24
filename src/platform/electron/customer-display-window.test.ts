import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
  createCustomerDisplayWindowController,
  resolveCustomerDisplayTarget,
  type CustomerDisplayTarget,
} from "./customer-display-window";

const cashier: CustomerDisplayTarget = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
};
const rear: CustomerDisplayTarget = {
  id: 2,
  bounds: { x: 1920, y: 0, width: 1280, height: 800 },
};
const third: CustomerDisplayTarget = {
  id: 3,
  bounds: { x: -1920, y: 0, width: 1920, height: 1080 },
};

class DisplayWindow extends EventEmitter {
  bounds = { ...cashier.bounds };
  destroyed = false;
  fullScreen = false;
  minimized = false;
  pendingFullScreen: boolean | null = null;
  webContents = { id: 10, send: vi.fn() };
  close = vi.fn();
  focus = vi.fn();
  show = vi.fn();
  setBounds = vi.fn((bounds: CustomerDisplayTarget["bounds"]) => { this.bounds = { ...bounds }; });
  restore = vi.fn(() => { this.minimized = false; });
  setFullScreen = vi.fn((value: boolean) => {
    if (this.asynchronousFullscreen) this.pendingFullScreen = value;
    else this.fullScreen = value;
  });

  constructor(private asynchronousFullscreen = false) { super(); }
  isDestroyed() { return this.destroyed; }
  getBounds() { return { ...this.bounds }; }
  isFullScreen() { return this.fullScreen; }
  isMinimized() { return this.minimized; }
  finishFullscreenTransition() {
    const value = this.pendingFullScreen;
    if (value === null) throw new Error("No fullscreen transition pending");
    this.pendingFullScreen = null;
    this.fullScreen = value;
    this.emit(value ? "enter-full-screen" : "leave-full-screen");
  }
}

function fixture(asynchronousFullscreen = false) {
  const window = new DisplayWindow(asynchronousFullscreen);
  const createWindow = vi.fn(() => window);
  const controller = createCustomerDisplayWindowController(createWindow, asynchronousFullscreen);
  return { controller, createWindow, window };
}

describe("Electron customer display targets", () => {
  it("uses the selected monitor with three connected displays", () => {
    expect(resolveCustomerDisplayTarget([cashier, rear, third], cashier.id, third.id)).toBe(third);
  });

  it("defaults away from the cashier even when its monitor is not the OS primary", () => {
    expect(resolveCustomerDisplayTarget([cashier, rear], rear.id)).toBe(cashier);
  });

  it("rejects a disconnected selected monitor instead of covering the cashier", () => {
    expect(() => resolveCustomerDisplayTarget([cashier], cashier.id, rear.id)).toThrow("no longer connected");
    expect(resolveCustomerDisplayTarget([cashier], cashier.id)).toBe(cashier);
  });
});

describe("Electron customer display window", () => {
  it("creates one window for three repeated open requests before it finishes loading", () => {
    const { controller, createWindow, window } = fixture();

    controller.open(rear);
    controller.open(rear);
    controller.open(third);

    expect(createWindow).toHaveBeenCalledOnce();
    expect(window.show).not.toHaveBeenCalled();
    window.emit("ready-to-show");
    expect(window.setBounds).toHaveBeenCalledWith(third.bounds);
    expect(controller.activeDisplayId).toBe(third.id);
    expect(window.fullScreen).toBe(true);
  });

  it("restores and reuses the visible customer window without closing or reloading it", () => {
    const { controller, createWindow, window } = fixture();
    controller.open(rear);
    window.emit("ready-to-show");
    window.minimized = true;
    controller.open(rear);
    controller.open(rear);

    expect(createWindow).toHaveBeenCalledOnce();
    expect(window.close).not.toHaveBeenCalled();
    expect(window.restore).toHaveBeenCalledOnce();
    expect(window.setBounds).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledTimes(3);
  });

  it("moves the same Windows window between monitors and preserves its ready renderer", () => {
    const { controller, createWindow, window } = fixture();
    controller.open(rear);
    window.emit("ready-to-show");
    controller.signalReady(window.webContents.id);
    controller.open(third);
    controller.send({ total: 125 });

    expect(createWindow).toHaveBeenCalledOnce();
    expect(window.close).not.toHaveBeenCalled();
    expect(window.setFullScreen.mock.calls.map(([value]) => value)).toEqual([true, false, true]);
    expect(window.setBounds).toHaveBeenLastCalledWith(third.bounds);
    expect(window.webContents.send).toHaveBeenCalledWith("display:receive", { total: 125 });
  });

  it("returns to the selected monitor if Windows moved the existing customer window", () => {
    const { controller, createWindow, window } = fixture();
    controller.open(rear);
    window.emit("ready-to-show");
    window.bounds = { ...third.bounds };
    controller.open(rear);

    expect(createWindow).toHaveBeenCalledOnce();
    expect(window.setBounds).toHaveBeenCalledTimes(2);
    expect(window.bounds).toEqual(rear.bounds);
  });

  it("keeps messages queued across repeated opens until the actual customer renderer is ready", () => {
    const { controller, window } = fixture();
    controller.open(rear);
    controller.send({ total: 100 });
    controller.open(rear);
    controller.send({ total: 200 });
    controller.signalReady(999);
    expect(window.webContents.send).not.toHaveBeenCalled();

    controller.signalReady(window.webContents.id);
    expect(window.webContents.send.mock.calls).toEqual([
      ["display:receive", { total: 100 }],
      ["display:receive", { total: 200 }],
    ]);
    controller.signalReady(window.webContents.id);
    expect(window.webContents.send).toHaveBeenCalledTimes(2);
  });

  it("ignores ready and close events from the previous window after reopening", () => {
    const oldWindow = new DisplayWindow();
    const nextWindow = new DisplayWindow();
    nextWindow.webContents.id = 11;
    const createWindow = vi.fn<() => DisplayWindow>().mockReturnValueOnce(oldWindow).mockReturnValueOnce(nextWindow);
    const controller = createCustomerDisplayWindowController(createWindow);

    controller.open(rear);
    controller.send({ total: 100 });
    controller.close();
    controller.open(third);
    controller.send({ total: 300 });
    oldWindow.emit("ready-to-show");
    oldWindow.emit("closed");
    controller.signalReady(oldWindow.webContents.id);

    expect(oldWindow.show).not.toHaveBeenCalled();
    expect(nextWindow.webContents.send).not.toHaveBeenCalled();
    expect(controller.activeDisplayId).toBe(third.id);
    controller.signalReady(nextWindow.webContents.id);
    expect(nextWindow.webContents.send.mock.calls).toEqual([["display:receive", { total: 300 }]]);
  });

  it("waits for macOS fullscreen transitions and applies the most recently selected monitor", () => {
    const { controller, createWindow, window } = fixture(true);
    controller.open(rear);
    window.emit("ready-to-show");
    controller.open(third);
    expect(window.setBounds).toHaveBeenCalledTimes(1);
    window.finishFullscreenTransition();
    expect(window.pendingFullScreen).toBe(false);
    controller.open(cashier);
    window.finishFullscreenTransition();

    expect(createWindow).toHaveBeenCalledOnce();
    expect(window.setBounds).toHaveBeenLastCalledWith(cashier.bounds);
    expect(window.pendingFullScreen).toBe(true);
    window.finishFullscreenTransition();
    expect(window.fullScreen).toBe(true);
    expect(controller.activeDisplayId).toBe(cashier.id);
  });

  it("clears active state after the customer window is closed", () => {
    const { controller, window } = fixture();
    controller.open(rear);
    window.destroyed = true;
    window.emit("closed");
    controller.send({ total: 100 });

    expect(controller.activeDisplayId).toBeNull();
    expect(window.webContents.send).not.toHaveBeenCalled();
  });

  it("restores moved bounds after an asynchronous fullscreen exit", () => {
    const { controller, window } = fixture(true);
    controller.open(rear);
    window.emit("ready-to-show");
    window.finishFullscreenTransition();
    window.bounds = { ...third.bounds };
    controller.open(rear);
    window.finishFullscreenTransition();

    expect(window.bounds).toEqual(rear.bounds);
    expect(window.setBounds).toHaveBeenCalledTimes(2);
    window.finishFullscreenTransition();
    expect(window.fullScreen).toBe(true);
  });
});
