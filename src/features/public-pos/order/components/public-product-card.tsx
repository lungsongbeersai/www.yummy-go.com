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

// ตัด backdrop-blur-md ออก — การ์ดมีหลายสิบใบต่อหน้าจอ แต่ละใบเป็น backdrop-filter
// region ของตัวเอง เปลืองแรง GPU ตอนเลื่อนหน้ามาก แลกกับเอฟเฟกต์กระจกฝ้าโหมดมืด
// ที่บางลง (ยังมี border/shadow กำหนดขอบการ์ดชัดอยู่)
//
// alpha ต่ำกว่าเดิมมาก (0.45/0.8 -> 0.14/0.35) — การ์ดในกริดเมนูปกติเรียงชิดกันเป็นแถว
// เงาที่เลยขอบล่างการ์ดถูกการ์ดแถวถัดไปทับบังไว้จึงไม่เห็น แต่การ์ดโปรโมชั่น/ชุด
// เรียงแถวเดียวแนวนอน (StatusRailSection) ไม่มีอะไรมาบังเงาส่วนเกิน เงาเข้มเดิมเลย
// ลอยเป็นก้อนดำแปลกๆ ใต้การ์ดบนพื้นหลังโล่งๆ ของหน้า
// overflow-hidden ไม่อยู่ตรงนี้แล้วโดยตั้งใจ — ดูคอมเมนต์ที่ CARD_CLIP_CLASS ด้านล่าง
const CARD_SURFACE_CLASS =
  "h-full gap-0 rounded-[20px] border-yg-line bg-yg-panel py-0 shadow-[0_18px_40px_-26px_rgb(0_0_0/0.14)] transition-[border-color,box-shadow,transform] duration-150 ease-out dark:shadow-[0_18px_40px_-26px_rgb(0_0_0/0.35)] motion-reduce:transition-none";

// Chrome มีบั๊กที่รู้จักกันดี: element ที่มีทั้ง overflow:hidden + border-radius + transition/transform
// (เช่น hover:-translate-y-1 ของ CARD_INTERACTIVE_CLASS) อยู่บนตัวเดียวกัน บางครั้งไม่ clip ลูกที่เป็น
// สี่เหลี่ยมมุมฉาก (รูปสินค้า/พื้นสี) ให้สนิทกับมุมโค้ง โผล่เป็นมุมเหลี่ยมแทรกออกมานอกเส้นขอบโค้ง —
// แยก overflow-hidden มาไว้ที่ wrapper ชั้นในที่ไม่มี transform ของตัวเอง ส่วน transform ยกการ์ดตอน
// hover ยังอยู่ที่ Card ชั้นนอกเหมือนเดิม (transform ของ ancestor ไม่ทำให้ลูกที่ถูก clip ไปแล้วหลุดออกมา)
const CARD_CLIP_CLASS = "h-full overflow-hidden rounded-[20px]";

// hover:-translate-y-1 ใช้ไม่ได้บนมือถือ (แตะไม่มี :hover) — active:scale ทำงาน
// ทันทีที่นิ้วแตะจอไม่ว่าจะ hover มาก่อนหรือไม่ ให้ความรู้สึกกดแล้ว "ตอบสนองทันที"
// active:duration-75 ให้กดยุบเร็วกว่าคืนตัว (ปล่อยกลับใช้ duration ปกติจาก CARD_SURFACE_CLASS)
// เลียนแบบ tap feedback ของแอปมือถือทั่วไป
const CARD_INTERACTIVE_CLASS =
  "hover:-translate-y-1 hover:border-yg-accent-line hover:shadow-[0_26px_54px_-26px_rgb(0_0_0/0.22)] active:translate-y-0 active:scale-[0.97] active:duration-75 dark:hover:shadow-[0_26px_54px_-26px_rgb(0_0_0/0.45)] motion-reduce:transform-none";

