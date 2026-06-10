"use client";

import dynamic from "next/dynamic";
import { ReceiptText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { PosZone } from "@/services/pos";
import {
  CartDiscountDialog,
  CartNoteDialog,
  CartPanelLoading,
  ConfirmAllLoadingDialog,
} from "./cart-dialogs";
import { CartSummaryDock } from "./cart-summary-dock";
import { CartTabItems, CartTabTrigger } from "./cart-items";
import { CustomerDisplayPickerDialog } from "./customer-display-picker-dialog";
import type { SelectedTableCartPanelWorkflow } from "./hooks/use-selected-table-cart-panel-workflow";
import type { PaymentDialogProps } from "./payment-dialog";
import { TableActionsOverlay } from "./table-actions-overlay";
import { TableQrDialog } from "./table-qr-dialog";
import { cartItemActionUuid } from "./utils";

const PaymentDialog = dynamic<PaymentDialogProps>(
  () => import("./payment-dialog").then((mod) => mod.PaymentDialog),
  {
    ssr: false,
    loading: () => <PaymentDialogLoadingFallback />,
  },
);

function PaymentDialogLoadingFallback() {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
      aria-busy="true"
    >
      <Card className="w-full max-w-[320px] rounded-lg border-white/20 bg-background text-center shadow-xl">
        <CardContent className="flex flex-col items-center gap-3 p-4">
          <div className="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary">
            <Spinner className="text-primary" />
          </div>
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    </div>
  );
}

