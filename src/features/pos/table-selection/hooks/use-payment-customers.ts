"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import { useTranslation } from "react-i18next";
import { customerFormInput } from "@/features/settings/customer/customer-utils";
import { toApiLanguage } from "@/lib/language";
import type { Customer } from "@/services/customer";
import { authStoreUuid, type AuthUser } from "@/stores/auth-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useToastStore } from "@/stores/toast-store";
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
  const { t } = useTranslation();
  const loadCustomers = useCustomerStore((state) => state.load);
  const saveCustomer = useCustomerStore((state) => state.save);
  const showToast = useToastStore((state) => state.show);
  const storeUuid = authStoreUuid(user);
  const [customerUuid, setCustomerUuid] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerCreateOpen, setCustomerCreateOpen] = useState(false);
  const [customerCreateSaving, setCustomerCreateSaving] = useState(false);
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
    setCustomerCreateOpen(false);
    setCustomerCreateSaving(false);
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

  // เปิด/ปิด dialog หรือสลับร้าน/ภาษา = ล้างรายชื่อลูกค้าที่ค้างอยู่
  useResetOnDeps([language, open, resetCustomers, storeUuid], () => resetCustomers());

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
    if (!open || customerUuid || !storeUuid || customerCreateOpen) return;

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
  }, [customerCreateOpen, customerUuid, language, loadCustomers, open, selectCustomer, storeUuid]);

  const handleCustomerOpenChange = useCallback((nextOpen: boolean) => {
    setCustomerOpen(nextOpen);
    if (nextOpen) setCustomerSearch("");
    else setCustomerSearchLoading(false);
  }, []);

  const handleCustomerSelect = useCallback(
    (customer: Customer) => selectCustomer(customer, true),
    [selectCustomer],
  );

  const openCustomerCreate = useCallback(() => {
    if (!storeUuid) {
      showToast({
        title: t("settings.saveFailed"),
        description: t("settings.storeRequired"),
        tone: "error",
      });
      return;
    }

    setCustomerOpen(false);
    setCustomerSearch("");
    setCustomerCreateOpen(true);
  }, [showToast, storeUuid, t]);

  const handleCustomerCreateOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (customerCreateSaving) return;
      setCustomerCreateOpen(nextOpen);
    },
    [customerCreateSaving],
  );

  const handleCustomerCreateSubmit = useCallback(
    async (formData: FormData) => {
      if (customerCreateSaving) return;

      const name = String(formData.get("customer_name") ?? "").trim();
      if (!storeUuid) {
        showToast({
          title: t("settings.saveFailed"),
          description: t("settings.storeRequired"),
          tone: "error",
        });
        return;
      }
      if (!name) {
        showToast({
          title: t("settings.saveFailed"),
          description: t("settings.customerNameRequired"),
          tone: "error",
        });
        return;
      }

      setCustomerCreateSaving(true);
      try {
        const savedCustomer = await saveCustomer(customerFormInput(formData, storeUuid, null));
        let nextCustomer: Customer | null = customerUuidOf(savedCustomer) ? savedCustomer : null;

        if (!nextCustomer) {
          try {
            const rows = await loadCustomers({
              store_uuid_fk: storeUuid,
              page: 1,
              limit: CUSTOMER_SEARCH_LIMIT,
              search: name,
              lang: toApiLanguage(language),
            });
            const options = dedupeCustomers(rows);
            nextCustomer =
              defaultCustomerFromRows(options, name) ??
              options.find((customer) => Boolean(customerUuidOf(customer))) ??
              null;
            setCustomerOptions(withSelectedCustomer(options, nextCustomer));
          } catch {
            nextCustomer = null;
          }
        }

        if (nextCustomer) selectCustomer(nextCustomer, true);
        else setCustomerSearch(name);

        setCustomerCreateOpen(false);
        showToast({ title: t("settings.saved"), tone: "success" });
      } catch (error) {
        showToast({
          title: t("settings.saveFailed"),
          description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
          tone: "error",
        });
      } finally {
        setCustomerCreateSaving(false);
      }
    },
    [
      customerCreateSaving,
      language,
      loadCustomers,
      saveCustomer,
      selectCustomer,
      showToast,
      storeUuid,
      t,
    ],
  );

  return {
    customerCreateOpen,
    customerCreateSaving,
    customerOpen,
    customerOptions,
    customerSearch,
    customerSearchLoading,
    customerUuid,
    handleCustomerOpenChange,
    handleCustomerSelect,
    handleCustomerCreateOpenChange,
    handleCustomerCreateSubmit,
    openCustomerCreate,
    selectedCustomerOption,
    setCustomerSearch,
  };
}
