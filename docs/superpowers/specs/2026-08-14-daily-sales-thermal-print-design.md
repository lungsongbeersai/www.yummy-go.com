# Daily sales thermal print parity

## Goal

Make the daily-sales auto-print output match the browser receipt semantically while respecting the thermal printer's constraints:

- never emit a `line` operation;
- render dividers as the short text `------------------`;
- show Invoice No., Quantity, and Amount in every date group;
- leave two blank lines after the report date range;
- render all printable text in bold in both outputs.

## Design

The current printer agent ignores `bold` and `size` for `lr` operations. The daily-sales report will therefore produce every visible thermal line with a `text` operation and `bold: true`. A local fixed-width formatter will build:

- three-column lines for the invoice header and invoice rows;
- two-column lines for totals and payment summary values;
- safe truncation for labels that would otherwise push values beyond the 80 mm receipt width.

The browser receipt will keep its grid-based layout, use the same short text divider, and add a report-local rule that makes all text bold. This preserves readable browser layout without changing shared receipt styles or other reports.

## Scope

- Update `src/features/report/daily-sales/daily-sales-report-print.ts`.
- Update its colocated unit tests to assert the thermal operation contract and browser HTML contract.
- Preserve the existing uncommitted daily-sales layout changes in the workspace.

No printer-agent or backend change is included. That larger alternative would be required only if precise Unicode column widths are needed across all reports.

## Error handling and compatibility

The formatter will retain invoice numbers, quantities, and amounts; only overly long display labels can be truncated to keep monetary values visible. Empty labels will continue to use the existing English fallback values.

## Verification

Tests will first demonstrate the required contract, then verify that:

- the thermal payload contains no `line` operations and uses only the short dash divider;
- all visible thermal text operations are bold;
- each date group contains Invoice No., Quantity, and Amount before its rows;
- the date-range metadata is followed by two blank lines;
- the browser HTML contains the same labels/data and a global bold rule.

Run the targeted Vitest file, TypeScript typecheck, and lint for the modified files. A physical 80 mm printer check remains necessary because printer font metrics are hardware-dependent.
