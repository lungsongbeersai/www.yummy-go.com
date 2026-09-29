"use client";

import { useCallback, useMemo, useState } from "react";
import type { PageLimit, SortOrder } from "@/services/shared/types";

export function useClientSettingsList<T>(
  rows: T[],
  rowId: (row: T) => string,
  searchableText: (row: T) => string,
) {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [orderBy, setOrderBy] = useState<SortOrder>("ASC");
  const [limit, setLimit] = useState<PageLimit>(20);
  const [page, setPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const clearSelection = useCallback(() => setSelectedRows(new Set()), []);

  const filteredRows = useMemo(() => {
    const needle = appliedSearch.trim().toLocaleLowerCase();
    const matches = needle
      ? rows.filter((row) => searchableText(row).toLocaleLowerCase().includes(needle))
      : rows;
    return orderBy === "DESC" ? [...matches].reverse() : matches;
  }, [appliedSearch, orderBy, rows, searchableText]);

  const total = filteredRows.length;
  const pageSize = limit === "All" ? Math.max(total, 1) : (limit ?? 20);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  const visibleRows = filteredRows.slice(offset, offset + pageSize);
  const visibleIds = visibleRows.map(rowId).filter(Boolean);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedRows.has(id));

  function toggleSelected(id: string, checked: boolean) {
    setSelectedRows((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedRows((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  return {
    allSelected,
    applySearch: () => {
      setAppliedSearch(search);
      setPage(1);
    },
    changeLimit: (next: PageLimit) => {
      setLimit(next);
      setPage(1);
    },
    clearSelection,
    limit,
    orderBy,
    page: safePage,
    pageEnd: total ? Math.min(offset + visibleRows.length, total) : 0,
    pageStart: total ? offset + 1 : 0,
    selectedRows,
    setOrderBy: (next: SortOrder) => {
      setOrderBy(next);
      setPage(1);
    },
    setPage,
    setSearch,
    search,
    toggleAll,
    toggleSelected,
    total,
    totalPages,
    visibleRows,
  };
}