// เมนูร้านที่มีสินค้าเยอะ การ์ดนอกจอต้อง skip layout/paint ไปเลยไม่งั้นเลื่อน/แตะช้าลง
// เรื่อยๆ ตามจำนวนสินค้า — "auto 360px" ให้เบราว์เซอร์จำขนาดจริงหลัง render ครั้งแรก
// ใช้แค่กับการ์ดกริด/rail (สูงใกล้เคียงกัน) ไม่ใช้กับ variant list ที่เตี้ยกว่ามาก
// (เทียบ order-customer-product-card.tsx ฝั่งแคชเชียร์ที่มี optimization นี้อยู่แล้ว)
const CARD_LAZY_RENDER_CLASS =
  "[content-visibility:auto] [contain-intrinsic-size:auto_360px]";

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
      <Card
        className={cn(
          CARD_SURFACE_CLASS,
          isBlocked ? "" : CARD_INTERACTIVE_CLASS,
        )}
      >
        <div className={CARD_CLIP_CLASS}>
          <Button
            type="button"
            variant="ghost"
            className="flex min-h-28 w-full items-stretch gap-3 rounded-none p-2.5 text-left hover:bg-yg-panel-hover focus-visible:ring-inset aria-disabled:cursor-not-allowed aria-disabled:hover:bg-transparent disabled:opacity-100"
            onClick={handleClick}
            disabled={loading}
            aria-busy={loading || undefined}
            aria-disabled={isBlocked || undefined}
            aria-label={accessibleLabel}
          >
            <div
              ref={mediaRef}
              className="relative size-24 shrink-0 overflow-hidden rounded-2xl border border-yg-line"
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
                <p className="lao-tone-text line-clamp-2 font-yg-serif text-base font-semibold leading-snug text-yg-ink">
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
                  {choiceMeta ? <ProductChoiceMeta label={choiceMeta} /> : null}
                </div>
              </div>

              {isBlocked ? null : (
                <div className="flex shrink-0 items-end justify-end">
                  <ProductActionPill
                    actionState={actionState}
                    hasActualChoices={hasActualChoices}
                    label={actionLabel}
                    loading={loading}
                    compact
                  />
                </div>
              )}
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
          บั๊ก clip มุมโค้งแบบเดียวกันได้อีก แม้จะย้าย overflow-hidden ออกไปแล้วก็ตาม */}
      <div className={cn(CARD_CLIP_CLASS, CARD_LAZY_RENDER_CLASS)}>
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
          <div ref={mediaRef} className="relative w-full">
            <ProductMedia
              product={product}
              blockedState={blockedState}
              blockedLabel={blockedLabel}
              preload={imagePreload}
            />
            {!isBlocked && promoLabel ? (
              <ProductPromoBadge label={promoLabel} overlay />
            ) : null}
          </div>

          <CardContent className="flex min-h-36 flex-1 flex-col gap-2 p-3.5 max-[419px]:gap-1 max-[419px]:py-3">
            <p className="lao-tone-text line-clamp-2 min-h-10 font-yg-serif text-base font-semibold leading-snug text-yg-ink">
              {product.prodName}
            </p>

            {/* การ์ดสองคอลัมน์บนมือถือเหลือพื้นที่ราคาไม่พอเมื่อปุ่ม 44px อยู่แถวเดียวกัน
                ให้ราคาเต็มแถว แล้วใช้ metadata กับปุ่มร่วมแถวล่างเพื่อคงความสูงเดิม */}
            <div className="mt-auto flex items-end justify-between gap-2 max-[419px]:grid max-[419px]:grid-cols-[minmax(0,1fr)_auto] max-[419px]:gap-x-2 max-[419px]:gap-y-1">
              <div className="min-w-0 flex-1 max-[419px]:contents">
                <ProductPriceLabel
                  price={price}
                  lang={lang}
                  blocked={isBlocked}
                />
                {choiceMeta ? <ProductChoiceMeta label={choiceMeta} /> : null}
              </div>

              {isBlocked ? null : (
                <div className="shrink-0 max-[419px]:col-start-2 max-[419px]:row-start-2">
                  <ProductActionPill
                    actionState={actionState}
                    hasActualChoices={hasActualChoices}
                    label={actionLabel}
                    loading={loading}
                  />
                </div>
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
        variant === "rail" ? "w-44 flex-none snap-start" : "w-44 flex-none snap-start sm:w-auto",
        blocked ? "" : CARD_INTERACTIVE_CLASS,
      )}
    >
      <div className={cn(CARD_CLIP_CLASS, CARD_LAZY_RENDER_CLASS)}>
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
          <div ref={mediaRef} className="relative w-full">
            <ProductMedia
              product={product}
              blockedState={blockedState}
              blockedLabel={blockedLabel}
              preload={imagePreload}
            />
          </div>

          <CardContent className="flex flex-col gap-1.5 p-3">
            <p className="lao-tone-text truncate font-yg-serif text-sm font-semibold leading-snug text-yg-ink">
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
              <span className="flex h-8 items-center justify-center gap-1 rounded-xl border border-yg-accent-line bg-yg-accent-soft text-2xs font-extrabold text-yg-accent-strong">
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
    if (blocked) {
      return (
        <span
          className={cn(
            "block min-h-7",
            compact ? "min-h-5" : "max-[419px]:col-span-2",
          )}
          aria-hidden="true"
        />
      );
    }

    return (
      <p
        className={cn(
          "min-h-7 text-xs font-semibold leading-4 text-yg-muted",
          compact ? "min-h-5" : "max-[419px]:col-span-2",
        )}
      >
        {t("pos.chooseToSeePrice")}
      </p>
    );
  }

  return (
    <p
      className={cn(
        "flex min-h-7 min-w-0 items-baseline gap-1",
        compact
          ? "min-h-5"
          : "max-[419px]:col-span-2 max-[419px]:flex-col max-[419px]:items-start max-[419px]:gap-0.5",
      )}
    >
      {price.kind === "starting" ? (
        <span className="shrink-0 text-2xs font-bold text-yg-faint">
          {t("pos.startingAt")}
        </span>
      ) : null}
      <span
        className={cn(
          "max-w-full font-yg-number text-2xl font-semibold leading-none tabular-nums",
          compact
            ? "truncate"
            : "whitespace-nowrap max-[419px]:text-[clamp(18px,5.2vw,22px)]",
          blocked ? "text-yg-muted" : "text-yg-accent-strong",
        )}
      >
        {formatMoney(price.value, lang)}
      </span>
    </p>
  );
}

