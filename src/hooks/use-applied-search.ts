"use client";

import { useCallback, useState } from "react";

interface ApplySearchOptions {
  page: number;
  reload: () => void;
  resetPage: () => void;
}

export function useAppliedSearch(search: string) {
  const [appliedSearch, setAppliedSearch] = useState(search);

  const applySearch = useCallback(
    ({ page, reload, resetPage }: ApplySearchOptions) => {
      if (page !== 1) {
        setAppliedSearch(search);
        resetPage();
        return;
      }

      if (search === appliedSearch) reload();
      else setAppliedSearch(search);
    },
    [appliedSearch, search]
  );

  return {
    appliedSearch,
    applySearch
  };
}
