export interface ReportRowSelectionState {
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
}

export function selectedRowsForIds<Row>(
  rows: Row[],
  selectedIds: Set<string>,
  getRowId: (row: Row) => string,
) {
  if (!selectedIds.size) return [];
  return rows.filter((row) => selectedIds.has(getRowId(row)));
}

export function selectionStateForVisibleIds(
  visibleIds: string[],
  selectedIds: Set<string>,
): ReportRowSelectionState {
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));

  return {
    allVisibleSelected,
    someVisibleSelected,
  };
}

export function nextRowSelectionIds(
  selectedIds: Set<string>,
  rowId: string,
  selected: boolean,
) {
  const next = new Set(selectedIds);
  if (selected) {
    next.add(rowId);
  } else {
    next.delete(rowId);
  }
  return next;
}

export function nextRowsSelectionIds(
  selectedIds: Set<string>,
  rowIds: string[],
  selected: boolean,
) {
  const next = new Set(selectedIds);
  for (const rowId of rowIds) {
    if (selected) {
      next.add(rowId);
    } else {
      next.delete(rowId);
    }
  }
  return next;
}
