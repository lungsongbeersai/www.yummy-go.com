"use client";

import { useMemo } from "react";
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
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { optionalString } from "@/lib/values";
import { SelectedTableCartPanel } from "../table-selection/selected-table-cart-panel";
import { productMedia } from "./product-media";
import {
  PRODUCT_GRID_CLASS,
  PRODUCT_GRID_PRELOAD_COUNT,
  productModeLabel,
} from "./order-customer-utils";
import {
  EmployeeCategoryRail,
  EmployeeCategorySidebar,
  EmployeeSearchForm,
  EmployeeMobileHeaderActions,
  EmployeeSortTabs,
} from "./order-customer-menu-components";
import {
  EmployeeProductCard,
  ProductGridSkeleton,
} from "./order-customer-product-card";
import {
  ProductOptionsForm,
  ProductOptionsOverlay,
} from "./order-customer-product-options";
import type { OrderCustomerWorkflow } from "./use-order-customer-workflow";

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
    productMode,
    productSheetOpen,
    printerContext,
    qty,
    refreshAll,
    saving,
    search,
    selectCategory,
    selectedCateUuid,
    selectedDetail,
    selectedProduct,
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
    toppingQtyByUuid,
    zones,
  } = workflow;

  // การ์ดแถวแรกคือ LCP ของหน้านี้ ปล่อยให้ lazy จะดีเลย์ LCP และ Next เตือนตอน dev
  // เคยลองวัดความกว้างกล่องจริงด้วย ResizeObserver มาก่อน แต่ใช้ไม่ได้จริง — หน้านี้ SSR ตอนโหลดครั้งแรก
  // HTML ที่ส่งมาถึงเบราว์เซอร์จึงมี loading attribute ตายตัวไปแล้วก่อน JS จะรันด้วยซ้ำ วัดฝั่ง client
  // จึงช้าเกินไปเสมอ ใช้จำนวนคงที่ที่มากพอแทน (ดูเหตุผลที่ PRODUCT_GRID_PRELOAD_COUNT)
  const preloadImageIndexes = useMemo(() => {
    const indexes = new Set<number>();
    for (const [index, entry] of activeProducts.entries()) {
      if (indexes.size >= PRODUCT_GRID_PRELOAD_COUNT) break;
      if (productMedia(entry.product).type === "image") indexes.add(index);
    }
    return indexes;
  }, [activeProducts]);

  return (
    <div
      data-pos-pattern="true"
      className="relative h-full min-h-0 overflow-hidden bg-[url('/pos/background_wide.webp')] bg-cover bg-top text-foreground"
    >
      <div
        aria-hidden="true"
        data-pos-pattern-overlay="true"
        className="pointer-events-none absolute inset-0 bg-primary/45 dark:bg-black/55"
      />
      <div className="relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden xl:grid-cols-[154px_minmax(0,1fr)_clamp(320px,20vw,360px)]">
        <header className="relative shrink-0 overflow-hidden border-b border-white/15 bg-transparent px-3 py-2 text-white shadow-[0_1px_0_rgb(255_255_255/0.08)] sm:px-3.5 md:py-1.5 xl:col-span-2">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-black/10"
          />
          <div className="relative flex min-w-0 flex-col gap-2 md:hidden">
            <EmployeeSortTabs
              activeSort={activeSort}
              onSortChange={(status) => setActiveSort(status)}
            />
            <div className="flex min-w-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("actions.back")}
                className="size-11 shrink-0 rounded-full bg-white/15 text-white shadow-sm hover:bg-white/25 hover:text-white"
                onClick={openTablesPage}
              >
                <ArrowLeft data-icon="inline-start" />
              </Button>

              <EmployeeSearchForm
                className="flex-1"
                loading={loadingMenu}
                search={search}
                onSearchChange={setSearch}
                onSearchSubmit={() => void submitSearch()}
              />

              <EmployeeMobileHeaderActions
                loading={loadingTables || loadingMenu}
                onRefresh={() => void refreshAll()}
              />
            </div>

            <EmployeeCategoryRail
              categories={categories}
              selectedCateUuid={selectedCateUuid}
              onSelectCategory={(cateUuid) => void selectCategory(cateUuid)}
            />
          </div>

          <div className="relative hidden min-w-0 items-center gap-2 md:flex md:h-11">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("actions.back")}
              className="size-11 shrink-0 rounded-full border border-white/20 bg-white/15 text-white shadow-sm hover:bg-white/25 hover:text-white"
              onClick={openTablesPage}
            >
              <ArrowLeft data-icon="inline-start" />
            </Button>

            <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-[9rem_minmax(10rem,1fr)] lg:grid-cols-[17rem_minmax(14rem,1fr)]">
              <EmployeeSortTabs
                activeSort={activeSort}
                className="w-full"
                onSortChange={(status) => setActiveSort(status)}
              />
              <EmployeeSearchForm
                className="w-full lg:max-w-xl"
                loading={loadingMenu}
                search={search}
                showSearchLabel
                onSearchChange={setSearch}
                onSearchSubmit={() => void submitSearch()}
              />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <LanguageSwitch
                className="size-11 border border-white/25 bg-white/15 text-white shadow-sm hover:bg-white/25 hover:text-white"
                contentAlign="end"
                showShort={false}
                size="icon"
                variant="ghost"
              />
              <ThemeToggle
                className="size-11 border border-white/25 bg-white/15 text-white shadow-sm hover:bg-white/25 hover:text-white"
                size="icon"
                variant="ghost"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("actions.refresh")}
                className="size-11 border border-white/25 bg-white/15 text-white shadow-sm hover:bg-white/25 hover:text-white"
                disabled={loadingTables || loadingMenu}
                onClick={() => void refreshAll()}
              >
                {loadingTables || loadingMenu ? <Spinner /> : <RefreshCcw />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="hidden h-11 border border-white/25 bg-white/15 text-white shadow-sm hover:bg-white/25 hover:text-white sm:inline-flex xl:hidden"
                onClick={() => void openCartSheet()}
              >
                <ShoppingCart data-icon="inline-start" />
                <span className="hidden sm:inline">{t("pos.currentCart")}</span>
                <Badge className="min-w-6 justify-center rounded-full border-white/30 bg-white text-primary">
                  {cartCount}
                </Badge>
              </Button>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 overflow-hidden md:grid-cols-[154px_minmax(0,1fr)] xl:col-span-2">
          <EmployeeCategorySidebar
            categories={categories}
            loading={loadingMenu && !categories.length}
            selectedCateUuid={selectedCateUuid}
            onSelectCategory={(cateUuid) => void selectCategory(cateUuid)}
          />

          <section
            aria-busy={loadingMenu}
            className="relative flex min-h-0 min-w-0 flex-col overflow-hidden"
          >
            <div className="pos-soft-light-zone pos-dark-zone min-h-0 flex-1 overflow-y-auto bg-background p-3 text-foreground sm:p-3.5 lg:p-4">
              {loadingMenu ? (
                <ProductGridSkeleton />
              ) : activeProducts.length ? (
                <div className={cn(PRODUCT_GRID_CLASS, "pb-24 xl:pb-4")}>
                  {activeProducts.map((entry, index) => (
                    <EmployeeProductCard
                      key={`${entry.cateUuid}-${entry.product.prodUuid}-${
                        optionalString(entry.product.proDetailUuid) ??
                        activeSort
                      }`}
                      activeSort={activeSort}
                      disabled={Boolean(loadingProductUuid) || saving}
                      entry={entry}
                      imagePreload={preloadImageIndexes.has(index)}
                      loading={loadingProductUuid === entry.product.prodUuid}
                      onAction={openOrAddProduct}
                    />
                  ))}
                </div>
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

        <aside className="relative col-start-3 row-span-2 row-start-1 hidden min-h-0 overflow-hidden bg-transparent xl:block">
          <div className="relative h-full min-h-0">
            <SelectedTableCartPanel
              allZones={zones}
              cart={cart}
              loading={loadingCart}
              newOrderFocusKey={newOrderFocusKey}
              printerContext={printerContext}
              showCreateEmployeeOrderAction={false}
              showTableFeatures={showTableFeatures}
              table={selectedTable}
              onCartRefresh={loadCart}
              onTableActionComplete={handleTableActionComplete}
            />
          </div>
        </aside>
      </div>

      <Button
        type="button"
        aria-label={t("pos.currentCart")}
        className="pos-safe-bottom-offset fixed right-4 z-40 h-12 max-w-[calc(100vw-2rem)] rounded-full border border-primary/20 bg-primary px-4 text-sm font-black text-primary-foreground shadow-[0_16px_34px_-20px_rgb(15_23_42/0.9)] hover:bg-primary/90 active:scale-[0.98] sm:hidden"
        onClick={() => void openCartSheet()}
      >
        <ShoppingCart data-icon="inline-start" />
        <span className="min-w-0 truncate">{t("pos.currentCart")}</span>
        <Badge className="min-w-6 shrink-0 justify-center rounded-full border-primary-foreground/30 bg-primary-foreground px-1.5 py-0 text-primary">
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
          data-pos-pattern="true"
          side="bottom"
          className="h-[calc(100dvh-8px)] max-h-none gap-0 overflow-hidden rounded-t-2xl border-white/20 bg-[url('/pos/background_wide.webp')] bg-cover bg-top p-0 text-white dark:border-primary/30"
        >
          <SheetTitle className="sr-only">{t("pos.currentCart")}</SheetTitle>
          <SelectedTableCartPanel
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
        open={productSheetOpen}
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
            selectedToppings={selectedToppings}
            toppingQtyByUuid={toppingQtyByUuid}
            onChangeToppingQty={changeSelectedToppingQty}
            onDetailChange={changeProductDetail}
            onNoteChange={setNote}
            onQtyChange={setQty}
            onSubmit={() => void submitSelectedProduct()}
            onToggleTopping={toggleSelectedTopping}
          />
        ) : null}
      </ProductOptionsOverlay>
    </div>
  );
}
