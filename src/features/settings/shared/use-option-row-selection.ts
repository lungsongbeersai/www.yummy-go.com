"use client";

import { useEffect, useMemo, useState } from "react";

export function useOptionRowSelection<Row>(rows: Row[], getId: (row: Row) => string) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const ids = useMemo(() => rows.map(getId).filter(Boolean), [getId, rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedRows.has(id));

  useEffect(() => {
    setSelectedRows((current) => {
      if (!current.size) return current;
      const allowed = new Set(ids);
      let changed = false;
      const next = new Set<string>();
      current.forEach((id) => {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : current;
    });
  }, [ids]);

  function toggleSelected(id: string, checked: boolean) {
    if (!id) return;
    setSelectedRows((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedRows(checked ? new Set(ids) : new Set());
  }

  function removeSelected(id: string) {
    setSelectedRows((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  return {
    allSelected,
    ids,
    removeSelected,
    selectedRows,
    toggleAll,
    toggleSelected
  };
}
