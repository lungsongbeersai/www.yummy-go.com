"use client";

import { type ReactNode } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ProductSortStatus,
  type CateProductItem,
  type ProdDetail,
  type ProdItem,
  type ProdTopping,
} from "@/services/pos";
import {
  clampQty,
  getProductActionState,
  getPromoLabel,
  isDetailAvailable,
  isToppingAvailable,
  MAX_ORDER_QTY,
  productActionLabel,
  productMedia,
  productModeLabel,
  productPriceFromDetail,
  toppingDisplayName,
  toppingPrice,
  toppingUuid,
  type ProductMedia,
  type ProductModalMode,
} from "./order-customer-utils";
import { ProductMediaView } from "./order-customer-product-card";

export function ProductOptionsOverlay({
  children,
  description,
  isMobile,
  open,
  title,
  onOpenChange,
}: {
  children: ReactNode;
  description: string;
  isMobile: boolean;
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
}) {
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="pos-soft-light-zone flex h-[calc(100dvh-8px)] max-h-none flex-col gap-0 overflow-hidden rounded-t-2xl border-border bg-background p-0 text-foreground"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pos-soft-light-zone flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden border-border bg-background p-0 text-foreground sm:max-w-[720px]">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function ProductOptionsForm({
  activeSort,
  listProduct,
  modalUnitPrice,
  mode,
  note,
  product,
  qty,
  saving,
  selectedDetail,
  selectedToppings,
  toppingUuids,
  onDetailChange,
  onNoteChange,
  onQtyChange,
  onSubmit,
  onToggleTopping,
}: {
  activeSort: ProductSortStatus;
  listProduct: CateProductItem;
  modalUnitPrice: number;
  mode: ProductModalMode;
  note: string;
  product: ProdItem;
  qty: number;
  saving: boolean;
  selectedDetail: ProdDetail;
  selectedToppings: ProdTopping[];
  toppingUuids: string[];
  onDetailChange: (detail: ProdDetail) => void;
  onNoteChange: (note: string) => void;
  onQtyChange: (qty: number) => void;
  onSubmit: () => void;
  onToggleTopping: (uuid: string) => void;
}) {
  const { t } = useTranslation();
  const media = productMedia(product);
  const details = (product.details ?? []).filter(isDetailAvailable);
  const toppings = (product.toppings ?? []).filter(isToppingAvailable);
  const total = modalUnitPrice * qty;
  const modeLabel = productModeLabel(mode, product, t);
  const actionLabel = productActionLabel(
    getProductActionState(listProduct, activeSort),
    listProduct,
    activeSort,
    t,
  );

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-3 sm:gap-4">
          <ProductDetailSummary
            actionLabel={actionLabel}
            media={media}
            modeLabel={modeLabel}
            product={product}
            qty={qty}
            selectedToppingCount={selectedToppings.length}
            total={total}
          />

          <FieldGroup className="gap-4">
            {details.length > 1 ? (
              <Field>
                <ProductSectionHeader
                  label={t("pos.chooseSize")}
                  meta={`${details.length}`}
                />
                <div className="flex flex-col gap-2">
                  {details.map((detail) => {
                    const active =
                      detail.pro_detail_uuid === selectedDetail.pro_detail_uuid;
                    return (
                      <ProductOptionRow
                        key={detail.pro_detail_uuid}
                        active={active}
                        label={detail.size_name || t("pos.size")}
                        price={money(productPriceFromDetail(detail))}
                        icon={
                          active ? <Check data-icon="inline-start" /> : null
                        }
                        onClick={() => onDetailChange(detail)}
                      />
                    );
                  })}
                </div>
              </Field>
            ) : null}

            {mode === "promotion" ? (
              <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-primary">
                <span className="text-sm font-black">{t("pos.promoDeal")}</span>
                <Badge className="shrink-0 bg-primary text-primary-foreground">
                  {getPromoLabel(selectedDetail, t)}
                </Badge>
              </div>
            ) : null}

            {toppings.length ? (
              <Field>
                <ProductSectionHeader
                  label={t("pos.toppings")}
                  meta={`${selectedToppings.length}/${toppings.length}`}
                />
                <div className="flex flex-col gap-2">
                  {toppings.map((topping) => {
                    const uuid = toppingUuid(topping);
                    const active = toppingUuids.includes(uuid);
                    return (
                      <ProductOptionRow
                        key={uuid}
                        active={active}
                        label={toppingDisplayName(topping)}
                        price={`+${money(toppingPrice(topping))}`}
                        icon={
                          active ? (
                            <Check data-icon="inline-start" />
                          ) : (
                            <Plus data-icon="inline-start" />
                          )
                        }
                        onClick={() => onToggleTopping(uuid)}
                      />
                    );
                  })}
                </div>
              </Field>
            ) : null}

            <Field>
              <ProductSectionHeader label={t("pos.qty")} meta={`${qty}`} />
              <div className="grid max-w-[220px] grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 bg-background hover:bg-muted"
                  disabled={qty <= 1}
                  onClick={() => onQtyChange(Math.max(1, qty - 1))}
                >
                  <Minus />
                </Button>
                <Input
                  className="h-11 w-full bg-background text-center text-lg font-black"
                  inputMode="numeric"
                  value={qty}
                  onChange={(event) => {
                    const next = Number(
                      event.target.value.replace(/[^\d]/g, ""),
                    );
                    onQtyChange(clampQty(next || 1));
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 bg-background hover:bg-muted"
                  disabled={qty >= MAX_ORDER_QTY}
                  onClick={() => onQtyChange(clampQty(qty + 1))}
                >
                  <Plus />
                </Button>
              </div>
            </Field>

            <Field>
              <ProductSectionHeader label={t("pos.note")} />
              <Textarea
                className="min-h-16 resize-none bg-background"
                value={note}
                placeholder={t("pos.notePlaceholder")}
                onChange={(event) => onNoteChange(event.target.value)}
              />
            </Field>
          </FieldGroup>
        </div>
      </div>

      <ProductOptionsFooter
        saving={saving}
        selectedToppings={selectedToppings}
        total={total}
      />
    </form>
  );
}

function ProductDetailSummary({
  actionLabel,
  media,
  modeLabel,
  product,
  qty,
  selectedToppingCount,
  total,
}: {
  actionLabel: string;
  media: ProductMedia;
  modeLabel: string;
  product: ProdItem;
  qty: number;
  selectedToppingCount: number;
  total: number;
}) {
  const { t } = useTranslation();

  return (
    <section className="rounded-xl border border-primary/15 bg-card p-3 shadow-sm">
      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted bg-cover bg-center">
          <ProductMediaView
            alt={product.prod_name}
            fallbackIcon="chef"
            media={media}
            sizes="120px"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2 self-center">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="w-fit bg-primary text-primary-foreground shadow-sm">
              {modeLabel}
            </Badge>
            <Badge className="w-fit border-primary/20 bg-primary/10 text-primary">
              {actionLabel}
            </Badge>
          </div>
          <h2 className="line-clamp-2 text-lg font-black leading-6 text-foreground sm:text-xl sm:leading-7">
            {product.prod_name}
          </h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold leading-4 text-muted-foreground">
            <span>
              {t("pos.qty")}: {qty}
            </span>
            <span>
              {t("pos.toppings")}: {selectedToppingCount}
            </span>
          </div>
        </div>
        <div className="col-span-2 flex min-w-0 items-end justify-between gap-3 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 sm:col-span-1 sm:min-w-[170px] sm:flex-col sm:items-end sm:justify-center">
          <p className="shrink-0 text-xs font-bold leading-4 text-primary/75">
            {t("common.total")}
          </p>
          <p className="truncate text-2xl font-black leading-8 text-primary tabular-nums">
            {money(total)}
          </p>
        </div>
      </div>
    </section>
  );
}

function ProductSectionHeader({
  label,
  meta,
}: {
  label: string;
  meta?: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <FieldLabel className="text-sm font-black leading-5 text-foreground">
        {label}
      </FieldLabel>
      {meta ? (
        <span className="shrink-0 text-xs font-black text-muted-foreground">
          {meta}
        </span>
      ) : null}
    </div>
  );
}

function ProductOptionRow({
  active,
  disabled,
  icon,
  label,
  price,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  price: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "h-auto min-h-12 w-full justify-between gap-3 rounded-lg border-border bg-card px-3 py-2 text-left hover:border-primary/30 hover:bg-primary/5",
        active &&
          "border-primary bg-primary/10 text-primary shadow-sm hover:bg-primary/15",
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span className="min-w-0 truncate text-sm font-black">{label}</span>
      </span>
      <span className="shrink-0 text-sm font-black tabular-nums">{price}</span>
    </Button>
  );
}

function ProductOptionsFooter({
  saving,
  selectedToppings,
  total,
}: {
  saving: boolean;
  selectedToppings: ProdTopping[];
  total: number;
}) {
  const { t } = useTranslation();
  const content = (
    <>
      <div className="min-w-0">
        <p className="text-xs font-bold leading-4 text-primary/75">
          {t("pos.toppings")}: {selectedToppings.length}
        </p>
        <p className="truncate text-2xl font-black leading-8 text-primary tabular-nums">
          {money(total)}
        </p>
      </div>
      <Button
        type="submit"
        className="h-12 min-w-[150px] rounded-lg bg-primary text-base font-black text-primary-foreground shadow-sm hover:bg-primary/90"
        disabled={saving}
      >
        {saving ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <Plus data-icon="inline-start" />
        )}
        {t("pos.sendOrder")}
      </Button>
    </>
  );

  return (
    <>
      <SheetFooter className="shrink-0 border-t border-border bg-background px-4 py-3 md:hidden">
        <div className="flex items-center justify-between gap-3">{content}</div>
      </SheetFooter>
      <DialogFooter className="hidden shrink-0 border-t border-border bg-background px-5 py-4 md:flex md:items-center md:justify-between">
        {content}
      </DialogFooter>
    </>
  );
}
