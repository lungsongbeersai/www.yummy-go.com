"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
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
import { ProductListMobile } from "./product-list-mobile";
import { ProductListTable } from "./product-list-table";
import { ALL_CATEGORIES_VALUE, useProductListWorkflow } from "./use-product-list-workflow";

export function ProductPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const product = useProductListWorkflow(initialPagination);
  const { t } = product;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-5">
        <div className="min-w-0">
          <p className="text-sm font-bold text-primary">{t("product.title")}</p>
          <h1 className="mt-1 text-xl font-black">{t("product.menuStock")}</h1>
        </div>
        <Link className={cn(buttonVariants({ size: "sm" }), "shadow-sm")} href="/product/form">
          <Plus data-icon="inline-start" />
          {t("product.newProduct")}
        </Link>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-b-0">
        <CardHeader className="shrink-0 border-t border-border/70 bg-muted/10 px-4 py-3 lg:px-5">
          <div className="grid w-full gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)] xl:items-end">
            <section className="grid min-w-0 gap-2 md:grid-cols-[minmax(18rem,1fr)_minmax(12rem,18rem)_minmax(7rem,9rem)]">
              <Field className="gap-1">
                <FieldLabel htmlFor="product-search-filter" className="text-xs font-bold text-muted-foreground">
                  {t("actions.search")}
                </FieldLabel>
                <InputGroup className="h-10 bg-background">
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
                <FieldLabel htmlFor="product-category-filter" className="text-xs font-bold text-muted-foreground">
                  {t("nav.category")}
                </FieldLabel>
                <Select
                  value={product.cateUuidFk || ALL_CATEGORIES_VALUE}
                  disabled={product.categoryLoading}
                  onValueChange={product.changeCategory}
                >
                  <SelectTrigger id="product-category-filter" className="h-10 w-full bg-background">
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
                <FieldLabel htmlFor="product-limit-filter" className="text-xs font-bold text-muted-foreground">
                  {t("common.rowsPerPage")}
                </FieldLabel>
                <Select value={String(product.pageLimit)} onValueChange={product.changePageLimit}>
                  <SelectTrigger id="product-limit-filter" className="h-10 w-full bg-background">
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
                <FieldLabel className="text-xs font-bold text-muted-foreground">{t("product.type")}</FieldLabel>
                <ToggleGroup
                  type="single"
                  value={product.statusSortFk}
                  aria-label={t("product.type")}
                  className="grid h-10 w-full max-w-xl grid-cols-3 rounded-md border border-border bg-background p-1 xl:max-w-none"
                  onValueChange={(value) => {
                    if (value) product.changeStatusSort(value);
                  }}
                >
                  {product.statusTabs.map((tab) => (
                    <ToggleGroupItem
                      key={tab.value}
                      value={tab.value}
                      size="sm"
                      className="h-8 min-w-0 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
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
              <LoadingState label={t("product.loading")} variant="table" />
            </div>
          ) : product.filteredRows.length ? (
            <>
              {product.selectedRows.size ? (
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-primary/5 px-4 py-2 text-sm">
                  <Badge className="bg-primary/10 text-primary">
                    {t("common.selectedCount", { count: product.selectedRows.size })}
                  </Badge>
                  <Button type="button" size="xs" variant="ghost" onClick={product.clearSelection}>
                    {t("actions.clear")}
                  </Button>
                </div>
              ) : null}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-2 md:hidden">
                <label className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <Checkbox
                    aria-label={t("common.selectAll")}
                    checked={product.allSelected}
                    onChange={(event) => product.toggleAllSelected(event.target.checked)}
                  />
                  <span className="truncate">{t("common.selectAll")}</span>
                </label>
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
              <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {t("common.showingRange", {
                    start: product.pageStart,
                    end: product.pageEnd,
                    total: product.total || product.rows.length
                  })}
                </span>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex">
                  <Button
                    className="min-w-0"
                    disabled={!product.canGoBack}
                    size="xs"
                    type="button"
                    variant="outline"
                    onClick={() => product.goToPage(product.page - 1)}
                  >
                    <ChevronLeft data-icon="inline-start" />
                    {t("actions.back")}
                  </Button>
                  <Badge className="h-7 px-2 text-xs">
                    {t("common.page", { current: product.page, total: Math.max(1, product.totalPages) })}
                  </Badge>
                  <Button
                    className="min-w-0"
                    disabled={!product.canGoNext}
                    size="xs"
                    type="button"
                    variant="outline"
                    onClick={() => product.goToPage(Math.min(Math.max(1, product.totalPages), product.page + 1))}
                  >
                    {t("common.nextPage")}
                    <ChevronRight data-icon="inline-end" />
                  </Button>
                </div>
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
    </div>
  );
}
