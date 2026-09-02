"use client";

import { useEffect, useMemo, useRef } from "react";
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
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import { cn } from "@/lib/utils";
import { optionalString } from "@/lib/values";
import { useNativeHeaderStore } from "@/stores/native-header-store";
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

// สี white/black แบบ glass เดิมออกแบบไว้สำหรับพื้นหลังรูปภาพโหมดสว่างเท่านั้น (bg_wide.webp)
// โหมดมืดไม่มีรูปพื้นหลัง (dark:bg-none dark:bg-background) เลยเหลือแต่กระจกใสซ้อนพื้นเข้ม
// เกือบดำ มองแทบไม่เห็นขอบ/พื้นปุ่ม จึงต้องมี dark: ทับด้วย token การ์ดปกติของแอป
// Capacitor (neutral) ใช้ token การ์ดแบบเดียวกันนี้ตรง ๆ เสมอ ไม่ผูกกับ dark: เพราะพื้นหลัง
// เป็น bg-background ธรรมดา (ไม่มีรูป) ทั้งสองโหมดอยู่แล้ว — ดู isCapacitorNativeApp ด้านล่าง
function headerIconButtonClass(neutral: boolean) {
  return cn(
    "size-11 shrink-0 rounded-full border shadow-sm",
    neutral
      ? "border-border bg-card text-foreground hover:bg-accent hover:text-foreground"
      : "border-white/25 bg-white/15 text-white hover:bg-white/25 hover:text-white dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-accent dark:hover:text-foreground"
  );
}

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

  const isCapacitorNativeApp = useIsCapacitorNativeApp();
  const setHeaderRefreshAction = useNativeHeaderStore((state) => state.setRefreshAction);
  const setHeaderTitle = useNativeHeaderStore((state) => state.setTitle);
  // refreshAll ไม่ได้ห่อ useCallback ในตัว workflow เอง (ได้ reference ใหม่ทุก render) —
  // เก็บ latest ไว้ใน ref แทนใส่ใน deps ตรง ๆ กัน effect ลงทะเบียนด้านล่างยิงซ้ำทุก render
  // โดยไม่จำเป็น — อัปเดต ref ผ่าน effect เปล่า (ไม่ใช่ระหว่าง render ตรง ๆ) ตามกฎ
  // react-hooks/refs
  const refreshAllRef = useRef(refreshAll);
  useEffect(() => {
    refreshAllRef.current = refreshAll;
  });

  // ปุ่มรีเฟรช/ภาษา/ธีมเดิมอยู่ในเมนู "..." ของแถวค้นหา ซึ่งซ้ำกับสิ่งที่ NativeTopBar
  // มีให้อยู่แล้วบน Capacitor (ตามที่ตกลงไว้) — ลงทะเบียนปุ่มรีเฟรชเข้า top bar แทน
  // ผ่าน store กลาง (เหมือนที่ทำไว้กับหน้า table-selection)
  useEffect(() => {
    if (!isCapacitorNativeApp) return;
    setHeaderRefreshAction({
      loading: loadingTables || loadingMenu,
      onClick: () => void refreshAllRef.current(),
    });
    return () => setHeaderRefreshAction(null);
  }, [isCapacitorNativeApp, loadingTables, loadingMenu, setHeaderRefreshAction]);

  // โชว์ชื่อโต๊ะ (เช่น "T01") ใน top bar แทนหัวข้อ static "ອໍເດີລູກຄ້າ" ของ route —
  // ผู้ใช้ต้องดูออกไวว่ากำลังสั่งให้โต๊ะไหนอยู่ ไม่ใช่แค่ชื่อหน้าเฉย ๆ
  useEffect(() => {
    if (!isCapacitorNativeApp) return;
    setHeaderTitle(selectedTable?.table_name || null);
    return () => setHeaderTitle(null);
  }, [isCapacitorNativeApp, selectedTable, setHeaderTitle]);

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
      // ไม่ใส่ attribute data-pos-pattern เลยบน Capacitor (ไม่ใช่แค่เปลี่ยน class) เพราะ
      // .android-webview-compat [data-pos-pattern] ใน globals.css บังคับรูปพื้นหลังกลับมา
      // ด้วย !important จาก attribute selector ตัวนี้โดยตรง ต่อให้ class ไม่มีรูปแล้วก็ตาม
      {...(!isCapacitorNativeApp ? { "data-pos-pattern": "true" } : {})}
      className={cn(
        "relative h-full min-h-0 overflow-hidden text-foreground",
        isCapacitorNativeApp
          // Capacitor ใช้พื้นหลังปกติของแอป (ขาว/การ์ดตามธีม) ไม่ใช่สี primary อีกต่อไป —
          // header/sort-tabs/search ผ่าน prop neutral ให้ใช้ text/สีแบบเดียวกับ dark: token
          // เดิมตรง ๆ (อ่านออกชัวร์บนพื้นขาวอยู่แล้ว) แทนสีขาวที่ออกแบบไว้สำหรับพื้นเข้ม/รูปภาพ
          ? "bg-background"
          : "bg-[url('/pos/background_wide.webp')] bg-cover bg-top dark:bg-none dark:bg-background",
      )}
    >
      {!isCapacitorNativeApp ? (
        <div
          aria-hidden="true"
          data-pos-pattern-overlay="true"
          className="pointer-events-none absolute inset-0 bg-primary/45 dark:hidden"
        />
      ) : null}
      <div className="relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:grid-cols-[154px_minmax(0,1fr)_clamp(320px,20vw,360px)]">
        <header
          className={cn(
            "relative shrink-0 overflow-hidden border-b px-3 sm:px-3.5 lg:col-span-2",
            isCapacitorNativeApp
              ? "border-border py-1 text-foreground"
              : "border-white/15 bg-transparent py-2 text-white shadow-[0_1px_0_rgb(255_255_255/0.08)] lg:py-1.5"
          )}
        >
          {!isCapacitorNativeApp ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-black/10"
            />
          ) : null}
          <div
            className={cn(
              "relative flex min-w-0 flex-col lg:hidden",
              isCapacitorNativeApp ? "gap-1.5" : "gap-2"
            )}
          >
            <EmployeeSortTabs
              activeSort={activeSort}
              neutral={isCapacitorNativeApp}
              onSortChange={(status) => setActiveSort(status)}
            />
            {/* ปุ่มย้อนกลับ + เมนู "..." (ภาษา/ธีม/รีเฟรช) ซ้ำกับ NativeTopBar บน
                Capacitor เท่านั้น — ฝั่งเว็บยังไม่มี header ของ shell ให้หน้านี้ (immersive
                screen) จึงต้องเก็บไว้เหมือนเดิม (ปุ่มรีเฟรชย้ายไปลงทะเบียนเข้า top bar
                แทนแล้วด้านบน) */}
            <div className="flex min-w-0 items-center gap-2">
              {!isCapacitorNativeApp ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("actions.back")}
                  className="size-11 shrink-0 rounded-full bg-white/15 text-white shadow-sm hover:bg-white/25 hover:text-white dark:bg-card dark:text-foreground dark:hover:bg-accent dark:hover:text-foreground"
                  onClick={openTablesPage}
                >
                  <ArrowLeft data-icon="inline-start" />
                </Button>
              ) : null}

              <EmployeeSearchForm
                className="flex-1"
                loading={loadingMenu}
                neutral={isCapacitorNativeApp}
                search={search}
                onSearchChange={setSearch}
                onSearchSubmit={() => void submitSearch()}
              />

              {!isCapacitorNativeApp ? (
                <EmployeeMobileHeaderActions
                  loading={loadingTables || loadingMenu}
                  onRefresh={() => void refreshAll()}
                />
              ) : null}
            </div>

            <EmployeeCategoryRail
              categories={categories}
              neutral={isCapacitorNativeApp}
              selectedCateUuid={selectedCateUuid}
              onSelectCategory={(cateUuid) => void selectCategory(cateUuid)}
            />
          </div>

          <div className="relative hidden min-w-0 items-center gap-2 lg:flex lg:h-11">
            {/* Capacitor's NativeTopBar already carries back / refresh / notif —
                on native, only the sort tabs + search belong in this row. */}
            {!isCapacitorNativeApp ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("actions.back")}
                className={headerIconButtonClass(isCapacitorNativeApp)}
                onClick={openTablesPage}
              >
                <ArrowLeft data-icon="inline-start" />
              </Button>
            ) : null}

            <div className="grid min-w-0 flex-1 grid-cols-[17rem_minmax(14rem,1fr)] gap-2">
              <EmployeeSortTabs
                activeSort={activeSort}
                className="w-full"
                neutral={isCapacitorNativeApp}
                onSortChange={(status) => setActiveSort(status)}
              />
              <EmployeeSearchForm
                className="w-full lg:max-w-xl"
                loading={loadingMenu}
                neutral={isCapacitorNativeApp}
                search={search}
                showSearchLabel
                onSearchChange={setSearch}
                onSearchSubmit={() => void submitSearch()}
              />
            </div>

            {!isCapacitorNativeApp ? (
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <LanguageSwitch
                  className={headerIconButtonClass(isCapacitorNativeApp)}
                  compact
                  size="icon"
                  variant="ghost"
                />
                <ThemeToggle
                  className={headerIconButtonClass(isCapacitorNativeApp)}
                  size="icon"
                  variant="ghost"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("actions.refresh")}
                  className={headerIconButtonClass(isCapacitorNativeApp)}
                  disabled={loadingTables || loadingMenu}
                  onClick={() => void refreshAll()}
                >
                  {loadingTables || loadingMenu ? <Spinner /> : <RefreshCcw />}
                </Button>
              </div>
            ) : null}
          </div>
        </header>

        <div className="grid min-h-0 overflow-hidden md:grid-cols-[154px_minmax(0,1fr)] lg:col-span-2">
          <EmployeeCategorySidebar
            categories={categories}
            loading={loadingMenu && !categories.length}
            neutral={isCapacitorNativeApp}
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
                <div className={cn(PRODUCT_GRID_CLASS, "pb-24 lg:pb-4")}>
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

        <aside className="relative col-start-3 row-span-2 row-start-1 hidden min-h-0 overflow-hidden bg-transparent lg:block">
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
        className="pos-safe-bottom-offset fixed right-4 z-40 h-12 max-w-[calc(100vw-2rem)] rounded-md border border-primary/20 bg-primary px-4 text-sm font-black text-primary-foreground shadow-[0_16px_34px_-20px_rgb(15_23_42/0.9)] hover:bg-primary/90 active:scale-[0.98] lg:hidden"
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
          // cart sheet ใช้รูปพื้นหลังต่อ (ต่างจาก container หลักที่ตัดรูปออกบน Capacitor
          // ตามที่ขอ) — ยังคง data-pos-pattern ไว้ทุกแพลตฟอร์มเหมือนเดิม
          data-pos-pattern="true"
          side="bottom"
          // ลบ env(safe-area-inset-top) ออกจากความสูงทั้งก้อน แทนที่จะปล่อยให้ sheet กาง
          // ไปทับ status bar แล้วค่อยดันแค่ "เนื้อหา" ข้างในลงมาด้วย padding (ที่ทำไปรอบ
          // ก่อน) — วิธีนั้นพื้นหลังสีเขียวของ sheet เองยังทาสีทับ status bar อยู่ดี (padding
          // ไม่ทำให้พื้นหลังหาย มีแค่เนื้อหาข้างในที่ขยับ) ผู้ใช้ต้องการให้ตัว sheet ทั้งก้อน
          // ไม่ล้ำขึ้นไปในโซน status bar เลย จึงต้องลดความสูงของ sheet เอง ให้ขอบบนสุดหยุด
          // อยู่ที่เส้น safe-area พอดี — CardHeader/ปุ่มปิดข้างในเลยกลับไปใช้ตำแหน่งปกติได้
          // (ไม่ต้อง offset เพิ่มเองแล้ว เพราะกรอบ sheet เริ่มต่ำกว่า status bar อยู่แล้ว)
          className="h-[calc(100dvh-8px-env(safe-area-inset-top,0px))] max-h-none gap-0 overflow-hidden rounded-t-2xl border-white/20 bg-[image:linear-gradient(color-mix(in_oklch,var(--primary)_45%,transparent),color-mix(in_oklch,var(--primary)_45%,transparent)),url('/pos/background_wide.webp')] bg-cover bg-top p-0 text-white data-[side=bottom]:h-[calc(100dvh-8px-env(safe-area-inset-top,0px))] dark:border-primary/30 dark:bg-none dark:bg-background"
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
