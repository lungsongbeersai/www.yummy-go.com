"use client";

import dynamic from "next/dynamic";
import { Loader2, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PUBLIC_MENU_KIND } from "@/stores/public-pos-store";
import {
  CATEGORY_TAIL_SPACER_HEIGHT,
  RAIL_RENDER_CHUNK,
} from "../constants";
import type { PublicBrowseWorkflow } from "../hooks/use-public-browse-workflow";
import { statusSectionLabel } from "../utils";
import { BottomNav } from "./public-bottom-nav";
import { CartFlyAnimationLayer } from "./cart-fly-animation-layer";
import { CartSheet } from "./cart-sheet";
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

const PublicCategoryIcon = dynamic(
  () =>
    import("@/features/public-pos/order/components/public-category-icon").then(
      (mod) => mod.PublicCategoryIcon,
    ),
  { ssr: false },
);

export function ProductBrowseContent({
  workflow,
}: {
  workflow: PublicBrowseWorkflow;
}) {
  const { t } = useTranslation();
  const {
    cart,
    cartActions,
    cartFlyAnimations,
    cartHydrated,
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

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={categoryBarRef}
        className="sticky top-12 z-20 -mx-2.5 bg-[#f3fbf7]/95 px-2.5 py-1.5 backdrop-blur-xl sm:-mx-4 sm:top-14 sm:px-4 dark:bg-app/95"
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-1.5 rounded-lg border border-emerald-100 bg-white/95 p-1.5 shadow-sm shadow-emerald-950/5 dark:border-border dark:bg-background/95">
          <form className="flex gap-1.5" onSubmit={search.handleSearchSubmit}>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />

              <Input
                className="h-9 cursor-pointer rounded-md border-emerald-100 bg-emerald-50/50 pl-8 text-sm font-semibold shadow-none dark:border-border dark:bg-muted/45"
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
              className="h-9 w-9 rounded-md"
              aria-label={t("pos.searchMenu")}
              disabled={loadingMenu}
            >
              {loadingMenu ? <Loader2 className="animate-spin" /> : <Search />}
            </Button>
          </form>

          {visibleCategoryTabs.length ? (
            <Tabs
              value={activeValue}
              onValueChange={handleTabChange}
              className="gap-0"
            >
              <div className="overflow-x-auto pb-1">
                <TabsList className="h-8 w-max justify-start gap-1 bg-transparent p-0">
                  {visibleCategoryTabs.map((category) => (
                    <TabsTrigger
                      key={category.cate_uuid}
                      value={category.cate_uuid}
                      ref={(element) => {
                        categoryTabRefs.current[category.cate_uuid] = element;
                      }}
                      className="h-8 flex-none gap-1.5 rounded-full border border-emerald-100 bg-white px-3 text-xs font-black shadow-none data-[state=active]:border-primary/30 data-[state=active]:bg-emerald-50 data-[state=active]:text-primary dark:border-border dark:bg-background dark:data-[state=active]:bg-primary/10"
                    >
                      {jumpingCateUuid === category.cate_uuid ? (
                        <Loader2 className="size-4 shrink-0 animate-spin" />
                      ) : (
                        <PublicCategoryIcon icon={category.cate_icon} />
                      )}

                      <span className="min-w-0 max-w-30 truncate sm:max-w-40">
                        {category.cate_name}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
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
        priorityFirstImage={!hasPromotionImage && hasSetImage}
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
                key={category.cate_uuid}
                category={category}
                products={products}
                totalProducts={category.products?.length ?? 0}
                loaded={loaded}
                loading={loading}
                jumping={jumpingCateUuid === category.cate_uuid}
                collapsed={collapsedCateUuids.includes(category.cate_uuid)}
                lang={lang}
                statusKind={PUBLIC_MENU_KIND.NORMAL}
                priorityFirstImage={
                  !hasPromotionImage && !hasSetImage && index === 0
                }
                loadingProductUuid={cartActions.loadingProductUuid}
                onEnsureLoad={ensureNormalCategoryProducts}
                onProductClick={cartActions.handleProductClick}
                onRevealMore={revealMoreProductsForCategory}
                onToggleCollapse={toggleCategoryCollapsed}
                refCallback={(element) => {
                  categoryRefs.current[category.cate_uuid] = element;
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

      {cartActions.productSheetOpen || selectedProduct ? (
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
      ) : null}

      {cartOpen || cartHydrated ? (
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
          onConfirmKitchen={cartActions.handleConfirmKitchen}
        />
      ) : null}
    </div>
  );
}
