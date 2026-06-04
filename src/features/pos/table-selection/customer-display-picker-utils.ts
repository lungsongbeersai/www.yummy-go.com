export const CUSTOMER_DISPLAY_TARGET_STORAGE_KEY = "yummy-go:customer-display-target";
export const BROWSER_CUSTOMER_DISPLAY_TARGET_STORAGE_KEY = "yummy-go:customer-display-browser-target";

export type BrowserCustomerDisplayScreenLike = {
  availHeight?: number;
  availLeft?: number;
  availTop?: number;
  availWidth?: number;
  devicePixelRatio?: number;
  height: number;
  isInternal?: boolean;
  isPrimary?: boolean;
  label?: string;
  left?: number;
  top?: number;
  width: number;
};

export type BrowserCustomerDisplayScreen = {
  availHeight: number;
  availLeft: number;
  availTop: number;
  availWidth: number;
  devicePixelRatio: number;
  height: number;
  isCurrent: boolean;
  isInternal: boolean;
  isPrimary: boolean;
  key: string;
  label: string;
  left: number;
  top: number;
  width: number;
};

export type BrowserCustomerDisplayInfo = {
  count: number;
  currentScreenKey: string | null;
  hasSecondary: boolean;
  isExtended: boolean;
  screens: BrowserCustomerDisplayScreen[];
};

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

export function browserCustomerDisplayPosition(display: Pick<BrowserCustomerDisplayScreen, "left" | "top">) {
  return `x ${display.left}, y ${display.top}`;
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

export function browserCustomerDisplayScreenKey(screen: BrowserCustomerDisplayScreenLike, index: number) {
  const primary = screen.isPrimary ? "primary" : "secondary";
  const label = screen.label?.trim() || "screen";
  return [
    index,
    primary,
    label,
    screen.left ?? 0,
    screen.top ?? 0,
    screen.width,
    screen.height
  ].join(":");
}

function browserScreensMatch(first: BrowserCustomerDisplayScreenLike, second: BrowserCustomerDisplayScreenLike) {
  return (
    (first.left ?? 0) === (second.left ?? 0) &&
    (first.top ?? 0) === (second.top ?? 0) &&
    first.width === second.width &&
    first.height === second.height &&
    Boolean(first.isPrimary) === Boolean(second.isPrimary)
  );
}

export function normalizeBrowserCustomerDisplayInfo(
  details: { currentScreen?: BrowserCustomerDisplayScreenLike | null; screens?: readonly BrowserCustomerDisplayScreenLike[] },
  isExtended: boolean
): BrowserCustomerDisplayInfo {
  const current = details.currentScreen ?? null;
  const screens = (details.screens ?? []).map((screen, index): BrowserCustomerDisplayScreen => {
    const left = screen.left ?? 0;
    const top = screen.top ?? 0;
    const width = screen.width;
    const height = screen.height;
    const label = screen.label?.trim() || `${width} x ${height}`;
    const key = browserCustomerDisplayScreenKey(screen, index);
    const isCurrent = current ? browserScreensMatch(screen, current) : false;

    return {
      availHeight: screen.availHeight ?? height,
      availLeft: screen.availLeft ?? left,
      availTop: screen.availTop ?? top,
      availWidth: screen.availWidth ?? width,
      devicePixelRatio: screen.devicePixelRatio ?? 1,
      height,
      isCurrent,
      isInternal: Boolean(screen.isInternal),
      isPrimary: Boolean(screen.isPrimary),
      key,
      label,
      left,
      top,
      width
    };
  });

  return {
    count: screens.length,
    currentScreenKey: screens.find((screen) => screen.isCurrent)?.key ?? null,
    hasSecondary: screens.some((screen) => !screen.isPrimary),
    isExtended,
    screens
  };
}

export function defaultBrowserCustomerDisplayKey(
  info: BrowserCustomerDisplayInfo | null | undefined,
  preferredKey: string | null | undefined
) {
  if (!info?.screens.length) return null;

  const preferred = info.screens.find((screen) => screen.key === preferredKey);
  if (preferred) return preferred.key;

  const secondary = info.screens.find((screen) => !screen.isPrimary);
  if (secondary) return secondary.key;

  const primary = info.screens.find((screen) => screen.isPrimary);
  return primary?.key ?? info.screens[0]?.key ?? null;
}

export function browserDisplayIsConnected(
  info: BrowserCustomerDisplayInfo | null | undefined,
  screenKey: string | null | undefined
) {
  if (!info || !screenKey) return false;
  return info.screens.some((screen) => screen.key === screenKey);
}

export function browserCustomerDisplayWindowFeatures(screen?: BrowserCustomerDisplayScreen | null) {
  if (!screen) return "popup=yes,width=1200,height=800,resizable=yes,scrollbars=no";

  return [
    "popup=yes",
    `left=${Math.round(screen.availLeft)}`,
    `top=${Math.round(screen.availTop)}`,
    `width=${Math.max(320, Math.round(screen.availWidth))}`,
    `height=${Math.max(320, Math.round(screen.availHeight))}`,
    "resizable=yes",
    "scrollbars=no"
  ].join(",");
}
