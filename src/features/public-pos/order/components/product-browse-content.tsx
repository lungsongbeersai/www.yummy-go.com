"use client";

import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import { PublicSuccessDialog } from "@/components/common/public-success-dialog";
import { useRef, useState, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  getConfirmableOrderPayload,
  readPublicProductLayoutMode,
  statusSectionLabel,
  subscribePublicProductLayoutMode,
  writePublicProductLayoutMode,
} from "../utils";
import { PublicLoadFeedback } from "./public-load-feedback";
import { BottomNav } from "./public-bottom-nav";
import { CartFlyAnimationLayer } from "./cart-fly-animation-layer";
import { CartSheet } from "./cart-sheet";
import { PublicCategoryMenu } from "./public-category-menu";
import { PublicMenuHero } from "./public-menu-hero";
import { PublicQrDialog } from "./public-qr-dialog";
import { PublicQrOrderScanDialog } from "./public-qr-order-scan-dialog";
import { MenuEmptyState, ProductsSkeleton } from "./public-pos-skeletons";
import { PublicSearchSheet } from "./public-search-sheet";
import {
  ProductCategorySection,
  StatusRailSection,
} from "./public-menu-sections";
import { ProductOrderSheet } from "./product-order-sheet";
import { HorizontalScrollArrows } from "./horizontal-scroll-arrows";

const CustomerWaiterSheet = dynamic(
  () =>
    import("@/features/waiter-requests/customer-waiter-sheet").then(
      (mod) => mod.CustomerWaiterSheet
    ),
  { ssr: false }
);

const PublicCategoryIcon = dynamic(
  () => import("./public-category-icon").then((mod) => mod.PublicCategoryIcon),
  { ssr: false }
);

