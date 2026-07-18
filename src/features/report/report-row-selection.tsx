"use client";

import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { Checkbox, type CheckboxProps } from "@/components/ui/checkbox";
import {
  nextRowSelectionIds,
  nextRowsSelectionIds,
  selectedRowsForIds,
  selectionStateForVisibleIds,
} from "./report-row-selection-utils";

export {
  nextRowSelectionIds,
  nextRowsSelectionIds,
  selectedRowsForIds,
  selectionStateForVisibleIds,
} from "./report-row-selection-utils";

export interface UseReportRowSelectionOptions<Row> {
  getRowId: (row: Row) => string;
  rows: Row[];
}

export interface UseReportRowSelectionResult<Row> {
  allVisibleSelected: boolean;
  clearSelection: () => void;
  isRowSelected: (row: Row) => boolean;
  selectedCount: number;
  selectedRows: Row[];
  selectedRowIds: Set<string>;
  someVisibleSelected: boolean;
  toggleRow: (row: Row, selected: boolean) => void;
  toggleRows: (rows: Row[], selected: boolean) => void;
}

export function useReportRowSelection<Row>({
  getRowId,
  rows,
}: UseReportRowSelectionOptions<Row>): UseReportRowSelectionResult<Row> {
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(
    () => new Set(),
  );
  const visibleIds = useMemo(() => rows.map(getRowId), [getRowId, rows]);
  const { allVisibleSelected, someVisibleSelected } = useMemo(
    () => selectionStateForVisibleIds(visibleIds, selectedRowIds),
    [selectedRowIds, visibleIds],
  );
  const selectedRows = useMemo(
    () => selectedRowsForIds(rows, selectedRowIds, getRowId),
    [getRowId, rows, selectedRowIds],
  );

  // โหลดข้อมูลชุดใหม่ = ล้างรายการที่เลือกไว้ทั้งหมด
  useResetOnChange(rows, () => setSelectedRowIds(new Set()));

  const clearSelection = useCallback(() => {
    setSelectedRowIds(new Set());
  }, []);

  const isRowSelected = useCallback(
    (row: Row) => selectedRowIds.has(getRowId(row)),
    [getRowId, selectedRowIds],
  );

  const toggleRow = useCallback(
    (row: Row, selected: boolean) => {
      const rowId = getRowId(row);
      setSelectedRowIds((current) =>
        nextRowSelectionIds(current, rowId, selected),
      );
    },
    [getRowId],
  );

  const toggleRows = useCallback(
    (targetRows: Row[], selected: boolean) => {
      const rowIds = targetRows.map(getRowId);
      setSelectedRowIds((current) =>
        nextRowsSelectionIds(current, rowIds, selected),
      );
    },
    [getRowId],
  );

  return {
    allVisibleSelected,
    clearSelection,
    isRowSelected,
    selectedCount: selectedRowIds.size,
    selectedRows,
    selectedRowIds,
    someVisibleSelected,
    toggleRow,
    toggleRows,
  };
}

export function ReportIndeterminateCheckbox({
  indeterminate = false,
  ...props
}: CheckboxProps & { indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return createElement(Checkbox, {
    ref,
    "aria-checked": indeterminate ? "mixed" : props.checked ? "true" : "false",
    ...props,
  });
}
