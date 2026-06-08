"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import {
  LIMIT_QUERY_PARAM,
  PAGE_QUERY_PARAM,
  normalizeUrlLimit,
  normalizeUrlPage,
  samePageLimit,
  type UrlPaginationState,
} from "@/lib/url-pagination";
import type { PageLimit } from "@/services/shared/types";

type PageUpdate = number | ((current: number) => number);

interface UseUrlPaginationOptions {
  defaultLimit?: PageLimit;
  initialPagination: UrlPaginationState;
  limitOptions?: PageLimit[];
}

export function useUrlPagination({
  defaultLimit = DEFAULT_PAGE_LIMIT,
  initialPagination,
  limitOptions = PAGE_LIMIT_OPTIONS,
}: UseUrlPaginationOptions) {
  const pathname = usePathname();
  const router = useRouter();
  const [page, setPageState] = useState(initialPagination.page);
  const [limit, setLimitState] = useState<PageLimit>(initialPagination.limit);

  const replaceUrl = useCallback(
    (nextPage: number, nextLimit: PageLimit) => {
      if (typeof window === "undefined") return;

      const params = new URLSearchParams(window.location.search);
      if (nextPage > 1) params.set(PAGE_QUERY_PARAM, String(nextPage));
      else params.delete(PAGE_QUERY_PARAM);

      if (samePageLimit(nextLimit, defaultLimit)) params.delete(LIMIT_QUERY_PARAM);
      else params.set(LIMIT_QUERY_PARAM, String(nextLimit));

      const query = params.toString();
      const nextSearch = query ? `?${query}` : "";
      if (window.location.search === nextSearch) return;

      router.replace(`${pathname}${nextSearch}`, { scroll: false });
    },
    [defaultLimit, pathname, router],
  );

  const goToPage = useCallback(
    (nextPage: PageUpdate) => {
      const safePage = normalizeUrlPage(typeof nextPage === "function" ? nextPage(page) : nextPage);
      setPageState(safePage);
      replaceUrl(safePage, limit);
    },
    [limit, page, replaceUrl],
  );

  const changeLimit = useCallback(
    (nextLimit: PageLimit) => {
      const safeLimit = normalizeUrlLimit(nextLimit, defaultLimit, limitOptions);
      setLimitState(safeLimit);
      setPageState(1);
      replaceUrl(1, safeLimit);
    },
    [defaultLimit, limitOptions, replaceUrl],
  );

  const resetPage = useCallback(() => {
    setPageState(1);
    replaceUrl(1, limit);
  }, [limit, replaceUrl]);

  useEffect(() => {
    setPageState(initialPagination.page);
    setLimitState(initialPagination.limit);
  }, [initialPagination.limit, initialPagination.page]);

  useEffect(() => {
    replaceUrl(initialPagination.page, initialPagination.limit);
  }, [initialPagination.limit, initialPagination.page, replaceUrl]);

  return {
    changeLimit,
    goToPage,
    limit,
    page,
    resetPage,
    setPage: goToPage,
  };
}