export function SelectedTableCartPanelContent({
  allZones,
  loading,
  onTableActionComplete,
  showCreateEmployeeOrderAction,
  variant,
  workflow,
}: {
  allZones: PosZone[];
  loading: boolean;
  onTableActionComplete: (nextTableUuid?: string) => Promise<void>;
  showCreateEmployeeOrderAction: boolean;
  variant: "side" | "sheet";
  workflow: SelectedTableCartPanelWorkflow;
}) {
  const { t } = useTranslation();
  const selectedTable = workflow.selectedTable;
  const customerDisplay = workflow.customerDisplay;

  return (
    <Card
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden border-0 bg-transparent text-white shadow-none",
        variant === "side"
          ? "rounded-none border-l border-primary/15"
          : "rounded-t-2xl",
      )}
    >
      <Tabs
        value={workflow.activeTab}
        onValueChange={workflow.handleTabChange}
        className="contents"
      >
        <CardHeader
          className={cn(
            "relative block shrink-0 overflow-hidden border-b border-white/10 px-4 pb-3 pt-4 text-white dark:bg-black/25",
            variant === "sheet" && "px-4 pb-2.5 pt-3 pr-12",
          )}
        >
          <div className="relative flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p
                className={cn(
                  "flex min-w-0 items-center gap-2 truncate font-black text-white",
                  variant === "sheet"
                    ? "text-[17px] leading-5"
                    : "text-[19px] leading-6",
                )}
              >
                <ReceiptText className="size-5 shrink-0" />
                <span className="truncate">
                  {selectedTable
                    ? `${t("nav.table")}: ${selectedTable.table_name}`
                    : t("pos.selectTableToContinue")}
                </span>
              </p>
              {workflow.invoice ? (
                <p className="truncate text-[11px] font-bold leading-4 text-white/75">
                  {t("pos.invoice")}: {workflow.invoice}
                </p>
              ) : null}
            </div>
            <Badge className="h-8 shrink-0 rounded-full border-white/20 bg-white/15 px-3 text-xs font-black text-white shadow-none">
              {t("common.total")}: {workflow.visibleItemCount}
            </Badge>
          </div>

          <TabsList
            className={cn(
              "pos-soft-light-zone grid w-full grid-cols-2 rounded-xl bg-white/15 p-1 text-white shadow-inner backdrop-blur-sm",
              variant === "sheet" ? "mt-2.5 h-11" : "mt-3 h-11.5",
            )}
          >
            <CartTabTrigger
              active={workflow.activeTab === "new"}
              count={workflow.newOrderItems.length}
              disabled={!workflow.hasSelectedTable}
              label={t("pos.newOrder")}
              value="new"
            />
            <CartTabTrigger
              active={workflow.activeTab === "history"}
              count={workflow.historyItems.length}
              disabled={!workflow.hasSelectedTable}
              label={t("pos.orderHistory")}
              value="history"
            />
          </TabsList>
        </CardHeader>

        <CardContent className="pos-soft-light-zone pos-dark-zone relative min-h-0 flex-1 overflow-hidden bg-background p-0 text-foreground">
          {loading ? (
            <CartPanelLoading />
          ) : (
            <div className="h-full min-h-0 overflow-y-auto bg-muted/35 dark:bg-background">
              <TabsContent value="new">
                <CartTabItems
                  editable
                  actingItemUuid={workflow.actingItemUuid}
                  actionDisabled={workflow.cartActionsLocked}
                  canConfirmKitchenItem={workflow.canConfirmKitchenItem}
                  items={workflow.newOrderItems}
                  updatingItemUuid={workflow.updatingItemUuid}
                  onChangeQty={workflow.changeCartItemQty}
                  onConfirmKitchen={workflow.confirmSingleItemToKitchen}
                  onConfirmServed={workflow.markItemServed}
                  onEditNote={workflow.openNoteDialog}
                  onItemDiscount={workflow.openItemDiscountDialog}
                  onOpenItemAction={workflow.openItemAction}
                />
              </TabsContent>
              <TabsContent value="history">
                <CartTabItems
                  actingItemUuid={workflow.actingItemUuid}
                  actionDisabled={workflow.cartActionsLocked}
                  canConfirmKitchenItem={workflow.canConfirmKitchenItem}
                  items={workflow.historyItems}
                  canSplitItem={workflow.canSplitItem}
                  splitSelectionDisabled={!workflow.canSelectSplitItems}
                  splitSelectedItemUuids={workflow.splitSelectedItemUuids}
                  updatingItemUuid={workflow.updatingItemUuid}
                  onChangeQty={workflow.changeCartItemQty}
                  onConfirmKitchen={workflow.confirmSingleItemToKitchen}
                  onConfirmServed={workflow.markItemServed}
                  onEditNote={workflow.openNoteDialog}
                  onItemDiscount={workflow.openItemDiscountDialog}
                  onOpenItemAction={workflow.openItemAction}
                  onToggleSplitItem={workflow.toggleSplitItem}
                />
              </TabsContent>
            </div>
          )}
        </CardContent>

        <CardFooter className="pos-safe-bottom-padding block shrink-0 border-t border-white/15 bg-transparent px-3 pt-2 text-white dark:bg-black/25">
          <CartSummaryDock
            actionsDisabled={!workflow.hasSelectedTable}
            billDiscountValueLabel={workflow.billDiscountValueLabel}
            canConfirm={workflow.canConfirm}
            canApplyBillDiscount={
              Boolean(workflow.currentOrderUuid) && !workflow.cartActionsLocked
            }
            canPay={workflow.canPayBill}
            canPaySplitSelection={workflow.canPaySplitSelection}
            compact={variant === "sheet"}
            confirming={workflow.confirming}
            discountPending={workflow.billDiscountPending}
            newOrderCount={workflow.newOrderItems.length}
            serviceLabel={workflow.serviceLabel}
            splitSelectedCount={workflow.splitSelectedCount}
            splitSelectedTotal={workflow.splitSelectedTotal}
            fullSummary={workflow.summary}
            summary={workflow.displaySummary}
            taxLabel={workflow.taxLabel}
            onBillDiscount={workflow.openBillDiscountDialog}
            onConfirm={() => void workflow.confirmNewOrder()}
            onCreateEmployeeOrder={
              showCreateEmployeeOrderAction
                ? workflow.openEmployeeOrderPage
                : undefined
            }
            onCreateTableQr={workflow.openTableQr}
            onCustomerDisplay={() =>
              void customerDisplay.openCustomerDisplayScreen()
            }
            onPayBill={workflow.openFullPayment}
            onPaySplitSelection={workflow.requestSelectedSplitPayment}
            onTableActions={workflow.openTableActions}
          />
        </CardFooter>
      </Tabs>
      {selectedTable ? (
        <TableActionsOverlay
          branchUuid={workflow.user?.branch_uuid}
          fallbackZones={allZones}
          language={workflow.language}
          open={workflow.tableActionsOpen}
          table={selectedTable}
          variant={variant}
          onCompleted={onTableActionComplete}
          onOpenChange={workflow.setTableActionsOpen}
        />
      ) : null}
      {selectedTable ? (
        <TableQrDialog
          open={workflow.tableQrOpen}
          table={selectedTable}
          onOpenChange={workflow.setTableQrOpen}
        />
      ) : null}
      <CustomerDisplayPickerDialog
        canCloseCustomerDisplay={customerDisplay.canCloseCustomerDisplay}
        browserDisplayInfo={customerDisplay.browserDisplayInfo}
        displayInfo={customerDisplay.displayInfo}
        error={customerDisplay.error}
        loading={customerDisplay.loading}
        mode={customerDisplay.mode}
        open={customerDisplay.open}
        opening={customerDisplay.opening}
        selectedBrowserScreenKey={customerDisplay.selectedBrowserScreenKey}
        selectedDisplayId={customerDisplay.selectedDisplayId}
        onCloseCustomerDisplay={() =>
          void customerDisplay.closeCustomerDisplayScreen()
        }
        onOpenBrowserDisplay={customerDisplay.openBrowserDisplayFromDialog}
        onOpenChange={customerDisplay.setOpen}
        onOpenSelectedBrowserDisplay={
          customerDisplay.openSelectedBrowserDisplay
        }
        onOpenSelectedDisplay={() =>
          void customerDisplay.openSelectedElectronDisplay()
        }
        onRefresh={() => void customerDisplay.refreshDisplays()}
        onSelectedBrowserScreenChange={
          customerDisplay.setSelectedBrowserScreenKey
        }
        onSelectedDisplayChange={customerDisplay.setSelectedDisplayId}
      />
      {selectedTable && workflow.paymentContext ? (
        <PaymentDialog
          open
          orders={workflow.paymentContext.orders}
          paymentKind={workflow.paymentContext.kind}
          splitBillItemUuids={
            workflow.paymentContext.splitBillItemUuids ?? []
          }
          summary={workflow.paymentContext.summary}
          table={selectedTable}
          onCompleted={workflow.handlePaymentCompleted}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) workflow.setPaymentContext(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmDisabled={!workflow.actionTargetUuid}
        confirmLabel={t("pos.cancelItem")}
        confirmPending={Boolean(workflow.actingItemUuid)}
        description={t("pos.cancelItemConfirm")}
        open={Boolean(workflow.itemActionTarget)}
        title={t("pos.cancelItem")}
        onConfirm={() => void workflow.confirmItemAction()}
        onOpenChange={(nextOpen) => {
          if (workflow.actingItemUuid) return;
          if (!nextOpen) workflow.setItemActionTarget(null);
        }}
      />
      <CartNoteDialog
        note={workflow.noteDraft}
        open={Boolean(workflow.noteTarget)}
        pending={Boolean(
          workflow.actingItemUuid &&
            workflow.noteTarget &&
            cartItemActionUuid(workflow.noteTarget) === workflow.actingItemUuid,
        )}
        onNoteChange={workflow.setNoteDraft}
        onOpenChange={(nextOpen) => {
          if (workflow.actingItemUuid) return;
          if (!nextOpen) workflow.setNoteTarget(null);
        }}
        onSubmit={() => void workflow.saveNote()}
      />
      <CartDiscountDialog
        draft={workflow.itemDiscountDraft}
        maxAmount={workflow.itemDiscountMaxAmount}
        open={Boolean(workflow.itemDiscountTarget)}
        pending={Boolean(
          workflow.actingItemUuid &&
            workflow.itemDiscountTarget &&
            cartItemActionUuid(workflow.itemDiscountTarget) ===
              workflow.actingItemUuid,
        )}
        submitDisabled={workflow.itemDiscountValue === null}
        title={t("pos.itemDiscount")}
        onDraftChange={workflow.setItemDiscountDraft}
        onOpenChange={(nextOpen) => {
          if (workflow.actingItemUuid) return;
          if (!nextOpen) workflow.setItemDiscountTarget(null);
        }}
        onSubmit={() => void workflow.saveItemDiscount()}
      />
      <CartDiscountDialog
        draft={workflow.billDiscountDraft}
        maxAmount={workflow.billDiscountMaxAmount}
        open={workflow.billDiscountOpen}
        pending={workflow.billDiscountPending}
        submitDisabled={
          !workflow.currentOrderUuid || workflow.billDiscountValue === null
        }
        title={t("pos.billDiscount")}
        onDraftChange={workflow.setBillDiscountDraft}
        onOpenChange={(nextOpen) => {
          if (workflow.billDiscountPending) return;
          workflow.setBillDiscountOpen(nextOpen);
        }}
        onSubmit={() => void workflow.saveBillDiscount()}
      />
      <ConfirmAllLoadingDialog progress={workflow.confirmAllProgress} />
    </Card>
  );
}
