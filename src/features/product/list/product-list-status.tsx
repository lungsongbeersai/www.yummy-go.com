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
import { cn } from "@/lib/utils";
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

export function bulkStockModeClass(mode: ProductStockModeValue) {
  return mode === 1 ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground";
}

export function stockSummaryLabel(workflow: ProductListWorkflow, summary: ProductStockSummary) {
  if (summary === "deduct") return workflow.t("product.stockMode.deduct");
  if (summary === "noDeduct") return workflow.t("product.stockMode.noDeduct");
  return workflow.t("product.stockBulk.mixed");
}

export function stockSummaryClass(summary: ProductStockSummary) {
  if (summary === "deduct") return "bg-primary/10 text-primary";
  if (summary === "noDeduct") return "bg-secondary text-secondary-foreground";
  return "bg-muted text-muted-foreground";
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
    <div className="flex min-w-0 items-center gap-2">
      {pending ? <Spinner /> : <Bell className="text-muted-foreground" />}
      <Badge className={enabled ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"}>
        {enabled ? workflow.t("product.notification.on") : workflow.t("product.notification.off")}
      </Badge>
    </div>
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
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-mono text-sm font-bold tabular-nums">-</p>
        <Badge className="bg-muted text-muted-foreground">{workflow.t("common.noData")}</Badge>
      </div>
    );
  }

  const summary = detailStockSummary(details);
  const currentModeClass = pendingMode ? bulkStockModeClass(pendingMode) : stockSummaryClass(summary);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="font-mono text-sm font-bold tabular-nums">{totalStockQty(row)}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className={currentModeClass}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pendingMode ? bulkStockModeLabel(workflow, pendingMode) : stockSummaryLabel(workflow, summary)}
        </Badge>
      </div>
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
  const details = productDetails(row);

  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <ProductNotificationStatus row={row} workflow={workflow} />
      {details.length ? (
        <Badge className="bg-primary/10 text-primary">
          {details.length} {workflow.t("product.sections.details")}
        </Badge>
      ) : (
        <Badge className="bg-muted text-muted-foreground">{workflow.t("common.noData")}</Badge>
      )}
    </div>
  );
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
      value={binaryFlag(detail.pro_detail_stock, "1")}
      disabled={disabled}
      onValueChange={(value) => workflow.updateDetailStockMode(detail, value)}
    >
      <SelectTrigger size="sm" className={compact ? "w-full" : "w-40"}>
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

export function ProductStockBadge({
  compact = false,
  detail,
  workflow
}: {
  compact?: boolean;
  detail: ProductDetail;
  workflow: ProductListWorkflow;
}) {
  const stockMode = binaryFlag(detail.pro_detail_stock, "1");
  const label =
    stockMode === "1" ? workflow.t("product.stockMode.deduct") : workflow.t("product.stockMode.noDeduct");
  const className = stockMode === "1" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground";

  return (
    <div className={cn("flex min-h-8 items-center", compact ? "w-full" : "justify-center")}>
      <Badge className={className}>{label}</Badge>
    </div>
  );
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
