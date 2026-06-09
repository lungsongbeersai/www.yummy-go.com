import type {
  branchServiceCharge,
  buildGroupedTableRows
} from "./table-utils";

export type TableGroupedRows = ReturnType<typeof buildGroupedTableRows>;
export type TableGroupedRow = TableGroupedRows[number];
export type TableServiceCharge = ReturnType<typeof branchServiceCharge>;
