export const PUBLIC_QR_SCAN_STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
} as const;

export type PublicQrScanStatus =
  (typeof PUBLIC_QR_SCAN_STATUS)[keyof typeof PUBLIC_QR_SCAN_STATUS];

export interface PublicQrScanState {
  requestKey: string;
  status: PublicQrScanStatus;
}

export const INITIAL_PUBLIC_QR_SCAN_STATE: PublicQrScanState = {
  requestKey: "",
  status: PUBLIC_QR_SCAN_STATUS.IDLE,
};

export function initialPublicLanguageApplied({
  activeLanguage,
  hydrated,
  initialQueryLanguage,
}: {
  activeLanguage: string;
  hydrated: boolean;
  initialQueryLanguage: string | null;
}) {
  return (
    !initialQueryLanguage ||
    (hydrated && activeLanguage === initialQueryLanguage)
  );
}

export function publicQrScanRequestKey(
  token: string,
  language: string,
  attempt: number,
) {
  return `${token.trim()}:${language}:${attempt}`;
}

export function currentPublicQrScanStatus(
  state: PublicQrScanState,
  requestKey: string,
  hasToken = true,
): PublicQrScanStatus {
  if (!hasToken) return PUBLIC_QR_SCAN_STATUS.ERROR;

  return requestKey && state.requestKey === requestKey
    ? state.status
    : PUBLIC_QR_SCAN_STATUS.IDLE;
}

export function isPublicQrScanLoading({
  hasToken,
  languageReady,
  storeLoading,
  status,
}: {
  hasToken: boolean;
  languageReady: boolean;
  storeLoading: boolean;
  status: PublicQrScanStatus;
}) {
  if (!languageReady) return true;
  if (!hasToken) return false;

  return (
    storeLoading ||
    status === PUBLIC_QR_SCAN_STATUS.IDLE ||
    status === PUBLIC_QR_SCAN_STATUS.LOADING
  );
}
