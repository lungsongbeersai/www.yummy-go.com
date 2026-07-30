"use client";

import Image from "next/image";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TableCell } from "@/components/ui/table";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ApiEntity } from "@/services/shared/types";
import type { ReportColumn, SummaryCards } from "./daily-sales-report-types";
import {
  firstOptionalNumber,
  firstNumber,
  formatDate,
  isCancelledRow,
  isPaymentAttentionRow,
  isZeroColumnValue,
  readValue,
  reportImageColor,
  reportImageSrc,
  statusClass,
  summaryCardValue,
  textValue,
  toppingLines,
} from "./daily-sales-report-utils";

export type MoneyCellTone = "default" | "discount" | "service" | "total" | "vat";
export function summaryMetricNumber(
  summaryCards: SummaryCards,
  reportTotal: ApiEntity,
  keys: string[],
) {
  return firstOptionalNumber(summaryCardValue(summaryCards, reportTotal, keys));
}

export function SummaryFooterBlankCell({ colSpan }: { colSpan?: number }) {
  return <TableCell className={summaryFooterCellClass()} colSpan={colSpan} />;
}

export function SummaryFooterLabelCell({
  billCount,
  billCountLabel,
  colSpan,
  label,
}: {
  billCount: number | null;
  billCountLabel: string;
  colSpan: number;
  label: string;
}) {
  return (
    <TableCell className={summaryFooterCellClass("left")} colSpan={colSpan}>
      <div className="flex min-w-64 items-center gap-2">
        <Badge
          variant="outline"
          className="h-6 border-primary/30 bg-muted px-2 text-xs font-semibold text-primary"
        >
          {label}
        </Badge>
        {billCount !== null ? (
          <span className="truncate text-xs font-semibold text-muted-foreground">
            {billCountLabel}: {billCount.toLocaleString("en-US")}
          </span>
        ) : null}
      </div>
    </TableCell>
  );
}

export function SummaryFooterMoneyCell({
  strong = false,
  tone = "default",
  value,
}: {
  strong?: boolean;
  tone?: MoneyCellTone;
  value: number | null;
}) {
  if (value === null) return <SummaryFooterBlankCell />;

  return (
    <TableCell
      className={cn(
        summaryFooterCellClass("right"),
        (strong || tone === "total" || (tone === "discount" && value > 0)) &&
          "font-semibold",
        tone === "total" && "text-foreground",
        tone === "discount" && value > 0 && "text-destructive",
        value === 0 && "text-muted-foreground",
      )}
    >
      {money(value)}
    </TableCell>
  );
}

export function SummaryFooterNumberCell({ value }: { value: number | null }) {
  if (value === null) return <SummaryFooterBlankCell />;

  return (
    <TableCell
      className={cn(
        summaryFooterCellClass("right"),
        "font-semibold",
        value === 0 && "text-muted-foreground",
      )}
    >
      {value.toLocaleString("en-US")}
    </TableCell>
  );
}

export function renderPrintCell(row: ApiEntity, column: ReportColumn) {
  const value = readValue(row, column.keys);

  if (column.kind === "image") return <PrintProductImage row={row} />;
  if (column.kind === "product") return <PrintProductNameCell row={row} />;
  if (column.kind === "money") return money(firstNumber(value));
  if (column.kind === "number")
    return firstNumber(value).toLocaleString("en-US");
  if (column.kind === "date") return formatDate(value);
  return textValue(value, "");
}

export function renderCell(row: ApiEntity, column: ReportColumn) {
  const value = readValue(row, column.keys);

  if (column.kind === "image") return <ProductImage row={row} />;
  if (column.kind === "product") return <ProductNameCell row={row} />;
  if (column.kind === "money") return money(firstNumber(value));
  if (column.kind === "number")
    return firstNumber(value).toLocaleString("en-US");
  if (column.kind === "date") return formatDate(value);
  if (column.kind === "status") {
    const label = textValue(value);
    return <Badge className={statusClass(row, label)}>{label}</Badge>;
  }

  return textValue(value);
}

export function tableRowClass(row: ApiEntity, index: number) {
  return cn(
    "group border-b border-border/80",
    index % 2 === 1 && "bg-muted/15",
    isPaymentAttentionRow(row) &&
      "bg-red-50 hover:bg-red-100/70 dark:bg-red-950/25 dark:hover:bg-red-950/35",
    isCancelledRow(row) &&
      "border-l-4 border-l-destructive/60 bg-destructive/5 hover:bg-destructive/10",
  );
}

