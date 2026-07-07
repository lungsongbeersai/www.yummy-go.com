"use client";

import Link from "next/link";
import { FileSpreadsheet, PencilLine, Plus, Search } from "lucide-react";
import { AppPagination } from "@/components/common/app-pagination";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { cn } from "@/lib/utils";
import { categoryOptionName, categoryUuid } from "./product-list-utils";
import { ProductImportDialog } from "./product-import-dialog";
import { ProductListMobile } from "./product-list-mobile";
import { ProductListTable } from "./product-list-table";
import { ALL_CATEGORIES_VALUE, useProductListWorkflow } from "./use-product-list-workflow";
import { ProductBulkEditDialog } from "./product-bulk-edit-dialog";

export function ProductPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const product = useProductListWorkflow(initialPagination);
  const { t } = product;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-2.5 lg:gap-3 lg:px-5 lg:py-3">
        <div className="min-w-0">
          <p className="text-base font-black text-primary">{t("product.title")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className="shadow-sm" onClick={() => product.setImportDialogOpen(true)}>
            <FileSpreadsheet data-icon="inline-start" />
            {t("product.import.button")}
          </Button>
          <Link className={cn(buttonVariants({ size: "sm" }), "shadow-sm")} href="/product/form">
            <Plus data-icon="inline-start" />
            {t("product.newProduct")}
          </Link>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-b-0">
        <CardHeader className="shrink-0 border-t border-border/70 bg-muted/10 px-4 py-2 lg:px-5 lg:py-3">
          <div className="grid w-full gap-2 lg:gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)] xl:items-end">
            <section className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-[minmax(18rem,1fr)_minmax(12rem,18rem)_minmax(7rem,9rem)]">
              <Field className="col-span-2 gap-1 md:col-span-1">
                <FieldLabel htmlFor="product-search-filter" className="sr-only text-xs font-bold text-muted-foreground md:not-sr-only">
                  {t("actions.search")}
                </FieldLabel>
                <InputGroup className="h-9 bg-background md:h-10">
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="product-search-filter"
                    name="product-search-filter"
                    value={product.search}
                    placeholder={t("product.searchProducts")}
                    onChange={(event) => product.setSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") product.applyFilters();
                    }}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="sm"
                      variant="ghost"
                      disabled={product.loading}
                      aria-label={t("actions.search")}
                      onClick={product.applyFilters}
                    >
                      {product.loading ? <Spinner data-icon="inline-start" /> : <Search data-icon="inline-start" />}
                      <span className="hidden sm:inline">{t("actions.search")}</span>
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <Field className="gap-1">
                <FieldLabel htmlFor="product-category-filter" className="sr-only text-xs font-bold text-muted-foreground md:not-sr-only">
                  {t("nav.category")}
                </FieldLabel>
                <Select
                  value={product.cateUuidFk || ALL_CATEGORIES_VALUE}
                  disabled={product.categoryLoading}
                  onValueChange={product.changeCategory}
                >
                  <SelectTrigger id="product-category-filter" className="h-9 w-full bg-background md:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" align="end">
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
              </Field>
              <Field className="gap-1">
                <FieldLabel htmlFor="product-limit-filter" className="sr-only text-xs font-bold text-muted-foreground md:not-sr-only">
                  {t("common.rowsPerPage")}
                </FieldLabel>
                <Select value={String(product.pageLimit)} onValueChange={product.changePageLimit}>
                  <SelectTrigger id="product-limit-filter" className="h-9 w-full bg-background md:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" align="end">
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
            </section>
            <section className="flex w-full min-w-0 justify-start xl:justify-end">
              <Field className="w-full min-w-0 gap-1">
                <FieldLabel className="sr-only text-xs font-bold text-muted-foreground md:not-sr-only">{t("product.type")}</FieldLabel>
                <ToggleGroup
                  type="single"
                  value={product.statusSortFk}
                  aria-label={t("product.type")}
                  className="grid h-9 w-full max-w-xl grid-cols-3 rounded-md border border-border bg-background p-1 md:h-10 xl:max-w-none"
                  onValueChange={(value) => {
                    if (value) product.changeStatusSort(value);
                  }}
                >
                  {product.statusTabs.map((tab) => (
                    <ToggleGroupItem
                      key={tab.value}
                      value={tab.value}
                      size="sm"
                      className="h-7 min-w-0 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground md:h-8"
                    >
                      <span className="truncate">{tab.label}</span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
            </section>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {product.loading ? (
            <div className="min-h-0 flex-1 p-4">
              <LoadingState label={t("product.loading")} variant="productList" />
            </div>
          ) : product.filteredRows.length ? (
            <>
              {product.selectedRows.size ? (
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-primary/5 px-4 py-2 text-sm">
                  <Badge className="bg-primary/10 text-primary">
                    {t("common.selectedCount", { count: product.selectedRows.size })}
                  </Badge>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="xs" variant="outline" disabled={product.bulkEditing} onClick={() => product.setBulkEditOpen(true)}>
                      <PencilLine data-icon="inline-start" />
                      {t("actions.edit")}
                    </Button>
                    <Button type="button" size="xs" variant="ghost" disabled={product.bulkEditing} onClick={product.clearSelection}>
                      {t("actions.clear")}
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-2 md:hidden">
                <Label className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <Checkbox
                    aria-label={t("common.selectAll")}
                    checked={product.allSelected}
                    onChange={(event) => product.toggleAllSelected(event.target.checked)}
                  />
                  <span className="truncate">{t("common.selectAll")}</span>
                </Label>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t("common.showingRange", {
                    start: product.pageStart,
                    end: product.pageEnd,
                    total: product.total || product.rows.length
                  })}
                </span>
              </div>
              <ProductListTable workflow={product} />
              <ProductListMobile workflow={product} />
              <div className="shrink-0 border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-sm text-muted-foreground">
                <AppPagination
                  page={product.page}
                  totalPages={Math.max(1, product.totalPages)}
                  onPageChange={product.goToPage}
                />
              </div>
            </>
          ) : (
            <div className="flex min-h-72 flex-1 items-center justify-center p-4">
              <EmptyState title={t("product.noProducts")} description={t("product.createOrSearch")} />
            </div>
          )}
        </CardContent>
      </Card>

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
      <ProductImportDialog workflow={product} />
      <ProductBulkEditDialog workflow={product} />
    </div>
  );
}
