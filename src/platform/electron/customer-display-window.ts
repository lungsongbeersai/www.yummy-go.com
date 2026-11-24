export interface CustomerDisplayTarget {
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
}

interface CustomerDisplayWindow {
  close(): void;
  focus(): void;
  getBounds(): CustomerDisplayTarget["bounds"];
  isDestroyed(): boolean;
  isFullScreen(): boolean;
  isMinimized(): boolean;
  restore(): void;
  setBounds(bounds: CustomerDisplayTarget["bounds"]): void;
  setFullScreen(fullScreen: boolean): void;
  show(): void;
  once(event: "closed" | "ready-to-show" | "enter-full-screen" | "leave-full-screen", listener: () => void): unknown;
  webContents: { id: number; send(channel: string, data: unknown): void };
}

export function resolveCustomerDisplayTarget<T extends CustomerDisplayTarget>(
  displays: readonly T[],
  cashierDisplayId: number,
  requestedDisplayId?: number,
): T {
  const target = typeof requestedDisplayId === "number"
    ? displays.find((display) => display.id === requestedDisplayId)
    : displays.find((display) => display.id !== cashierDisplayId) ?? displays[0];
  if (!target) throw new Error("The selected customer display is no longer connected. Refresh the display list and try again.");
  return target;
}

export function createCustomerDisplayWindowController(
  createWindow: (target: CustomerDisplayTarget) => CustomerDisplayWindow,
  waitForFullscreenEvents = false,
) {
  interface Session {
    window: CustomerDisplayWindow;
    target: CustomerDisplayTarget;
    placed: CustomerDisplayTarget | null;
    visible: boolean;
    rendererReady: boolean;
    transitioning: boolean;
    pending: unknown[];
  }
  let session: Session | null = null;

  function isCurrent(current: Session) {
    return session === current && !current.window.isDestroyed();
  }

  function place(current: Session, verifyBounds = false) {
    if (!isCurrent(current) || !current.visible || current.transitioning) return;
    const { window, target, placed } = current;
    const bounds = verifyBounds ? window.getBounds() : placed?.bounds;
    const needsMove = !placed || placed.id !== target.id ||
      Object.keys(target.bounds).some((key) => {
        const coordinate = key as keyof CustomerDisplayTarget["bounds"];
        return target.bounds[coordinate] !== bounds?.[coordinate];
      });

    if (needsMove && window.isFullScreen()) {
      current.placed = null;
      // macOS applies bounds only after its asynchronous fullscreen exit finishes.
      if (waitForFullscreenEvents) {
        current.transitioning = true;
        window.once("leave-full-screen", () => {
          current.transitioning = false;
          place(current);
        });
      }
      window.setFullScreen(false);
      if (waitForFullscreenEvents) return;
    }
    if (needsMove) {
      window.setBounds(target.bounds);
      current.placed = { id: target.id, bounds: { ...target.bounds } };
    }
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
    if (!window.isFullScreen()) {
      if (waitForFullscreenEvents) {
        current.transitioning = true;
        window.once("enter-full-screen", () => {
          current.transitioning = false;
          place(current);
        });
      }
      window.setFullScreen(true);
    }
  }

  return {
    get activeDisplayId() {
      return session && !session.window.isDestroyed() ? session.target.id : null;
    },
    open(target: CustomerDisplayTarget) {
      if (session && !session.window.isDestroyed()) {
        session.target = target;
        place(session, true);
        return;
      }
      const current: Session = {
        window: createWindow(target), target, placed: null, visible: false,
        rendererReady: false, transitioning: false, pending: [],
      };
      session = current;
      current.window.once("ready-to-show", () => {
        current.visible = true;
        place(current);
      });
      current.window.once("closed", () => {
        if (session === current) session = null;
      });
    },
    close() {
      const current = session;
      session = null;
      if (current && !current.window.isDestroyed()) current.window.close();
    },
    send(data: unknown) {
      if (!session || session.window.isDestroyed()) return;
      if (session.rendererReady) session.window.webContents.send("display:receive", data);
      else session.pending.push(data);
    },
    signalReady(senderId: number) {
      if (!session || session.window.isDestroyed() || session.window.webContents.id !== senderId) return;
      session.rendererReady = true;
      for (const data of session.pending) session.window.webContents.send("display:receive", data);
      session.pending.length = 0;
    },
  };
}
