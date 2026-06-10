"use client";

import { Info, Layers3, Pencil, Plus, RefreshCcw, Save, Search, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FormattedNumberInput } from "@/components/common/formatted-number-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { BinaryFlag } from "./product-form-types";
import {
  binaryFlag,
  entityLabel,
  sizeName,
  sizeUuid,
} from "./product-form-utils";
import { ProductFormSectionNumber } from "./product-form-section-number";
import type { ProductFormWorkflow } from "./use-product-form-workflow";

const NO_SET_PRODUCT_OPTION_VALUE = "__no-set-products__";

export function ProductFormDetailsSection({ form }: { form: ProductFormWorkflow }) {
  const {
    t,
    detailStockStateClass,
    detailStockStateLabel,
    detailStockActionLabel,
    details,
    bulkStockSaving,
    updateAllDetailStockModes,
    nextDetailStockMode,
    addDetail,
    typeLabel,
    detailModeHint,
    sizeOptions,
    setOptionOptions,
    filteredSetOptionOptions,
    language,
    statusSortFk,
    updateDetail,
    removeDetail,
    setOptionDialogOpen,
    handleSetOptionDialogOpen,
    setOptionNameLa,
    setSetOptionNameLa,
    setOptionNameEng,
    setSetOptionNameEng,
    setOptionSearch,
    setSetOptionSearch,
    editingSetOptionUuid,
    deletingSetOptionUuid,
    setDeletingSetOptionUuid,
    setOptionSaving,
    openSetOptionDialog,
    resetSetOptionForm,
    editSetOption,
    saveSetOptionFromDialog,
    deleteSetOptionFromDialog,
  } = form;
  const detailItemLabel = statusSortFk === "2" ? t("pos.product") : t("fields.size");
  const showNoSetProductOptions = statusSortFk === "2" && !sizeOptions.length;
  const sizeSelectKey = showNoSetProductOptions ? "empty" : sizeOptions.length ? "ready" : "loading";

  return (
    <>
      <Card>
            <CardHeader className="flex-col items-stretch gap-3 md:flex-row md:items-start">
              <ProductFormSectionNumber value="3" />
              <div className="min-w-0 flex-1">
                <CardTitle>{t("product.sections.details")}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{t("product.sections.detailsHint")}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row md:justify-end">
                <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-border bg-muted/35 px-3 text-xs sm:min-w-48">
                  <span className="font-bold text-muted-foreground">{t("product.stockBulk.label")}</span>
                  <Badge className={detailStockStateClass}>{detailStockStateLabel}</Badge>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!details.length || bulkStockSaving}
                  onClick={() => void updateAllDetailStockModes(nextDetailStockMode)}
                >
                  {bulkStockSaving ? <Spinner data-icon="inline-start" /> : <Layers3 data-icon="inline-start" />}
                  {detailStockActionLabel}
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={bulkStockSaving} onClick={addDetail}>
                  <Plus data-icon="inline-start" />
                  {t("product.addDetail")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Alert>
                <Info />
                <AlertTitle>{typeLabel}</AlertTitle>
                <AlertDescription>{detailModeHint}</AlertDescription>
              </Alert>
            {details.map((row, index) => {
              const selectedSize = sizeOptions.find((size) => sizeUuid(size) === row.size_uuid_fk);
              const selectedSizeLabel = selectedSize
                ? entityLabel(selectedSize, "size_name_eng", "size_name_la", language, sizeName(selectedSize) || row.size_uuid_fk)
                : detailItemLabel;
              const canEditDetailStock = statusSortFk === "2";
              const rowStockMode = binaryFlag(row.pro_detail_stock, "1");
              const rowStockLabel =
                rowStockMode === "1" ? t("product.stockMode.deduct") : t("product.stockMode.noDeduct");
              const rowStockClass =
                rowStockMode === "1" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground";

              return (
              <FieldSet key={row.id} className="gap-4 rounded-md border border-border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <FieldLegend className="mb-1 text-sm font-black">#{index + 1}</FieldLegend>
                    <FieldDescription className="text-xs">{selectedSizeLabel}</FieldDescription>
                  </div>
                  <Button
                    type="button"
                    size="iconSm"
                    variant="ghost"
                    disabled={details.length <= 1}
                    aria-label={t("actions.delete")}
                    onClick={() => removeDetail(row.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <FieldGroup className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Field>
                    <FieldLabel>{detailItemLabel}</FieldLabel>
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                      <Select
                        key={sizeSelectKey}
                        value={row.size_uuid_fk}
                        onValueChange={(value) => {
                          if (value === NO_SET_PRODUCT_OPTION_VALUE) return;
                          updateDetail(row.id, { size_uuid_fk: value });
                        }}
                      >
                        <SelectTrigger className="min-w-0 flex-1">
                          <SelectValue placeholder={detailItemLabel} />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectGroup>
                            {showNoSetProductOptions ? (
                              <SelectItem value={NO_SET_PRODUCT_OPTION_VALUE} disabled>
                                {t("product.noSetProductOptions")}
                              </SelectItem>
                            ) : null}
                            {sizeOptions.map((size) => {
                              const uuid = sizeUuid(size);
                              return (
                                <SelectItem key={uuid} value={uuid}>
                                  {entityLabel(size, "size_name_eng", "size_name_la", language, sizeName(size) || uuid)}
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {statusSortFk === "2" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          disabled={setOptionSaving}
                          onClick={() => openSetOptionDialog(row.id)}
                        >
                          <Plus data-icon="inline-start" />
                          {t("product.addSetProductOption")}
                        </Button>
                      ) : null}
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel>{t("fields.bprice")}</FieldLabel>
                    <FormattedNumberInput
                      min={0}
                      value={row.pro_detail_bprice}
                      onValueChange={(value) => updateDetail(row.id, { pro_detail_bprice: value })}
                    />
                  </Field>
                  {statusSortFk !== "2" ? (
                    <Field>
                      <FieldLabel>{t("fields.sprice")}</FieldLabel>
                      <FormattedNumberInput
                        min={0}
                        value={row.pro_detail_sprice}
                        onValueChange={(value) => updateDetail(row.id, { pro_detail_sprice: value })}
                      />
                    </Field>
                  ) : null}
                  <Field>
                    <FieldLabel>{t("fields.qtyStock")}</FieldLabel>
                    <FormattedNumberInput
                      min={0}
                      value={row.pro_detail_qty_stock}
                      onValueChange={(value) => updateDetail(row.id, { pro_detail_qty_stock: value })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("product.detailStockStatus")}</FieldLabel>
                    {canEditDetailStock ? (
                      <Select
                        value={row.pro_detail_stock}
                        disabled={bulkStockSaving}
                        onValueChange={(value) => updateDetail(row.id, { pro_detail_stock: value as BinaryFlag })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectGroup>
                            <SelectItem value="1">{t("product.stockMode.deduct")}</SelectItem>
                            <SelectItem value="2">{t("product.stockMode.noDeduct")}</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex min-h-10 items-center rounded-md border border-border bg-muted/25 px-3">
                        <Badge className={rowStockClass}>{rowStockLabel}</Badge>
                      </div>
                    )}
                  </Field>
                  {statusSortFk === "1" ? (
                    <Field>
                      <FieldLabel>{t("product.detailEnabledStatus")}</FieldLabel>
                      <Select
                        value={row.pro_detail_enabled}
                        onValueChange={(value) => updateDetail(row.id, { pro_detail_enabled: value as BinaryFlag })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectGroup>
                            <SelectItem value="1">{t("common.active")}</SelectItem>
                            <SelectItem value="2">{t("common.inactive")}</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : null}
                  {statusSortFk === "3" ? (
                    <>
                      <Field>
                        <FieldLabel>{t("product.buyQty")}</FieldLabel>
                        <FormattedNumberInput
                          min={0}
                          value={row.pro_detail_cus_qtyBuy}
                          onValueChange={(value) => updateDetail(row.id, { pro_detail_cus_qtyBuy: value })}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>{t("product.freeQty")}</FieldLabel>
                        <FormattedNumberInput
                          min={0}
                          value={row.pro_detail_cus_qtyFree}
                          onValueChange={(value) => updateDetail(row.id, { pro_detail_cus_qtyFree: value })}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>{t("product.promotionTime.label")}</FieldLabel>
                        <Select
                          value={row.pro_detail_status}
                          onValueChange={(value) => updateDetail(row.id, { pro_detail_status: value as BinaryFlag })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper">
                            <SelectGroup>
                              <SelectItem value="1">{t("product.promotionTime.dateOnly")}</SelectItem>
                              <SelectItem value="2">{t("product.promotionTime.timeRange")}</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>{t("product.startDate")}</FieldLabel>
                        <Input
                          type="date"
                          value={row.pro_detail_sDate}
                          onChange={(event) => updateDetail(row.id, { pro_detail_sDate: event.target.value })}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>{t("product.endDate")}</FieldLabel>
                        <Input
                          type="date"
                          value={row.pro_detail_eDate}
                          onChange={(event) => updateDetail(row.id, { pro_detail_eDate: event.target.value })}
                        />
                      </Field>
                      {row.pro_detail_status === "2" ? (
                        <>
                          <Field>
                            <FieldLabel>{t("product.startTime")}</FieldLabel>
                            <Input
                              type="time"
                              value={row.pro_detail_sTime}
                              onChange={(event) => updateDetail(row.id, { pro_detail_sTime: event.target.value })}
                            />
                          </Field>
                          <Field>
                            <FieldLabel>{t("product.endTime")}</FieldLabel>
                            <Input
                              type="time"
                              value={row.pro_detail_eTime}
                              onChange={(event) => updateDetail(row.id, { pro_detail_eTime: event.target.value })}
                            />
                          </Field>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </FieldGroup>
              </FieldSet>
              );
            })}
            </CardContent>
      </Card>
      <Dialog open={setOptionDialogOpen} onOpenChange={handleSetOptionDialogOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("product.addSetProductOption")}</DialogTitle>
            <DialogDescription>{t("product.setProductOptionHint")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 lg:grid-cols-2">
            <FieldSet className="gap-4 rounded-md border bg-muted/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <FieldLegend className="mb-1 text-sm font-black">
                    {editingSetOptionUuid ? t("settings.editRecord") : t("settings.newRecord")}
                  </FieldLegend>
                  <FieldDescription>{t("product.setProductOptionFormHint")}</FieldDescription>
                </div>
                {editingSetOptionUuid ? (
                  <Button type="button" size="sm" variant="outline" disabled={setOptionSaving} onClick={resetSetOptionForm}>
                    <RefreshCcw data-icon="inline-start" />
                    {t("actions.new")}
                  </Button>
                ) : null}
              </div>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="set-option-name-la">{t("fields.nameLa")}</FieldLabel>
                  <Input
                    id="set-option-name-la"
                    value={setOptionNameLa}
                    disabled={setOptionSaving}
                    autoComplete="off"
                    onChange={(event) => setSetOptionNameLa(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="set-option-name-eng">{t("fields.nameEn")}</FieldLabel>
                  <Input
                    id="set-option-name-eng"
                    value={setOptionNameEng}
                    disabled={setOptionSaving}
                    autoComplete="off"
                    onChange={(event) => setSetOptionNameEng(event.target.value)}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>

            <div className="flex min-h-0 flex-col gap-3 rounded-md border bg-muted/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black">{t("product.setProductOptions")}</p>
                  <p className="text-xs text-muted-foreground">{t("common.total")}: {setOptionOptions.length}</p>
                </div>
                <Badge>{t("common.selectedCount", { count: details.filter((row) => row.size_uuid_fk).length })}</Badge>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={setOptionSearch}
                  placeholder={t("product.searchSetProductOptions")}
                  onChange={(event) => setSetOptionSearch(event.target.value)}
                />
              </div>
              <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                {filteredSetOptionOptions.map((size) => {
                  const uuid = sizeUuid(size);
                  const label = entityLabel(size, "size_name_eng", "size_name_la", language, sizeName(size) || uuid);
                  const selected = details.some((row) => row.size_uuid_fk === uuid);
                  const editing = editingSetOptionUuid === uuid;

                  return (
                    <div
                      key={uuid}
                      className={cn(
                        "flex items-center gap-2 rounded-md border bg-background p-3",
                        editing || selected ? "border-primary" : "border-border"
                      )}
                    >
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => editSetOption(size)}>
                        <span className="block truncate text-sm font-black">{label}</span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {String(size.size_name_eng ?? "") || t("fields.nameEn")}
                        </span>
                      </button>
                      {selected ? <Badge className="shrink-0">{t("common.active")}</Badge> : null}
                      <Button
                        type="button"
                        size="iconSm"
                        variant="ghost"
                        aria-label={t("actions.edit")}
                        disabled={setOptionSaving}
                        onClick={() => editSetOption(size)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        size="iconSm"
                        variant="danger"
                        aria-label={t("actions.delete")}
                        disabled={setOptionSaving}
                        onClick={() => setDeletingSetOptionUuid(uuid)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  );
                })}
                {!filteredSetOptionOptions.length ? (
                  <FieldDescription>{t("common.noData")}</FieldDescription>
                ) : null}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={setOptionSaving} onClick={() => handleSetOptionDialogOpen(false)}>
              {t("actions.cancel")}
            </Button>
            <Button type="button" disabled={setOptionSaving || !setOptionNameLa.trim()} onClick={saveSetOptionFromDialog}>
              {setOptionSaving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(deletingSetOptionUuid)}
        title={`${t("actions.delete")} ${t("product.setProductOptions")}`}
        description={t("settings.deleteConfirm")}
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        confirmPending={setOptionSaving}
        onConfirm={() => void deleteSetOptionFromDialog(deletingSetOptionUuid)}
        onOpenChange={(open) => {
          if (!open) setDeletingSetOptionUuid("");
        }}
      />
    </>
  );
}
