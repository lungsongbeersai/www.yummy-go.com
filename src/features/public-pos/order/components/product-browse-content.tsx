"use client";

import { useRef, useSyncExternalStore, type ReactNode } from "react";
import { Grid2X2, List, Loader2, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PUBLIC_MENU_KIND } from "@/stores/public-pos-store";
import {
  CATEGORY_TAIL_SPACER_HEIGHT,
  DEFAULT_PUBLIC_POS_HERO_VISIBLE,
  RAIL_RENDER_CHUNK,
} from "../constants";
import type { PublicBrowseWorkflow } from "../hooks/use-public-browse-workflow";
import {
  readPublicPosHeroVisible,
  subscribePublicPosHeroVisible,
} from "../public-pos-hero-visibility";
import type { PublicProductLayoutMode } from "../types";
import {
  readPublicProductLayoutMode,
  statusSectionLabel,
  subscribePublicProductLayoutMode,
  writePublicProductLayoutMode,
} from "../utils";
import { BottomNav } from "./public-bottom-nav";
import { CartFlyAnimationLayer } from "./cart-fly-animation-layer";
import { CartSheet } from "./cart-sheet";
import { PublicCategoryMenu } from "./public-category-menu";
import { PublicMenuHero } from "./public-menu-hero";
import { PublicQrDialog } from "./public-qr-dialog";
import {
  MenuEmptyState,
  ProductsSkeleton,
} from "./public-pos-skeletons";
import { PublicSearchSheet } from "./public-search-sheet";
import {
  ProductCategorySection,
  StatusRailSection,
} from "./public-menu-sections";
import { ProductOrderSheet } from "./product-order-sheet";
import { ScrollJumpControls } from "./scroll-jump-controls";
import { HorizontalScrollArrows } from "./horizontal-scroll-arrows";

