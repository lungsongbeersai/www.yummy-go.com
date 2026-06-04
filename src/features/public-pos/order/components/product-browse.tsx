"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PUBLIC_MENU_KIND, usePublicPosStore } from "@/stores/public-pos-store";
import { useToastStore } from "@/stores/toast-store";
import {
  CATEGORY_TAIL_SPACER_HEIGHT,
  RAIL_RENDER_CHUNK,
} from "@/features/public-pos/order/constants";
import { useCartFlyAnimation } from "@/features/public-pos/order/hooks/use-cart-fly-animation";
import { usePublicCartOrderActions } from "@/features/public-pos/order/hooks/use-public-cart-order-actions";
import { usePublicMenuBrowse } from "@/features/public-pos/order/hooks/use-public-menu-browse";
import { usePublicQrDialog } from "@/features/public-pos/order/hooks/use-public-qr-dialog";
import { usePublicSearch } from "@/features/public-pos/order/hooks/use-public-search";
import {
  StatusRailSection,
  ProductCategorySection,
} from "@/features/public-pos/order/components/public-menu-sections";
import { PublicSearchSheet } from "@/features/public-pos/order/components/public-search-sheet";
import { ProductOrderSheet } from "@/features/public-pos/order/components/product-order-sheet";
import { CartSheet } from "@/features/public-pos/order/components/cart-sheet";
import { BottomNav } from "@/features/public-pos/order/components/public-bottom-nav";
import { CartFlyAnimationLayer } from "@/features/public-pos/order/components/cart-fly-animation-layer";
import {
  MenuEmptyState,
  ProductsSkeleton,
} from "@/features/public-pos/order/components/public-pos-skeletons";
import { PublicQrDialog } from "@/features/public-pos/order/components/public-qr-dialog";
import { ScrollJumpControls } from "@/features/public-pos/order/components/scroll-jump-controls";
import { statusSectionLabel, totalCartQty } from "@/features/public-pos/order/utils";

const PublicCategoryIcon = dynamic(
  () =>
    import("@/features/public-pos/order/components/public-category-icon").then(
      (mod) => mod.PublicCategoryIcon,
    ),
  { ssr: false },
);

