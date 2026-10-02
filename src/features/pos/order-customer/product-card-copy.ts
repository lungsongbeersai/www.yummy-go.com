const DESKTOP_PRODUCT_CARD_COPY = {
  chooseActionKey: "pos.chooseOptionsAction",
  showVariablePriceHint: false,
} as const;

const NATIVE_MOBILE_PRODUCT_CARD_COPY = {
  chooseActionKey: "pos.mobileOptionsAction",
  showVariablePriceHint: false,
} as const;

/**
 * Copy changes requested for the compact native POS must stay out of the web
 * and Electron desktop surfaces, even when those windows use a mobile width.
 */
export function productCardCopy(nativeMobile: boolean) {
  return nativeMobile
    ? NATIVE_MOBILE_PRODUCT_CARD_COPY
    : DESKTOP_PRODUCT_CARD_COPY;
}

export function productCardRadiusClass() {
  return "rounded-md";
}
