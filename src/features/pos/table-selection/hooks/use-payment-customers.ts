"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toApiLanguage } from "@/lib/language";
import type { Customer } from "@/services/customer";
import { authStoreUuid, type AuthUser } from "@/stores/auth-store";
import { useCustomerStore } from "@/stores/customer-store";
import {
  CUSTOMER_SEARCH_DEBOUNCE_MS,
  CUSTOMER_SEARCH_LIMIT,
  customerUuidOf,
  dedupeCustomers,
  defaultCustomerFromRows,
  defaultCustomerSearchTerm,
  withSelectedCustomer,
} from "../payment-dialog-utils";

interface UsePaymentCustomersParams {
  language: string;
  open: boolean;
  user: AuthUser | null;
}

export function usePaymentCustomers({
  language,
  open,
  user,
}: UsePaymentCustomersParams) {
  const loadCustomers = useCustomerStore((state) => state.load);
  const storeUuid = authStoreUuid(user);
  const [customerUuid, setCustomerUuid] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const listRequestIdRef = useRef(0);
  const defaultRequestIdRef = useRef(0);
  const selectionVersionRef = useRef(0);
  const selectedCustomerRef = useRef<Customer | null>(null);

  const resetCustomers = useCallback(() => {
    listRequestIdRef.current += 1;
    defaultRequestIdRef.current += 1;
    selectionVersionRef.current += 1;
    selectedCustomerRef.current = null;
    setCustomerUuid("");
    setCustomerOpen(false);
    setCustomerSearch("");
    setCustomerOptions([]);
    setSelectedCustomer(null);
    setCustomerSearchLoading(false);
  }, []);

  const selectCustomer = useCallback((customer: Customer, close = false) => {
    const uuid = customerUuidOf(customer);
    if (!uuid) return;

    selectionVersionRef.current += 1;
    selectedCustomerRef.current = customer;
    setCustomerUuid(uuid);
    setSelectedCustomer(customer);
    setCustomerOptions((options) => withSelectedCustomer(options, customer));
    if (close) setCustomerOpen(false);
  }, []);

  const selectedCustomerOption = useMemo(
    () =>
      selectedCustomer ??
      customerOptions.find(
        (customer) => customerUuidOf(customer) === customerUuid,
      ) ??
      null,
    [customerOptions, customerUuid, selectedCustomer],
  );

  useEffect(() => {
    resetCustomers();
  }, [language, open, resetCustomers, storeUuid]);

  useEffect(() => {
    selectedCustomerRef.current = selectedCustomer;
  }, [selectedCustomer]);

  useEffect(() => {
    if (!open || !customerOpen) return;

    if (!storeUuid) {
      setCustomerOptions(
        selectedCustomerRef.current ? [selectedCustomerRef.current] : [],
      );
      setCustomerSearchLoading(false);
      return;
    }

    const requestId = listRequestIdRef.current + 1;
    listRequestIdRef.current = requestId;
    const query = customerSearch.trim();
    const debounceMs = query ? CUSTOMER_SEARCH_DEBOUNCE_MS : 0;
    const timer = window.setTimeout(() => {
      void (async () => {
        setCustomerSearchLoading(true);
        try {
          const rows = await loadCustomers({
            store_uuid_fk: storeUuid,
            page: 1,
            limit: CUSTOMER_SEARCH_LIMIT,
            search: query,
            lang: toApiLanguage(language),
          });
          if (listRequestIdRef.current !== requestId) return;

          setCustomerOptions(
            withSelectedCustomer(
              dedupeCustomers(rows),
              selectedCustomerRef.current,
            ),
          );
        } catch {
          if (listRequestIdRef.current === requestId) {
            setCustomerOptions(
              selectedCustomerRef.current ? [selectedCustomerRef.current] : [],
            );
          }
        } finally {
          if (listRequestIdRef.current === requestId) {
            setCustomerSearchLoading(false);
          }
        }
      })();
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      if (listRequestIdRef.current === requestId) listRequestIdRef.current += 1;
    };
  }, [customerOpen, customerSearch, language, loadCustomers, open, storeUuid]);

  useEffect(() => {
    if (!open || customerUuid || !storeUuid) return;

    const requestId = defaultRequestIdRef.current + 1;
    defaultRequestIdRef.current = requestId;
    const selectionVersion = selectionVersionRef.current;
    const term = defaultCustomerSearchTerm(language);

    void (async () => {
      try {
        const rows = await loadCustomers({
          store_uuid_fk: storeUuid,
          page: 1,
          limit: CUSTOMER_SEARCH_LIMIT,
          search: term,
          lang: toApiLanguage(language),
        });
        if (
          defaultRequestIdRef.current !== requestId ||
          selectionVersionRef.current !== selectionVersion
        )
          return;

        const customer = defaultCustomerFromRows(rows, term);
        if (customer) selectCustomer(customer);
      } catch {
        return;
      }
    })();

    return () => {
      if (defaultRequestIdRef.current === requestId) {
        defaultRequestIdRef.current += 1;
      }
    };
  }, [customerUuid, language, loadCustomers, open, selectCustomer, storeUuid]);

  const handleCustomerOpenChange = useCallback((nextOpen: boolean) => {
    setCustomerOpen(nextOpen);
    if (nextOpen) setCustomerSearch("");
    else setCustomerSearchLoading(false);
  }, []);

  const handleCustomerSelect = useCallback(
    (customer: Customer) => selectCustomer(customer, true),
    [selectCustomer],
  );

  return {
    customerOpen,
    customerOptions,
    customerSearch,
    customerSearchLoading,
    customerUuid,
    handleCustomerOpenChange,
    handleCustomerSelect,
    selectedCustomerOption,
    setCustomerSearch,
  };
}