export function ProductBrowseContent({
  workflow,
}: {
  workflow: PublicBrowseWorkflow;
}) {
  const { t } = useTranslation();
  // server render ใช้ list เสมอ ฝั่ง client sync จาก localStorage โดยไม่มี effect
  const productLayoutMode = useSyncExternalStore(
    subscribePublicProductLayoutMode,
    readPublicProductLayoutMode,
    (): PublicProductLayoutMode => "list"
  );
  // ปิดเป็นค่าเริ่มต้น สลับได้จาก Tweaks — แพตเทิร์นเดียวกับ productLayoutMode
  const heroVisible = useSyncExternalStore(
    subscribePublicPosHeroVisible,
    readPublicPosHeroVisible,
    (): boolean => DEFAULT_PUBLIC_POS_HERO_VISIBLE
  );
  const [waiterOpen, setWaiterOpen] = useState(false);
  const [waiterMounted, setWaiterMounted] = useState(false);
  const categoryRailRef = useRef<HTMLDivElement | null>(null);
  const viewOnlyScanButtonRef = useRef<HTMLButtonElement | null>(null);
  const pendingScanFocusRef = useRef(false);
  const {
    token,
    cart,
    cartActions,
    cartFlyAnimations,
    cartHydrated,
    cartLoadError,
    retryCart,
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
    qrOrderScanner,
    saving,
    search,
    selectedProduct,
    table,
    viewOnly,
  } = workflow;
  const {
    activeValue,
    categoryBarRef,
    categoryRefs,
    categoryTabRefs,
    collapsedCateUuids,
    ensureNormalCategoryProducts,
    handleScrollToTop,
    handleTabChange,
    hasAnyProducts,
    hasMoreRenderedMenu,
    hasPromotionImage,
    hasSetImage,
    jumpingCateUuid,
    menuCategories,
    menuLoadError,
    retryMenu,
    normalMenu,
    promotionMenu,
    promotionProducts,
    railVisibleCounts,
    renderSentinelRef,
    renderedMenuSections,
    revealMoreProductsForCategory,
    revealMoreRailProducts,
    setMenu,
    setProducts,
    toggleCategoryCollapsed,
    visibleCategoryTabs,
  } = browse;

  function handleProductLayoutModeChange(mode: PublicProductLayoutMode) {
    writePublicProductLayoutMode(mode);
  }

  // ปุ่ม "ສະແກນ QR ເພື່ອສັ່ງອາຫານ" ใน modal รายละเอียดสินค้า (โหมดดูอย่างเดียว) —
  // ปิด modal แล้วพา user กลับไปที่ปุ่มเดิมบนแบนเนอร์แทนที่จะเปิด scanner ซ้อนจาก
  // ในมัด modal เอง
  function handleScanQrFromModal() {
    pendingScanFocusRef.current = true;
    cartActions.setProductSheetOpen(false);
  }

  // Radix คืนโฟกัสให้ trigger เดิม (การ์ดสินค้า) เป็นค่าเริ่มต้นตอน modal ปิด — ที่นี่
  // ต้องการโฟกัสปุ่มสแกน QR แทน จึง preventDefault แล้วจัดการเองหลังภาพเคลื่อนไหวปิดจบ
  function handleProductSheetCloseAutoFocus(event: Event) {
    if (!pendingScanFocusRef.current) return;
    pendingScanFocusRef.current = false;
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    viewOnlyScanButtonRef.current?.focus({ preventScroll: true });
  }

  return (
    <div className="flex flex-col gap-3">
      {heroVisible ? (
        <PublicMenuHero onSearch={search.openSearchSheet} />
      ) : null}

      {/* บาร์นี้ sticky ตลอดการเลื่อน — เดิมมี backdrop-blur-xl ซึ่งบังคับให้เบราว์เซอร์
          re-blur พื้นหลังทุกเฟรมขณะเลื่อน (สาเหตุหลักของอาการกระตุกบนจอ 120Hz)
          ตัด blur ออก ใช้พื้นทึบแทน (เดิม /95 ยังเห็นเมนูทะลุบาร์ตอนเลื่อน จึงทึบเต็ม) compositing ถูกกว่ามาก
          border-b: เส้นใต้แถบหมวดหมู่ ขีดขอบของแถบที่เลื่อนซ้าย-ขวาได้ และแยกแถบออกจากเมนูตอนติดด้านบน */}
      <div
        ref={categoryBarRef}
        className="sticky top-16 z-20 -mx-(--yg-gutter) border-b border-yg-divider bg-yg-bg px-(--yg-gutter) pt-0 pb-0"
      >
        <div className="mx-auto flex max-w-280 flex-col gap-0">
          {visibleCategoryTabs.length ? (
            <Tabs
              value={activeValue}
              onValueChange={handleTabChange}
              className="gap-0"
            >
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <div
                    ref={categoryRailRef}
                    className="yg-rail overflow-x-auto overflow-y-hidden"
                  >
                    <TabsList className="h-10 w-max justify-start gap-2 rounded-none bg-transparent p-0 group-data-horizontal/tabs:h-10">
                      {visibleCategoryTabs.map((category) => (
                        <TabsTrigger
                          key={category.cateUuid}
                          value={category.cateUuid}
                          ref={(element) => {
                            categoryTabRefs.current[category.cateUuid] =
                              element;
                          }}
                          className="h-10 flex-none gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-2 text-sm font-medium text-yg-ink/75 shadow-none duration-150 motion-reduce:transition-none after:hidden data-[state=active]:border-yg-accent data-[state=active]:bg-transparent data-[state=active]:text-yg-accent-strong"
                        >
                          <span className="grid size-3.5 shrink-0 place-items-center">
                            {jumpingCateUuid === category.cateUuid ? (
                              <Loader2 className="size-3.5 shrink-0 animate-spin" />
                            ) : (
                              <PublicCategoryIcon
                                icon={category.cateIcon}
                                className="size-3.5"
                              />
                            )}
                          </span>

                          <span className="lao-tone-text min-w-0 max-w-30 truncate sm:max-w-40">
                            {category.cateName}
                          </span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                  {/* Fade only where more categories remain; keep the next chip visible for swiping. */}
                  <HorizontalScrollArrows
                    scrollRef={categoryRailRef}
                    variant="fade"
                  />
                </div>

                {/* อยู่นอกแถบเลื่อน — กดถึงได้เสมอไม่ต้องเลื่อนหา ใช้ตอนหมวดเยอะจนแถบ pill ไม่พอ */}
                <span
                  className="h-6 w-px shrink-0 bg-yg-divider"
                  aria-hidden="true"
                />
                <PublicCategoryMenu
                  layoutMode={productLayoutMode}
                  onLayoutModeChange={handleProductLayoutModeChange}
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

      <PublicLoadFeedback
        loading={loadingMenu}
        error={menuLoadError || normalMenu.error}
        onRetry={retryMenu}
      />
      {loadingMenu && !hasAnyProducts ? (
        <ProductsSkeleton layoutMode={productLayoutMode} />
      ) : null}

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
        cardKind="set"
      />

      {renderedMenuSections.length ? (
        <div className="flex flex-col">
          {renderedMenuSections.map(
            ({ category, products, loaded, loading }) => (
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
                priorityFirstImage
                loadingProductUuid={cartActions.loadingProductUuid}
                onEnsureLoad={ensureNormalCategoryProducts}
                onProductClick={cartActions.handleProductClick}
                onRevealMore={revealMoreProductsForCategory}
                onToggleCollapse={toggleCategoryCollapsed}
                refCallback={(element) => {
                  categoryRefs.current[category.cateUuid] = element;
                }}
              />
            )
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

      <BottomNav
        cartQty={cartQty}
        needsConfirmation={Boolean(
          getConfirmableOrderPayload(cart, cartStatusRule)
        )}
        cartTargetRef={cartTargetRef}
        hideCart={table?.view_only}
        onScan={qrOrderScanner.openQrOrderScanner}
        scanTargetRef={viewOnlyScanButtonRef}
        onMenu={handleScrollToTop}
        onCart={() => onCartOpenChange(true)}
        onShare={qr.handleOpenQrDialog}
        onCallStaff={
          !viewOnly && table
            ? () => {
                setWaiterMounted(true);
                setWaiterOpen(true);
              }
            : undefined
        }
      />

      {!viewOnly && table && waiterMounted ? (
        <CustomerWaiterSheet
          key={token}
          open={waiterOpen}
          onOpenChange={setWaiterOpen}
          token={token}
          branch={table.branch_uuid_fk}
          table={table.table_uuid}
        />
      ) : null}

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

      <PublicQrOrderScanDialog
        open={qrOrderScanner.qrOrderScannerOpen}
        status={qrOrderScanner.qrOrderScannerStatus}
        videoRef={qrOrderScanner.qrOrderScannerVideoRef}
        onOpenChange={(next) =>
          next
            ? qrOrderScanner.openQrOrderScanner()
            : qrOrderScanner.closeQrOrderScanner()
        }
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
        viewOnly={viewOnly}
        onScanQr={handleScanQrFromModal}
        onCloseAutoFocus={handleProductSheetCloseAutoFocus}
        onAdd={(payload, sourceRect) => {
          if (selectedProduct)
            void cartActions.handleAddToCart(
              selectedProduct,
              payload,
              sourceRect
            );
        }}
      />

      <PublicSuccessDialog
        open={cartActions.confirmationSuccess}
        onOpenChange={cartActions.setConfirmationSuccess}
        message={t("publicSuccess.order")}
      />
      <CartSheet
        open={cartOpen}
        loadError={cartLoadError}
        onRetryLoad={retryCart}
        onOpenChange={onCartOpenChange}
        cart={cart}
        statusRule={cartStatusRule}
        lang={lang}
        // สคีเลตันเต็มจอควรขึ้นแค่ครั้งแรกที่ยังไม่มีข้อมูลเลย — รีเฟรชรอบถัดๆไป
        // (หลังแก้จำนวน/ลบ/socket sync) ให้ตะกร้าเดิมค้างอยู่แล้วสลับข้อมูลใหม่
        // ในที่เดิมแบบ stale-while-revalidate ไม่กะพริบทั้งจอ
        loading={loadingCart && !cartHydrated}
        saving={saving}
        confirming={confirming}
        onUpdateQty={cartActions.handleUpdateItemQty}
        onDeleteItem={cartActions.handleDeleteItem}
        onNoteChange={cartActions.setNoteDraft}
        onNoteOpen={cartActions.handleOpenNoteDialog}
        onNoteOpenChange={cartActions.handleNoteDialogOpenChange}
        onUpdateNote={cartActions.handleUpdateItemNote}
        onQuantityOpen={cartActions.handleOpenQuantityDialog}
        onQuantityOpenChange={cartActions.handleQuantityDialogOpenChange}
        onSubmitQuantity={cartActions.handleSubmitQuantity}
        onConfirmKitchen={cartActions.handleConfirmKitchen}
        noteDraft={cartActions.noteDraft}
        noteTarget={cartActions.noteTarget}
        quantityTarget={cartActions.quantityTarget}
      />
    </div>
  );
}
