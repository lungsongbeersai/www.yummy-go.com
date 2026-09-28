"use client";

import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import type { ProductDetail } from "@/services/product";
import {
  binaryFlag,
  detailStockSummary,
  productDetails,
  productDetailUuid,
  totalStockQty,
  type ProductStockSummary
} from "./product-list-utils";
import type { ProductStatusKey, ProductStockModeValue, ProductTableRow } from "./product-list-types";
import type { ProductListWorkflow } from "./use-product-list-workflow";

export function bulkStockActiveMode(summary: ProductStockSummary): ProductStockModeValue | null {
  if (summary === "deduct") return 1;
  if (summary === "noDeduct") return 2;
  return null;
}

export function bulkStockModeLabel(workflow: ProductListWorkflow, mode: ProductStockModeValue) {
  return mode === 1 ? workflow.t("product.stockMode.deduct") : workflow.t("product.stockMode.noDeduct");
}

type BadgeVariant = "secondary" | "outline";

// ใช้ variant ของ Badge แทนการใส่สีเอง — "ตัดสต๊อก" = secondary, "ไม่ตัด"/ปนกัน = outline
export function bulkStockModeVariant(mode: ProductStockModeValue): BadgeVariant {
  return mode === 1 ? "secondary" : "outline";
}

export function stockSummaryLabel(workflow: ProductListWorkflow, summary: ProductStockSummary) {
  if (summary === "deduct") return workflow.t("product.stockMode.deduct");
  if (summary === "noDeduct") return workflow.t("product.stockMode.noDeduct");
  return workflow.t("product.stockBulk.mixed");
}

export function stockSummaryVariant(summary: ProductStockSummary): BadgeVariant {
  return summary === "deduct" ? "secondary" : "outline";
}

export function ProductNotificationStatus({
  row,
  workflow
}: {
  row: ProductTableRow;
  workflow: ProductListWorkflow;
}) {
  const notificationKey: ProductStatusKey = `notification:${row.prod_uuid}`;
  const enabled = binaryFlag(row.prod_notification, "2") === "1";
  const pending = workflow.pendingKeys.has(notificationKey);

  return (
    <Badge variant={enabled ? "secondary" : "outline"}>
      {pending ? <Spinner data-icon="inline-start" /> : <Bell data-icon="inline-start" />}
      {enabled ? workflow.t("product.notification.on") : workflow.t("product.notification.off")}
    </Badge>
  );
}

export function ProductStockSummaryStatus({
  row,
  workflow
}: {
  row: ProductTableRow;
  workflow: ProductListWorkflow;
}) {
  const details = productDetails(row);
  const pendingKey: ProductStatusKey = `stock-all:${row.prod_uuid}`;
  const pending = workflow.pendingKeys.has(pendingKey);
  const pendingMode = workflow.pendingBulkStockModes[row.prod_uuid];

  if (!details.length) {
    return <Badge variant="outline">{workflow.t("common.noData")}</Badge>;
  }

  const summary = detailStockSummary(details);
  const variant = pendingMode ? bulkStockModeVariant(pendingMode) : stockSummaryVariant(summary);

  return (
    <div className="flex items-center gap-2">
      <span className="tabular-nums">{totalStockQty(row)}</span>
      <Badge variant={variant}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {pendingMode ? bulkStockModeLabel(workflow, pendingMode) : stockSummaryLabel(workflow, summary)}
      </Badge>
    </div>
  );
}

export function ProductStatusBadges({
  row,
  workflow
}: {
  row: ProductTableRow;
  workflow: ProductListWorkflow;
}) {
  return <ProductNotificationStatus row={row} workflow={workflow} />;
}

export function ProductStockSelect({
  compact = false,
  detail,
  prodUuid,
  workflow
}: {
  compact?: boolean;
  detail: ProductDetail;
  prodUuid?: string;
  workflow: ProductListWorkflow;
}) {
  const detailUuid = productDetailUuid(detail);
  const stockKey: ProductStatusKey = `stock:${detailUuid}`;
  const enabledKey: ProductStatusKey = `enabled:${detailUuid}`;
  const bulkStockPending = prodUuid ? workflow.pendingKeys.has(`stock-all:${prodUuid}`) : false;
  const disabled = bulkStockPending || workflow.pendingKeys.has(stockKey) || workflow.pendingKeys.has(enabledKey);

  return (
    <Select
      value={binaryFlag(detail.pro_detail_stock)}
      disabled={disabled}
      onValueChange={(value) => workflow.updateDetailStockMode(detail, value)}
    >
      <SelectTrigger size="sm" className={compact ? "w-full" : undefined}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectGroup>
          <SelectItem value="1">{workflow.t("product.stockMode.deduct")}</SelectItem>
          <SelectItem value="2">{workflow.t("product.stockMode.noDeduct")}</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function ProductStockBadge({ detail, workflow }: { detail: ProductDetail; workflow: ProductListWorkflow }) {
  const mode: ProductStockModeValue = binaryFlag(detail.pro_detail_stock) === "1" ? 1 : 2;

  return <Badge variant={bulkStockModeVariant(mode)}>{bulkStockModeLabel(workflow, mode)}</Badge>;
}

export function ProductEnabledSwitch({
  detail,
  workflow
}: {
  detail: ProductDetail;
  workflow: ProductListWorkflow;
}) {
  const detailUuid = productDetailUuid(detail);
  const stockKey: ProductStatusKey = `stock:${detailUuid}`;
  const enabledKey: ProductStatusKey = `enabled:${detailUuid}`;
  const disabled = workflow.pendingKeys.has(stockKey) || workflow.pendingKeys.has(enabledKey);

  return (
    <Switch
      checked={binaryFlag(detail.pro_detail_enabled, "1") === "1"}
      disabled={disabled}
      size="sm"
      aria-label={workflow.t("product.detailEnabledStatus")}
      onCheckedChange={(checked) => workflow.updateDetailEnabled(detail, checked)}
    />
  );
}
