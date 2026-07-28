export interface PageRefreshRegistration {
  busy: boolean;
  disabled: boolean;
  id: string;
  label: string;
  refresh: () => Promise<void> | void;
}

export type PageRefreshEvent =
  | { type: "register"; registration: PageRefreshRegistration }
  | { type: "unregister"; id: string };

export function reducePageRefreshRegistration(
  state: PageRefreshRegistration | null,
  event: PageRefreshEvent,
): PageRefreshRegistration | null {
  if (event.type === "register") return event.registration;
  return state?.id === event.id ? null : state;
}
