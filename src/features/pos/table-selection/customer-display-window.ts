import {
  browserCustomerDisplayWindowFeatures,
  browserCustomerDisplayWindowIsActive,
  type BrowserCustomerDisplayScreen,
} from "./customer-display-picker-utils";

interface CustomerDisplayWindowControls {
  closed: boolean;
  focus: () => void;
  moveTo: (x: number, y: number) => void;
  resizeTo: (width: number, height: number) => void;
}

interface OpenBrowserCustomerDisplayWindowOptions<Popup extends CustomerDisplayWindowControls> {
  currentWindow: Popup | null;
  openWindow: (url: string, target: string, features: string) => Popup | null;
  targetScreen?: BrowserCustomerDisplayScreen | null;
}

export function openBrowserCustomerDisplayWindow<Popup extends CustomerDisplayWindowControls>({
  currentWindow,
  openWindow,
  targetScreen,
}: OpenBrowserCustomerDisplayWindowOptions<Popup>) {
  // Reopening a tracked popup must keep its page and data subscriptions intact.
  const popup = browserCustomerDisplayWindowIsActive(currentWindow)
    ? currentWindow
    : openWindow(
        "/customer-display",
        "yummy-go-customer-display",
        browserCustomerDisplayWindowFeatures(targetScreen),
      );

  if (!popup) return null;

  if (targetScreen) {
    // Named-window reuse does not apply window.open's requested geometry.
    popup.moveTo(Math.round(targetScreen.availLeft), Math.round(targetScreen.availTop));
    popup.resizeTo(
      Math.max(320, Math.round(targetScreen.availWidth)),
      Math.max(320, Math.round(targetScreen.availHeight)),
    );
  }
  popup.focus();

  return popup;
}
