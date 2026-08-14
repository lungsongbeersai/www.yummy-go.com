# Daily Sales Thermal Print Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the daily-sales thermal receipt use short text dividers, show its complete invoice header, provide space after the date range, and print every visible line in bold while preserving semantic parity with the browser receipt.

**Architecture:** Keep browser printing as HTML/CSS with its current three-column grid, and add a report-local bold rule plus the shared short divider text. Replace thermal `lr` rows with `text` rows built by fixed-width local formatters, because the printer agent does not apply bold to `lr` operations. The formatter will reserve space for invoice/quantity/amount and label/value pairs, truncating only display labels to protect numeric totals.

**Tech Stack:** TypeScript, Vitest, the existing `ReportPrintOp` protocol, HTML/CSS receipt template.

## Global Constraints

- Do not add dependencies or change printer-agent/backend behavior.
- Do not emit a `ReportPrintOp` with `type: "line"` or `type: "lr"` for this report.
- Use exactly `------------------` for every report divider.
- Every visible `text` thermal operation must set `bold: true`.
- Leave one `{ type: "blank", n: 2 }` operation immediately after the date-range operation.
- Preserve the existing uncommitted invoice-group layout and only change daily-sales print code/tests.
- Use `@/` imports, TypeScript without `any`, and retain the existing no-currency amount format.

---

### Task 1: Lock down the daily-sales print contract and implement the thermal formatter

**Files:**
- Modify: `src/features/report/daily-sales/daily-sales-report-print.test.ts`
- Modify: `src/features/report/daily-sales/daily-sales-report-print.ts`

**Interfaces:**
- Consumes: `buildDailySalesPrintData(input): DailySalesPrintData`, `renderDailySalesPrintHtml(data): string`, and `buildDailySalesReportOps(data): ReportPrintOp[]`.
- Produces: a daily-sales thermal payload containing only bold `text` and non-visible `blank` operations; an HTML receipt that contains the same invoice labels/data and applies a local all-bold rule.

- [ ] **Step 1: Replace stale layout assertions with a failing thermal contract test**

  In `daily-sales-report-print.test.ts`, replace the tests that expect `invoiceNumber x5`, contiguous `<span>` elements, or `lr` operations. Add this test before changing production code:

  ```ts
  it("uses bold text rows, short dash dividers, and two blank lines after the date range", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ invoiceNumber: "120826-0011", lineTotal: 150000 })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const printableOps = ops.filter((op) => op.type === "text");
    const rangeIndex = ops.findIndex(
      (op) => op.text === "period: 2026-07-13 - 2026-07-13",
    );

    expect(ops.some((op) => op.type === "line" || op.type === "lr")).toBe(false);
    expect(printableOps.length).toBeGreaterThan(0);
    printableOps.forEach((op) => expect(op.bold).toBe(true));
    expect(printableOps.filter((op) => op.text === "------------------").length).toBeGreaterThan(0);
    expect(ops[rangeIndex + 1]).toMatchObject({ type: "blank", n: 2 });
    expect(ops[rangeIndex + 2]).toMatchObject({
      type: "text",
      text: "printedBy: cashier",
      bold: true,
    });
  });
  ```

- [ ] **Step 2: Add a failing browser/thermal parity test**

  Add a test that verifies every date group exposes all three labels and a concrete invoice in both representations:

  ```ts
  it("keeps Invoice No., Quantity, and Amount visible in both print outputs", () => {
    const data = buildDailySalesPrintData({
      bills: [bill({ invoiceNumber: "080826-0002", qtyTotal: 52, lineTotal: 9260636 })],
      dateFrom: "2026-07-13",
      dateTo: "2026-07-13",
      labels,
      user,
    });

    const ops = buildDailySalesReportOps(data);
    const html = renderDailySalesPrintHtml(data);
    const header = ops.find((op) =>
      op.type === "text" &&
      op.text?.includes("invoiceNumber") &&
      op.text.includes("quantity") &&
      op.text.includes("totalAmount"),
    );
    const invoiceRow = ops.find((op) =>
      op.type === "text" && op.text?.includes("080826-0002"),
    );

    expect(header).toBeDefined();
    expect(invoiceRow?.text).toContain("52");
    expect(invoiceRow?.text).toContain("9,260,636");
    expect(html).toContain('class="invoice-row header"');
    expect(html).toContain("invoiceNumber");
    expect(html).toContain("quantity");
    expect(html).toContain("totalAmount");
    expect(html).toContain("080826-0002");
    expect(html).toContain("9,260,636");
    expect(html).toContain("body, body * { font-weight: 700; }");
  });
  ```

