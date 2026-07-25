"use client";

import { useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { Boxes, Bell, CheckCircle2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { ProductBulkEditFieldValue, ProductBulkEditInput } from "./product-list-types";
import type { ProductListWorkflow } from "./use-product-list-workflow";

const KEEP_VALUE: ProductBulkEditFieldValue = "keep";

interface ProductBulkEditDialogProps {
  workflow: ProductListWorkflow;
}

function hasChanges(input: ProductBulkEditInput) {
  return input.notification !== KEEP_VALUE || input.enabled !== KEEP_VALUE || input.stockMode !== KEEP_VALUE;
}

export function ProductBulkEditDialog({ workflow }: ProductBulkEditDialogProps) {
  const [notification, setNotification] = useState<ProductBulkEditFieldValue>(KEEP_VALUE);
  const [enabled, setEnabled] = useState<ProductBulkEditFieldValue>(KEEP_VALUE);
  const [stockMode, setStockMode] = useState<ProductBulkEditFieldValue>(KEEP_VALUE);
  const selectedCount = workflow.selectedProductRows.length;
  const disabledDetailFields = workflow.selectedDetailCount === 0;
  const input: ProductBulkEditInput = { notification, enabled, stockMode };

  // เปิด dialog ใหม่ = เริ่มจากค่า "คงเดิม" ทุกช่องเสมอ
  useResetOnChange(workflow.bulkEditOpen, () => {
    if (!workflow.bulkEditOpen) return;
    setNotification(KEEP_VALUE);
    setEnabled(KEEP_VALUE);
    setStockMode(KEEP_VALUE);
  });

  return (
    <Dialog open={workflow.bulkEditOpen} onOpenChange={workflow.setBulkEditOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {workflow.t("actions.edit")} {workflow.t("common.selectedCount", { count: selectedCount })}
          </DialogTitle>
          <DialogDescription>
            {workflow.t("product.title")} / {workflow.activeStatusLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 rounded-md border border-border bg-muted/20 p-3 text-xs">
          <Badge className="bg-primary/10 text-primary">
            {workflow.t("common.selectedCount", { count: selectedCount })}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Boxes className="size-3" />
            {workflow.t("product.sections.details")}: {workflow.selectedDetailCount}
          </Badge>
        </div>

        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel className="flex items-center gap-2">
              <Bell className="size-4 text-muted-foreground" />
              {workflow.t("product.notification.label")}
            </FieldLabel>
            <Select
              value={notification}
              disabled={workflow.bulkEditing}
              onValueChange={(value) => setNotification(value as ProductBulkEditFieldValue)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  <SelectItem value={KEEP_VALUE}>{workflow.t("storePermissions.noChanges")}</SelectItem>
                  <SelectItem value="1">{workflow.t("product.notification.on")}</SelectItem>
                  <SelectItem value="2">{workflow.t("product.notification.off")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-muted-foreground" />
                {workflow.t("product.detailEnabledStatus")}
              </FieldLabel>
              <Select
                value={enabled}
                disabled={workflow.bulkEditing || disabledDetailFields}
                onValueChange={(value) => setEnabled(value as ProductBulkEditFieldValue)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectItem value={KEEP_VALUE}>{workflow.t("storePermissions.noChanges")}</SelectItem>
                    <SelectItem value="1">{workflow.t("common.active")}</SelectItem>
                    <SelectItem value="2">{workflow.t("common.inactive")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {disabledDetailFields ? (
                <FieldDescription>{workflow.t("common.noData")}</FieldDescription>
              ) : null}
            </Field>

            <Field>
              <FieldLabel className="flex items-center gap-2">
                <Boxes className="size-4 text-muted-foreground" />
                {workflow.t("product.stockBulk.label")}
              </FieldLabel>
              <Select
                value={stockMode}
                disabled={workflow.bulkEditing || disabledDetailFields}
                onValueChange={(value) => setStockMode(value as ProductBulkEditFieldValue)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectItem value={KEEP_VALUE}>{workflow.t("storePermissions.noChanges")}</SelectItem>
                    <SelectItem value="1">{workflow.t("product.stockMode.deduct")}</SelectItem>
                    <SelectItem value="2">{workflow.t("product.stockMode.noDeduct")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {disabledDetailFields ? (
                <FieldDescription>{workflow.t("common.noData")}</FieldDescription>
              ) : null}
            </Field>
          </div>
        </FieldGroup>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={workflow.bulkEditing} onClick={() => workflow.setBulkEditOpen(false)}>
            {workflow.t("actions.cancel")}
          </Button>
          <Button
            type="button"
            disabled={workflow.bulkEditing || !selectedCount || !hasChanges(input)}
            onClick={() => void workflow.applyBulkEdit(input)}
          >
            {workflow.bulkEditing ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            {workflow.t("actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
