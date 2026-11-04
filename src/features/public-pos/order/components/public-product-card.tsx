"use client";

import { memo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Eye,
  Plus,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { CateProductItem } from "@/services/pos";
import {
  PUBLIC_MENU_KIND,
  usePublicPosStore,
  publicMenuKindToStatusSortFk,
  type PublicMenuKind,
} from "@/stores/public-pos-store";
import type { ProductActionState } from "../types";
import {
  formatMoney,
  getProductActionState,
  getProductBlockedState,
  hasPromo,
  productBlockedLabel,
  publicProductCardPrice,
} from "../utils";
import { ProductMedia } from "./public-product-media";

// A shared frame keeps product groups distinct in both list and tile layouts.
const CARD_SURFACE_CLASS =
  "h-full gap-0 py-0 shadow-none ring-0 transition-[transform,border-color] duration-150 ease-out motion-reduce:transition-none";
const CARD_TILE_CLASS = "rounded-2xl border border-yg-divider bg-yg-card p-2";
const CARD_ROW_CLASS = "rounded-2xl border border-yg-divider bg-yg-card";
const CARD_ROW_BUTTON_CLASS =
  "flex h-auto min-h-28 w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-yg-panel-hover active:scale-[0.99] active:duration-75 focus-visible:ring-inset aria-disabled:cursor-not-allowed aria-disabled:hover:bg-transparent disabled:opacity-100 motion-reduce:transform-none";
const CARD_ROW_MEDIA_CLASS =
  "relative size-20 shrink-0 overflow-hidden rounded-xl bg-yg-panel2 sm:size-24";

// Chrome มีบั๊กที่รู้จักกันดี: element ที่มีทั้ง overflow:hidden + border-radius + transition/transform
// (เช่น hover:-translate-y-1 ของ CARD_INTERACTIVE_CLASS) อยู่บนตัวเดียวกัน บางครั้งไม่ clip ลูกที่เป็น
// สี่เหลี่ยมมุมฉาก (รูปสินค้า/พื้นสี) ให้สนิทกับมุมโค้ง โผล่เป็นมุมเหลี่ยมแทรกออกมานอกเส้นขอบโค้ง —
// แยก overflow-hidden มาไว้ที่ wrapper ชั้นในที่ไม่มี transform ของตัวเอง ส่วน transform ยกการ์ดตอน
// hover ยังอยู่ที่ Card ชั้นนอกเหมือนเดิม (transform ของ ancestor ไม่ทำให้ลูกที่ถูก clip ไปแล้วหลุดออกมา)
const CARD_CLIP_CLASS = "h-full";

const MEDIA_FRAME_CLASS = "relative w-full overflow-hidden rounded-xl";

// hover:-translate-y-1 ใช้ไม่ได้บนมือถือ (แตะไม่มี :hover) — active:scale ทำงาน
// ทันทีที่นิ้วแตะจอไม่ว่าจะ hover มาก่อนหรือไม่ ให้ความรู้สึกกดแล้ว "ตอบสนองทันที"
// active:duration-75 ให้กดยุบเร็วกว่าคืนตัว (ปล่อยกลับใช้ duration ปกติจาก CARD_SURFACE_CLASS)
// เลียนแบบ tap feedback ของแอปมือถือทั่วไป
const CARD_INTERACTIVE_CLASS =
  "hover:border-yg-accent-line hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] active:duration-75 motion-reduce:transform-none";

// เมนูร้านที่มีสินค้าเยอะ การ์ดนอกจอต้อง skip layout/paint ไปเลยไม่งั้นเลื่อน/แตะช้าลง
// เรื่อยๆ ตามจำนวนสินค้า — "auto 360px" ให้เบราว์เซอร์จำขนาดจริงหลัง render ครั้งแรก
// ใช้แค่กับการ์ดกริด/rail (สูงใกล้เคียงกัน) ไม่ใช้กับ variant list ที่เตี้ยกว่ามาก
// (เทียบ order-customer-product-card.tsx ฝั่งแคชเชียร์ที่มี optimization นี้อยู่แล้ว)
//
// 220px ≈ the flat card as drawn now (4:3 image + two-line name + the 44px row: ~220px on phones,
// ~240px on desktop). The old 360px came from the taller framed card; a card not drawn yet kept
// that height and, the grid stretching a row to its tallest item, padded its neighbours with
// empty space.
const CARD_LAZY_RENDER_CLASS =
  "[content-visibility:auto] [contain-intrinsic-size:auto_220px]";

// โปรโมชั่น/เซ็ต มีจำนวนรายการน้อยอยู่แล้ว (ไม่ต้องพึ่ง optimization นี้) และสูงไม่นิ่ง
// เท่าการ์ดสินค้าปกติ (โปรโมชั่นไม่มีแถวราคา/ปุ่มเลือกจำนวน, เซ็ตบางใบมีปุ่ม "เบิ่ง" บางใบไม่มี)
// การ์ดที่ยังไม่เคย render (เลื่อนออกนอกจอ) เลยค้าง placeholder "auto 360px" ที่สูงเกินจริงไว้
// ทำให้ทั้งแถวสูงเกิน เหลือช่องว่างใต้การ์ดที่มองเห็นจริง (P-72) — ปิด lazy-render สำหรับสองประเภทนี้
function canLazyRenderCard(statusKind: PublicMenuKind) {
  return (
    statusKind !== PUBLIC_MENU_KIND.PROMOTION &&
    statusKind !== PUBLIC_MENU_KIND.SET
  );
}

export const ProductCard = memo(function ProductCard({
  product,
  cateUuid,
  statusKind,
  lang,
  loading,
  onProductClick,
  imagePreload = false,
  variant = "grid",
}: {
  product: CateProductItem;
  cateUuid: string;
  statusKind: PublicMenuKind;
  lang: string;
  loading: boolean;
  onProductClick: (
    product: CateProductItem,
    cateUuid: string,
    statusKind: PublicMenuKind,
    sourceRect?: DOMRect | null
  ) => void;
  imagePreload?: boolean;
  variant?: "grid" | "rail" | "railGrid" | "list";
}) {
  const { t } = useTranslation();
  const compactRail = variant === "rail" || variant === "railGrid";
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const price = publicProductCardPrice(product);
  const statusSortFk = publicMenuKindToStatusSortFk(statusKind);
  const blockedState = getProductBlockedState(product, statusSortFk);
  const viewOnly = usePublicPosStore((state) => Boolean(state.scan?.view_only));
  const productActionState = getProductActionState(product, statusSortFk);
  const actionState =
    viewOnly && productActionState !== "blocked" ? "view" : productActionState;
  const isBlocked = actionState === "blocked";
  const blockedLabel = productBlockedLabel(blockedState, product, t);
  const optionCount = Math.max(0, Number(product.countOptionEnabled ?? 0) || 0);
  const hasActualChoices =
    product.hasOptions === true ||
    optionCount > 1 ||
    Number(product.countToppingEnabled ?? 0) > 0;
  const choiceMeta = hasActualChoices
    ? optionCount > 1
      ? t("pos.optionCount", { count: optionCount })
      : product.optionsMsg || t("pos.hasOptions")
    : "";
  const promoLabel =
    product.promoMsg || (hasPromo(product) ? t("pos.promotion") : "");
  const productSummary = product.promoMsg?.trim() || choiceMeta;
  const showProductSummary =
    Boolean(productSummary) &&
    productSummary !== t("pos.promotion") &&
    productSummary !== t("pos.menuPromotion");
  const compactOptions = actionState === "choose";
  const actionLabel = compactOptions
    ? t("pos.mobileOptionsAction")
    : getActionLabel({
        actionState,
        blockedLabel,
        detailed: false,
        t,
      });
  const detailedActionLabel = compactOptions
    ? t("pos.mobileOptionsAction")
    : getActionLabel({
        actionState,
        blockedLabel,
        detailed: true,
        t,
      });
  const priceLabel = getAccessiblePriceLabel(price, lang, isBlocked, t);
  const accessibleLabel = [
    product.prodName,
    priceLabel,
    promoLabel,
    choiceMeta,
    detailedActionLabel,
  ]
    .filter(Boolean)
    .join(", ");
  // Available tile actions share the photo corner; the entire card remains the tap target.
  const addOnImage = !isBlocked;
  const handleClick = useCallback(() => {
    if (isBlocked || loading) return;
    onProductClick(
      product,
      cateUuid,
      statusKind,
      mediaRef.current?.getBoundingClientRect()
    );
  }, [cateUuid, isBlocked, loading, onProductClick, product, statusKind]);

  if (variant === "list") {
    return (
      <Card className={cn(CARD_SURFACE_CLASS, CARD_ROW_CLASS)}>
        <div className={CARD_CLIP_CLASS}>
          <Button
            type="button"
            variant="ghost"
            className={CARD_ROW_BUTTON_CLASS}
            onClick={handleClick}
            disabled={loading}
            aria-busy={loading || undefined}
            aria-disabled={isBlocked || undefined}
            aria-label={accessibleLabel}
          >
            <div
              ref={mediaRef}
              className={CARD_ROW_MEDIA_CLASS}
            >
              <ProductMedia
                product={product}
                variant="listThumb"
                blockedState={blockedState}
                blockedLabel={blockedLabel}
                preload={imagePreload}
              />
            </div>

            <CardContent className="flex min-w-0 flex-1 flex-col justify-center gap-2.5 p-0">
              <div className="flex min-w-0 flex-col gap-1.5">
                <p className="lao-tone-text line-clamp-2 whitespace-normal font-yg-sans text-base font-semibold leading-6 text-yg-ink">
                  {product.prodName}
                </p>
                {!isBlocked && (promoLabel || choiceMeta) ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {promoLabel ? (
                      <ProductPromoBadge label={promoLabel} compact />
                    ) : null}
                    {choiceMeta ? (
                      <ProductChoiceMeta label={choiceMeta} />
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-2 [&>span]:ml-auto">
                <ProductPriceLabel
                  price={price}
                  lang={lang}
                  blocked={isBlocked}
                  compact
                />
                <ProductActionPill
                  actionState={actionState}
                  hasActualChoices={hasActualChoices}
                  label={actionLabel}
                  loading={loading}
                  compact
                  filled={actionState === "add" || actionState === "choose"}
                  subtle={actionState !== "add"}
                />
              </div>
            </CardContent>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        CARD_SURFACE_CLASS,
        CARD_TILE_CLASS,
        variant === "rail"
          ? "w-38 flex-none snap-start sm:w-42"
          : variant === "railGrid"
          ? "w-38 flex-none snap-start sm:w-auto"
          : "min-w-0",
        isBlocked ? "" : CARD_INTERACTIVE_CLASS,
        compactRail && "h-auto hover:translate-y-0",
      )}
    >
      {/* content-visibility:auto ก็ทำตัวเหมือน overflow:hidden ทางการ paint (contain: paint โดยนัย)
          จึงต้องอยู่ในชั้นเดียวกับ CARD_CLIP_CLASS ที่ไม่มี transform เหตุผลเดียวกับด้านบน ไม่งั้นก็เจอ
          บั๊ก clip มุมโค้งแบบเดียวกันได้อีก แม้จะย้าย overflow-hidden ออกไปแล้วก็ตาม — ดู
          canLazyRenderCard ด้านบนสำหรับเหตุผลที่ตัดออกสำหรับโปรโมชั่น/เซ็ต */}
      <div
        className={cn(
          CARD_CLIP_CLASS,
          canLazyRenderCard(statusKind) ? CARD_LAZY_RENDER_CLASS : ""
        )}
      >
        <Button
          type="button"
          variant="ghost"
          className="flex h-full w-full flex-col items-stretch justify-start rounded-none p-0 text-left hover:bg-transparent focus-visible:ring-inset aria-disabled:cursor-not-allowed disabled:opacity-100"
          onClick={handleClick}
          disabled={loading}
          aria-busy={loading || undefined}
          aria-disabled={isBlocked || undefined}
          aria-label={accessibleLabel}
        >
          <div ref={mediaRef} className={MEDIA_FRAME_CLASS}>
            <ProductMedia
              product={product}
              blockedState={blockedState}
              blockedLabel={blockedLabel}
              preload={imagePreload}
              overlay={
                addOnImage ? (
                  // Keep the action in the same corner of every media frame.
                  <span className="absolute right-2 bottom-2 max-w-[calc(100%-1rem)] rounded-xl">
                    <ProductActionPill
                      actionState={actionState}
                      hasActualChoices={hasActualChoices}
                      label={actionLabel}
                      loading={loading}
                      onImage
                      iconOnly={compactRail}
                      subtle={actionState === "choose"}
                    />
                  </span>
                ) : null
              }
            />
            {!isBlocked &&
            promoLabel &&
            statusKind !== PUBLIC_MENU_KIND.PROMOTION ? (
              <ProductPromoBadge label={promoLabel} overlay />
            ) : null}
          </div>

          <CardContent className={cn("@container flex flex-1 flex-col px-1", compactRail ? "gap-1 pt-2 pb-1" : "gap-1.5 pt-3 pb-2")}>
            <p className={cn("lao-tone-text line-clamp-2 whitespace-normal font-yg-sans font-semibold text-yg-ink", compactRail ? "text-sm leading-5" : "text-base leading-6")}>
              {product.prodName}
            </p>

            {/* Price and action use separate rows so neither squeezes the other on phones. */}
            {showProductSummary && !isBlocked ? (
              <p className={cn("lao-tone-text whitespace-normal text-xs font-normal leading-5 text-yg-muted", compactRail ? "line-clamp-1" : "line-clamp-2")}>
                {productSummary}
              </p>
            ) : null}
            <div className="mt-auto flex min-w-0 flex-col gap-1 pt-1">
              {price.kind !== "variable" ? (
                <div className="flex min-h-5 min-w-0 items-center">
                  <ProductPriceLabel
                    price={price}
                    lang={lang}
                    blocked={isBlocked}
                    compact={compactRail}
                  />
                </div>
              ) : null}
              {isBlocked || !addOnImage ? (
                <span className={isBlocked ? "w-full" : "self-end"}>
                  <ProductActionPill
                    actionState={actionState}
                    hasActualChoices={hasActualChoices}
                    label={actionLabel}
                    loading={loading}
                    subtle={!isBlocked}
                  />
                </span>
              ) : null}
            </div>
          </CardContent>
        </Button>
      </div>
    </Card>
  );
});

/** การ์ดชุด (SET) — โครงต่างจาก ProductCard ตั้งใจ: ไม่มีแถว choice meta,
 *  ไม่มีข้อความ "เลือกเพื่อดูราคา" (ชุดมีราคาคงที่เสมอ), เหลือปุ่มเดียวคือ "ดู"
 *  ที่เปิดโมดัลรายการที่รวมอยู่ในชุดเสมอ — เนื้อหาน้อยกว่าการ์ดสินค้าทั่วไป
 *  จึงไม่ reserve พื้นที่ (min-h/line-clamp-2) แบบเดียวกัน ไม่งั้นการ์ดจะสูงเกินจำเป็น */
export const SetProductCard = memo(function SetProductCard({
  product,
  cateUuid,
  lang,
  loading,
  onProductClick,
  imagePreload = false,
  variant = "rail",
}: {
  product: CateProductItem;
  cateUuid: string;
  lang: string;
  loading: boolean;
  onProductClick: (
    product: CateProductItem,
    cateUuid: string,
    statusKind: PublicMenuKind,
    sourceRect?: DOMRect | null
  ) => void;
  imagePreload?: boolean;
  variant?: "rail" | "railGrid";
}) {
  const { t } = useTranslation();
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const statusKind = PUBLIC_MENU_KIND.SET;
  const price = publicProductCardPrice(product, true);
  const priceValue = price.kind === "variable" ? null : price.value;
  const statusSortFk = publicMenuKindToStatusSortFk(statusKind);
  const blockedState = getProductBlockedState(product, statusSortFk);
  const blocked = Boolean(blockedState);
  const blockedLabel = productBlockedLabel(blockedState, product, t);
  const viewLabel = t("pos.viewDetails");
  const accessibleLabel = [
    product.prodName,
    blocked
      ? blockedLabel
      : priceValue !== null
      ? formatMoney(priceValue, lang)
      : "",
    blocked ? "" : viewLabel,
  ]
    .filter(Boolean)
    .join(", ");
  const handleClick = useCallback(() => {
    if (blocked || loading) return;
    onProductClick(
      product,
      cateUuid,
      statusKind,
      mediaRef.current?.getBoundingClientRect()
    );
  }, [blocked, cateUuid, loading, onProductClick, product, statusKind]);

  return (
    <Card
      className={cn(
        CARD_SURFACE_CLASS,
        CARD_TILE_CLASS,
        variant === "rail"
          ? "w-38 flex-none snap-start sm:w-42"
          : "w-38 flex-none snap-start sm:w-auto",
        blocked ? "" : CARD_INTERACTIVE_CLASS,
        "h-auto hover:translate-y-0",
      )}
    >
      {/* canLazyRenderCard(statusKind) เป็น false เสมอที่นี่ (statusKind ล็อกเป็น SET) —
          ดูเหตุผลที่ canLazyRenderCard ด้านบน */}
      <div
        className={cn(
          CARD_CLIP_CLASS,
          canLazyRenderCard(statusKind) ? CARD_LAZY_RENDER_CLASS : ""
        )}
      >
        <Button
          type="button"
          variant="ghost"
          className="flex h-full w-full flex-col items-stretch justify-start rounded-none p-0 text-left hover:bg-transparent focus-visible:ring-inset aria-disabled:cursor-not-allowed disabled:opacity-100"
          onClick={handleClick}
          disabled={loading}
          aria-busy={loading || undefined}
          aria-disabled={blocked || undefined}
          aria-label={accessibleLabel}
        >
          <div ref={mediaRef} className={MEDIA_FRAME_CLASS}>
            <ProductMedia
              product={product}
              blockedState={blockedState}
              blockedLabel={blockedLabel}
              preload={imagePreload}
            />
            {!blocked && (
              <span className="absolute right-2 bottom-2">
                <ProductActionPill
                  actionState="view"
                  hasActualChoices={false}
                  label={viewLabel}
                  loading={loading}
                  onImage
                  iconOnly
                />
              </span>
            )}
          </div>

          <CardContent className="flex flex-1 flex-col gap-1 px-1 pt-2 pb-1">
            <p className="lao-tone-text line-clamp-2 whitespace-normal font-yg-sans text-sm font-semibold leading-5 text-yg-ink">
              {product.prodName}
            </p>

            <p
              className={cn(
                "mt-auto min-h-6 max-w-full truncate font-yg-number text-base font-bold leading-6 tabular-nums",
                blocked ? "text-yg-muted" : "text-yg-accent-strong"
              )}
            >
              {priceValue !== null ? formatMoney(priceValue, lang) : ""}
            </p>
          </CardContent>
        </Button>
      </div>
    </Card>
  );
});

function ProductPriceLabel({
  price,
  lang,
  blocked,
  compact = false,
}: {
  price: ReturnType<typeof publicProductCardPrice>;
  lang: string;
  blocked: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();

  if (price.kind === "variable") return null;

  return (
    <p
      className={cn(
        // Stack the starting-price label so list rows retain room for a 44px action.
        "flex min-w-0 flex-col items-start gap-0.5",
        compact ? "min-h-6" : ""
      )}
    >
      {price.kind === "starting" ? (
        <span className="shrink-0 text-xs font-medium text-yg-faint">
          {t("pos.startingAt")}
        </span>
      ) : null}
      <span
        className={cn(
          "max-w-full font-yg-number font-bold leading-6 tabular-nums",
          compact ? "truncate text-base" : "whitespace-nowrap text-lg",
          blocked ? "text-yg-muted" : "text-yg-accent-strong"
        )}
      >
        {formatMoney(price.value, lang)}
      </span>
    </p>
  );
}

function ProductChoiceMeta({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1 text-xs font-medium leading-5 text-yg-muted",
        className
      )}
    >
      <SlidersHorizontal className="size-3 shrink-0" aria-hidden="true" />
      <span className="lao-tone-text truncate">{label}</span>
    </span>
  );
}

function ProductPromoBadge({
  label,
  overlay = false,
  compact = false,
}: {
  label: string;
  overlay?: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 border border-yg-accent-line bg-yg-accent-soft font-medium tracking-wide text-yg-accent-strong",
        overlay
          ? // บนรูปใช้พื้นทึบเหมือนปุ่มบนรูป — accent-soft โปร่ง 13% อ่านไม่ออกเมื่อทับรูปสีจัด
            "absolute left-2 top-2 h-6 max-w-[calc(100%-1rem)] rounded-full bg-yg-bg2 px-2 text-xs shadow-sm"
          : "min-h-6 rounded-full px-2 text-xs",
        compact ? "font-medium" : ""
      )}
    >
      <Sparkles className="size-3 shrink-0" aria-hidden="true" />
      <span className="lao-tone-text truncate">{label}</span>
    </span>
  );
}