- [ ] **Step 3: Run the targeted test to prove the new contract fails**

  Run:

  ```powershell
  npx vitest run src/features/report/daily-sales/daily-sales-report-print.test.ts
  ```

  Expected: the new tests fail because current thermal output still contains `lr` operations, uses 32 dashes, and leaves visible rows with `bold: false`.

- [ ] **Step 4: Add fixed-width text formatters and make thermal output bold**

  In `daily-sales-report-print.ts`:

  1. Change `RECEIPT_DIVIDER` to `"------------------"`.
  2. Add `quantity: string` back to `DailySalesPrintLabels` and render the invoice header with `labels.quantity || labels.totalQuantity || "Quantity"` in both browser and thermal paths.
  3. Add `fitThermalText(value: string, width: number)`, `thermalInvoiceLine(invoice, labels)`, and `thermalSummaryLine(label, value)` helpers. Use a 16-character invoice column, a 9-character quantity column, a 14-character amount column, and a 24-character summary label column; truncate only the overlong text cell with `…` before padding.
  4. Add a local `text(text, align, size)` factory that returns `{ type: "text", text, align, bold: true, size }`.
  5. Replace every visible thermal `lr` operation with that text factory. Generate invoice headers/rows with `thermalInvoiceLine`, summary rows with `thermalSummaryLine`, and all dividers with `text(RECEIPT_DIVIDER, "left", 20)`.
  6. Change the date-range spacer to `{ type: "blank", n: 2 }`.
  7. Add `body, body * { font-weight: 700; }` to `DAILY_SALES_EXTRA_STYLES` so browser print has the same all-bold intent.

  The key formatter shape is:

  ```ts
  function fitThermalText(value: string, width: number) {
    if (value.length <= width) return value;
    return `${value.slice(0, Math.max(0, width - 1))}…`;
  }

  function thermalSummaryLine(label: string, value: string) {
    return `${fitThermalText(label, 24).padEnd(24)} ${fitThermalText(value, 14).padStart(14)}`;
  }
  ```

- [ ] **Step 5: Run the targeted test and confirm it passes**

  Run:

  ```powershell
  npx vitest run src/features/report/daily-sales/daily-sales-report-print.test.ts
  ```

  Expected: all daily-sales print tests pass, including the new no-`lr`, short-divider, all-bold, date-range spacing, and browser/thermal parity assertions.

- [ ] **Step 6: Run static verification**

  Run:

  ```powershell
  npm run typecheck
  npm run lint -- --file src/features/report/daily-sales/daily-sales-report-print.ts --file src/features/report/daily-sales/daily-sales-report-print.test.ts
  ```

  Expected: both commands exit successfully without errors related to the changed report files.

- [ ] **Step 7: Review the final diff without staging unrelated changes**

  Run:

  ```powershell
  git diff --check -- src/features/report/daily-sales/daily-sales-report-print.ts src/features/report/daily-sales/daily-sales-report-print.test.ts
  git diff -- src/features/report/daily-sales/daily-sales-report-print.ts src/features/report/daily-sales/daily-sales-report-print.test.ts
  ```

  Expected: no whitespace errors and a diff limited to the requested printer layout and its colocated tests. Do not commit the pre-existing uncommitted workspace changes unless the user explicitly requests a commit.
