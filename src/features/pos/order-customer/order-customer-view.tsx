"use client";

import { memo, useEffect, useRef } from "react";
import { ArrowLeft, RefreshCcw, ShoppingCart, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { DisplaySettingsMenu } from "@/components/layout/web/display-settings-menu";
import { SimulatorLauncher } from "@/features/simulator/simulator-launcher";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useIsNativeShellActive } from "@/hooks/use-native-shell-active";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import { useLandscapeTablet } from "@/hooks/use-landscape-tablet";
import { cn } from "@/lib/utils";
import { useNativeHeaderStore } from "@/stores/native-header-store";
import { useAppStore } from "@/stores/app-store";
import { SelectedTableCartPanel } from "../table-selection/selected-table-cart-panel";
import { newOrderTabItems, primaryCartOrder, visibleCartItems } from "../table-selection/utils";
import { DraftExitWarningDialog } from "./draft-exit-warning-dialog";
import { productModeLabel } from "./order-customer-utils";
import {
  EmployeeCategoryRail,
  EmployeeCategorySidebar,
  EmployeeSearchForm,
  EmployeeMobileHeaderActions,
  EmployeeSortTabs,
} from "./order-customer-menu-components";
import { ProductGridSkeleton } from "./order-customer-product-card";
import { EmployeeProductGrid } from "./order-customer-product-grid";
import {
  ProductOptionsForm,
  ProductOptionsMedia,
  ProductOptionsSubtitle,
  ProductOptionsOverlay,
} from "./order-customer-product-options";
import type { OrderCustomerWorkflow } from "./use-order-customer-workflow";

// Typing a menu search or changing product options leaves the server cart intact.
// Its own state/store subscriptions still update this panel independently.
const OrderCartPanel = memo(SelectedTableCartPanel);

const headerIconButtonClass = "size-11 shrink-0 rounded-full";

