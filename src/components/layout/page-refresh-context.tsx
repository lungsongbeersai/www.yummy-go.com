"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  reducePageRefreshRegistration,
  type PageRefreshRegistration,
} from "@/components/layout/page-refresh-state";

interface PageRefreshContextValue {
  register: (registration: PageRefreshRegistration) => void;
  unregister: (id: string) => void;
}

const PageRefreshContext = createContext<PageRefreshContextValue | null>(null);
const PageRefreshActionContext = createContext<PageRefreshRegistration | null | undefined>(
  undefined,
);

export interface PageRefreshProviderProps {
  children: ReactNode;
}

export interface UsePageRefreshRegistrationOptions {
  busy?: boolean;
  disabled?: boolean;
  label: string;
  onRefresh: () => Promise<void> | void;
}

export function PageRefreshProvider({ children }: PageRefreshProviderProps) {
  const [registration, dispatch] = useReducer(reducePageRefreshRegistration, null);
  const register = useCallback((nextRegistration: PageRefreshRegistration) => {
    dispatch({ type: "register", registration: nextRegistration });
  }, []);
  const unregister = useCallback((id: string) => {
    dispatch({ type: "unregister", id });
  }, []);
  const value = useMemo(() => ({ register, unregister }), [register, unregister]);

  return (
    <PageRefreshContext.Provider value={value}>
      <PageRefreshActionContext.Provider value={registration}>
        {children}
      </PageRefreshActionContext.Provider>
    </PageRefreshContext.Provider>
  );
}

export function usePageRefreshAction(): PageRefreshRegistration | null {
  const registration = useContext(PageRefreshActionContext);
  if (registration === undefined) {
    throw new Error("usePageRefreshAction must be used within a PageRefreshProvider");
  }
  return registration;
}

export function usePageRefreshRegistration({
  busy = false,
  disabled = false,
  label,
  onRefresh,
}: UsePageRefreshRegistrationOptions) {
  const id = useId();
  const context = useContext(PageRefreshContext);

  if (!context) {
    throw new Error("usePageRefreshRegistration must be used within a PageRefreshProvider");
  }

  useEffect(() => {
    context.register({
      busy,
      disabled,
      id,
      label,
      refresh: onRefresh,
    });
    return () => context.unregister(id);
  }, [busy, context, disabled, id, label, onRefresh]);
}
