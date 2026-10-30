"use client";

import Link from "next/link";
import { Check, CircleAlert, Printer, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { internalRoute } from "@/lib/routes";
import { useDepositStore, type DepositReceiptState } from "@/stores/deposit-store";
import { useToastStore } from "@/stores/toast-store";
import { formatDepositDate, formatDepositQuantity } from "../deposit-order-items";

export function DepositReceiptStatus({ receipt, onClose }: { receipt: DepositReceiptState; onClose: () => void }) {
  const { t } = useTranslation();
  const printing = useDepositStore((state) => state.printing);
  const reprinting = useDepositStore((state) => state.reprinting);
  const reprintReceipt = useDepositStore((state) => state.reprintReceipt);
  const showToast = useToastStore((state) => state.show);
  const busy = printing || reprinting;
  const pending = receipt.outcome === "pending";
  const printFailed = receipt.outcome === "error" || receipt.outcome === "skipped";
  const reasonKey = receipt.reasonCode === "DEPOSIT_PRINTER_NOT_CONFIGURED" ? "deposit.missingDepositPrinter"
    : receipt.reasonCode === "DOCUMENT_PRINT_DEVICE_REQUIRED" ? "deposit.printerDeviceRequired"
    : receipt.reasonCode === "DOCUMENT_PRINTER_UNAVAILABLE" ? "deposit.printerUnavailable" : null;

  async function printAgain() {
    try { await reprintReceipt(); }
    catch (error) { showToast({ title: t("deposit.receiptPrintFailed"), description: error instanceof Error ? error.message : "", tone: "error" }); }
  }

  return <>
    <div className="min-h-0 flex flex-col gap-5 overflow-y-auto px-5 py-5 sm:px-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-success/10 text-success-text"><Check className="size-5" /></span>
        <div><h3 className="text-base font-semibold">{t(receipt.kind === "withdrawal" ? "deposit.withdrawSuccess" : "deposit.createSuccess")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{receipt.customerName || receipt.deposits[0]?.customer_name || "—"}{receipt.customerPhone ? " · " + receipt.customerPhone : ""}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("deposit.depositNo")}: <span className="font-mono text-foreground">{receipt.depositNos.join(", ") || "—"}</span></p>
        </div>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border px-4">
        {receipt.deposits.map((row) => <div key={row.deposit_uuid} className="flex items-start justify-between gap-4 py-3 text-sm">
          <div className="min-w-0"><p className="font-medium">{row.product_name}</p><p className="mt-1 text-xs text-muted-foreground">{t("deposit.productCode")}: <span className="font-mono">{row.product_code || "—"}</span></p>
            <p className="mt-1 text-xs text-muted-foreground">{t("deposit.expireDate")}: {formatDepositDate(row.expire_date)}</p></div>
          <div className="shrink-0 text-right"><p className="font-medium tabular-nums">{formatDepositQuantity(receipt.kind === "withdrawal" ? Number(receipt.withdrawal?.qty_withdrawn || 0) : row.deposit_qty)} {row.unit_name}</p>
            {receipt.kind === "withdrawal" ? <p className="mt-1 text-xs text-muted-foreground">{t("deposit.remaining")}: {formatDepositQuantity(Number(receipt.withdrawal?.qty_after ?? row.remaining_qty))} {row.unit_name}</p> : null}</div>
        </div>)}
      </div>
      <Alert role="status" className={printFailed ? "border-warning/40 bg-warning/5" : undefined}>
        {busy ? <Spinner /> : printFailed ? <CircleAlert /> : <Printer />}
        <AlertTitle>{t(busy ? "deposit.receiptPrinting" : printFailed ? "deposit.receiptSavedPrintNeeded" : pending ? "deposit.receiptPending" : "deposit.receiptPrinted")}</AlertTitle>
        <AlertDescription>
          <p>{t(printFailed ? "deposit.receiptRetryHint" : pending ? "deposit.receiptPendingHint" : "deposit.receiptSavedHint")}</p>
          {receipt.printerName ? <p className="mt-1">{t("deposit.receiptPrinter")}: {receipt.printerName}</p> : null}
          {printFailed && (reasonKey || receipt.message) ? <p className="mt-1 break-words">{reasonKey ? t(reasonKey) : receipt.message}</p> : null}
          {receipt.outcome === "skipped" ? <Link href={internalRoute("/printers")} onClick={onClose} className="mt-2 inline-block font-medium text-primary-text underline underline-offset-4">{t("deposit.configurePrinter")}</Link> : null}
        </AlertDescription>
      </Alert>
    </div>
    <DialogFooter className="shrink-0 border-t border-border bg-background px-5 py-4 sm:px-6">
      <Button type="button" variant="outline" className="h-10" disabled={busy} onClick={() => void printAgain()}>
        {busy ? <Spinner /> : pending ? <RefreshCw className="size-4" /> : <Printer className="size-4" />}
        {t(pending ? "deposit.checkPrintStatus" : "deposit.reprintReceipt")}
      </Button>
      <Button type="button" className="h-10" disabled={busy} onClick={onClose}>{t("deposit.done")}</Button>
    </DialogFooter>
  </>;
}
