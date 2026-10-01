"use client";

import { Fragment, useCallback, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ApiEntity } from "@/services/shared/types";
import type { DailySalesBillGroup } from "@/stores/report-store";
import { SortableReportTableHead } from "../report-sort-table-head";
import {
  ReportColumnPinningProvider,
  ReportRowPinToggle,
  ReportRowPinningProvider,
} from "../shared/report-column-head";
import type { ReportColumnOption } from "../shared/report-column-visibility";
import { ReportIndeterminateCheckbox } from "../shared/report-row-selection";
import { useLocalTableSort } from "../shared/report-sort-utils";
import {
  STICKY_TABLE_CLASS,
  useStickyTable,
  type ReportColumnPinning,
} from "../shared/report-sticky-table";
import {
  detailGroupDiscountTotal as groupDiscountTotal,
  detailGroupItemDiscountTotal as groupItemDiscountTotal,
  detailGroupItemLineTotal as groupItemLineTotal,
  detailGroupQuantity as groupQuantity,
  detailGroupSellingPriceTotal as groupSellingPriceTotal,
  detailItemMoney as itemMoney,
  detailItemProductName as itemProductName,
  detailItemQuantity as itemQuantity,
} from "./daily-sales-detail-model";
import type { ReportColumn, SummaryCards } from "./daily-sales-report-types";
import {
  firstNumber,
  billGroupPaymentLabel,
  formatSaleDate,
  hasDisplayValue,
  isCancelledRow,
  isPaymentAttentionRow,
  readValue,
  reportRecordId,
  rowKey,
  statusClass,
} from "./daily-sales-report-utils";
import type { MoneyCellTone } from "./daily-sales-report-cells";
import {
  BlankCell,
  MoneyCell,
  OptionalMoneyCell,
  ProductImage,
  ProductNameCell,
  SummaryFooterBlankCell,
  SummaryFooterLabelCell,
  SummaryFooterMoneyCell,
  SummaryFooterNumberCell,
  summaryMetricNumber,
} from "./daily-sales-report-cells";

type DailySalesBillSortKey =
  | "amount"
  | "discount"
  | "invoiceNumber"
  | "itemCount"
  | "lineTotal"
  | "paymentType"
  | "salePrice"
  | "saleDate"
  | "serviceCharge"
  | "status"
  | "tableName"
  | "toppingTotal"
  | "vat";

type DetailTextColumnKey = "invoiceNumber" | "saleDate" | "tableName" | "paymentType";
type DetailNumericColumnKey = "salePrice" | "itemCount" | "toppingTotal" | "amount" | "discount" | "lineTotal";

type DetailTextColumn = { key: DetailTextColumnKey; label: string; minWidth: string };
type DetailNumericColumn = { key: DetailNumericColumnKey; label: string; minWidth: string };

function detailTextColumns(t: (key: string) => string): DetailTextColumn[] {
  return [
    { key: "invoiceNumber", label: t("report.columns.invoiceNumber"), minWidth: "min-w-[132px]" },
    { key: "saleDate", label: t("report.columns.saleDate"), minWidth: "min-w-[118px]" },
    { key: "tableName", label: t("report.columns.tableName"), minWidth: "min-w-[96px]" },
    { key: "paymentType", label: t("report.columns.paymentType"), minWidth: "min-w-[138px]" },
  ];
}

function detailNumericColumns(t: (key: string) => string): DetailNumericColumn[] {
  return [
    { key: "salePrice", label: t("report.columns.salePrice"), minWidth: "min-w-[132px]" },
    { key: "itemCount", label: t("report.columns.quantity"), minWidth: "min-w-[92px]" },
    { key: "toppingTotal", label: t("report.columns.toppingTotal"), minWidth: "min-w-[138px]" },
    { key: "amount", label: t("report.columns.amount"), minWidth: "min-w-[132px]" },
    { key: "discount", label: t("report.columns.discount"), minWidth: "min-w-[124px]" },
    { key: "lineTotal", label: t("common.total"), minWidth: "min-w-[132px]" },
  ];
}

/** ตัวเลือกของเมนู "คอลัมน์" — เลขบิลซ่อนไม่ได้ เพราะเป็นหัวของกลุ่มบิลและเป็นที่วางชื่อสินค้าในแถวรายการ */
export function detailColumnOptions(t: (key: string) => string): ReportColumnOption[] {
  return [
    ...detailTextColumns(t).map((column) => ({
      hideable: column.key !== "invoiceNumber",
      id: column.key,
      label: column.label,
    })),
    ...detailNumericColumns(t).map((column) => ({ id: column.key, label: column.label })),
    { id: "status", label: t("report.columns.status") },
  ];
}

