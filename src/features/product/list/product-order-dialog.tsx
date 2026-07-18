"use client";

import { useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { productName } from "./product-list-utils";
import type { ProductListWorkflow } from "./use-product-list-workflow";

export function ProductOrderDialog({ workflow }: { workflow: ProductListWorkflow }) {
  const target = workflow.orderEditTarget;
  const total = workflow.filteredRows.length;
  const sortAvailable = workflow.canSortProducts;
  const [position, setPosition] = useState("");

  useResetOnChange(target, () => {
    if (target) setPosition(String(target.row_number));
  });

  const parsed = Number(position);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= total;

  function submit() {
    if (!target || !valid || !sortAvailable || workflow.saving) return;
    void workflow.moveProductToPosition(target, parsed);
  }

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !workflow.saving) workflow.setOrderEditTarget(null);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{workflow.t("product.editOrder")}</DialogTitle>
          <DialogDescription>{target ? productName(target, workflow.language) : ""}</DialogDescription>
        </DialogHeader>
        {sortAvailable ? (
          <Field>
            <FieldLabel htmlFor="product-order-position">{workflow.t("common.order")}</FieldLabel>
            <Input
              id="product-order-position"
              name="product-order-position"
              type="number"
              inputMode="numeric"
              min={1}
              max={total}
              value={position}
              onChange={(event) => setPosition(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
            />
            <FieldDescription>{workflow.t("product.editOrderHint", { total })}</FieldDescription>
          </Field>
        ) : (
          <p className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            {workflow.t("product.sortHint")}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={workflow.saving}
            onClick={() => workflow.setOrderEditTarget(null)}
          >
            {workflow.t("actions.cancel")}
          </Button>
          <Button type="button" disabled={!valid || !sortAvailable || workflow.saving} onClick={submit}>
            {workflow.saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            {workflow.t("actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
