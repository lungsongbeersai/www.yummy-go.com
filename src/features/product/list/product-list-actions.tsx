"use client";

import { Bell, Boxes, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { binaryFlag, detailStockSummary, productDetails } from "./product-list-utils";
import { bulkStockActiveMode } from "./product-list-status";
import type { ProductStatusKey, ProductStockModeValue, ProductTableRow } from "./product-list-types";
import type { ProductListWorkflow } from "./use-product-list-workflow";

export function ProductListActions({
  row,
  workflow
}: {
  row: ProductTableRow;
  workflow: ProductListWorkflow;
}) {
  const details = productDetails(row);
  const stockSummary = detailStockSummary(details);
  const activeStockMode = bulkStockActiveMode(stockSummary);
  const stockPendingKey: ProductStatusKey = `stock-all:${row.prod_uuid}`;
  const stockPending = workflow.pendingKeys.has(stockPendingKey);
  const notificationKey: ProductStatusKey = `notification:${row.prod_uuid}`;
  const notificationPending = workflow.pendingKeys.has(notificationKey);
  const notificationOn = binaryFlag(row.prod_notification, "2") === "1";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="iconSm" variant="ghost" aria-label={workflow.t("common.actions")}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => workflow.editProduct(row)}>
            <Pencil />
            {workflow.t("actions.edit")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {workflow.t("product.notification.label")}
          </DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={notificationOn}
            disabled={notificationPending}
            onCheckedChange={(checked) => workflow.updateNotification(row, checked === true)}
          >
            {notificationPending ? <Spinner /> : <Bell />}
            {notificationOn ? workflow.t("product.notification.on") : workflow.t("product.notification.off")}
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
            {stockPending ? <Spinner /> : <Boxes />}
            {workflow.t("product.stockBulk.label")}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={activeStockMode ? String(activeStockMode) : ""}
            onValueChange={(value) => {
              if (value === "1" || value === "2") {
                workflow.updateAllDetailStockModes(row, Number(value) as ProductStockModeValue);
              }
            }}
          >
            <DropdownMenuRadioItem value="1" disabled={!details.length || stockPending}>
              {workflow.t("product.stockMode.deduct")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="2" disabled={!details.length || stockPending}>
              {workflow.t("product.stockMode.noDeduct")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onSelect={() => workflow.setDeleteTarget(row)}>
            <Trash2 />
            {workflow.t("actions.delete")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
