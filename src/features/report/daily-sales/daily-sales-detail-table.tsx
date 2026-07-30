"use client";

import { Fragment, useCallback, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
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
import { ReportIndeterminateCheckbox } from "../shared/report-row-selection";
import { useLocalTableSort } from "../shared/report-sort-utils";
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
  formatDate,
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

export function DetailBillTable({
  collapsedGroups,
  groups,
  pageStart,
  reportTotal,
  selectedRecordIds,
  summaryCards,
  onToggleGroup,
  onToggleRow,
  onToggleRows,
}: {
  collapsedGroups: Set<string>;
  groups: DailySalesBillGroup[];
  itemColumns: ReportColumn[];
  pageStart: number;
  reportTotal: ApiEntity;
  selectedRecordIds: Set<string>;
  summaryCards: SummaryCards;
  onToggleGroup: (groupId: string) => void;
  onToggleRow: (row: ApiEntity, selected: boolean) => void;
  onToggleRows: (rows: ApiEntity[], selected: boolean) => void;
}) {
  const { t } = useTranslation();

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
  return (
    <div className="w-full min-w-0">
      <Table className="w-max min-w-full table-auto text-sm">
        <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-30 [&_th]:h-9 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
          <TableRow>
            <TableHead className="w-10 text-center">
              <ReportIndeterminateCheckbox
                aria-label={t("common.selectAll")}
                checked={allVisibleSelected}
                indeterminate={!allVisibleSelected && someVisibleSelected}
                onChange={(event) =>
                  onToggleRows(visibleItems, event.target.checked)
                }
              />
            </TableHead>

            <TableHead className="w-16 text-center">{t("fields.no")}</TableHead>

            <SortableReportTableHead
              sort={groupSort}
              sortKey="invoiceNumber"
              className="min-w-[132px]"
              onSort={toggleGroupSort}
            >
              {t("report.columns.invoiceNumber")}
            </SortableReportTableHead>

            <SortableReportTableHead
              sort={groupSort}
              sortKey="saleDate"
              className="min-w-[118px]"
              onSort={toggleGroupSort}
            >
              {t("report.columns.saleDate")}
            </SortableReportTableHead>

            <SortableReportTableHead
              sort={groupSort}
              sortKey="tableName"
              className="min-w-[96px]"
              onSort={toggleGroupSort}
            >
              {t("report.columns.tableName")}
            </SortableReportTableHead>

            <SortableReportTableHead
              sort={groupSort}
              sortKey="paymentType"
              className="min-w-[138px]"
              onSort={toggleGroupSort}
            >
              {t("report.columns.paymentType")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="salePrice"
              className="min-w-[132px] text-right"
              onSort={toggleGroupSort}
            >
              {t("report.columns.salePrice")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="itemCount"
              className="min-w-[92px] text-right"
              onSort={toggleGroupSort}
            >
              {t("report.columns.quantity")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="toppingTotal"
              className="min-w-[138px] text-right"
              onSort={toggleGroupSort}
            >
              {t("report.columns.toppingTotal")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="amount"
              className="min-w-[132px] text-right"
              onSort={toggleGroupSort}
            >
              {t("report.columns.amount")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="discount"
              className="min-w-[124px] text-right"
              onSort={toggleGroupSort}
            >
              {t("report.columns.discount")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="lineTotal"
              className="min-w-[132px] text-right"
              onSort={toggleGroupSort}
            >
              {t("common.total", { defaultValue: "Total" })}
            </SortableReportTableHead>

            {hasStatusData ? (
              <SortableReportTableHead
                sort={groupSort}
                sortKey="status"
                className="min-w-[118px]"
                onSort={toggleGroupSort}
              >
                {t("report.columns.status")}
              </SortableReportTableHead>
            ) : null}
          </TableRow>
        </TableHeader>

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
                    "border-b border-border/80 bg-card hover:bg-muted/25 [&>td]:whitespace-nowrap [&>td]:px-2 [&>td]:py-2",
                    expanded &&
                      !group.cancelled &&
                      !groupNeedsAttention &&
                      "border-l-4 border-l-primary/60 bg-primary/5 hover:bg-primary/10",
                    groupNeedsAttention &&
                      "bg-red-50 hover:bg-red-100/70 dark:bg-red-950/25 dark:hover:bg-red-950/35",
                    group.cancelled &&
                      "border-l-4 border-l-destructive/60 bg-destructive/5 hover:bg-destructive/10",
                  )}
                  data-state={expanded ? "selected" : undefined}
                >
                  <TableCell className="text-center">
                    <ReportIndeterminateCheckbox
                      aria-label={t("common.selectRow", {
                        name: group.invoiceNumber,
                      })}
                      checked={groupSelected}
                      indeterminate={groupPartiallySelected}
                      onChange={(event) =>
                        onToggleRows(group.items, event.target.checked)
                      }
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        size="iconSm"
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
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {pageStart + index}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="font-semibold">
                    {group.invoiceNumber}
                  </TableCell>
                  <TableCell>{formatDate(group.saleDate)}</TableCell>
                  <TableCell>{group.tableName}</TableCell>
                  <TableCell>{group.paymentType}</TableCell>

                  {expanded ? (
                    <>
                      <BlankCell align="right" />
                      <BlankCell align="right" />
                      <BlankCell align="right" />
                      <BlankCell align="right" />
                      <BlankCell align="right" />
                      <BlankCell align="right" />
                    </>
                  ) : (
                    <>
                      <OptionalMoneyCell
                        value={groupSellingPriceTotal(group)}
                      />
                      <TableCell className="text-right font-semibold tabular-nums">
                        {groupQuantity(group).toLocaleString("en-US")}
                      </TableCell>
                      <OptionalMoneyCell value={group.toppingTotal} />
                      <OptionalMoneyCell value={group.amountTotal} />
                      <OptionalMoneyCell
                        tone="discount"
                        value={groupDiscountTotal(group)}
                      />
                      <MoneyCell value={group.lineTotal} strong tone="total" />
                    </>
                  )}

                  {hasStatusData ? (
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
                    {group.items.map((item, itemIndex) => {
                      const recordId = reportRecordId(item);
                      const selected = selectedRecordIds.has(recordId);

                      return (
                        <TableRow
                          key={`${rowKey(item, itemIndex)}-${itemIndex}`}
                          className={cn(
                            "border-b border-border/80 bg-background hover:bg-muted/20 [&>td]:whitespace-nowrap [&>td]:px-2 [&>td]:py-2",
                            groupNeedsAttention &&
                              "bg-red-50/70 hover:bg-red-50/70 dark:bg-red-950/20 dark:hover:bg-red-950/20",
                            selected &&
                              !isCancelledRow(item) &&
                              !isPaymentAttentionRow(item) &&
                              "bg-primary/5",
                          )}
                        >
                          <TableCell className="text-center">
                            <Checkbox
                              aria-label={t("common.selectRow", {
                                name: itemProductName(
                                  item,
                                  `${group.invoiceNumber}-${itemIndex + 1}`,
                                ),
                              })}
                              checked={selected}
                              onChange={(event) =>
                                onToggleRow(item, event.target.checked)
                              }
                            />
                          </TableCell>

                          <TableCell />

                          <TableCell colSpan={4}>
                            <div className="flex min-w-72 items-center gap-2">
                              <ProductImage row={item} />
                              <ProductNameCell row={item} />
                            </div>
                          </TableCell>

                          <OptionalMoneyCell
                            value={itemMoney(item, ["sale_price"])}
                          />
                          <TableCell className="text-right font-semibold tabular-nums">
                            {itemQuantity(item).toLocaleString("en-US")}
                          </TableCell>
                          <OptionalMoneyCell
                            value={itemMoney(item, ["topping_total"])}
                          />
                          <OptionalMoneyCell
                            value={itemMoney(item, ["amount"])}
                          />
                          <OptionalMoneyCell
                            tone="discount"
                            value={itemMoney(item, ["discount"])}
                          />
                          <OptionalMoneyCell
                            tone="total"
                            value={itemMoney(item, ["total"])}
                            strong
                          />

                          {hasStatusData ? <TableCell /> : null}
                        </TableRow>
                      );
                    })}
                    <DetailBillSummaryRow
                      group={group}
                      hasStatusData={hasStatusData}
                      summaryLabel={t("report.summary")}
                    />
                    <DetailBillAdjustmentRows
                      group={group}
                      hasStatusData={hasStatusData}
                    />
                  </>
                ) : null}
              </Fragment>
            );
          })}
          <DetailReportFooterRow
            hasStatusData={hasStatusData}
            reportTotal={reportTotal}
            summaryCards={summaryCards}
            summaryLabel={t("report.summary")}
            billCountLabel={t("report.cards.billsCount")}
          />
        </TableBody>
      </Table>
    </div>
  );
}

function DetailReportFooterRow({
  billCountLabel,
  hasStatusData,
  reportTotal,
  summaryCards,
  summaryLabel,
}: {
  billCountLabel: string;
  hasStatusData: boolean;
  reportTotal: ApiEntity;
  summaryCards: SummaryCards;
  summaryLabel: string;
}) {
  return (
    <TableRow className="border-t-2 border-primary bg-primary/5 font-semibold text-foreground hover:bg-primary/5">
      <SummaryFooterBlankCell />
      <SummaryFooterBlankCell />
      <SummaryFooterLabelCell
        billCount={summaryMetricNumber(summaryCards, reportTotal, [
          "bill_count",
          "bills_count",
          "total_bills",
        ])}
        billCountLabel={billCountLabel}
        colSpan={4}
        label={summaryLabel}
      />
      <SummaryFooterMoneyCell
        value={summaryMetricNumber(summaryCards, reportTotal, [
          "product_price_total",
          "selling_price_total",
          "sale_price_total",
        ])}
      />
      <SummaryFooterNumberCell
        value={summaryMetricNumber(summaryCards, reportTotal, ["total_qty"])}
      />
      <SummaryFooterMoneyCell
        value={summaryMetricNumber(summaryCards, reportTotal, [
          "topping_total",
          "total_topping_price",
          "sum_topping",
        ])}
      />
      <SummaryFooterMoneyCell
        value={summaryMetricNumber(summaryCards, reportTotal, ["amount"])}
      />
      <SummaryFooterMoneyCell
        tone="discount"
        value={summaryMetricNumber(summaryCards, reportTotal, [
          "sum_discount",
          "discount_bill",
          "discount_item",
        ])}
      />
      <SummaryFooterMoneyCell
        strong
        tone="total"
        value={summaryMetricNumber(summaryCards, reportTotal, [
          "sum_total",
          "grand_total",
          "net_total",
        ])}
      />
      {hasStatusData ? <SummaryFooterBlankCell /> : null}
    </TableRow>
  );
}

function DetailBillSummaryRow({
  group,
  hasStatusData,
  summaryLabel,
}: {
  group: DailySalesBillGroup;
  hasStatusData: boolean;
  summaryLabel: string;
}) {
  return (
    <TableRow className="border-0 bg-muted hover:bg-muted [&>td]:whitespace-nowrap [&>td]:px-2 [&>td]:py-2">
      <TableCell />
      <TableCell />
      <TableCell colSpan={4}>
        <span className="text-xs font-semibold text-primary">
          {summaryLabel}
        </span>
      </TableCell>
      <OptionalMoneyCell value={groupSellingPriceTotal(group)} strong />
      <TableCell className="text-right font-semibold tabular-nums">
        {groupQuantity(group).toLocaleString("en-US")}
      </TableCell>
      <OptionalMoneyCell value={group.toppingTotal} strong />
      <OptionalMoneyCell value={group.amountTotal} strong />
      <OptionalMoneyCell
        tone="discount"
        value={groupItemDiscountTotal(group)}
        strong
      />
      <OptionalMoneyCell value={groupItemLineTotal(group)} strong />
      {hasStatusData ? <TableCell /> : null}
    </TableRow>
  );
}

function DetailBillAdjustmentRows({
  group,
  hasStatusData,
}: {
  group: DailySalesBillGroup;
  hasStatusData: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      <DetailBillAdjustmentRow
        hasStatusData={hasStatusData}
        label={t("report.columns.billDiscount", {
          defaultValue: "Bill discount",
        })}
        tone="discount"
        value={group.discountBillAmount}
      />
      <DetailBillAdjustmentRow
        hasStatusData={hasStatusData}
        label={t("dashboard.serviceCharge")}
        tone="service"
        value={group.serviceChargeAmount}
      />
      <DetailBillAdjustmentRow
        hasStatusData={hasStatusData}
        label={t("dashboard.vat")}
        tone="vat"
        value={group.vatAmount}
      />
      <DetailBillAdjustmentRow
        hasStatusData={hasStatusData}
        label={t("common.total")}
        last
        tone="total"
        value={group.lineTotal}
      />
    </>
  );
}

function DetailBillAdjustmentRow({
  hasStatusData,
  label,
  last = false,
  tone = "default",
  value,
}: {
  hasStatusData: boolean;
  label: string;
  last?: boolean;
  tone?: MoneyCellTone;
  value: number;
}) {
  return (
    <TableRow
      className={cn(
        "bg-muted hover:bg-muted [&>td]:whitespace-nowrap [&>td]:px-2 [&>td]:py-1",
        last ? "border-b border-border" : "border-0",
      )}
    >
      <TableCell colSpan={10} />
      <TableCell className="text-right" colSpan={2}>
        <div className="ml-auto grid w-56 max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <span className={adjustmentLabelClass(tone)}>{label}</span>
          <DetailBillAdjustmentValue tone={tone} value={value} />
        </div>
      </TableCell>
      {hasStatusData ? <TableCell /> : null}
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

function adjustmentLabelClass(tone: MoneyCellTone) {
  return cn(
    "truncate text-xs font-semibold leading-none",
    tone === "discount" && "text-destructive",
    tone === "service" && "text-sky-700 dark:text-sky-300",
    tone === "vat" && "text-amber-700 dark:text-amber-300",
    tone === "total" && "text-primary",
    tone === "default" && "text-muted-foreground",
  );
}

function adjustmentValueClass(tone: MoneyCellTone, value: number) {
  return cn(
    "whitespace-nowrap text-right font-semibold tabular-nums",
    tone === "discount" && "text-destructive",
    tone === "discount" && value === 0 && "opacity-70",
    tone === "service" &&
      value > 0 &&
      "font-semibold text-sky-700 dark:text-sky-300",
    tone === "total" && "font-semibold text-primary",
    tone === "vat" &&
      value > 0 &&
      "font-semibold text-amber-700 dark:text-amber-300",
    tone === "default" && "font-semibold text-foreground",
    value === 0 &&
      tone !== "discount" &&
      tone !== "total" &&
      "text-muted-foreground",
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
