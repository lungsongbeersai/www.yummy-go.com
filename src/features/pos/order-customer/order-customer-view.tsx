"use client";

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
import { optionalString } from "../table-selection/utils";
import { SelectedTableCartPanel } from "../table-selection/selected-table-cart-panel";
import { PRODUCT_GRID_CLASS, productModeLabel } from "./order-customer-utils";
import {
  EmployeeCategoryRail,
  EmployeeCategorySidebar,
  EmployeeSearchForm,
  EmployeeMenuControlDock,
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
    openTablesPage,
    productMode,
    productSheetOpen,
    qty,
    refreshAll,
    saving,
    search,
    selectCategory,
    selectedCateUuid,
    selectedDetail,
    selectedListProduct,
    selectedProduct,
    selectedTable,
    selectedToppings,
    setActiveSort,
    setCartSheetOpen,
    setNote,
    setProductSheetOpen,
    setQty,
    setSearch,
    submitSearch,
    submitSelectedProduct,
    t,
    toggleSelectedTopping,
    toppingUuids,
    zones,
  } = workflow;

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-[url('/pos/background_wide.webp')] bg-cover bg-top text-foreground">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-primary/45 dark:bg-black/55" />
      <div className="relative grid h-full min-h-0 overflow-hidden md:grid-cols-[136px_minmax(0,1fr)] xl:grid-cols-[136px_minmax(0,1fr)_clamp(340px,24vw,420px)]">
        <EmployeeCategorySidebar
          categories={categories}
          loading={loadingMenu && !categories.length}
          selectedCateUuid={selectedCateUuid}
          onBack={openTablesPage}
          onSelectCategory={(cateUuid) => void selectCategory(cateUuid)}
        />

        <section className="relative flex min-h-0 min-w-0 flex-col overflow-hidden">
          <header className="relative shrink-0 overflow-hidden bg-transparent px-3 py-2 text-white sm:px-4">
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

            <div className="relative hidden min-w-0 items-center gap-2 md:flex">
              <EmployeeMenuControlDock
                activeSort={activeSort}
                loading={loadingMenu}
                search={search}
                onSearchChange={setSearch}
                onSearchSubmit={() => void submitSearch()}
                onSortChange={(status) => setActiveSort(status)}
              />

              <div className="flex shrink-0 items-center gap-2">
                <LanguageSwitch
                  className="border border-white/25 bg-white/15 text-white shadow-sm hover:bg-white/25 hover:text-white"
                  contentAlign="end"
                  showShort={false}
                  size="icon"
                  variant="ghost"
                />
                <ThemeToggle
                  className="border border-white/25 bg-white/15 text-white shadow-sm hover:bg-white/25 hover:text-white"
                  size="icon"
                  variant="ghost"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("actions.refresh")}
                  className="border border-white/25 bg-white/15 text-white shadow-sm hover:bg-white/25 hover:text-white"
                  disabled={loadingTables || loadingMenu}
                  onClick={() => void refreshAll()}
                >
                  {loadingTables || loadingMenu ? <Spinner /> : <RefreshCcw />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="hidden border border-white/25 bg-white/15 text-white shadow-sm hover:bg-white/25 hover:text-white sm:inline-flex xl:hidden"
                  onClick={() => setCartSheetOpen(true)}
                >
                  <ShoppingCart data-icon="inline-start" />
                  <span className="hidden sm:inline">
                    {t("pos.currentCart")}
                  </span>
                  <Badge className="min-w-6 justify-center rounded-full border-white/30 bg-white text-primary">
                    {cartCount}
                  </Badge>
                </Button>
              </div>
            </div>
          </header>

          <div className="pos-soft-light-zone pos-dark-zone min-h-0 flex-1 overflow-y-auto bg-background p-3 text-foreground sm:p-4 lg:p-5">
            {loadingMenu ? (
              <ProductGridSkeleton />
            ) : activeProducts.length ? (
              <div className={cn(PRODUCT_GRID_CLASS, "pb-24 xl:pb-4")}>
                {activeProducts.map((entry) => (
                  <EmployeeProductCard
                    key={`${entry.cateUuid}-${entry.product.prod_uuid}-${optionalString(entry.product.pro_detail_uuid) ?? activeSort}`}
                    activeSort={activeSort}
                    entry={entry}
                    loading={
                      loadingProductUuid === entry.product.prod_uuid || saving
                    }
                    onAction={() => void openOrAddProduct(entry)}
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
                  <EmptyDescription>{t("empty.adjustSearch")}</EmptyDescription>
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

        <aside className="relative hidden min-h-0 overflow-hidden bg-transparent xl:block">
          <div className="relative h-full min-h-0">
            <SelectedTableCartPanel
              allZones={zones}
              cart={cart}
              loading={loadingCart}
              newOrderFocusKey={newOrderFocusKey}
              showCreateEmployeeOrderAction={false}
              table={selectedTable}
              onCartRefresh={loadCart}
              onTableActionComplete={handleTableActionComplete}
            />
          </div>
        </aside>
      </div>

      <Button
        type="button"
        className="pos-safe-bottom-offset fixed right-4 h-12 rounded-full border border-white/20 bg-black/45 px-4 text-white shadow-lg hover:bg-white/10 sm:hidden"
        onClick={() => setCartSheetOpen(true)}
      >
        <ShoppingCart data-icon="inline-start" />
        {t("pos.currentCart")}
        <Badge className="min-w-6 justify-center rounded-full border-white/30 bg-white px-1.5 py-0 text-black">
          {cartCount}
        </Badge>
      </Button>

      <Sheet open={cartSheetOpen} onOpenChange={setCartSheetOpen}>
        <SheetContent
          side="bottom"
          className="h-[calc(100dvh-8px)] max-h-none gap-0 overflow-hidden rounded-t-2xl border-white/20 bg-[url('/pos/background_wide.webp')] bg-cover bg-top p-0 text-white dark:border-primary/30"
        >
          <SheetTitle className="sr-only">{t("pos.currentCart")}</SheetTitle>
          <SelectedTableCartPanel
            allZones={zones}
            cart={cart}
            loading={loadingCart}
            newOrderFocusKey={newOrderFocusKey}
            showCreateEmployeeOrderAction={false}
            table={selectedTable}
            variant="sheet"
            onCartRefresh={loadCart}
            onTableActionComplete={handleTableActionComplete}
          />
        </SheetContent>
      </Sheet>

      <ProductOptionsOverlay
        description={
          selectedProduct
            ? productModeLabel(productMode, selectedProduct, t)
            : ""
        }
        isMobile={isMobile}
        open={productSheetOpen}
        title={selectedProduct?.prod_name ?? t("pos.product")}
        onOpenChange={(nextOpen) => {
          if (saving) return;
          setProductSheetOpen(nextOpen);
        }}
      >
        {selectedProduct && selectedListProduct && selectedDetail ? (
          <ProductOptionsForm
            activeSort={activeSort}
            listProduct={selectedListProduct}
            modalUnitPrice={modalUnitPrice}
            mode={productMode}
            note={note}
            product={selectedProduct}
            qty={qty}
            saving={saving}
            selectedDetail={selectedDetail}
            selectedToppings={selectedToppings}
            toppingUuids={toppingUuids}
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
