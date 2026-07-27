"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import type { CartOrder, FetchCartParams } from "@/services/pos";

type CartPanelData = CartOrder | CartOrder[] | null;

interface RefreshCartOptions {
  clearBeforeLoad?: boolean;
  showLoading?: boolean;
}

interface UseSelectedTableCartParams {
  language: string;
  loadCart: (params: FetchCartParams) => Promise<CartPanelData>;
  onError: (error: unknown) => void;
  selectedTableUuid: string;
  setStoreCart: (cart: CartPanelData) => void;
}

function cartRequestKey(tableUuid: string, language: string) {
  return tableUuid ? `${tableUuid}:${language}` : "";
}

export function useSelectedTableCart({
  language,
  loadCart,
  onError,
  selectedTableUuid,
  setStoreCart
}: UseSelectedTableCartParams) {
  const [cart, setCart] = useState<CartPanelData>(null);
  const [loading, setLoading] = useState(false);
  const latestRequestIdRef = useRef(0);
  const latestRequestedKeyRef = useRef("");

  const clearCart = useCallback(() => {
    latestRequestIdRef.current += 1;
    latestRequestedKeyRef.current = "";
    setCart(null);
    setLoading(false);
    setStoreCart(null);
  }, [setStoreCart]);

  const refreshCartForTable = useCallback(
    async (tableUuid: string, { clearBeforeLoad = false, showLoading = true }: RefreshCartOptions = {}) => {
      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      latestRequestedKeyRef.current = cartRequestKey(tableUuid, language);

      if (!tableUuid) {
        setCart(null);
        setStoreCart(null);
        setLoading(false);
        return null;
      }

      if (clearBeforeLoad) {
        setCart(null);
        setStoreCart(null);
      }
      if (showLoading) setLoading(true);

      try {
        const nextCart = await loadCart({ table_uuid: tableUuid, lang: language });
        if (latestRequestIdRef.current === requestId) setCart(nextCart);
        return nextCart;
      } catch (error) {
        if (latestRequestIdRef.current === requestId) throw error;
        return null;
      } finally {
        if (showLoading && latestRequestIdRef.current === requestId) setLoading(false);
      }
    },
    [language, loadCart, setStoreCart]
  );

  const refreshSelectedCart = useCallback(
    (options?: RefreshCartOptions) => refreshCartForTable(selectedTableUuid, options),
    [refreshCartForTable, selectedTableUuid]
  );

  const selectedRequestKey = cartRequestKey(selectedTableUuid, language);
  useResetOnChange(selectedRequestKey, () => {
    setCart(null);
    setLoading(false);
  });

  useEffect(() => {
    if (!selectedTableUuid) {
      latestRequestIdRef.current += 1;
      latestRequestedKeyRef.current = "";
      setStoreCart(null);
      return;
    }

    if (latestRequestedKeyRef.current === selectedRequestKey) return;

    latestRequestIdRef.current += 1;
    latestRequestedKeyRef.current = "";
    setStoreCart(null);
    void refreshSelectedCart().catch(onError);
  }, [onError, refreshSelectedCart, selectedRequestKey, selectedTableUuid, setStoreCart]);

  return {
    cart,
    clearCart,
    loading,
    refreshCartForTable,
    refreshSelectedCart
  };
}
