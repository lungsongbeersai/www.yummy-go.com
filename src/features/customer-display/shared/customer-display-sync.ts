export const CUSTOMER_DISPLAY_STORAGE_KEY = "yummy-go:customer-display-payload";
export const CUSTOMER_DISPLAY_CHANNEL = "yummy-go:customer-display";

export interface CustomerDisplayItem {
  image?: string | null;
  imageColor?: string | null;
  name: string;
  note?: string | null;
  price?: number | null;
  qty: number;
  status?: string | null;
  total: number;
}

export type CustomerDisplayMode = "order" | "payment";

export interface CustomerDisplayPayment {
  amount: number;
  invoice?: string | null;
  qrUrl: string | null;
}

export interface CustomerDisplayPayload {
  discount: number;
  grand_total: number;
  invoice?: string | null;
  items: CustomerDisplayItem[];
  mode?: CustomerDisplayMode;
  payment?: CustomerDisplayPayment | null;
  service: number;
  subtotal: number;
  table_name: string;
  total: number;
  updated_at: string;
  vat: number;
}

export function withCustomerDisplayOrderMode(
  payload: CustomerDisplayPayload
): CustomerDisplayPayload {
  const next = { ...payload, mode: "order" as const };
  delete next.payment;
  return next;
}

export function withCustomerDisplayPaymentMode(
  payload: CustomerDisplayPayload,
  payment: CustomerDisplayPayment
): CustomerDisplayPayload {
  return {
    ...payload,
    mode: "payment",
    payment
  };
}

type CustomerDisplayElectronApi = {
  sendToDisplay: (data: CustomerDisplayPayload) => void;
};

type CustomerDisplayBroadcastChannelLike = {
  close: () => void;
  postMessage: (data: CustomerDisplayPayload) => void;
};

type CustomerDisplayBroadcastChannelConstructor = new (
  channelName: string
) => CustomerDisplayBroadcastChannelLike;

type CustomerDisplayPublishTarget = {
  BroadcastChannel?: CustomerDisplayBroadcastChannelConstructor;
  electronAPI?: CustomerDisplayElectronApi;
  localStorage?: Pick<Storage, "setItem">;
  setTimeout?: (handler: () => void, timeout: number) => unknown;
};

export type PublishCustomerDisplayPayloadOptions = {
  browser?: boolean;
  electron?: boolean;
  repeatBrowserMessage?: boolean;
  repeatDelayMs?: number;
  target?: CustomerDisplayPublishTarget;
};

export function publishCustomerDisplayPayload(
  payload: CustomerDisplayPayload,
  options: PublishCustomerDisplayPayloadOptions = {}
) {
  const target =
    options.target ?? (typeof window === "undefined" ? undefined : window);
  const sendElectron = options.electron ?? Boolean(target?.electronAPI);
  const sendBrowser = options.browser ?? !sendElectron;

  if (sendElectron) {
    target?.electronAPI?.sendToDisplay(payload);
  }

  if (!sendBrowser) return;

  target?.localStorage?.setItem(
    CUSTOMER_DISPLAY_STORAGE_KEY,
    JSON.stringify(payload)
  );

  if (!target?.BroadcastChannel) return;

  const channel = new target.BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
  channel.postMessage(payload);

  if (!options.repeatBrowserMessage || !target.setTimeout) {
    channel.close();
    return;
  }

  target.setTimeout(() => {
    channel.postMessage(payload);
    channel.close();
  }, options.repeatDelayMs ?? 600);
}