export function tableCellClass(row: ApiEntity, column: ReportColumn) {
  return cn(
    "h-9 whitespace-nowrap px-2 text-xs",
    column.align === "right" && "text-right tabular-nums",
    column.kind === "product" && "max-w-72",
    column.wide && column.kind !== "product" && "max-w-72 truncate",
    isZeroColumnValue(row, column) && "text-muted-foreground",
  );
}

export function ProductNameCell({ row }: { row: ApiEntity }) {
  const productName = textValue(
    readValue(row, [
      "product_name",
      "prod_name",
      "prod_name_la",
      "prod_name_eng",
    ]),
  );
  const toppings = toppingLines(row);

  return (
    <div className="min-w-0 leading-snug">
      <p className="max-w-72 truncate font-semibold text-foreground">
        {productName}
      </p>
      {toppings.length ? (
        <div className="mt-1 flex max-w-72 flex-col gap-0.5 text-xs font-medium text-muted-foreground">
          {toppings.map((topping, index) => (
            <span key={`${topping}-${index}`} className="truncate">
              {topping}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PrintProductNameCell({ row }: { row: ApiEntity }) {
  const productName = textValue(
    readValue(row, [
      "product_name",
      "prod_name",
      "prod_name_la",
      "prod_name_eng",
    ]),
  );
  const toppings = toppingLines(row);

  return (
    <span>
      <strong>{productName}</strong>
      {toppings.length ? (
        <span className="report-print-toppings">
          {toppings.map((topping, index) => (
            <span key={`${topping}-${index}`}>{topping}</span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

export function PrintProductImage({ row }: { row: ApiEntity }) {
  const src = reportImageSrc(row);
  const color = reportImageColor(row) || "#10B981";
  const backgroundImage = src ? `url("${printImageUrl(src)}")` : undefined;

  return (
    <span
      aria-hidden="true"
      className="report-print-image"
      style={{
        backgroundColor: backgroundImage ? "#ffffff" : color,
        backgroundImage,
      }}
    />
  );
}

export function printImageUrl(src: string) {
  if (/^https?:\/\//i.test(src))
    return `/_next/image?url=${encodeURIComponent(src)}&w=48&q=75`;
  return src;
}

export function ProductImage({ row }: { row: ApiEntity }) {
  const src = reportImageSrc(row);
  const color = reportImageColor(row);
  const name = textValue(
    readValue(row, [
      "product_name",
      "prod_name",
      "prod_name_la",
      "prod_name_eng",
    ]),
    "Product",
  );

  return (
    <span
      className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted"
      style={color ? { backgroundColor: color } : undefined}
    >
      {src ? (
        <Image
          src={src}
          alt={name}
          fill
          sizes="64px"
          className="object-cover"
        />
      ) : color ? null : (
        <Package className="text-muted-foreground" />
      )}
    </span>
  );
}

export function summaryFooterCellClass(align: "left" | "right" = "left") {
  return cn(
    "sticky bottom-0 z-20 h-10 whitespace-nowrap border-t-2 border-primary bg-muted px-2 py-2 font-bold text-foreground",
    align === "right" && "text-right tabular-nums",
  );
}

export function MoneyCell({
  strong = false,
  tone = "default",
  value,
}: {
  strong?: boolean;
  tone?: MoneyCellTone;
  value: number;
}) {
  return (
    <TableCell
      className={cn(
        "whitespace-nowrap px-2 text-right tabular-nums",
        (strong || tone === "total" || (tone === "discount" && value > 0)) &&
          "font-semibold",
        tone === "total" && "text-foreground",
        tone === "discount" && value > 0 && "text-destructive",
        value === 0 && "text-muted-foreground",
      )}
    >
      {money(value)}
    </TableCell>
  );
}

export function OptionalMoneyCell({
  strong = false,
  tone = "default",
  value,
}: {
  strong?: boolean;
  tone?: MoneyCellTone;
  value: number | null;
}) {
  if (value === null) return <BlankCell align="right" />;
  return <MoneyCell value={value} strong={strong} tone={tone} />;
}

export function BlankCell({ align = "left" }: { align?: "left" | "right" }) {
  return (
    <TableCell
      className={cn(
        "whitespace-nowrap px-2 text-muted-foreground",
        align === "right" && "text-right",
      )}
    />
  );
}
