"use client";

import Link from "next/link";
import { PencilLine, Plus, Search, Trash2, Upload } from "lucide-react";
import { AppPagination } from "@/components/common/app-pagination";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { categoryOptionName, categoryUuid } from "./product-list-utils";
import { ProductImportDialog } from "./product-import-dialog";
import { ProductListMobile } from "./product-list-mobile";
import { ProductOrderDialog } from "./product-order-dialog";
import { ProductListTable } from "./product-list-table";
import { ALL_CATEGORIES_VALUE, useProductListWorkflow } from "./use-product-list-workflow";
import { ProductBulkEditDialog } from "./product-bulk-edit-dialog";

// โครงแบบ Data Table ของ shadcn: แท็บประเภท + ปุ่มหลัก → แถบค้นหา/กรอง → ตารางในกรอบ → แถบแบ่งหน้า
// ชื่อหน้ามีอยู่แล้วบนแถบหัวของ app shell จึงไม่แสดงซ้ำในหน้า
export function ProductPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const product = useProductListWorkflow(initialPagination);
  const { t } = product;
  const selectedCount = product.selectedRows.size;
  const bulkBusy = product.bulkEditing || product.bulkDeleting;

  return (
    // จอ md ขึ้นไปตารางสกรอลอยู่ในกรอบของมันเอง (แถบกรอง/แบ่งหน้าค้างอยู่) — จอเล็กทั้งหน้าสกรอลไปด้วยกัน
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 md:overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={product.statusSortFk}
          onValueChange={(value) => {
            if (value) product.changeStatusSort(value);
          }}
        >
          <TabsList aria-label={t("product.type")}>
            {product.statusTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => product.setImportDialogOpen(true)}>
            <Upload data-icon="inline-start" />
            {t("product.import.button")}
          </Button>
          <Link className={buttonVariants()} href="/products/form">
            <Plus data-icon="inline-start" />
            {t("product.newProduct")}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="sm:max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            id="product-search-filter"
            name="product-search-filter"
            aria-label={t("actions.search")}
            aria-invalid={product.highlightSearchFilter || undefined}
            value={product.search}
            placeholder={t("product.searchProducts")}
            onChange={(event) => product.setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") product.applyFilters();
            }}
          />
          {product.loading ? (
            <InputGroupAddon align="inline-end">
              <Spinner />
            </InputGroupAddon>
          ) : (
            <InputGroupAddon align="inline-end">
              <InputGroupButton onClick={product.applyFilters}>{t("actions.search")}</InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <Select
          value={product.cateUuidFk || ALL_CATEGORIES_VALUE}
          disabled={product.categoryLoading}
          open={product.categoryDropdownOpen}
          onOpenChange={product.setCategoryDropdownOpen}
          onValueChange={product.changeCategory}
        >
          <SelectTrigger aria-label={t("nav.category")} aria-invalid={product.highlightCategoryFilter || undefined}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              <SelectItem value={ALL_CATEGORIES_VALUE}>
                {t("common.all")} {t("nav.category")}
              </SelectItem>
              {product.categoryOptions.map((category) => {
                const uuid = categoryUuid(category);
                return (
                  <SelectItem key={uuid} value={uuid}>
                    {categoryOptionName(category, product.language)}
                  </SelectItem>
                );
              })}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={product.orderBy} onValueChange={product.changeOrderBy}>
          <SelectTrigger aria-label={t("common.order")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              <SelectItem value="ASC">{t("product.sortOldest")}</SelectItem>
              <SelectItem value="DESC">{t("product.sortNewest")}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* จอเล็กไม่มีหัวตาราง — ช่องเลือกทั้งหมดมาอยู่ในแถบนี้แทน */}
        {product.filteredRows.length ? (
          <Field orientation="horizontal" className="w-auto md:hidden">
            <Checkbox
              id="product-select-all-mobile"
              checked={product.allSelected}
              onCheckedChange={(checked) => product.toggleAllSelected(checked === true)}
            />
            <FieldLabel htmlFor="product-select-all-mobile">{t("common.selectAll")}</FieldLabel>
          </Field>
        ) : null}

        {/* แถบจัดการที่เลือก โผล่เฉพาะตอนมีรายการถูกเลือก — ไม่กินพื้นที่ตอนไม่ได้ใช้ */}
        {selectedCount ? (
          <div className="flex items-center gap-2 md:ml-auto">
            <span className="text-muted-foreground">{t("common.selectedCount", { count: selectedCount })}</span>
            <ButtonGroup>
              <Button type="button" variant="outline" disabled={bulkBusy} onClick={() => product.setBulkEditOpen(true)}>
                <PencilLine data-icon="inline-start" />
                {t("actions.edit")}
              </Button>
              <Button type="button" variant="outline" disabled={bulkBusy} onClick={() => product.setBulkDeleteOpen(true)}>
                <Trash2 data-icon="inline-start" />
                {t("actions.delete")}
              </Button>
            </ButtonGroup>
            <Button type="button" variant="ghost" disabled={bulkBusy} onClick={product.clearSelection}>
              {t("actions.clear")}
            </Button>
          </div>
        ) : null}
      </div>

      {product.loading ? (
        <LoadingState label={t("product.loading")} variant="productList" />
      ) : product.filteredRows.length ? (
        <>
          <div className="hidden min-h-0 flex-1 flex-col overflow-hidden rounded-lg border md:flex">
            <ProductListTable workflow={product} />
          </div>
          <div className="md:hidden">
            <ProductListMobile workflow={product} />
          </div>
        </>
      ) : (
        <EmptyState title={t("product.noProducts")} description={t("product.createOrSearch")} />
      )}

      <div className="flex flex-wrap items-center gap-4 pb-[max(var(--pos-system-bottom-safe-area,0px),var(--app-shell-bottom-nav-height,0px))]">
        <Field orientation="horizontal" className="w-auto">
          <FieldLabel htmlFor="product-limit-filter">{t("common.rowsPerPage")}</FieldLabel>
          <Select value={String(product.pageLimit)} onValueChange={product.changePageLimit}>
            <SelectTrigger id="product-limit-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                {PAGE_LIMIT_OPTIONS.map((limit) => (
                  <SelectItem key={String(limit)} value={String(limit)}>
                    {limit === "All" ? t("common.all") : limit}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <AppPagination
          className="flex-1"
          page={product.page}
          rangeLabel={t("common.showingRange", {
            start: product.pageStart,
            end: product.pageEnd,
            total: product.total || product.rows.length
          })}
          totalPages={Math.max(1, product.totalPages)}
          onPageChange={product.goToPage}
        />
      </div>

      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        description={t("product.deleteConfirm")}
        open={Boolean(product.deleteTarget)}
        title={t("actions.delete")}
        onConfirm={() => {
          if (product.deleteTarget) void product.remove(product.deleteTarget);
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) product.setDeleteTarget(null);
        }}
      />
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        confirmPending={product.bulkDeleting}
        description={t("product.bulkDeleteConfirm", { count: selectedCount })}
        open={product.bulkDeleteOpen}
        title={t("actions.delete")}
        onConfirm={() => void product.removeSelectedProducts()}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) product.setBulkDeleteOpen(false);
        }}
      />
      <ProductImportDialog workflow={product} />
      <ProductBulkEditDialog workflow={product} />
      <ProductOrderDialog workflow={product} />
    </div>
  );
}