function groupNumericCell(group: DailySalesBillGroup, key: DetailNumericColumnKey) {
  switch (key) {
    case "salePrice":
      return <OptionalMoneyCell key={key} value={groupSellingPriceTotal(group)} />;
    case "itemCount":
      return <QuantityCell key={key} value={groupQuantity(group)} />;
    case "toppingTotal":
      return <OptionalMoneyCell key={key} value={group.toppingTotal} />;
    case "amount":
      return <OptionalMoneyCell key={key} value={group.amountTotal} />;
    case "discount":
      return <OptionalMoneyCell key={key} tone="discount" value={groupDiscountTotal(group)} />;
    case "lineTotal":
      return <MoneyCell key={key} value={group.lineTotal} strong tone="total" />;
  }
}

function itemNumericCell(item: ApiEntity, key: DetailNumericColumnKey) {
  switch (key) {
    case "salePrice":
      return <OptionalMoneyCell key={key} value={itemMoney(item, ["sale_price"])} />;
    case "itemCount":
      return <QuantityCell key={key} value={itemQuantity(item)} />;
    case "toppingTotal":
      return <OptionalMoneyCell key={key} value={itemMoney(item, ["topping_total"])} />;
    case "amount":
      return <OptionalMoneyCell key={key} value={itemMoney(item, ["amount"])} />;
    case "discount":
      return <OptionalMoneyCell key={key} tone="discount" value={itemMoney(item, ["discount"])} />;
    case "lineTotal":
      return <OptionalMoneyCell key={key} tone="total" value={itemMoney(item, ["total"])} strong />;
  }
}

function billSummaryNumericCell(group: DailySalesBillGroup, key: DetailNumericColumnKey) {
  switch (key) {
    case "salePrice":
      return <OptionalMoneyCell key={key} value={groupSellingPriceTotal(group)} strong />;
    case "itemCount":
      return <QuantityCell key={key} value={groupQuantity(group)} />;
    case "toppingTotal":
      return <OptionalMoneyCell key={key} value={group.toppingTotal} strong />;
    case "amount":
      return <OptionalMoneyCell key={key} value={group.amountTotal} strong />;
    case "discount":
      return <OptionalMoneyCell key={key} tone="discount" value={groupItemDiscountTotal(group)} strong />;
    case "lineTotal":
      return <OptionalMoneyCell key={key} value={groupItemLineTotal(group)} strong />;
  }
}

function reportFooterNumericCell(
  key: DetailNumericColumnKey,
  summaryCards: SummaryCards,
  reportTotal: ApiEntity,
) {
  const metric = (keys: string[]) => summaryMetricNumber(summaryCards, reportTotal, keys);

  switch (key) {
    case "salePrice":
      return (
        <SummaryFooterMoneyCell
          key={key}
          value={metric(["product_price_total", "selling_price_total", "sale_price_total"])}
        />
      );
    case "itemCount":
      return <SummaryFooterNumberCell key={key} value={metric(["total_qty"])} />;
    case "toppingTotal":
      return (
        <SummaryFooterMoneyCell key={key} value={metric(["topping_total", "total_topping_price", "sum_topping"])} />
      );
    case "amount":
      return <SummaryFooterMoneyCell key={key} value={metric(["amount"])} />;
    case "discount":
      return (
        <SummaryFooterMoneyCell
          key={key}
          tone="discount"
          value={metric(["sum_discount", "discount_bill", "discount_item"])}
        />
      );
    case "lineTotal":
      return (
        <SummaryFooterMoneyCell
          key={key}
          strong
          tone="total"
          value={metric(["sum_total", "grand_total", "net_total"])}
        />
      );
  }
}

function groupTextValue(group: DailySalesBillGroup, key: DetailTextColumnKey, t: (key: string) => string) {
  switch (key) {
    case "invoiceNumber":
      return group.invoiceNumber;
    case "saleDate":
      return formatSaleDate(group.saleDate);
    case "tableName":
      return group.tableName;
    case "paymentType":
      return billGroupPaymentLabel(group, t);
  }
}