function ProductActionPill({
  actionState,
  hasActualChoices,
  label,
  loading,
  compact = false,
  onImage = false,
  fullWidth = false,
  subtle = false,
  filled = false,
  iconOnly: forceIconOnly = false,
}: {
  actionState: ProductActionState;
  hasActualChoices: boolean;
  label: string;
  loading: boolean;
  compact?: boolean;
  /** On-photo actions retain the same 44px visual target as list actions. */
  onImage?: boolean;
  fullWidth?: boolean;
  subtle?: boolean;
  filled?: boolean;
  iconOnly?: boolean;
}) {
  const isAdd = actionState === "add";
  const isChoose = actionState === "choose" && hasActualChoices;
  const blocked = actionState === "blocked";
  const Icon = blocked
    ? AlertCircle
    : isAdd
    ? Plus
    : isChoose
    ? SlidersHorizontal
    : Eye;
  // Rail icons leave more of the photo visible; the enclosing card keeps the full action label.
  const iconOnly = forceIconOnly || (isAdd && !loading);

  // Sold out / unavailable is a state, not an action: plain muted text, so it never reads as a
  // button the customer should tap.
  if (blocked) {
    return (
      <span className="flex h-8 min-w-0 items-center gap-1.5 text-xs font-bold text-yg-muted">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="lao-tone-text truncate">{label}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex h-11 min-w-11 max-w-full shrink-0 items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold leading-none transition-[filter,transform] duration-150 ease-out motion-safe:group-active/button:scale-95 active:scale-90 active:duration-75 motion-reduce:transition-none motion-reduce:active:scale-100",
        iconOnly ? "size-11 px-0" : "px-3",
        onImage
          ? iconOnly
            ? "size-11 shadow-sm"
            : "shadow-sm"
          : "",
        compact
          ? iconOnly
            ? "size-11 px-0"
            : "max-w-32"
          : "",
        fullWidth ? "w-full px-3" : "",
        subtle
          ? "border-yg-accent-line shadow-none"
          : "",
        filled
          ? "border-yg-accent bg-yg-accent text-yg-on-accent"
          : "border-yg-accent-line bg-yg-panel text-yg-accent-strong",
        // บนรูปต้องพื้นทึบ — yg-panel ในโหมดมืดโปร่ง 4.5% ตัวอักษรเขียวอ่อนไปทับรูปตรง ๆ
        // อ่านไม่ออกบนรูปพื้นขาว/เขียว (เช่น เป๊ปซี่, ไฮเนเก้น)
        onImage && !filled ? "bg-yg-bg2" : ""
      )}
    >
      {loading ? (
        <Spinner />
      ) : (
        <Icon
          className={cn(
            "shrink-0",
            isAdd ? "size-5" : "size-4"
          )}
          aria-hidden="true"
        />
      )}
      {iconOnly ? null : (
        <span className="lao-tone-text truncate">{label}</span>
      )}
    </span>
  );
}

function getAccessiblePriceLabel(
  price: ReturnType<typeof publicProductCardPrice>,
  lang: string,
  blocked: boolean,
  t: ReturnType<typeof useTranslation>["t"]
) {
  if (price.kind === "variable") {
    return blocked ? "" : t("pos.chooseToSeePrice");
  }
  const amount = formatMoney(price.value, lang);
  return price.kind === "starting"
    ? `${t("pos.startingAt")} ${amount}`
    : amount;
}

function getActionLabel({
  actionState,
  blockedLabel,
  detailed,
  t,
}: {
  actionState: ProductActionState;
  blockedLabel: string;
  detailed: boolean;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  if (actionState === "blocked") return blockedLabel;
  if (actionState === "choose") {
    return t("pos.chooseOptionsAction");
  }
  if (actionState === "view") {
    return t(detailed ? "pos.viewDetailsAction" : "pos.viewDetails");
  }
  return t("pos.addItem");
}