function ProductChoiceMeta({ label }: { label: string }) {
  return (
    <span className="mt-0.5 flex min-w-0 items-center gap-1 text-2xs font-semibold text-yg-faint">
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
        "inline-flex max-w-full items-center gap-1 border border-yg-accent-line bg-yg-accent-soft font-extrabold tracking-wide text-yg-accent-strong",
        overlay
          ? "absolute left-2.5 top-2.5 h-6 max-w-[calc(100%-1.25rem)] rounded-lg px-2 text-2xs backdrop-blur-md"
          : "h-5 rounded-md px-1.5 text-2xs",
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
}: {
  actionState: ProductActionState;
  hasActualChoices: boolean;
  label: string;
  loading: boolean;
  compact?: boolean;
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

  return (
    <span
      className={cn(
        "flex h-11 min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-2xl border text-xs font-extrabold leading-none transition-[filter,transform] duration-150 ease-out active:scale-90 active:duration-75 motion-reduce:transition-none motion-reduce:active:scale-100",
        iconOnly ? "w-11 px-0" : "px-3.5",
        compact ? "max-w-32" : "",
        blocked
          ? "border-yg-line bg-yg-panel2 text-yg-muted"
          : isChoose
            ? "border-yg-accent-line bg-yg-accent-soft text-yg-accent-strong"
            : "border-yg-accent bg-yg-accent text-yg-on-accent shadow-[0_8px_20px_-10px_var(--yg-accent)]",
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
