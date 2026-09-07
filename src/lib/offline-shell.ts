import {
  OFFLINE_INFRA_PATHS,
  OFFLINE_PROTECTED_PATHS,
} from "./offline-routes";

// HTML shells, not API/data permissions. AuthGuard and the per-endpoint offline
// transport still own authorization and mutation safety.
export const OFFLINE_SHELL_ROUTES = [
  ...OFFLINE_INFRA_PATHS,
  ...OFFLINE_PROTECTED_PATHS,
] as const;

// Warm public entry documents during service-worker install as well as the
// cashier entry points. This prevents an unauthenticated browser from falling
// through to Chrome's ERR_INTERNET_DISCONNECTED page after the first online
// visit, before a login has ever happened.
export const CORE_OFFLINE_SHELL_ROUTES = [
  "/",
  "/home",
  "/policy",
  "/login",
  "/pos/tables",
  "/pos/order",
] as const;

export function isOfflineShellRoute(path: string) {
  return OFFLINE_SHELL_ROUTES.some((route) => route === path);
}
