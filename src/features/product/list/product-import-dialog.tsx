"use client";

import { AlertCircle, CheckCircle2, FileSpreadsheet, Info, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProductListWorkflow } from "./use-product-list-workflow";

export function ProductImportDialog({ workflow }: { workflow: ProductListWorkflow }) {
  const ready = workflow.importSummary.ready > 0 && !workflow.importing && !workflow.importParsing;
  const busy = workflow.importing || workflow.importParsing;

  return (
    <Dialog
      open={workflow.importDialogOpen}
      onOpenChange={(open) => {
        if (busy) return;
        workflow.setImportDialogOpen(open);
        if (!open) workflow.resetImportState();
      }}
    >
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b border-border px-4 py-4 pr-12 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted text-primary">
              <FileSpreadsheet />
            </span>
            <div className="min-w-0">
              <DialogTitle>{workflow.t("product.import.title")}</DialogTitle>
              <DialogDescription>{workflow.t("product.import.description")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 gap-4 overflow-y-auto px-4 py-4 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] sm:px-6">
          <aside className="flex min-w-0 flex-col gap-4">
            <Field className="rounded-md border bg-muted/20 p-3">
              <FieldLabel htmlFor="product-import-file">{workflow.t("product.import.excelFile")}</FieldLabel>
              <Input
                id="product-import-file"
                accept=".xlsx,.xls"
                disabled={busy}
                type="file"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  void workflow.prepareImportFile(file);
                  event.currentTarget.value = "";
                }}
              />
              <FieldDescription>{workflow.t("product.import.defaultsDescription")}</FieldDescription>
            </Field>

            <Alert>
              <Info />
              <AlertTitle>{workflow.t("product.import.summaryTitle")}</AlertTitle>
              <AlertDescription>{workflow.t("product.import.defaultsDescription")}</AlertDescription>
            </Alert>

            {workflow.importFileName ? (
              <div className="flex min-w-0 flex-col gap-2 rounded-md border p-3 text-sm">
                <Badge className="w-fit max-w-full">
                  <FileSpreadsheet data-icon="inline-start" />
                  <span className="truncate">{workflow.importFileName}</span>
                </Badge>
                <div className="grid grid-cols-3 gap-2">
                  <Badge className="justify-center bg-primary/10 text-primary">
                    {workflow.t("product.import.readyCount", { count: workflow.importSummary.ready })}
                  </Badge>
                  <Badge
                    className={
                      workflow.importSummary.invalid
                        ? "justify-center border-destructive/30 bg-destructive/10 text-destructive"
                        : "justify-center"
                    }
                  >
                    {workflow.t("product.import.invalidCount", { count: workflow.importSummary.invalid })}
                  </Badge>
                  <Badge className="justify-center">
                    {workflow.t("product.import.warningCount", { count: workflow.importSummary.warnings })}
                  </Badge>
                </div>
              </div>
            ) : null}
          </aside>

          <section className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{workflow.t("product.import.previewTitle")}</h3>
              <Badge>{workflow.importSummary.total}</Badge>
            </div>

            {workflow.importResult ? (
              <Alert>
                <AlertCircle />
                <AlertTitle>{workflow.t("product.import.statusTitle")}</AlertTitle>
                <AlertDescription>{workflow.importResult}</AlertDescription>
              </Alert>
            ) : null}

            {workflow.importParsing ? (
              <div className="flex min-h-60 items-center justify-center gap-2 rounded-md border text-sm text-muted-foreground">
                <Spinner />
                {workflow.t("product.import.reading")}
              </div>
            ) : workflow.importDrafts.length ? (
              <div className="max-h-[55vh] overflow-auto rounded-md border">
                <Table className="min-w-[980px]">
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-24">{workflow.t("product.import.sheet")}</TableHead>
                      <TableHead>{workflow.t("product.import.product")}</TableHead>
                      <TableHead>{workflow.t("product.import.category")}</TableHead>
                      <TableHead>{workflow.t("product.import.unit")}</TableHead>
                      <TableHead className="text-right">{workflow.t("product.import.options")}</TableHead>
                      <TableHead className="text-right">{workflow.t("product.import.price")}</TableHead>
                      <TableHead>{workflow.t("product.import.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workflow.importDrafts.map((draft) => {
                      const valid = Boolean(draft.payload) && !draft.errors.length;
                      return (
                        <TableRow key={draft.key}>
                          <TableCell>
                            <Badge>{draft.sheetName}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[18rem]">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{draft.productNameLa || "-"}</p>
                              <p className="truncate text-xs text-muted-foreground">{draft.productCode}</p>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[12rem] truncate">{draft.categoryName || "-"}</TableCell>
                          <TableCell className="max-w-[10rem] truncate">{draft.unitName || "-"}</TableCell>
                          <TableCell className="text-right">{draft.detailCount}</TableCell>
                          <TableCell className="text-right tabular-nums">{draft.salePrice.toLocaleString()}</TableCell>
                          <TableCell className="max-w-[22rem]">
                            {valid ? (
                              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                                <CheckCircle2 data-icon="inline-start" />
                                {workflow.t("product.import.ready")}
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1 text-xs text-destructive">
                                {draft.errors.slice(0, 3).map((error) => (
                                  <span key={error}>{error}</span>
                                ))}
                              </div>
                            )}
                            {draft.warnings.length ? (
                              <p className="mt-1 text-xs text-muted-foreground">{draft.warnings.join(", ")}</p>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </section>
        </div>

        <DialogFooter className="border-t border-border px-4 py-3 sm:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              workflow.setImportDialogOpen(false);
              workflow.resetImportState();
            }}
          >
            {workflow.t("actions.cancel")}
          </Button>
          <Button type="button" disabled={!ready} onClick={() => void workflow.importProductsFromDrafts()}>
            {workflow.importing ? <Spinner data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
            {workflow.t("product.import.importButton", { count: workflow.importSummary.ready })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