export function ProductBrowseContent({
  workflow,
}: {
  workflow: PublicBrowseWorkflow;
}) {
  const { t } = useTranslation();
  // server render ใช้ grid เสมอ ฝั่ง client sync จาก localStorage โดยไม่มี effect
  const productLayoutMode = useSyncExternalStore(
    subscribePublicProductLayoutMode,
    readPublicProductLayoutMode,
    (): PublicProductLayoutMode => "grid",
  );
  // ปิดเป็นค่าเริ่มต้น สลับได้จาก Tweaks — แพตเทิร์นเดียวกับ productLayoutMode
  const heroVisible = useSyncExternalStore(
    subscribePublicPosHeroVisible,
    readPublicPosHeroVisible,
    (): boolean => DEFAULT_PUBLIC_POS_HERO_VISIBLE,
  );
  const categoryRailRef = useRef<HTMLDivElement | null>(null);
  const {
    cart,
    cartActions,
    cartFlyAnimations,
    cartOpen,
    cartQty,
    cartStatusRule,
    cartTargetRef,
    confirming,
    browse,
    handleCartFlyDone,
    lang,
    loadingCart,
    loadingItem,
    loadingMenu,
    onCartOpenChange,
    qr,
    saving,
    search,
    selectedProduct,
    table,
  } = workflow;
  const {
    activeValue,
    categoryBarRef,
    categoryRefs,
    categoryTabRefs,
    collapsedCateUuids,
    ensureNormalCategoryProducts,
    handleScrollJump,
    handleScrollToTop,
    handleTabChange,
    hasAnyProducts,
    hasMoreRenderedMenu,
    hasPromotionImage,
    hasSetImage,
    jumpingCateUuid,
    menuCategories,
    normalMenu,
    promotionMenu,
    promotionProducts,
    railVisibleCounts,
    renderSentinelRef,
    renderedMenuSections,
    revealMoreProductsForCategory,
    revealMoreRailProducts,
    scrollJumpEdge,
    setMenu,
    setProducts,
    toggleCategoryCollapsed,
    visibleCategoryTabs,
  } = browse;
  const gridLayoutLabel = t("settings.icons.grid");
  const listLayoutLabel = t("settings.icons.list");

  function handleProductLayoutModeChange(mode: PublicProductLayoutMode) {
    writePublicProductLayoutMode(mode);
  }

  return (
    <div className="flex flex-col gap-3">
      {heroVisible ? (
        <PublicMenuHero onSearch={search.openSearchSheet} />
      ) : null}

      <div
        ref={categoryBarRef}
        className="yg-rise yg-rise-1 sticky top-0 z-20 -mx-(--yg-gutter) bg-yg-bg/85 px-(--yg-gutter) py-2 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-280 flex-col gap-2">
          <form className="flex gap-2" onSubmit={search.handleSearchSubmit}>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-yg-faint" />

              <Input
                className="h-11 cursor-pointer rounded-2xl border-yg-line bg-yg-panel pl-10 text-sm font-medium text-yg-ink shadow-none backdrop-blur-md placeholder:text-yg-faint focus-visible:border-yg-accent-line focus-visible:ring-yg-accent/40"
                value={search.searchText}
                readOnly
                aria-expanded={search.searchOpen}
                aria-haspopup="dialog"
                onClick={search.openSearchSheet}
                onFocus={search.openSearchSheet}
                placeholder={t("pos.searchMenu")}
              />
            </div>

            <Button
              type="submit"
              size="icon"
              className="size-11 rounded-2xl bg-yg-accent text-yg-on-accent shadow-[0_8px_20px_-10px_var(--yg-accent)] hover:bg-yg-accent hover:brightness-105"
              aria-label={t("pos.searchMenu")}
              disabled={loadingMenu}
            >
              {loadingMenu ? <Loader2 className="animate-spin" /> : <Search />}
            </Button>

            <div
              className="flex shrink-0 gap-0.5 rounded-2xl border border-yg-line bg-yg-panel p-1 backdrop-blur-md"
              role="group"
              aria-label={`${gridLayoutLabel} / ${listLayoutLabel}`}
            >
              <LayoutModeButton
                active={productLayoutMode === "grid"}
                label={gridLayoutLabel}
                icon={<Grid2X2 />}
                onClick={() => handleProductLayoutModeChange("grid")}
              />
              <LayoutModeButton
                active={productLayoutMode === "list"}
                label={listLayoutLabel}
                icon={<List />}
                onClick={() => handleProductLayoutModeChange("list")}
              />
            </div>
          </form>

          {visibleCategoryTabs.length ? (
            <Tabs
              value={activeValue}
              onValueChange={handleTabChange}
              className="gap-0"
            >
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <div ref={categoryRailRef} className="yg-rail overflow-x-auto">
                    <TabsList className="h-11 w-max justify-start gap-2 bg-transparent p-0">
                      {visibleCategoryTabs.map((category) => (
                        <TabsTrigger
                          key={category.cateUuid}
                          value={category.cateUuid}
                          ref={(element) => {
                            categoryTabRefs.current[category.cateUuid] = element;
                          }}
                          className="h-11 flex-none gap-2 rounded-full border border-yg-line bg-yg-panel px-4 text-[13px] font-bold text-yg-muted shadow-none backdrop-blur-md data-[state=active]:border-yg-accent data-[state=active]:bg-yg-accent data-[state=active]:text-yg-on-accent data-[state=active]:shadow-[0_8px_20px_-8px_var(--yg-accent)]"
                        >
                          {jumpingCateUuid === category.cateUuid ? (
                            <Loader2 className="size-4 shrink-0 animate-spin" />
                          ) : null}

                          <span className="lao-tone-text min-w-0 max-w-30 truncate sm:max-w-40">
                            {category.cateName}
                          </span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                  {/* <HorizontalScrollArrows scrollRef={categoryRailRef} /> */}
                </div>

                {/* อยู่นอกแถบเลื่อน — กดถึงได้เสมอไม่ต้องเลื่อนหา ใช้ตอนหมวดเยอะจนแถบ pill ไม่พอ */}
                <PublicCategoryMenu
                  categories={visibleCategoryTabs}
                  activeCateUuid={activeValue}
                  jumpingCateUuid={jumpingCateUuid}
                  onSelect={handleTabChange}
                />
              </div>
            </Tabs>
          ) : null}
        </div>
      </div>

      <PublicSearchSheet
        history={search.searchHistory}
        loading={loadingMenu}
        open={search.searchOpen}
        value={search.searchDraft}
        onClearHistory={search.clearSearchHistory}
        onHistorySelect={search.handleSearchHistorySelect}
        onOpenChange={search.handleSearchOpenChange}
        onSubmit={search.handleSearchSheetSubmit}
        onValueChange={search.handleSearchDraftChange}
      />

      {normalMenu.loading && !hasAnyProducts ? <ProductsSkeleton /> : null}

      <StatusRailSection
        title={statusSectionLabel(PUBLIC_MENU_KIND.PROMOTION, lang)}
        products={promotionProducts}
        visibleCount={
          railVisibleCounts[PUBLIC_MENU_KIND.PROMOTION] ?? RAIL_RENDER_CHUNK
        }
        loading={promotionMenu.loading}
        priorityFirstImage={hasPromotionImage}
        lang={lang}
        loadingProductUuid={cartActions.loadingProductUuid}
        onProductClick={cartActions.handleProductClick}
        onRevealMore={revealMoreRailProducts}
      />

      <StatusRailSection
        title={statusSectionLabel(PUBLIC_MENU_KIND.SET, lang)}
        products={setProducts}
        visibleCount={
          railVisibleCounts[PUBLIC_MENU_KIND.SET] ?? RAIL_RENDER_CHUNK
        }
        loading={setMenu.loading}
        priorityFirstImage={hasSetImage}
        lang={lang}
        loadingProductUuid={cartActions.loadingProductUuid}
        onProductClick={cartActions.handleProductClick}
        onRevealMore={revealMoreRailProducts}
      />

      {renderedMenuSections.length ? (
        <div className="flex flex-col">
          {renderedMenuSections.map(
            ({ category, products, loaded, loading }, index) => (
              <ProductCategorySection
                key={category.cateUuid}
                category={category}
                products={products}
                totalProducts={category.products?.length ?? 0}
                loaded={loaded}
                loading={loading}
                jumping={jumpingCateUuid === category.cateUuid}
                collapsed={collapsedCateUuids.includes(category.cateUuid)}
                lang={lang}
                statusKind={PUBLIC_MENU_KIND.NORMAL}
                layoutMode={productLayoutMode}
                priorityFirstImage={index === 0}
                loadingProductUuid={cartActions.loadingProductUuid}
                onEnsureLoad={ensureNormalCategoryProducts}
                onProductClick={cartActions.handleProductClick}
                onRevealMore={revealMoreProductsForCategory}
                onToggleCollapse={toggleCategoryCollapsed}
                refCallback={(element) => {
                  categoryRefs.current[category.cateUuid] = element;
                }}
              />
            ),
          )}

          {hasMoreRenderedMenu ? (
            <div ref={renderSentinelRef} className="h-12" aria-hidden="true" />
          ) : null}

          <div
            className="shrink-0"
            style={{ height: CATEGORY_TAIL_SPACER_HEIGHT }}
            aria-hidden="true"
          />
        </div>
      ) : null}

      {!loadingMenu && !hasAnyProducts && !menuCategories.length ? (
        <MenuEmptyState />
      ) : null}

      <ScrollJumpControls edge={scrollJumpEdge} onScroll={handleScrollJump} />

      <BottomNav
        cartQty={cartQty}
        cartTargetRef={cartTargetRef}
        onMenu={handleScrollToTop}
        onCart={() => onCartOpenChange(true)}
        onShare={qr.handleOpenQrDialog}
      />

      <CartFlyAnimationLayer
        animations={cartFlyAnimations}
        onDone={handleCartFlyDone}
      />

      <PublicQrDialog
        dataUrl={qr.qrDataUrl}
        open={qr.qrDialogOpen}
        tableName={table?.table_name}
        targetUrl={qr.qrTargetUrl}
        onDownload={qr.handleDownloadQr}
        onOpenChange={qr.setQrDialogOpen}
        onShare={qr.handleShareQr}
      />

      <ProductOrderSheet
        open={cartActions.productSheetOpen}
        onOpenChange={cartActions.setProductSheetOpen}
        product={selectedProduct}
        statusKind={cartActions.selectedProductStatusKind}
        cart={cart}
        lang={lang}
        loading={loadingItem}
        saving={saving}
        onAdd={(payload, sourceRect) => {
          if (selectedProduct)
            void cartActions.handleAddToCart(
              selectedProduct,
              payload,
              sourceRect,
            );
        }}
      />

      <CartSheet
        open={cartOpen}
        onOpenChange={onCartOpenChange}
        cart={cart}
        statusRule={cartStatusRule}
        lang={lang}
        loading={loadingCart}
        saving={saving}
        confirming={confirming}
        onUpdateQty={cartActions.handleUpdateItemQty}
        onDeleteItem={cartActions.handleDeleteItem}
        onNoteChange={cartActions.setNoteDraft}
        onNoteOpen={cartActions.handleOpenNoteDialog}
        onNoteOpenChange={cartActions.handleNoteDialogOpenChange}
        onUpdateNote={cartActions.handleUpdateItemNote}
        onConfirmKitchen={cartActions.handleConfirmKitchen}
        noteDraft={cartActions.noteDraft}
        noteTarget={cartActions.noteTarget}
      />
    </div>
  );
}

function LayoutModeButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="iconSm"
      variant="ghost"
      className={cn(
        "size-9 rounded-xl",
        active
          ? "bg-yg-accent-soft text-yg-accent-strong hover:bg-yg-accent-soft"
          : "text-yg-faint hover:bg-yg-panel-hover hover:text-yg-ink",
      )}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {icon}
    </Button>
  );
}
