"use client";

import { memo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ChevronRight,
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

// White tiles have a visible outline; list rows retain their section dividers.
const CARD_SURFACE_CLASS =
  "h-full gap-0 py-0 shadow-none ring-0 transition-[transform,border-color] duration-150 ease-out motion-reduce:transition-none";
const CARD_TILE_CLASS = "rounded-2xl border border-yg-divider bg-yg-card p-2";
const CARD_ROW_CLASS = "rounded-none bg-transparent";

// Chrome มีบั๊กที่รู้จักกันดี: element ที่มีทั้ง overflow:hidden + border-radius + transition/transform
// (เช่น hover:-translate-y-1 ของ CARD_INTERACTIVE_CLASS) อยู่บนตัวเดียวกัน บางครั้งไม่ clip ลูกที่เป็น
// สี่เหลี่ยมมุมฉาก (รูปสินค้า/พื้นสี) ให้สนิทกับมุมโค้ง โผล่เป็นมุมเหลี่ยมแทรกออกมานอกเส้นขอบโค้ง —
// แยก overflow-hidden มาไว้ที่ wrapper ชั้นในที่ไม่มี transform ของตัวเอง ส่วน transform ยกการ์ดตอน
// hover ยังอยู่ที่ Card ชั้นนอกเหมือนเดิม (transform ของ ancestor ไม่ทำให้ลูกที่ถูก clip ไปแล้วหลุดออกมา)
const CARD_CLIP_CLASS = "h-full";

// The image carries the rounded corners now that there is no card around it.
const MEDIA_FRAME_CLASS = "relative w-full overflow-hidden rounded-lg";

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
    sourceRect?: DOMRect | null,
  ) => void;
  imagePreload?: boolean;
  variant?: "grid" | "rail" | "railGrid" | "list";
}) {
  const { t } = useTranslation();
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const price = publicProductCardPrice(product);
  const statusSortFk = publicMenuKindToStatusSortFk(statusKind);
  const blockedState = getProductBlockedState(product, statusSortFk);
  const actionState = getProductActionState(product, statusSortFk);
  const isBlocked = actionState === "blocked";
  const blockedLabel = productBlockedLabel(blockedState, product, t);
  const optionCount = Math.max(
    0,
    Number(product.countOptionEnabled ?? 0) || 0,
  );
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
  const actionLabel = getActionLabel({
    actionState,
    blockedLabel,
    detailed: false,
    t,
  });
  const detailedActionLabel = getActionLabel({
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
  // One-tap items (no options to pick) carry their "+" on the image, bottom-right, so the add
  // action sits on the product itself. Items that open the sheet keep their pill in the body.
  const addOnImage = actionState === "add";
  const handleClick = useCallback(() => {
    if (isBlocked || loading) return;
    onProductClick(
      product,
      cateUuid,
      statusKind,
      mediaRef.current?.getBoundingClientRect(),
    );
  }, [cateUuid, isBlocked, loading, onProductClick, product, statusKind]);

  if (variant === "list") {
    return (
      <Card className={cn(CARD_SURFACE_CLASS, CARD_ROW_CLASS)}>
        <div className={CARD_CLIP_CLASS}>
          <Button
            type="button"
            variant="ghost"
            className="flex min-h-28 w-full items-stretch gap-3 rounded-xl px-1.5 py-3 text-left hover:bg-yg-panel-hover active:scale-[0.99] active:duration-75 focus-visible:ring-inset aria-disabled:cursor-not-allowed aria-disabled:hover:bg-transparent disabled:opacity-100 motion-reduce:transform-none"
            onClick={handleClick}
            disabled={loading}
            aria-busy={loading || undefined}
            aria-disabled={isBlocked || undefined}
            aria-label={accessibleLabel}
          >
            <div
              ref={mediaRef}
              className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-yg-card"
            >
              <ProductMedia
                product={product}
                variant="listThumb"
                blockedState={blockedState}
                blockedLabel={blockedLabel}
                preload={imagePreload}
              />
            </div>

            <CardContent className="flex min-w-0 flex-1 gap-3 p-0">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="lao-tone-text line-clamp-2 font-yg-sans text-base font-semibold leading-snug text-yg-ink">
                  {product.prodName}
                </p>

                <ProductPriceLabel
                  price={price}
                  lang={lang}
                  blocked={isBlocked}
                  compact
                />

                <div className="flex min-h-5 min-w-0 flex-wrap items-center gap-1.5">
                  {!isBlocked && promoLabel ? (
                    <ProductPromoBadge label={promoLabel} compact />
                  ) : null}
                  {choiceMeta && !isBlocked ? <ProductChoiceMeta label={choiceMeta} /> : null}
                </div>
              </div>

              {/* Sold out shows its state here too, as muted text (see ProductActionPill). */}
              <div className="flex shrink-0 items-end justify-end">
                <ProductActionPill
                  actionState={actionState}
                  hasActualChoices={hasActualChoices}
                  label={actionLabel}
                  loading={loading}
                  compact
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
          ? "w-44 flex-none snap-start"
          : variant === "railGrid"
            ? "w-44 flex-none snap-start sm:w-auto"
            : "min-w-0",
        isBlocked ? "" : CARD_INTERACTIVE_CLASS,
      )}
    >
      {/* content-visibility:auto ก็ทำตัวเหมือน overflow:hidden ทางการ paint (contain: paint โดยนัย)
          จึงต้องอยู่ในชั้นเดียวกับ CARD_CLIP_CLASS ที่ไม่มี transform เหตุผลเดียวกับด้านบน ไม่งั้นก็เจอ
          บั๊ก clip มุมโค้งแบบเดียวกันได้อีก แม้จะย้าย overflow-hidden ออกไปแล้วก็ตาม — ดู
          canLazyRenderCard ด้านบนสำหรับเหตุผลที่ตัดออกสำหรับโปรโมชั่น/เซ็ต */}
      <div
        className={cn(
          CARD_CLIP_CLASS,
          canLazyRenderCard(statusKind) ? CARD_LAZY_RENDER_CLASS : "",
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
                  // Pinned to the picture's own bottom-right corner (not the frame's), so a
                  // tall bottle photo still has the button on it. The whole card is the button:
                  // this is a visual cue, not a nested button. The card-coloured ring keeps the
                  // green square apart from whatever photo is behind it.
                  <span className="absolute right-1.5 bottom-1.5 rounded-lg ring-2 ring-yg-card">
                    <ProductActionPill
                      actionState={actionState}
                      hasActualChoices={hasActualChoices}
                      label={actionLabel}
                      loading={loading}
                      onImage
                    />
                  </span>
                ) : null
              }
            />
            {!isBlocked && promoLabel ? (
              <ProductPromoBadge label={promoLabel} overlay />
            ) : null}
          </div>

          <CardContent className="@container flex flex-1 flex-col gap-1.5 px-1.5 pt-2.5 pb-2">
            <p className="lao-tone-text line-clamp-2 min-h-10 font-yg-sans text-base font-semibold leading-snug text-yg-ink">
              {product.prodName}
            </p>

            {/* One fixed 44px row for every card type: price (or "choose to see price") on the
                left, the pill on the right. Card types used to differ (price row, then a note +
                pill row), and the grid stretches a row to its tallest card, so the one-row cards
                stood half empty. Sold out: the state alone, the image already dims. */}
            <div className="mt-auto flex h-11 min-w-0 items-center justify-between gap-2">
              {isBlocked ? (
                <ProductActionPill
                  actionState={actionState}
                  hasActualChoices={hasActualChoices}
                  label={actionLabel}
                  loading={loading}
                />
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <ProductPriceLabel price={price} lang={lang} blocked={false} />
                  </div>
                  {/* One-tap items have their "+" on the image instead. */}
                  {addOnImage ? null : (
                    <ProductActionPill
                      actionState={actionState}
                      hasActualChoices={hasActualChoices}
                      label={actionLabel}
                      loading={loading}
                    />
                  )}
                </>
              )}
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
    sourceRect?: DOMRect | null,
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
    blocked ? blockedLabel : priceValue !== null ? formatMoney(priceValue, lang) : "",
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
      mediaRef.current?.getBoundingClientRect(),
    );
  }, [blocked, cateUuid, loading, onProductClick, product, statusKind]);

  return (
    <Card
      className={cn(
        CARD_SURFACE_CLASS,
        CARD_TILE_CLASS,
        variant === "rail" ? "w-44 flex-none snap-start" : "w-44 flex-none snap-start sm:w-auto",
        blocked ? "" : CARD_INTERACTIVE_CLASS,
      )}
    >
      {/* canLazyRenderCard(statusKind) เป็น false เสมอที่นี่ (statusKind ล็อกเป็น SET) —
          ดูเหตุผลที่ canLazyRenderCard ด้านบน */}
      <div className={cn(CARD_CLIP_CLASS, canLazyRenderCard(statusKind) ? CARD_LAZY_RENDER_CLASS : "")}>
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
          </div>

          <CardContent className="flex flex-col gap-1.5 px-1.5 pt-2.5 pb-2">
            <p className="lao-tone-text truncate font-yg-sans text-sm font-semibold leading-snug text-yg-ink">
              {product.prodName}
            </p>

            {/* จองพื้นที่ราคา/ปุ่มไว้เสมอ (ว่างเปล่าเมื่อไม่มีข้อมูล) ไม่งั้นการ์ดที่หมด
                (ไม่มีราคา/ไม่มีปุ่ม) จะเตี้ยกว่าใบข้างๆ ในแถวเดียวกัน */}
            <p
              className={cn(
                "min-h-5 font-yg-number text-sm font-semibold tabular-nums",
                blocked ? "text-yg-muted" : "text-yg-accent-strong",
              )}
            >
              {priceValue !== null ? formatMoney(priceValue, lang) : ""}
            </p>

            {blocked ? (
              <span className="h-8" aria-hidden="true" />
            ) : (
              <span className="flex h-8 items-center justify-center gap-1 rounded-lg border border-yg-accent-line bg-yg-accent-soft text-2xs font-medium text-yg-accent-strong">
                {loading ? (
                  <Spinner />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="lao-tone-text truncate">{viewLabel}</span>
              </span>
            )}
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

  if (price.kind === "variable") {
    // Nothing to show for a sold-out item without a fixed price. No placeholder either: with no
    // card frame there is no row height to keep, only a gap under the name.
    if (blocked) return null;

    return (
      <p
        className={cn(
          "text-xs font-semibold leading-4 text-yg-muted",
          // In the card's 44px row: two lines at most, and none on a card too narrow to hold
          // it beside the "choose" pill (which says the same).
          compact ? "min-h-5" : "line-clamp-2 text-2xs @max-[10rem]:hidden",
        )}
      >
        {t("pos.chooseToSeePrice")}
      </p>
    );
  }

  return (
    <p
      className={cn(
        "flex min-w-0 gap-1",
        // Card: "from" stacked above the amount, so both fit the 44px row beside a pill.
        compact ? "min-h-5 items-baseline" : "flex-col items-start gap-0.5",
      )}
    >
      {price.kind === "starting" ? (
        <span className="shrink-0 text-2xs font-bold text-yg-faint">
          {t("pos.startingAt")}
        </span>
      ) : null}
      <span
        className={cn(
          // Body size (16px, 14px on narrow phones): the price reads, but the product name stays
          // the first thing the eye lands on.
          "max-w-full font-yg-number text-base font-semibold leading-none tabular-nums",
          compact
            ? "truncate text-sm"
            : "whitespace-nowrap max-[419px]:text-sm",
          blocked ? "text-yg-muted" : "text-yg-accent-strong",
        )}
      >
        {formatMoney(price.value, lang)}
      </span>
    </p>
  );
}

function ProductChoiceMeta({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("mt-0.5 flex min-w-0 items-center gap-1 text-2xs font-semibold text-yg-faint", className)}>
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
          ? "absolute left-2.5 top-2.5 h-6 max-w-[calc(100%-1.25rem)] rounded-md px-2 text-2xs backdrop-blur-md"
          : "h-5 rounded-sm px-1.5 text-2xs",
        compact ? "text-2xs" : "",
      )}
    >
      <Sparkles className="size-2.5 shrink-0" aria-hidden="true" />
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
}: {
  actionState: ProductActionState;
  hasActualChoices: boolean;
  label: string;
  loading: boolean;
  compact?: boolean;
  /** 36px on the product photo: the whole card is the tap target, so it needn't be 44px. */
  onImage?: boolean;
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
        : ChevronRight;
  // ปุ่ม "เพิ่ม" เป็นไอคอนล้วนทรงจัตุรัสตามดีไซน์ ที่เหลือมีข้อความกำกับ
  const iconOnly = isAdd && !loading;

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
        "flex h-11 min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium leading-none transition-[filter,transform] duration-150 ease-out active:scale-90 active:duration-75 motion-reduce:transition-none motion-reduce:active:scale-100",
        iconOnly || onImage ? "w-11 px-0" : "px-3.5",
        onImage ? "size-9" : "",
        compact ? "max-w-32" : "",
        isChoose
          ? "border-yg-accent-line bg-yg-panel text-yg-accent-strong"
          : "border-yg-accent bg-yg-accent text-yg-on-accent",
      )}
    >
      {loading ? (
        <Spinner />
      ) : (
        <Icon className="size-4 shrink-0" aria-hidden="true" />
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
  t: ReturnType<typeof useTranslation>["t"],
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
    return t(detailed ? "pos.chooseOptionsAction" : "pos.chooseOptions");
  }
  if (actionState === "view") {
    return t(detailed ? "pos.viewDetailsAction" : "pos.viewDetails");
  }
  return t("pos.addItem");
}