export function ProductBrowse({
  token,

  lang,

  cartOpen,

  onCartOpenChange,
}: {
  token: string;

  lang: string;

  cartOpen: boolean;

  onCartOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  const toast = useToastStore((state) => state.show);

  const {
    table,

    menuByKind,

    loadingMenu,

    menuRequestKey,

    cart,

    cartStatusRule,

    cartHydrated,

    loadingCart,

    loadingItem,

    selectedProduct,

    saving,

    confirming,
  } = usePublicPosStore(
    useShallow((state) => ({
      table: state.scan,

      menuByKind: state.menuByKind,

      loadingMenu: state.loadingMenu,

      menuRequestKey: state.menuRequestKey,

      cart: state.cart,

      cartStatusRule: state.cartStatusRule,

      cartHydrated: state.cartHydrated,

      loadingCart: state.loadingCart,

      loadingItem: state.loadingItem,

      selectedProduct: state.selectedProduct,

      saving: state.saving,

      confirming: state.confirming,
    })),
  );

  const {
    setError,

    setSelectedCateUuid,

    ensureCartLoaded,

    loadMenuProducts,

    loadNormalCategoryProducts,

    loadProductItem,

    createOrder,

    updateQty,

    deleteItem,

    confirmKitchen,
  } = usePublicPosStore(
    useShallow((state) => ({
      setError: state.setError,

      setSelectedCateUuid: state.setSelectedCateUuid,

      ensureCartLoaded: state.ensureCartLoaded,

      loadMenuProducts: state.loadMenuProducts,

      loadNormalCategoryProducts: state.loadNormalCategoryProducts,

      loadProductItem: state.loadProductItem,

      createOrder: state.createOrder,

      updateQty: state.updateQty,

      deleteItem: state.deleteItem,

      confirmKitchen: state.confirmKitchen,
    })),
  );

  const cartTargetRef = useRef<HTMLButtonElement | null>(null);
  const { cartFlyAnimations, playCartFlyAnimation, handleCartFlyDone } =
    useCartFlyAnimation(cartTargetRef);
  const cartQty = useMemo(() => totalCartQty(cart), [cart]);
  const {
    searchText,
    searchDraft,
    searchOpen,
    searchHistory,
    submittedSearch,
    searchRun,
    openSearchSheet,
    handleSearchSubmit,
    clearSearchHistory,
    handleSearchSheetSubmit,
    handleSearchHistorySelect,
    handleSearchOpenChange,
    handleSearchDraftChange,
  } = usePublicSearch({ branchUuid: table?.branch_uuid_fk, lang });
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
  } = usePublicMenuBrowse({
    lang,
    loadMenuProducts,
    loadNormalCategoryProducts,
    menuByKind,
    menuRequestKey,
    searchRun,
    setError,
    setSelectedCateUuid,
    submittedSearch,
    t,
    toast,
    token,
  });
  const {
    qrDialogOpen,
    qrTargetUrl,
    qrDataUrl,
    setQrDialogOpen,
    handleOpenQrDialog,
    handleShareQr,
    handleDownloadQr,
  } = usePublicQrDialog({ table, t, toast });
  const {
    productSheetOpen,
    setProductSheetOpen,
    selectedProductStatusKind,
    loadingProductUuid,
    handleAddToCart,
    handleProductClick,
    handleUpdateItemQty,
    handleDeleteItem,
    handleConfirmKitchen,
  } = usePublicCartOrderActions({
    cart,
    cartOpen,
    cartStatusRule,
    confirming,
    confirmKitchen,
    createOrder,
    deleteItem,
    ensureCartLoaded,
    lang,
    loadProductItem,
    loadingItem,
    playCartFlyAnimation,
    saving,
    submittedSearch,
    table,
    t,
    toast,
    token,
    updateQty,
  });

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={categoryBarRef}
        className="sticky top-12 z-20 -mx-2.5 bg-[#f3fbf7]/95 px-2.5 py-1.5 backdrop-blur-xl sm:-mx-4 sm:top-14 sm:px-4 dark:bg-app/95"
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-1.5 rounded-lg border border-emerald-100 bg-white/95 p-1.5 shadow-sm shadow-emerald-950/5 dark:border-border dark:bg-background/95">
          <form className="flex gap-1.5" onSubmit={handleSearchSubmit}>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />

              <Input
                className="h-9 cursor-pointer rounded-md border-emerald-100 bg-emerald-50/50 pl-8 text-sm font-semibold shadow-none dark:border-border dark:bg-muted/45"
                value={searchText}
                readOnly
                aria-expanded={searchOpen}
                aria-haspopup="dialog"
                onClick={openSearchSheet}
                onFocus={openSearchSheet}
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

                      <span className="min-w-0 max-w-[7.5rem] truncate sm:max-w-[10rem]">
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
        history={searchHistory}
        loading={loadingMenu}
        open={searchOpen}
        value={searchDraft}
        onClearHistory={clearSearchHistory}
        onHistorySelect={handleSearchHistorySelect}
        onOpenChange={handleSearchOpenChange}
        onSubmit={handleSearchSheetSubmit}
        onValueChange={handleSearchDraftChange}
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
        loadingProductUuid={loadingProductUuid}
        onProductClick={handleProductClick}
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
        loadingProductUuid={loadingProductUuid}
        onProductClick={handleProductClick}
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
                loadingProductUuid={loadingProductUuid}
                onEnsureLoad={ensureNormalCategoryProducts}
                onProductClick={handleProductClick}
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
        onShare={handleOpenQrDialog}
      />

      <CartFlyAnimationLayer
        animations={cartFlyAnimations}
        onDone={handleCartFlyDone}
      />

      <PublicQrDialog
        dataUrl={qrDataUrl}
        open={qrDialogOpen}
        tableName={table?.table_name}
        targetUrl={qrTargetUrl}
        onDownload={handleDownloadQr}
        onOpenChange={setQrDialogOpen}
        onShare={handleShareQr}
      />

      {productSheetOpen || selectedProduct ? (
        <ProductOrderSheet
          open={productSheetOpen}
          onOpenChange={setProductSheetOpen}
          product={selectedProduct}
          statusKind={selectedProductStatusKind}
          cart={cart}
          lang={lang}
          loading={loadingItem}
          saving={saving}
          onAdd={(payload, sourceRect) => {
            if (selectedProduct)
              void handleAddToCart(selectedProduct, payload, sourceRect);
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
          onUpdateQty={handleUpdateItemQty}
          onDeleteItem={handleDeleteItem}
          onConfirmKitchen={handleConfirmKitchen}
        />
      ) : null}
    </div>
  );
}
