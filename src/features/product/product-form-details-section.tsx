"use client";

import { Info, Layers3, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { BinaryFlag } from "./product-form-types";
import {
  binaryFlag,
  entityLabel,
  sizeName,
  sizeUuid,
} from "./product-form-utils";
import { ProductFormSectionNumber } from "./product-form-section-number";
import type { ProductFormWorkflow } from "./use-product-form-workflow";

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
    language,
    statusSortFk,
    updateDetail,
    removeDetail,
  } = form;

  return (          <Card>
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
                : t("fields.size");
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
                    <FieldLabel>{t("fields.size")}</FieldLabel>
                    <Select key={sizeOptions.length ? "ready" : "loading"} value={row.size_uuid_fk} onValueChange={(value) => updateDetail(row.id, { size_uuid_fk: value })}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("fields.size")} />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectGroup>
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
                  </Field>
                  <Field>
                    <FieldLabel>{t("fields.bprice")}</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      value={row.pro_detail_bprice}
                      onChange={(event) => updateDetail(row.id, { pro_detail_bprice: event.target.value })}
                    />
                  </Field>
                  {statusSortFk !== "2" ? (
                    <Field>
                      <FieldLabel>{t("fields.sprice")}</FieldLabel>
                      <Input
                        type="number"
                        min={0}
                        value={row.pro_detail_sprice}
                        onChange={(event) => updateDetail(row.id, { pro_detail_sprice: event.target.value })}
                      />
                    </Field>
                  ) : null}
                  <Field>
                    <FieldLabel>{t("fields.qtyStock")}</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      value={row.pro_detail_qty_stock}
                      onChange={(event) => updateDetail(row.id, { pro_detail_qty_stock: event.target.value })}
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
                        <Input
                          type="number"
                          min={0}
                          value={row.pro_detail_cus_qtyBuy}
                          onChange={(event) => updateDetail(row.id, { pro_detail_cus_qtyBuy: event.target.value })}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>{t("product.freeQty")}</FieldLabel>
                        <Input
                          type="number"
                          min={0}
                          value={row.pro_detail_cus_qtyFree}
                          onChange={(event) => updateDetail(row.id, { pro_detail_cus_qtyFree: event.target.value })}
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
  );
}