export function OrderCustomerView({
  workflow,
}: {
  workflow: OrderCustomerWorkflow;
}) {
  const {
    activeProducts,
    activeSort,
    cart,
    cartCount,
    cartSheetOpen,
    categories,
    changeProductDetail,
    changeSelectedToppingQty,
    draftExitCleanupPending,
    draftExitWarningOpen,
    handlePaymentComplete,
    handleTableActionComplete,
    isMobile,
    loadCart,
    loadingCart,
    loadingMenu,
    loadingProductUuid,
    loadingTables,
    modalUnitPrice,
    newOrderFocusKey,
    note,
    openOrAddProduct,
    openCartSheet,
    openTablesPage,
    onDraftExitContinue,
    onDraftExitLeaveTable,
    productMode,
    productSheetOpen,
    printerContext,
    prefetchProduct,
    qty,
    refreshAll,
    saving,
    search,
    selectCategory,
    selectedCateUuid,
    selectedDetail,
    selectedProduct,
    selectedSetChildOptionGroupUuids,
    selectedSetChoiceUuids,
    selectedSetChoiceTasteUuids,
    selectedTastes,
    selectedTable,
    selectedToppings,
    setActiveSort,
    setCartSheetOpen,
    setNote,
    setProductSheetOpen,
    setQty,
    setSearch,
    showTableFeatures,
    submitSearch,
    submitSelectedProduct,
    t,
    toggleSelectedTopping,
    toggleSelectedTaste,
    toggleSetChildOption,
    toggleSetChoice,
    toggleSetChoiceTaste,
    toppingQtyByUuid,
    zones,
  } = workflow;

  const hasPendingCartNotice = cartCount > 0 || Boolean(selectedTable?.customer_order_state) ||
    newOrderTabItems(visibleCartItems(primaryCartOrder(cart))).length > 0;
  const animateCartNotice = hasPendingCartNotice && !cartSheetOpen;
  const nativeShellActive = useIsNativeShellActive();
  const decorBackground = useAppStore((state) => state.decorBackground);
  const neutralChrome = nativeShellActive || !decorBackground;
  const isNativeApp = useIsCapacitorNativeApp();
  const landscapeTablet = useLandscapeTablet();
  const horizontalNativeOrderLayout = nativeShellActive && landscapeTablet;
  const portraitNativeOrderLayout = nativeShellActive && !landscapeTablet;
  // Swan 1 ซ่อน native chrome เพื่อใช้ command row แบบ desktop บน WebView รุ่นเก่า
  // แต่หมวดหมู่ยังต้องเป็น rail แนวนอนของ Native ไม่ย้อนกลับไปเป็น sidebar ซ้าย
  const useNativeCategoryLayout = isNativeApp;
  const compactNativeProductGrid = horizontalNativeOrderLayout
    ? "gap-2 md:grid-cols-[repeat(auto-fill,minmax(148px,1fr))]"
    : undefined;
  const setHeaderTitle = useNativeHeaderStore((state) => state.setTitle);
  const setHeaderBackAction = useNativeHeaderStore(
    (state) => state.setBackAction
  );
  // openTablesPage เดียวกับปุ่มย้อนกลับบนเว็บ (มีขั้นตอนเตือนก่อนทิ้ง draft ที่ยังไม่
  // ยืนยันของตัวเอง ดู use-draft-cleanup.ts) เก็บ ref ด้วยเหตุผลเดียวกับ refreshAllRef
  const openTablesPageRef = useRef(openTablesPage);
  useEffect(() => {
    openTablesPageRef.current = openTablesPage;
  });

  // ปุ่ม Back ของ NativeTopBar ปกติแค่ router.back() เฉย ๆ ซึ่งจะข้าม dialog เตือน
  // draft ที่ยังไม่ยืนยัน (บนเว็บปุ่มย้อนกลับในหน้านี้เรียก openTablesPage ตรง ๆ อยู่แล้ว)
  // Android hardware Back ยังต้องใช้ override นี้แม้ Swan 1 ซ่อน NativeTopBar
  // เพื่อแสดง desktop POS layout; gate ด้วย native app ไม่ใช่ visual shell
  useEffect(() => {
    if (!isNativeApp) return;
    setHeaderBackAction(() => void openTablesPageRef.current());
    return () => setHeaderBackAction(null);
  }, [isNativeApp, setHeaderBackAction]);

  // โชว์ชื่อโต๊ะ (เช่น "T01") ใน top bar แทนหัวข้อ static "ອໍເດີລູກຄ້າ" ของ route —
  // ผู้ใช้ต้องดูออกไวว่ากำลังสั่งให้โต๊ะไหนอยู่ ไม่ใช่แค่ชื่อหน้าเฉย ๆ
  useEffect(() => {
    if (!nativeShellActive) return;
    setHeaderTitle(selectedTable?.table_name || null);
    return () => setHeaderTitle(null);
  }, [nativeShellActive, selectedTable, setHeaderTitle]);

  return (
    <div
      data-pos-appearance={neutralChrome ? "plain" : "decorated"}
      className={cn(
        "relative h-full min-h-0 overflow-hidden bg-background text-foreground",
        !nativeShellActive && "pos-decor-surface"
      )}
    >
      <div
        className={cn(
          "relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden",
          useNativeCategoryLayout
            ? "lg:grid-cols-[minmax(0,1fr)_clamp(320px,20vw,360px)]"
            : "lg:grid-cols-[154px_minmax(0,1fr)_clamp(320px,20vw,360px)]"
        )}
      >
        <header
          className={cn(
            "relative shrink-0 overflow-hidden border-b px-3 sm:px-3.5",
            !useNativeCategoryLayout && "lg:col-span-2",
            nativeShellActive
              ? horizontalNativeOrderLayout
                ? "border-primary/20 bg-background pb-1 pt-0 text-foreground shadow-sm dark:border-border dark:bg-card"
                : "border-border bg-card py-1 text-foreground shadow-xs"
              : // ตอน nativeShellActive=false นี่คือ header บนสุดของหน้าจริง ๆ (ไม่มี NativeTopBar
                // ให้ด้านบนแล้ว — AppShell ก็ซ่อน header ตัวเองบน immersive screen เหมือนกัน) ต้อง
                // กันพื้นที่ status bar เองด้วย pt เพิ่มจาก env(safe-area-inset-top) ไม่งั้น
                // sort-tabs/search แถวบนโดน status bar ทับตอนรันบน Capacitor จอกว้าง/แนวนอน
                cn(
                  "py-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] lg:py-1.5 lg:pt-[calc(0.375rem+env(safe-area-inset-top,0px))]",
                  neutralChrome
                    ? "border-border bg-card text-foreground shadow-xs"
                    : "border-primary-foreground/20 bg-transparent text-primary-foreground"
                )
          )}
        >
          {horizontalNativeOrderLayout ? (
            <div className="relative flex min-w-0 flex-col gap-1.5">
              <h1 className="sr-only">
                {selectedTable?.table_name
                  ? `${t("pos.table")} ${selectedTable.table_name}`
                  : t("nav.order")}
              </h1>

              <div
                data-pos-order-command-row="true"
                className="-mx-3 flex min-w-0 items-center gap-2 bg-primary px-3 pb-1 pt-[calc(0.25rem+env(safe-area-inset-top,0px))] text-primary-foreground sm:-mx-3.5 sm:px-3.5"
              >
                <Button
                  type="button"
                  variant="header"
                  size="icon"
                  aria-label={t("actions.back")}
                  className={headerIconButtonClass}
                  onClick={() => void openTablesPage()}
                >
                  <ArrowLeft data-icon="inline-start" />
                </Button>

                <div className="grid min-w-0 flex-1 grid-cols-[minmax(12rem,17rem)_minmax(0,1fr)] gap-2">
                  <EmployeeSortTabs
                    activeSort={activeSort}
                    className="w-full"
                    neutral
                    onPrimary
                    onSortChange={(status) => setActiveSort(status)}
                  />
                  <EmployeeSearchForm
                    className="w-full"
                    loading={loadingMenu}
                    neutral
                    onPrimary
                    search={search}
                    showSearchLabel
                    onSearchChange={setSearch}
                    onSearchSubmit={() => void submitSearch()}
                  />
                </div>

                <EmployeeMobileHeaderActions
                  loading={loadingTables || loadingMenu}
                  onRefresh={() => void refreshAll()}
                />
              </div>

              <EmployeeCategoryRail
                categories={categories}
                neutral
                selectedCateUuid={selectedCateUuid}
                wide
                onSelectCategory={(cateUuid) => void selectCategory(cateUuid)}
              />
            </div>
          ) : null}
          {!horizontalNativeOrderLayout ? (
            <div
              className={cn(
                "relative flex min-w-0 flex-col",
                nativeShellActive ? "gap-1.5" : "gap-2 lg:hidden"
              )}
            >
              {/* Native แนวตั้งย้าย sort tabs ขึ้นไปแทนชุด action ด้านขวาของ NativeTopBar
                  เพื่อคืนความสูงให้สินค้า ส่วนเว็บยังไม่มี shell header จึงเก็บแถวนี้ไว้ */}
              {!portraitNativeOrderLayout ? (
                <EmployeeSortTabs
                  activeSort={activeSort}
                  neutral={neutralChrome}
                  onSortChange={(status) => setActiveSort(status)}
                />
              ) : null}
              {/* ปุ่มย้อนกลับ + เมนู "..." ซ้ำกับ NativeTopBar บน Capacitor เท่านั้น —
                  ฝั่งเว็บยังไม่มี header ของ shell ให้หน้านี้ จึงต้องเก็บไว้เหมือนเดิม */}
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {!nativeShellActive ? (
                  <Button
                    type="button"
                    variant="header"
                    size="icon"
                    aria-label={t("actions.back")}
                    className={headerIconButtonClass}
                    onClick={() => void openTablesPage()}
                  >
                    <ArrowLeft data-icon="inline-start" />
                  </Button>
                ) : null}

                <EmployeeSearchForm
                  className={nativeShellActive
                    ? "min-w-40 flex-1"
                    : "order-last w-full flex-none sm:order-none sm:w-auto sm:flex-1"}
                  loading={loadingMenu}
                  neutral={neutralChrome}
                  search={search}
                  onSearchChange={setSearch}
                  onSearchSubmit={() => void submitSearch()}
                />

                {portraitNativeOrderLayout ? (
                  <DisplaySettingsMenu showLabel className="ml-auto h-11 sm:h-11" />
                ) : null}

                {!nativeShellActive ? (
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <SimulatorLauncher />
                    <EmployeeMobileHeaderActions
                      loading={loadingTables || loadingMenu}
                      onRefresh={() => void refreshAll()}
                    />
                  </div>
                ) : null}
              </div>

              <EmployeeCategoryRail
                categories={categories}
                neutral={useNativeCategoryLayout || neutralChrome}
                selectedCateUuid={selectedCateUuid}
                wide={useNativeCategoryLayout}
                onSelectCategory={(cateUuid) => void selectCategory(cateUuid)}
              />
            </div>
          ) : null}

          {!horizontalNativeOrderLayout && !nativeShellActive ? (
            <div className="relative hidden min-w-0 flex-wrap items-center gap-2 lg:flex lg:min-h-11">
              {/* Capacitor's NativeTopBar already carries back / refresh / notif —
                on native, only the sort tabs + search belong in this row. */}
              {!nativeShellActive ? (
                <Button
                  type="button"
                  variant="header"
                  size="icon"
                  aria-label={t("actions.back")}
                  className={headerIconButtonClass}
                  onClick={() => void openTablesPage()}
                >
                  <ArrowLeft data-icon="inline-start" />
                </Button>
              ) : null}

              <div className="grid min-w-[min(22.5rem,100%)] flex-1 grid-cols-[minmax(12rem,17rem)_minmax(10rem,1fr)] gap-2">
                <EmployeeSortTabs
                  activeSort={activeSort}
                  className="w-full"
                  neutral={neutralChrome}
                  onSortChange={(status) => setActiveSort(status)}
                />
                <EmployeeSearchForm
                  className={cn("w-full", !nativeShellActive && "lg:max-w-xl")}
                  loading={loadingMenu}
                  neutral={neutralChrome}
                  search={search}
                  showSearchLabel
                  onSearchChange={setSearch}
                  onSearchSubmit={() => void submitSearch()}
                />
              </div>

              {!nativeShellActive ? (
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <SimulatorLauncher />
                  <DisplaySettingsMenu showLabel className="h-11 sm:h-11" />
                  {/* Keep language/refresh compact on tablet widths; appearance remains visible. */}
                  <div className="hidden items-center gap-2 xl:flex">
                    <LanguageSwitch
                      className={headerIconButtonClass}
                      compact
                      size="icon"
                      variant="header"
                    />
                    <Button
                      type="button"
                      variant="header"
                      size="icon"
                      aria-label={t("actions.refresh")}
                      className={headerIconButtonClass}
                      disabled={loadingTables || loadingMenu}
                      onClick={() => void refreshAll()}
                    >
                      {loadingTables || loadingMenu ? (
                        <Spinner />
                      ) : (
                        <RefreshCcw />
                      )}
                    </Button>
                  </div>
                  <div className="xl:hidden">
                    <EmployeeMobileHeaderActions
                      loading={loadingTables || loadingMenu}
                      onRefresh={() => void refreshAll()}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {useNativeCategoryLayout && !nativeShellActive ? (
            <div className="relative hidden min-w-0 lg:block">
              <EmployeeCategoryRail
                categories={categories}
                neutral
                selectedCateUuid={selectedCateUuid}
                wide
                onSelectCategory={(cateUuid) => void selectCategory(cateUuid)}
              />
            </div>
          ) : null}
        </header>

        <div
          className={cn(
            "min-h-0 overflow-hidden",
            useNativeCategoryLayout
              ? "flex"
              : "grid md:grid-cols-[154px_minmax(0,1fr)] lg:col-span-2"
          )}
        >
          {!useNativeCategoryLayout ? (
            <EmployeeCategorySidebar
              categories={categories}
              loading={loadingMenu && !categories.length}
              neutral={neutralChrome}
              selectedCateUuid={selectedCateUuid}
              onSelectCategory={(cateUuid) => void selectCategory(cateUuid)}
            />
          ) : null}

          <section
            aria-busy={loadingMenu}
            className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          >
            <div
              className="pos-soft-light-zone pos-dark-zone min-h-0 flex-1 overflow-y-auto bg-product-canvas p-3 text-foreground sm:p-3.5 lg:p-4 dark:bg-background"
            >
              {loadingMenu ? (
                <ProductGridSkeleton
                  className={compactNativeProductGrid}
                  compact={horizontalNativeOrderLayout}
                  nativeMobile={isNativeApp}
                />
              ) : activeProducts.length ? (
                // lg: (แนวนอน/แท็บเล็ต — ไม่มีปุ่มตะกร้าลอย/แถบล่างมาบัง) ต้องกันแถบ gesture ของ
                // ระบบเองด้วย safe-area-inset-bottom โดยเฉพาะตอนรันบน Capacitor ผ่าน AppShell
                // ที่ไม่มี bottom nav มาช่วยกันให้แล้วเหมือน NativeAppShell
                <EmployeeProductGrid
                  activeSort={activeSort}
                  className={compactNativeProductGrid}
                  compact={horizontalNativeOrderLayout}
                  loadingProductUuid={loadingProductUuid}
                  nativeMobile={isNativeApp}
                  products={activeProducts}
                  onAction={openOrAddProduct}
                  onPrefetch={prefetchProduct}
                />
              ) : (
                <Empty className="min-h-105 rounded-xl border border-dashed bg-background text-foreground">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Utensils />
                    </EmptyMedia>
                    <EmptyTitle>{t("pos.noProductsInCategory")}</EmptyTitle>
                    <EmptyDescription>
                      {t("empty.adjustSearch")}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void refreshAll()}
                    >
                      <RefreshCcw data-icon="inline-start" />
                      {t("actions.refresh")}
                    </Button>
                  </EmptyContent>
                </Empty>
              )}
            </div>
          </section>
        </div>

        <aside
          className={cn(
            "relative row-span-2 row-start-1 hidden min-h-0 overflow-hidden bg-transparent lg:block",
            useNativeCategoryLayout ? "col-start-2" : "col-start-3"
          )}
        >
          <div className="relative h-full min-h-0">
            <OrderCartPanel
              allZones={zones}
              cart={cart}
              loading={loadingCart}
              newOrderFocusKey={newOrderFocusKey}
              printerContext={printerContext}
              showCreateEmployeeOrderAction={false}
              showTableFeatures={showTableFeatures}
              table={selectedTable}
              onCartRefresh={loadCart}
              onPaymentCompleted={handlePaymentComplete}
              onTableActionComplete={handleTableActionComplete}
            />
          </div>
        </aside>
      </div>

      <Button
        type="button"
        aria-label={t("pos.currentCart")}
        data-pending-notice={animateCartNotice ? "true" : undefined}
        className={cn(
          "pos-safe-bottom-offset fixed right-4 z-40 h-12 max-w-[calc(100vw-2rem)] rounded-md border px-4 text-sm font-black shadow-[0_16px_34px_-20px_rgb(15_23_42/0.9)] active:scale-[0.98] lg:hidden",
          portraitNativeOrderLayout
            ? "border-foreground/15 bg-foreground text-background hover:bg-foreground/90 hover:text-background"
            : "border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90",
          animateCartNotice && "pos-pending-notice"
        )}
        onClick={() => void openCartSheet()}
      >
        <ShoppingCart data-icon="inline-start" />
        <span className="min-w-0 truncate">{t("pos.currentCart")}</span>
        <Badge
          className={cn(
            "min-w-6 shrink-0 justify-center rounded-full px-1.5 py-0",
            portraitNativeOrderLayout
              ? "border-background/30 bg-background text-foreground"
              : "border-primary-foreground/30 bg-primary-foreground text-primary",
            animateCartNotice && "border-border bg-card text-card-foreground"
          )}
        >
          {cartCount}
        </Badge>
      </Button>

      <Sheet
        open={cartSheetOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            void openCartSheet();
            return;
          }
          setCartSheetOpen(false);
        }}
      >
        <SheetContent
          data-pos-appearance={decorBackground ? "decorated" : "plain"}
          side="bottom"
          // ลบ env(safe-area-inset-top) ออกจากความสูงทั้งก้อน แทนที่จะปล่อยให้ sheet กาง
          // ไปทับ status bar แล้วค่อยดันแค่ "เนื้อหา" ข้างในลงมาด้วย padding (ที่ทำไปรอบ
          // ก่อน) — วิธีนั้นพื้นหลังสีเขียวของ sheet เองยังทาสีทับ status bar อยู่ดี (padding
          // ไม่ทำให้พื้นหลังหาย มีแค่เนื้อหาข้างในที่ขยับ) ผู้ใช้ต้องการให้ตัว sheet ทั้งก้อน
          // ไม่ล้ำขึ้นไปในโซน status bar เลย จึงต้องลดความสูงของ sheet เอง ให้ขอบบนสุดหยุด
          // อยู่ที่เส้น safe-area พอดี — CardHeader/ปุ่มปิดข้างในเลยกลับไปใช้ตำแหน่งปกติได้
          // (ไม่ต้อง offset เพิ่มเองแล้ว เพราะกรอบ sheet เริ่มต่ำกว่า status bar อยู่แล้ว)
          className={cn(
            "pos-decor-surface h-[calc(100dvh-8px-env(safe-area-inset-top,0px))] max-h-none gap-0 overflow-hidden rounded-t-2xl p-0 data-[side=bottom]:h-[calc(100dvh-8px-env(safe-area-inset-top,0px))]",
            decorBackground
              ? "border-primary-foreground/20 text-primary-foreground"
              : "border-border text-foreground"
          )}
        >
          <SheetTitle className="sr-only">{t("pos.currentCart")}</SheetTitle>
          <OrderCartPanel
            allZones={zones}
            cart={cart}
            loading={loadingCart}
            newOrderFocusKey={newOrderFocusKey}
            printerContext={printerContext}
            showCreateEmployeeOrderAction={false}
            showTableFeatures={showTableFeatures}
            table={selectedTable}
            variant="sheet"
            onCartRefresh={loadCart}
            onPaymentCompleted={handlePaymentComplete}
            onTableActionComplete={handleTableActionComplete}
          />
        </SheetContent>
      </Sheet>

      <ProductOptionsOverlay
        closeDisabled={saving}
        closeLabel={t("actions.close")}
        description={
          selectedProduct
            ? productModeLabel(productMode, selectedProduct, t)
            : ""
        }
        isMobile={isMobile}
        media={
          selectedProduct ? (
            <ProductOptionsMedia product={selectedProduct} />
          ) : null
        }
        open={productSheetOpen}
        subtitle={
          selectedProduct && selectedDetail ? (
            <ProductOptionsSubtitle
              detail={selectedDetail}
              mode={productMode}
              product={selectedProduct}
              unitPrice={modalUnitPrice}
            />
          ) : null
        }
        title={selectedProduct?.prodName ?? t("pos.product")}
        onOpenChange={(nextOpen) => {
          if (saving) return;
          setProductSheetOpen(nextOpen);
        }}
      >
        {selectedProduct && selectedDetail ? (
          <ProductOptionsForm
            modalUnitPrice={modalUnitPrice}
            mode={productMode}
            note={note}
            product={selectedProduct}
            qty={qty}
            saving={saving}
            selectedDetail={selectedDetail}
            selectedSetChildOptionGroupUuids={selectedSetChildOptionGroupUuids}
            selectedSetChoiceUuids={selectedSetChoiceUuids}
            selectedSetChoiceTasteUuids={selectedSetChoiceTasteUuids}
            selectedTastes={selectedTastes}
            selectedToppings={selectedToppings}
            toppingQtyByUuid={toppingQtyByUuid}
            onChangeToppingQty={changeSelectedToppingQty}
            onDetailChange={changeProductDetail}
            onNoteChange={setNote}
            onQtyChange={setQty}
            onSubmit={() => void submitSelectedProduct()}
            onToggleSetChildOption={toggleSetChildOption}
            onToggleSetChoice={toggleSetChoice}
            onToggleSetChoiceTaste={toggleSetChoiceTaste}
            onToggleTaste={toggleSelectedTaste}
            onToggleTopping={toggleSelectedTopping}
          />
        ) : null}
      </ProductOptionsOverlay>
      <DraftExitWarningDialog
        leavePending={draftExitCleanupPending}
        open={draftExitWarningOpen}
        onContinue={onDraftExitContinue}
        onLeaveTable={onDraftExitLeaveTable}
      />
    </div>
  );
}