function QuantityCell({ value }: { value: number }) {
  return <TableCell className="text-right font-medium tabular-nums">{value.toLocaleString("en-US")}</TableCell>;
}

export function DetailBillTable({
  collapsedGroups,
  groups,
  isColumnVisible,
  pageStart,
  pinning,
  reportTotal,
  selectedRecordIds,
  summaryCards,
  onToggleGroup,
  onToggleRow,
  onToggleRows,
}: {
  collapsedGroups: Set<string>;
  groups: DailySalesBillGroup[];
  isColumnVisible: (id: string) => boolean;
  itemColumns: ReportColumn[];
  pageStart: number;
  pinning: ReportColumnPinning;
  reportTotal: ApiEntity;
  selectedRecordIds: Set<string>;
  summaryCards: SummaryCards;
  onToggleGroup: (groupId: string) => void;
  onToggleRow: (row: ApiEntity, selected: boolean) => void;
  onToggleRows: (rows: ApiEntity[], selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const textColumns = useMemo(
    () => detailTextColumns(t).filter((column) => isColumnVisible(column.key)),
    [isColumnVisible, t],
  );
  const numericColumns = useMemo(
    () => detailNumericColumns(t).filter((column) => isColumnVisible(column.key)),
    [isColumnVisible, t],
  );

  const getGroupSortValue = useCallback(
    (group: DailySalesBillGroup, key: DailySalesBillSortKey) =>
      dailySalesBillSortValue(group, key),
    [],
  );

  const {
    sort: groupSort,
    sortedRows: sortedGroups,
    toggleSort: toggleGroupSort,
  } = useLocalTableSort(groups, getGroupSortValue);

  const visibleItems = useMemo(
    () => sortedGroups.flatMap((group) => group.items),
    [sortedGroups],
  );
  const visibleItemIds = useMemo(
    () => visibleItems.map(reportRecordId),
    [visibleItems],
  );
  const allVisibleSelected =
    visibleItemIds.length > 0 &&
    visibleItemIds.every((id) => selectedRecordIds.has(id));
  const someVisibleSelected = visibleItemIds.some((id) =>
    selectedRecordIds.has(id),
  );

  const hasStatusData = useMemo(
    () =>
      visibleItems.some((item) =>
        hasDisplayValue(
          readValue(item, [
            "status_name",
            "status_text",
            "status",
            "status_code",
            "order_status_text",
            "order_it_status_text",
          ]),
        ),
      ),
    [visibleItems],
  );
  const showStatus = hasStatusData && isColumnVisible("status");
  const layout: DetailLayout = {
    numericColumns,
    showStatus,
    textSpan: textColumns.length,
  };
  // ล็อกคอลัมน์/แถวแบบเดียวกับตารางรายงานอื่น — แถวที่ล็อกได้คือแถวหัวบิล (แถวรายการสินค้าเป็นลูกของบิล)
  const stickyRef = useStickyTable(pinning);

  return (
    // container ของ Table เป็นตัวสกรอลเอง — หัวตาราง sticky ด้านบน, แถวรวม sticky ด้านล่าง
    <Table containerClassName={cn("min-h-0 flex-1 overflow-auto", STICKY_TABLE_CLASS)} containerRef={stickyRef}>
      <ReportColumnPinningProvider pinning={pinning}>
      <TableHeader className="sticky top-0 z-30 bg-muted">
        <TableRow>
          <TableHead>
            <ReportIndeterminateCheckbox
              aria-label={t("common.selectAll")}
              checked={allVisibleSelected}
              indeterminate={!allVisibleSelected && someVisibleSelected}
              onCheckedChange={(checked) => onToggleRows(visibleItems, checked as boolean)}
            />
          </TableHead>

          <TableHead>{t("fields.no")}</TableHead>

          {textColumns.map((column) => (
            <SortableReportTableHead
              key={column.key}
              sort={groupSort}
              sortKey={column.key}
              className={column.minWidth}
              columnId={column.key}
              onSort={toggleGroupSort}
            >
              {column.label}
            </SortableReportTableHead>
          ))}

          {numericColumns.map((column) => (
            <SortableReportTableHead
              key={column.key}
              align="right"
              sort={groupSort}
              sortKey={column.key}
              className={cn(column.minWidth, "text-right")}
              columnId={column.key}
              onSort={toggleGroupSort}
            >
              {column.label}
            </SortableReportTableHead>
          ))}

          {showStatus ? (
            <SortableReportTableHead
              sort={groupSort}
              sortKey="status"
              className="min-w-[118px]"
              columnId="status"
              onSort={toggleGroupSort}
            >
              {t("report.columns.status")}
            </SortableReportTableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      </ReportColumnPinningProvider>

      <ReportRowPinningProvider>
      <TableBody>
        {sortedGroups.map((group, index) => {
          const expanded = !collapsedGroups.has(group.id);
          const statusRow = group.items[0] ?? {};
          const groupItemIds = group.items.map(reportRecordId);
          const selectedItemCount = groupItemIds.filter((id) =>
            selectedRecordIds.has(id),
          ).length;
          const groupSelected =
            groupItemIds.length > 0 &&
            selectedItemCount === groupItemIds.length;
          const groupPartiallySelected =
            selectedItemCount > 0 && !groupSelected;
          const groupNeedsAttention =
            !group.cancelled &&
            isPaymentAttentionRow({
              debt_amount: group.debtAmount,
              payment_method: group.paymentType,
              status: group.status,
            });

          return (
            <Fragment key={group.id}>
              <TableRow
                className={cn(
                  // สีพื้นบอกสถานะบิล (ค้างชำระ/ยกเลิก) — เป็นข้อมูล ไม่ใช่การตกแต่ง
                  groupNeedsAttention && "bg-warning/10 hover:bg-warning/15",
                  group.cancelled && "bg-destructive/5 hover:bg-destructive/10",
                )}
                data-state={expanded ? "selected" : undefined}
              >
                <TableCell>
                  <div className="flex items-center gap-1">
                    <ReportIndeterminateCheckbox
                      aria-label={t("common.selectRow", {
                        name: group.invoiceNumber,
                      })}
                      checked={groupSelected}
                      disabled={group.items.length === 0}
                      indeterminate={groupPartiallySelected}
                      onCheckedChange={(checked) => onToggleRows(group.items, checked as boolean)}
                    />
                    <ReportRowPinToggle isDefault={index === 0} label={group.invoiceNumber} rowId={group.id} />
                  </div>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-expanded={expanded}
                      aria-label={
                        expanded
                          ? t("report.collapseBill")
                          : t("report.expandBill")
                      }
                      onClick={() => onToggleGroup(group.id)}
                    >
                      {expanded ? <ChevronDown /> : <ChevronRight />}
                    </Button>
                    <span className="tabular-nums text-muted-foreground">
                      {pageStart + index}
                    </span>
                  </div>
                </TableCell>

                {textColumns.map((column) => (
                  <TableCell key={column.key} className={column.key === "invoiceNumber" ? "font-medium" : undefined}>
                    {groupTextValue(group, column.key, t)}
                  </TableCell>
                ))}

                {/* บิลที่เปิดอยู่แสดงยอดในแถวสรุปของบิลด้านล่างแล้ว — แถวหัวบิลจึงเว้นว่างไม่ให้ตัวเลขซ้ำ */}
                {numericColumns.map((column) =>
                  expanded ? <BlankCell key={column.key} align="right" /> : groupNumericCell(group, column.key),
                )}

                {showStatus ? (
                  <TableCell>
                    <Badge
                      className={statusClass(
                        group.cancelled
                          ? { ...statusRow, cancelled: true }
                          : statusRow,
                        group.status,
                      )}
                    >
                      {group.status}
                    </Badge>
                  </TableCell>
                ) : null}
              </TableRow>

              {expanded ? (
                <>
                  {group.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={detailColumnCount(layout)}>
                        <Alert>
                          <AlertDescription>{t("report.billItemsMissing")}</AlertDescription>
                        </Alert>
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {group.items.map((item, itemIndex) => {
                    const recordId = reportRecordId(item);
                    const selected = selectedRecordIds.has(recordId);

                    return (
                      <TableRow
                        key={`${rowKey(item, itemIndex)}-${itemIndex}`}
                        className={cn(groupNeedsAttention && "bg-warning/5 hover:bg-warning/10")}
                        data-state={selected && !isCancelledRow(item) ? "selected" : undefined}
                      >
                        <TableCell>
                          <Checkbox
                            aria-label={t("common.selectRow", {
                              name: itemProductName(
                                item,
                                `${group.invoiceNumber}-${itemIndex + 1}`,
                              ),
                            })}
                            checked={selected}
                            onCheckedChange={(checked) => onToggleRow(item, checked as boolean)}
                          />
                        </TableCell>

                        <TableCell />

                        {/* ชื่อสินค้ากินพื้นที่ของคอลัมน์ข้อความที่แสดงอยู่ (อย่างน้อยคือเลขบิลที่ซ่อนไม่ได้) */}
                        <TableCell colSpan={layout.textSpan}>
                          <div className="flex items-center gap-2">
                            <ProductImage row={item} />
                            <ProductNameCell row={item} />
                          </div>
                        </TableCell>

                        {numericColumns.map((column) => itemNumericCell(item, column.key))}

                        {showStatus ? <TableCell /> : null}
                      </TableRow>
                    );
                  })}
                  <DetailBillSummaryRow
                    group={group}
                    layout={layout}
                    summaryLabel={t("report.summary")}
                  />
                  <DetailBillAdjustmentRows group={group} layout={layout} />
                </>
              ) : null}
            </Fragment>
          );
        })}
        <DetailReportFooterRow
          layout={layout}
          reportTotal={reportTotal}
          summaryCards={summaryCards}
          summaryLabel={t("report.summary")}
          billCountLabel={t("report.cards.billsCount")}
        />
      </TableBody>
      </ReportRowPinningProvider>
    </Table>
  );
}

type DetailLayout = {
  numericColumns: DetailNumericColumn[];
  showStatus: boolean;
  /** จำนวนคอลัมน์ข้อความที่แสดงอยู่ (เลขบิลซ่อนไม่ได้ จึงมีอย่างน้อย 1) */
  textSpan: number;
};

function detailColumnCount(layout: DetailLayout) {
  return 2 + layout.textSpan + layout.numericColumns.length + (layout.showStatus ? 1 : 0);
}

function DetailReportFooterRow({
  billCountLabel,
  layout,
  reportTotal,
  summaryCards,
  summaryLabel,
}: {
  billCountLabel: string;
  layout: DetailLayout;
  reportTotal: ApiEntity;
  summaryCards: SummaryCards;
  summaryLabel: string;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <SummaryFooterLabelCell
        billCount={summaryMetricNumber(summaryCards, reportTotal, [
          "bill_count",
          "bills_count",
          "total_bills",
        ])}
        billCountLabel={billCountLabel}
        colSpan={2 + layout.textSpan}
        label={summaryLabel}
      />
      {layout.numericColumns.map((column) => reportFooterNumericCell(column.key, summaryCards, reportTotal))}
      {layout.showStatus ? <SummaryFooterBlankCell /> : null}
    </TableRow>
  );
}

function DetailBillSummaryRow({
  group,
  layout,
  summaryLabel,
}: {
  group: DailySalesBillGroup;
  layout: DetailLayout;
  summaryLabel: string;
}) {
  return (
    <TableRow className="bg-primary/5 hover:bg-primary/5">
      <TableCell colSpan={2} />
      <TableCell colSpan={layout.textSpan} className="font-medium text-primary-text">
        {summaryLabel}
      </TableCell>
      {layout.numericColumns.map((column) => billSummaryNumericCell(group, column.key))}
      {layout.showStatus ? <TableCell /> : null}
    </TableRow>
  );
}

function DetailBillAdjustmentRows({
  group,
  layout,
}: {
  group: DailySalesBillGroup;
  layout: DetailLayout;
}) {
  const { t } = useTranslation();

  return (
    <>
      <DetailBillAdjustmentRow
        layout={layout}
        label={t("report.columns.billDiscount", {
          defaultValue: "Bill discount",
        })}
        tone="discount"
        value={group.discountBillAmount}
      />
      <DetailBillAdjustmentRow
        layout={layout}
        label={t("dashboard.serviceCharge")}
        tone="service"
        value={group.serviceChargeAmount}
      />
      <DetailBillAdjustmentRow
        layout={layout}
        label={t("dashboard.vat")}
        tone="vat"
        value={group.vatAmount}
      />
      <DetailBillAdjustmentRow
        layout={layout}
        label={t("common.total")}
        tone="total"
        value={group.lineTotal}
      />
    </>
  );
}

// ส่วนลดบิล/ค่าบริการ/VAT/ยอดรวม ของบิล: ป้าย+ตัวเลขชิดขวาของตาราง กิน 2 คอลัมน์สุดท้ายก่อนสถานะ
// (หรือเท่าที่มีถ้าผู้ใช้ซ่อนคอลัมน์จนเหลือน้อย) ที่เหลือด้านซ้ายเป็นช่องว่าง
function DetailBillAdjustmentRow({
  label,
  layout,
  tone = "default",
  value,
}: {
  label: string;
  layout: DetailLayout;
  tone?: MoneyCellTone;
  value: number;
}) {
  const contentColumns = layout.textSpan + layout.numericColumns.length;
  const valueSpan = Math.min(2, contentColumns);

  return (
    <TableRow className="border-0 bg-primary/5 hover:bg-primary/5">
      <TableCell colSpan={2 + contentColumns - valueSpan} />
      <TableCell colSpan={valueSpan}>
        <div className="flex items-center justify-end gap-4">
          <span className={adjustmentLabelClass(tone)}>{label}</span>
          <DetailBillAdjustmentValue tone={tone} value={value} />
        </div>
      </TableCell>
      {layout.showStatus ? <TableCell /> : null}
    </TableRow>
  );
}

function DetailBillAdjustmentValue({
  tone = "default",
  value,
}: {
  tone?: MoneyCellTone;
  value: number;
}) {
  return (
    <span className={adjustmentValueClass(tone, value)}>
      {money(value)}
    </span>
  );
}

// สีของแต่ละรายการปรับยอดสื่อความหมาย (ส่วนลด=แดง, ยอดรวม=primary) ใช้ token ของธีมทั้งหมด
function adjustmentLabelClass(tone: MoneyCellTone) {
  return cn(
    "text-muted-foreground",
    tone === "discount" && "text-destructive",
    tone === "service" && "text-info-text",
    tone === "vat" && "text-warning-text",
    tone === "total" && "font-medium text-primary-text",
  );
}

function adjustmentValueClass(tone: MoneyCellTone, value: number) {
  return cn(
    "text-right tabular-nums",
    tone === "discount" && value > 0 && "text-destructive",
    tone === "total" && "font-semibold text-primary-text",
    value === 0 && tone !== "total" && "text-muted-foreground",
  );
}

function groupMoney(group: DailySalesBillGroup, keys: string[]) {
  const groupEntity = group as unknown as ApiEntity;
  const value = readValue(groupEntity, keys);
  if (hasDisplayValue(value)) return firstNumber(value);

  if (
    keys.some((key) => ["amount", "order_total", "total_order"].includes(key))
  ) {
    return group.amountTotal;
  }
  if (keys.some((key) => ["topping_total", "toppingTotal"].includes(key))) {
    return group.toppingTotal;
  }
  if (keys.some((key) => ["discount_bill", "discountBill"].includes(key))) {
    return group.discountBillAmount;
  }
  if (
    keys.some((key) =>
      [
        "sum_servicecharge",
        "service_charge",
        "service_charge_amount",
        "serviceCharge",
      ].includes(key),
    )
  ) {
    return group.serviceChargeAmount;
  }
  if (keys.some((key) => ["vat", "vat_amount"].includes(key))) {
    return group.vatAmount;
  }

  const summary = groupEntity.summary;
  if (!summary || typeof summary !== "object") return null;

  const summaryValue = readValue(summary as ApiEntity, keys);
  return hasDisplayValue(summaryValue) ? firstNumber(summaryValue) : null;
}

function dailySalesBillSortValue(
  group: DailySalesBillGroup,
  key: DailySalesBillSortKey,
) {
  switch (key) {
    case "amount":
      return groupMoney(group, ["amount"]) ?? 0;
    case "discount":
      return groupDiscountTotal(group);
    case "invoiceNumber":
      return group.invoiceNumber;
    case "itemCount":
      return groupQuantity(group);
    case "lineTotal":
      return group.lineTotal;
    case "paymentType":
      return group.paymentType;
    case "salePrice":
      return groupSellingPriceTotal(group);
    case "saleDate":
      return group.saleDate;
    case "serviceCharge":
      return (
        groupMoney(group, [
          "sum_servicecharge",
          "service_charge",
          "serviceCharge",
        ]) ?? 0
      );
    case "status":
      return group.status;
    case "tableName":
      return group.tableName;
    case "toppingTotal":
      return groupMoney(group, ["topping_total", "toppingTotal"]) ?? 0;
    case "vat":
      return groupMoney(group, ["vat"]) ?? 0;
  }
}
