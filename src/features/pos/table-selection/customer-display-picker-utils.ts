export const CUSTOMER_DISPLAY_TARGET_STORAGE_KEY = "yummy-go:customer-display-target";

export function customerDisplayIdFromStorage(value: string | null | undefined) {
  if (!value) return null;
  const displayId = Number(value);
  return Number.isFinite(displayId) ? displayId : null;
}

export function customerDisplayResolution(display: Pick<ElectronDisplay, "height" | "width">) {
  return `${display.width} x ${display.height}`;
}

export function customerDisplayPosition(display: Pick<ElectronDisplay, "x" | "y">) {
  return `x ${display.x}, y ${display.y}`;
}

export function activeCustomerDisplay(info: ElectronDisplayInfo | null | undefined) {
  if (!info) return null;
  return info.displays.find((display) => display.id === info.activeCustomerDisplayId || display.isActive) ?? null;
}

export function defaultCustomerDisplayId(
  info: ElectronDisplayInfo | null | undefined,
  preferredDisplayId: number | null | undefined
) {
  if (!info?.displays.length) return null;

  const preferred = info.displays.find((display) => display.id === preferredDisplayId);
  if (preferred) return preferred.id;

  const active = activeCustomerDisplay(info);
  if (active) return active.id;

  const secondary = info.displays.find((display) => !display.isPrimary);
  if (secondary) return secondary.id;

  const primary = info.displays.find((display) => display.isPrimary);
  return primary?.id ?? info.displays[0]?.id ?? null;
}

export function displayIsConnected(info: ElectronDisplayInfo | null | undefined, displayId: number | null | undefined) {
  if (!info || typeof displayId !== "number") return false;
  return info.displays.some((display) => display.id === displayId);
}
