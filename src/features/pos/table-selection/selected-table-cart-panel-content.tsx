"use client";

import dynamic from "next/dynamic";
import { ReceiptText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PrintLoadingDialog } from "@/components/common/print-loading-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { useIsNativeShellActive } from "@/hooks/use-native-shell-active";
import { cn } from "@/lib/utils";
import type { PosZone } from "@/services/pos";
import { useAuthStore } from "@/stores/auth-store";
import { DepositDialog } from "@/features/sales/deposit/deposit-dialog";
import { BranchMenuQrDialog } from "./branch-menu-qr-dialog";
import {
  CancelItemLoadingDialog,
  CartDiscountDialog,
  CartNoteDialog,
  CartPanelLoading,
  CartQuantityDialog,
  ConfirmAllLoadingDialog,
  ConfirmItemLoadingDialog,
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
  }
);

function PaymentDialogLoadingFallback() {
  const { t } = useTranslation();

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-[320px] text-center"
        aria-busy="true"
      >
        <DialogTitle className="sr-only">{t("common.loading")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("pos.paymentDialogLoadingDescription")}
        </DialogDescription>
        <div className="flex flex-col items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary">
            <Spinner className="text-primary" />
          </div>
          <Skeleton className="h-3 w-32" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SelectedTableCartPanelContent({
  allZones,
  loading,
  onTableActionComplete,
  showCreateEmployeeOrderAction,
  showTableFeatures = true,
  variant,
  workflow,
}: {
  allZones: PosZone[];
  loading: boolean;
  onTableActionComplete: (nextTableUuid?: string) => Promise<void>;
  showCreateEmployeeOrderAction: boolean;
  showTableFeatures?: boolean;
  variant: "side" | "sheet";
  workflow: SelectedTableCartPanelWorkflow;
}) {
  const { t } = useTranslation();
  const selectedTable = workflow.selectedTable;
  const customerDisplay = workflow.customerDisplay;
  const nativeShellActive = useIsNativeShellActive();
  // Native landscape ใช้ side panel ค้างขวา: คืนพื้นเขียวลายใบไม้เฉพาะหัว/ท้ายตาม cart sheet
  // แนวตั้ง แต่ให้ CardContent ทึบสีขาวคั่นกลาง จึงคงธีมขาว–เขียวและไม่รบกวนการอ่านรายการ
  // ใช้ useIsNativeShellActive แทนเช็ก Capacitor ตรง ๆ เพื่อให้ scope ตรงกับ shell ที่แสดงจริง
  const neutral = nativeShellActive && variant === "side";
  const isNoTableStore = useAuthStore(
    (state) => state.user?.store_table_status === 2
  );
  // ร้านไม่มีโต๊ะ: create_order สร้างรายการด้วยสถานะยืนยันแล้วเสมอ (ไม่ผ่าน
  // สถานะ "ใหม่/รอยืนยัน") จึงไม่มี tab ให้แยก — รวมเป็นลิสต์เดียว
  const counterCartItems = isNoTableStore
    ? [...workflow.newOrderDisplayItems, ...workflow.historyItems]
    : [];
  // สั่งเพิ่มสินค้าแต่ละครั้งจะเรียก loadCart รีเฟรชตะกร้าใหม่เสมอ ถ้าโชว์
  // skeleton ทุกครั้งที่ loading จะเห็นรายการเดิมหายวับแล้วโผล่กลับมาทุกครั้ง (กระพริบ)
  // จึงโชว์ skeleton เฉพาะตอนโหลดครั้งแรกที่ยังไม่มีรายการอะไรให้เห็นเลย
  const hasCartItems = isNoTableStore
    ? counterCartItems.length > 0
    : workflow.newOrderDisplayItems.length > 0 ||
      workflow.historyItems.length > 0;
  const cancellingItem = Boolean(
    workflow.actingItemUuid && workflow.itemActionTarget?.action === "cancel"
  );

  return (
    <Card
      data-pos-pattern={neutral ? "true" : undefined}
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden border-0 bg-transparent text-white shadow-none",
        variant === "side"
          ? "rounded-none border-l border-primary/15"
          : "rounded-t-2xl",
        neutral &&
          "border-primary/30 bg-primary bg-[url('/posAll/background_wide.webp')] bg-cover bg-top pb-0 text-primary-foreground dark:border-border dark:bg-none dark:bg-background dark:text-foreground"
      )}
    >
      {neutral ? (
        <div
          aria-hidden="true"
          data-pos-pattern-overlay="true"
          className="pointer-events-none absolute inset-0 bg-primary/30 dark:hidden"
        />
      ) : null}
      <Tabs
        value={workflow.activeTab}
        onValueChange={workflow.handleTabChange}
        // A real flex column, not `display: contents`. Older iOS Safari/WKWebView
        // mishandles a display:contents flex item, so the middle list never got a
        // bounded height and the header/footer scrolled with it instead of
        // staying pinned. `gap-0` keeps the previous spacing.
        className="relative z-10 flex min-h-0 flex-1 flex-col gap-0"
      >
        <CardHeader
          data-pos-cart-sheet-header={variant === "sheet" ? "true" : undefined}
          className={cn(
            "relative block shrink-0 overflow-hidden border-b",
            neutral
              ? "border-white/15 bg-primary/25 text-primary-foreground dark:border-border dark:bg-card dark:text-foreground"
              : "border-white/10 text-white dark:bg-black/25",
            variant === "side" ? "px-3 pb-2 pt-2.5" : "px-4 pb-2.5 pt-3 pr-12"
          )}
        >
          {/* min-h กันความสูงลดฮวบตอนไม่มีเลขบิล (ไม่งั้นจะเตี้ยกว่า header หลักฝั่งซ้าย
              ที่ยึดความสูงจากปุ่มไอคอน size-11 — ให้ตรงกับ md:h-11 ของ header ฝั่งนั้น) */}
          <div className="relative flex min-h-9.5 min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p
                className={cn(
                  "flex min-w-0 items-center gap-2 truncate text-base font-black leading-5",
                  neutral
                    ? "text-primary-foreground dark:text-foreground"
                    : "text-white"
                )}
              >
                <ReceiptText className="size-5 shrink-0" />
                <span className="truncate">
                  {selectedTable
                    ? isNoTableStore
                      ? selectedTable.table_name
                      : `${t("nav.table")}: ${selectedTable.table_name}`
                    : isNoTableStore
                    ? t("pos.counterCartEmpty")
                    : t("pos.selectTableToContinue")}
                </span>
              </p>
              {workflow.invoice ? (
                <p
                  className={cn(
                    "truncate text-2xs font-bold leading-4",
                    neutral
                      ? "text-primary-foreground/80 dark:text-muted-foreground"
                      : "text-white/75"
                  )}
                >
                  {t("pos.invoice")}: {workflow.invoice}
                </p>
              ) : null}
            </div>
            <Badge
              className={cn(
                "shrink-0 rounded-full font-semibold tabular-nums shadow-none",
                neutral
                  ? "border-white/25 bg-white/15 text-primary-foreground dark:border-border dark:bg-muted dark:text-foreground"
                  : "border-white/20 bg-white/15 text-white",
                variant === "side" ? "h-7 px-2.5 text-2xs" : "h-8 px-3 text-xs"
              )}
            >
              {t("pos.itemCount", { count: workflow.visibleItemCount })}
            </Badge>
          </div>

          {isNoTableStore ? null : (
            <TabsList
              className={cn(
                // pos-soft-light-zone ต้องมาคู่กับ pos-dark-zone เสมอ (ดู CardContent ด้านล่าง) —
                // ถ้ามีแค่ pos-soft-light-zone อย่างเดียว --foreground จะค้างค่าโหมดสว่าง (เกือบดำ)
                // แม้อยู่ในโหมดมืด ทำให้ตัวอักษรแท็บที่ active (ใช้ text-foreground จาก TabsTrigger
                // เดิม) เป็นสีดำมองไม่เห็นบนพื้นเข้ม — จุดนี้เคยตกหล่นไปตอนก๊อปคลาสมา
                // overflow-hidden กัน focus ring/box-shadow ของ trigger แต่ละอันทะลุออกนอก
                // มุมโค้ง rounded-xl ของแถบทั้งก้อน (trigger เองโค้งแค่ rounded-lg เล็กกว่า)
                //
                // native side ใช้พื้นเขียวลายใบไม้ จึงใช้ track ขาวโปร่งและข้อความขาวเหมือน sheet
                // โดยให้ active tab เป็น primary ทึบเพื่อเห็นสถานะชัดเจน
                // gap-1 — TabsTrigger ฐานปัดมุมโค้งครบ 4 มุมทุกด้าน (rounded-lg) ไม่ใช่แค่มุมนอก
                // เดิมไม่มี gap คั่นระหว่าง 2 เซลล์ grid เลย แท็บทั้งสองเลยชนกันสนิท ตรงรอยต่อ
                // มุมโค้งของทั้งคู่หันเข้าหากันจึงเผยพื้นหลังแทร็ก (bg-muted) เป็นรอยบากรูปโบว์ไท
                // เล็ก ๆ แทรกอยู่ตรงกลาง เห็นชัดเป็นพิเศษตอนแท็บ active ทึบสีเขียว — ดูเหมือนมีอะไร
                // มาบัง/กัดขอบปุ่ม ใส่ gap คั่นแยกให้แต่ละแท็บเป็นก้อนอิสระ ตัดปัญหาที่ต้นตอ
                neutral
                  ? "grid w-full grid-cols-2 gap-1 overflow-hidden rounded-xl border border-white/20 bg-white/15 p-1 text-primary-foreground shadow-inner backdrop-blur-sm dark:border-border dark:bg-muted dark:text-foreground"
                  : "pos-soft-light-zone pos-dark-zone grid w-full grid-cols-2 gap-1 overflow-hidden rounded-xl bg-white/15 p-1 text-white shadow-inner backdrop-blur-sm",
                variant === "side"
                  ? "mt-2 h-14 group-data-horizontal/tabs:h-14"
                  : "mt-2.5 h-11 group-data-horizontal/tabs:h-11"
              )}
            >
              <CartTabTrigger
                active={workflow.activeTab === "new"}
                count={workflow.newOrderDisplayItems.length}
                disabled={!workflow.hasSelectedTable}
                label={t("pos.newOrder")}
                neutral={neutral}
                shortLabel={t("pos.newOrderShort")}
                value="new"
              />
              <CartTabTrigger
                active={workflow.activeTab === "history"}
                count={workflow.historyItems.length}
                disabled={!workflow.hasSelectedTable}
                label={t("pos.orderHistory")}
                neutral={neutral}
                shortLabel={t("pos.orderHistoryShort")}
                value="history"
              />
            </TabsList>
          )}
        </CardHeader>

        <CardContent className="pos-soft-light-zone pos-dark-zone relative min-h-0 flex-1 overflow-hidden bg-background p-0 text-foreground">
          {loading && !hasCartItems ? (
            <CartPanelLoading />
          ) : (
            <div
              className={cn(
                "h-full min-h-0 overflow-y-auto overscroll-contain dark:bg-background",
                neutral ? "bg-background" : "bg-muted/35"
              )}
            >
              {isNoTableStore ? (
                <CartTabItems
                  compact={variant === "side"}
                  actingItemUuid={workflow.actingItemUuid}
                  actionDisabled={workflow.cartActionsLocked}
                  canConfirmKitchenItem={workflow.canConfirmKitchenItem}
                  canItemDiscount={workflow.canManageDiscounts}
                  items={counterCartItems}
                  canSplitItem={workflow.canSplitItem}
                  splitSelectionDisabled={!workflow.canSelectSplitItems}
                  splitSelectedItemUuids={workflow.splitSelectedItemUuids}
                  quantityOverrides={workflow.quantityOverrides}
                  updatingItemUuid={workflow.updatingItemUuid}
                  onChangeQty={workflow.changeCartItemQty}
                  onConfirmKitchen={workflow.confirmSingleItemToKitchen}
                  onConfirmServed={workflow.markItemServed}
                  onEditNote={workflow.openNoteDialog}
                  onItemDiscount={workflow.openItemDiscountDialog}
                  onOpenItemAction={workflow.openItemAction}
                  onOpenQuantityDialog={workflow.openQuantityDialog}
                  onReprintKitchen={workflow.reprintSingleItemToKitchen}
                  onSetSplitItemQuantity={workflow.setSplitItemQuantity}
                  onToggleSplitItem={workflow.toggleSplitItem}
                />
              ) : (
                <>
                  <TabsContent value="new">
                    <CartTabItems
                      editable
                      compact={variant === "side"}
                      actingItemUuid={workflow.actingItemUuid}
                      actionDisabled={workflow.cartActionsLocked}
                      canConfirmKitchenItem={workflow.canConfirmKitchenItem}
                      canMutateItem={workflow.canMutateItem}
                      canItemDiscount={workflow.canManageDiscounts}
                      items={workflow.newOrderDisplayItems}
                      quantityOverrides={workflow.quantityOverrides}
                      updatingItemUuid={workflow.updatingItemUuid}
                      onChangeQty={workflow.changeCartItemQty}
                      onConfirmKitchen={workflow.confirmSingleItemToKitchen}
                      onConfirmServed={workflow.markItemServed}
                      onEditNote={workflow.openNoteDialog}
                      onItemDiscount={workflow.openItemDiscountDialog}
                      onOpenItemAction={workflow.openItemAction}
                      onOpenQuantityDialog={workflow.openQuantityDialog}
                      onReprintKitchen={workflow.reprintSingleItemToKitchen}
                    />
                  </TabsContent>
                  <TabsContent value="history">
                    <CartTabItems
                      compact={variant === "side"}
                      actingItemUuid={workflow.actingItemUuid}
                      actionDisabled={workflow.cartActionsLocked}
                      canConfirmKitchenItem={workflow.canConfirmKitchenItem}
                      canItemDiscount={workflow.canManageDiscounts}
                      items={workflow.historyItems}
                      canSplitItem={workflow.canSplitItem}
                      splitSelectionDisabled={!workflow.canSelectSplitItems}
                      splitSelectedItemUuids={workflow.splitSelectedItemUuids}
                      quantityOverrides={workflow.quantityOverrides}
                      updatingItemUuid={workflow.updatingItemUuid}
                      onChangeQty={workflow.changeCartItemQty}
                      onConfirmKitchen={workflow.confirmSingleItemToKitchen}
                      onConfirmServed={workflow.markItemServed}
                      onEditNote={workflow.openNoteDialog}
                      onItemDiscount={workflow.openItemDiscountDialog}
                      onOpenItemAction={workflow.openItemAction}
                      onOpenQuantityDialog={workflow.openQuantityDialog}
                      onReprintKitchen={workflow.reprintSingleItemToKitchen}
                      onSetSplitItemQuantity={workflow.setSplitItemQuantity}
                      onToggleSplitItem={workflow.toggleSplitItem}
                    />
                  </TabsContent>
                </>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter
          className={cn(
            "pos-safe-bottom-padding block shrink-0 border-t",
            neutral
              ? "border-white/15 bg-primary/25 text-primary-foreground dark:border-border dark:bg-card dark:text-foreground"
              : "border-white/15 bg-transparent text-white dark:bg-black/25",
            variant === "side" ? "px-2.5 pt-1.5" : "px-3 pt-2"
          )}
        >
          <CartSummaryDock
            actionsDisabled={!workflow.hasSelectedTable}
            neutral={neutral}
            billDiscountValueLabel={workflow.billDiscountValueLabel}
            canConfirm={workflow.canConfirm}
            canApplyBillDiscount={
              Boolean(workflow.currentOrderUuid) &&
              !workflow.cartActionsLocked &&
              workflow.canManageDiscounts
            }
            canPay={workflow.canPayBill}
            canPaySplitSelection={workflow.canPaySplitSelection}
            compact={variant === "side"}
            confirming={workflow.confirming}
            discountPending={workflow.billDiscountPending}
            newOrderCount={workflow.newOrderItems.length}
            splitSelectedCount={workflow.splitSelectedCount}
            splitSelectedTotal={workflow.splitSelectedTotal}
            summary={workflow.displaySummary}
            taxLabel={workflow.taxLabel}
            onBillDiscount={workflow.openBillDiscountDialog}
            onConfirm={() => void workflow.confirmNewOrder()}
            onCreateEmployeeOrder={
              showCreateEmployeeOrderAction
                ? workflow.openEmployeeOrderPage
                : undefined
            }
            onCreateTableQr={
              showTableFeatures ? workflow.openTableQr : undefined
            }
            onCreateBranchMenuQr={workflow.openBranchMenuQr}
            onCreateDeposit={() => workflow.setDepositDialogOpen(true)}
            onCustomerDisplay={() =>
              void customerDisplay.openCustomerDisplayScreen()
            }
            onPayBill={workflow.openFullPayment}
            onPaySplitSelection={workflow.requestSelectedSplitPayment}
            onTableActions={
              showTableFeatures ? workflow.openTableActions : undefined
            }
          />
        </CardFooter>
      </Tabs>
      {selectedTable && showTableFeatures ? (
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
      {selectedTable && showTableFeatures ? (
        <TableQrDialog
          open={workflow.tableQrOpen}
          table={selectedTable}
          onOpenChange={workflow.setTableQrOpen}
        />
      ) : null}
      <BranchMenuQrDialog
        open={workflow.branchMenuQrOpen}
        onOpenChange={workflow.setBranchMenuQrOpen}
      />
      <DepositDialog
        branchUuid={workflow.user?.branch_uuid}
        defaultTab="create"
        open={workflow.depositDialogOpen}
        orderItems={workflow.displayItems}
        orderUuid={workflow.currentOrderUuid ?? undefined}
        onCompleted={onTableActionComplete}
        onOpenChange={workflow.setDepositDialogOpen}
      />
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
      {selectedTable &&
      workflow.paymentContext?.tableUuid === selectedTable.table_uuid ? (
        <PaymentDialog
          hasRealTable={showTableFeatures}
          open
          orders={workflow.paymentContext.orders}
          paymentKind={workflow.paymentContext.kind}
          splitBillItemUuids={workflow.paymentContext.splitBillItemUuids ?? []}
          summary={workflow.paymentContext.summary}
          table={selectedTable}
          onCompleted={workflow.handlePaymentCompleted}
          onTransferAccountQrChange={workflow.setPaymentAccountQrUrl}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) workflow.setPaymentContext(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmDisabled={!workflow.actionTargetUuid}
        confirmLabel={t("pos.deleteItem")}
        confirmPending={Boolean(workflow.actingItemUuid)}
        description={t("pos.deleteItemConfirm")}
        open={workflow.itemActionTarget?.action === "delete"}
        title={t("pos.deleteItem")}
        onConfirm={() => void workflow.confirmItemAction()}
        onOpenChange={(nextOpen) => {
          if (workflow.actingItemUuid) return;
          if (!nextOpen) workflow.setItemActionTarget(null);
        }}
      />
      <CartQuantityDialog
        item={
          workflow.itemActionTarget?.action === "cancel" &&
          !workflow.actionTargetIsSet
            ? workflow.itemActionTarget.item
            : null
        }
        open={
          workflow.itemActionTarget?.action === "cancel" &&
          !workflow.actionTargetIsSet &&
          !cancellingItem
        }
        pending={Boolean(workflow.actingItemUuid)}
        purpose="cancel"
        onOpenChange={(nextOpen) => {
          if (workflow.actingItemUuid) return;
          if (!nextOpen) workflow.setItemActionTarget(null);
        }}
        onSubmit={(qty) => void workflow.confirmItemAction(qty)}
      />
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmDisabled={!workflow.actionTargetUuid}
        confirmLabel={t("pos.cancelItem")}
        confirmPending={Boolean(workflow.actingItemUuid)}
        description={t("pos.cancelItemConfirm")}
        open={
          workflow.itemActionTarget?.action === "cancel" &&
          workflow.actionTargetIsSet &&
          !cancellingItem
        }
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
            cartItemActionUuid(workflow.noteTarget) === workflow.actingItemUuid
        )}
        onNoteChange={workflow.setNoteDraft}
        onOpenChange={(nextOpen) => {
          if (workflow.actingItemUuid) return;
          if (!nextOpen) workflow.setNoteTarget(null);
        }}
        onSubmit={() => void workflow.saveNote()}
      />
      <CartQuantityDialog
        item={workflow.quantityTarget}
        open={Boolean(workflow.quantityTarget)}
        pending={workflow.quantityPending}
        onOpenChange={(nextOpen) => {
          if (workflow.quantityPending) return;
          if (!nextOpen) workflow.setQuantityTarget(null);
        }}
        onSubmit={(qty) => void workflow.submitQuantityChange(qty)}
      />
      <CartDiscountDialog
        draft={workflow.itemDiscountDraft}
        maxAmount={workflow.itemDiscountMaxAmount}
        open={Boolean(workflow.itemDiscountTarget)}
        pending={Boolean(
          workflow.actingItemUuid &&
            workflow.itemDiscountTarget &&
            cartItemActionUuid(workflow.itemDiscountTarget) ===
              workflow.actingItemUuid
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
      <ConfirmAllLoadingDialog
        open={workflow.confirming}
        progress={workflow.confirmAllProgress}
      />
      <ConfirmItemLoadingDialog stage={workflow.confirmingItemStage} />
      <CancelItemLoadingDialog open={cancellingItem} />
      <PrintLoadingDialog open={Boolean(workflow.printingItemUuid)} />
    </Card>
  );
}
