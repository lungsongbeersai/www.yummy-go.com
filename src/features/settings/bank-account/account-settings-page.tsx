"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CreditCard, GripVertical, Landmark } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SettingsListPageLayout } from "@/features/settings/shared/settings-list-page-layout";
import { SettingsEmptyRecords, SettingsRowActions } from "@/features/settings/shared/settings-shell";
import type { Bank, BranchAccount, SaveBranchAccountInput } from "@/services/bank-account";
import type { Branch } from "@/services/branch";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBankAccountStore } from "@/stores/bank-account-store";
import { useToastStore } from "@/stores/toast-store";
import { cn } from "@/lib/utils";
import { canManageBranchAccounts, ROLE_STATUS } from "@/lib/permissions";
import { createSessionGuard } from "@/stores/session-store-registry";
import { AccountFormDialog } from "./bank-account-form-dialogs";
import { accountBelongsToBranch, accountBranchOptions, accountBranchUuid } from "./account-branch-scope";
import { useClientSettingsList } from "./use-client-settings-list";

const accountId = (account: BranchAccount) => account.account_uuid;
const accountSearchText = (account: BranchAccount) => `${account.account_name} ${account.account_number} ${account.bank_name_la} ${account.bank_name_eng}`;

function branchName(branch: Branch, language: string) {
  return (language.startsWith("en") ? branch.branch_name_eng : branch.branch_name_la)
    || branch.branch_name
    || branch.branch_name_la
    || branch.branch_name_eng
    || "—";
}

function bankName(account: BranchAccount, language: string) {
  return (language.startsWith("en") ? account.bank_name_eng : account.bank_name_la)
    || account.bank_name_la
    || account.bank_name_eng;
}

type AccountTableProps = {
  allSelected: boolean;
  dragEnabled: boolean;
  language: string;
  pageStart: number;
  rows: BranchAccount[];
  selectedRows: Set<string>;
  onDelete: (row: BranchAccount) => void;
  onEdit: (row: BranchAccount) => void;
  onReorder: (rows: BranchAccount[]) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
};

function AccountTable({
  allSelected,
  dragEnabled,
  language,
  pageStart,
  rows,
  selectedRows,
  onDelete,
  onEdit,
  onReorder,
  onToggleAll,
  onToggleSelected,
}: AccountTableProps) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex(
      (row) => row.account_uuid === String(active.id),
    );
    const newIndex = rows.findIndex(
      (row) => row.account_uuid === String(over.id),
    );
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(rows, oldIndex, newIndex));
  }

  const body = (
    <TableBody>
      {rows.map((row, index) => {
        const selected = selectedRows.has(row.account_uuid);
        const cells = (
          <>
            <TableCell>
              <Checkbox
                aria-label={t("common.selectRow", {
                  name: row.account_name || bankName(row, language),
                })}
                checked={selected}
                onCheckedChange={(checked) =>
                  onToggleSelected(row.account_uuid, checked === true)
                }
              />
            </TableCell>
            <TableCell className="text-center text-muted-foreground tabular-nums">
              {pageStart + index}
            </TableCell>
            <TableCell className="font-medium">
              {row.account_name || "—"}
            </TableCell>
            <TableCell>{bankName(row, language)}</TableCell>
            <TableCell className="tabular-nums" translate="no">
              {row.account_number || "—"}
            </TableCell>
            <TableCell>
              {row.account_qr ? (
                <Image
                  alt={t("settings.storeBranch.accountQr")}
                  className="size-10 rounded border bg-background object-contain p-1"
                  height={40}
                  src={row.account_qr}
                  unoptimized
                  width={40}
                />
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>
              <StatusBadge active={Number(row.account_status) === 1} />
            </TableCell>
            <TableCell className="text-right">
              <SettingsRowActions
                row={row}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </TableCell>
          </>
        );

        return dragEnabled ? (
          <SortableAccountRow
            key={row.account_uuid}
            id={row.account_uuid}
            selected={selected}
          >
            {cells}
          </SortableAccountRow>
        ) : (
          <TableRow
            key={row.account_uuid}
            data-state={selected ? "selected" : undefined}
          >
            {cells}
          </TableRow>
        );
      })}
    </TableBody>
  );

  const table = (
    <Table containerClassName="min-h-0 flex-1 overflow-auto">
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow>
          {dragEnabled ? <TableHead className="w-px" aria-hidden /> : null}
          <TableHead className="w-px">
            <Checkbox
              aria-label={t("common.selectAll")}
              checked={allSelected}
              onCheckedChange={(checked) => onToggleAll(checked === true)}
            />
          </TableHead>
          <TableHead className="w-px text-center">{t("fields.no")}</TableHead>
          <TableHead>{t("settings.storeBranch.accountName")}</TableHead>
          <TableHead>{t("settings.storeBranch.bank")}</TableHead>
          <TableHead>{t("settings.storeBranch.accountNumber")}</TableHead>
          <TableHead>{t("settings.storeBranch.accountQr")}</TableHead>
          <TableHead>{t("settings.storeBranch.status")}</TableHead>
          <TableHead className="w-px">
            <span className="sr-only">{t("common.actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      {dragEnabled ? (
        <SortableContext
          items={rows.map((row) => row.account_uuid)}
          strategy={verticalListSortingStrategy}
        >
          {body}
        </SortableContext>
      ) : (
        body
      )}
    </Table>
  );

  return dragEnabled ? (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      {table}
    </DndContext>
  ) : (
    table
  );
}

function SortableAccountRow({
  children,
  id,
  selected,
}: {
  children: ReactNode;
  id: string;
  selected: boolean;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <TableRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
      }}
      data-state={selected ? "selected" : undefined}
      className={cn(isDragging && "bg-background opacity-90 shadow-md")}
    >
      <TableCell>
        <Button
          aria-label={t("common.reorder")}
          size="icon-sm"
          type="button"
          variant="ghost"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden />
        </Button>
      </TableCell>
      {children}
    </TableRow>
  );
}

export function AccountSettingsPage() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  return <ScopedAccountSettingsPage key={`${token}:${user?.uuid}:${user?.status}:${user?.branch_uuid}:${authStoreUuid(user)}`} />;
}

function ScopedAccountSettingsPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.show);
  const deleteBranchAccount = useBankAccountStore((state) => state.deleteBranchAccount);
  const fetchBanks = useBankAccountStore((state) => state.fetchBanks);
  const fetchBranchAccounts = useBankAccountStore((state) => state.fetchBranchAccounts);
  const fetchBranches = useBankAccountStore((state) => state.fetchBranches);
  const saveBranchAccount = useBankAccountStore((state) => state.saveBranchAccount);
  const sortBranchAccounts = useBankAccountStore((state) => state.sortBranchAccounts);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchUuid, setBranchUuid] = useState(user?.branch_uuid ?? "");
  const branchUuid = accountBranchUuid(user?.status, user?.branch_uuid ?? "", selectedBranchUuid);
  const canManage = canManageBranchAccounts(user?.status);
  const [rows, setRows] = useState<BranchAccount[]>([]);
  const [referencesReady, setReferencesReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BranchAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BranchAccount | null>(null);
  const [deleting, setDeleting] = useState(false);
  const scopedRows = rows.filter((row) => accountBelongsToBranch(row.branch_uuid_fk, branchUuid));
  const list = useClientSettingsList(scopedRows, accountId, accountSearchText);
  const clearSelection = list.clearSelection;
  const language = i18n.resolvedLanguage || i18n.language;
  const title = t("settings.modules.account.title");
  const mounted = useRef(true);
  const loadGeneration = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadGeneration.current += 1;
    };
  }, []);

  const currentScopeGuard = useCallback(() => {
    const isCurrentSession = createSessionGuard();
    return () => mounted.current && isCurrentSession();
  }, []);

  const loadAccounts = useCallback(async (targetBranch: string, background = false) => {
    const generation = ++loadGeneration.current;
    const isCurrentScope = currentScopeGuard();
    const isCurrent = () => isCurrentScope() && generation === loadGeneration.current;
    if (!isCurrent()) return;
    if (!targetBranch) {
      setRows([]);
      setLoading(false);
      return;
    }
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const nextRows = await fetchBranchAccounts(targetBranch);
      if (isCurrent()) setRows(nextRows.filter((row) => accountBelongsToBranch(row.branch_uuid_fk, targetBranch)));
    } catch (error) {
      if (!isCurrent()) return;
      setRows([]);
      showToast({ title: t("settings.storeBranch.transferAccountsLoadFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
    } finally {
      if (isCurrent()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [currentScopeGuard, fetchBranchAccounts, setLoading, setRefreshing, setRows, showToast, t]);

  useEffect(() => {
    let active = true;
    async function loadReferences() {
      try {
        const [nextBanks, nextBranches] = await Promise.all([
          fetchBanks(),
          fetchBranches(authStoreUuid(user)),
        ]);
        if (!active) return;
        setBanks(nextBanks);
        const scopedBranches = accountBranchOptions(nextBranches, user?.status, user?.branch_uuid ?? "");
        setBranches(scopedBranches);
        const ownBranch = scopedBranches.find((branch) => branch.branch_uuid === user?.branch_uuid);
        setBranchUuid(ownBranch?.branch_uuid || scopedBranches[0]?.branch_uuid || "");
      } catch (error) {
        if (!active) return;
        showToast({ title: t("settings.bankAccount.loadReferencesFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
        setLoading(false);
      } finally {
        if (active) setReferencesReady(true);
      }
    }
    void loadReferences();
    return () => { active = false; };
  }, [fetchBanks, fetchBranches, showToast, t, user]);

  useEffect(() => {
    if (!referencesReady) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      clearSelection();
      void loadAccounts(branchUuid);
    });
    return () => { active = false; };
  }, [branchUuid, clearSelection, loadAccounts, referencesReady]);

  function openCreate() {
    if (!canManage || !branchUuid) return;
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: BranchAccount) {
    if (!canManage || !accountBelongsToBranch(row.branch_uuid_fk, branchUuid)) return;
    setEditing(row);
    setDialogOpen(true);
  }

  async function handleSave(input: SaveBranchAccountInput) {
    if (!canManage || !accountBelongsToBranch(input.branch_uuid_fk, branchUuid) || !input.bank_uuid_fk || !input.account_name || !input.account_number || saving) return;
    if (editing && !accountBelongsToBranch(editing.branch_uuid_fk, branchUuid)) return;
    const isCurrent = currentScopeGuard();
    if (!isCurrent()) return;
    setSaving(true);
    try {
      await saveBranchAccount(input);
      if (!isCurrent()) return;
      setDialogOpen(false);
      await loadAccounts(branchUuid, true);
      if (!isCurrent()) return;
      showToast({ title: t("settings.storeBranch.transferAccountSaved"), tone: "success" });
    } catch (error) {
      if (!isCurrent()) return;
      showToast({ title: t("settings.saveFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
    } finally {
      if (isCurrent()) setSaving(false);
    }
  }

  async function handleDelete() {
    if (!canManage || !deleteTarget || !accountBelongsToBranch(deleteTarget.branch_uuid_fk, branchUuid) || deleting) return;
    const isCurrent = currentScopeGuard();
    if (!isCurrent()) return;
    setDeleting(true);
    try {
      await deleteBranchAccount(deleteTarget.account_uuid, branchUuid);
      if (!isCurrent()) return;
      setDeleteTarget(null);
      await loadAccounts(branchUuid, true);
      if (!isCurrent()) return;
      showToast({ title: t("settings.bankAccount.accountDeleted"), tone: "success" });
    } catch (error) {
      if (!isCurrent()) return;
      showToast({ title: t("settings.storeBranch.deleteFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
    } finally {
      if (isCurrent()) setDeleting(false);
    }
  }

  async function handleReorder(nextRows: BranchAccount[]) {
    if (!canManage || !branchUuid || sorting || nextRows.some((row) => !accountBelongsToBranch(row.branch_uuid_fk, branchUuid))) return;
    const isCurrent = currentScopeGuard();
    if (!isCurrent()) return;
    const previousRows = rows;
    const persistedRows = list.orderBy === "DESC" ? [...nextRows].reverse() : nextRows;
    setRows(persistedRows);
    setSorting(true);
    try {
      await sortBranchAccounts(branchUuid, persistedRows);
      if (!isCurrent()) return;
      showToast({
        title: t("settings.bankAccount.orderSaved"),
        tone: "success",
      });
      await loadAccounts(branchUuid, true);
    } catch (error) {
      if (!isCurrent()) return;
      setRows(previousRows);
      showToast({
        title: t("settings.bankAccount.orderSaveFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      if (isCurrent()) setSorting(false);
    }
  }

  const branchSelector = Number(user?.status) !== ROLE_STATUS.BRANCH_ADMIN && branches.length > 1 ? (
    <Select disabled={sorting || saving || deleting} value={branchUuid} onValueChange={(value) => { if (branches.some((branch) => branch.branch_uuid === value)) { setBranchUuid(value); list.setPage(1); } }}>
      <SelectTrigger aria-label={t("nav.branch")} className="w-full @xl:w-64"><SelectValue placeholder={t("settings.storeBranch.noBranch")} /></SelectTrigger>
      <SelectContent position="popper"><SelectGroup>
        {branches.map((branch) => <SelectItem key={branch.branch_uuid} value={branch.branch_uuid}>{branchName(branch, language)}</SelectItem>)}
      </SelectGroup></SelectContent>
    </Select>
  ) : null;

  const dragEnabled =
    canManage &&
    !sorting &&
    !refreshing &&
    list.visibleRows.length > 1 &&
    list.visibleRows.length === scopedRows.length;

  const table = (
    <AccountTable
      allSelected={list.allSelected}
      dragEnabled={dragEnabled}
      language={language}
      pageStart={list.pageStart}
      rows={list.visibleRows}
      selectedRows={list.selectedRows}
      onDelete={setDeleteTarget}
      onEdit={openEdit}
      onReorder={(nextRows) => void handleReorder(nextRows)}
      onToggleAll={list.toggleAll}
      onToggleSelected={list.toggleSelected}
    />
  );

  const mobileList = (
    <ItemGroup className="@xl:grid @xl:grid-cols-2">{list.visibleRows.map((row) => (
      <Item key={row.account_uuid} variant="outline">
        <Checkbox aria-label={t("common.selectRow", { name: row.account_name || bankName(row, language) })} checked={list.selectedRows.has(row.account_uuid)} onCheckedChange={(checked) => list.toggleSelected(row.account_uuid, checked === true)} />
        <ItemMedia className="grid size-10 place-items-center overflow-hidden rounded-md bg-primary/10 text-primary">
          {row.account_qr ? <Image alt={t("settings.storeBranch.accountQr")} className="size-full object-contain" height={40} src={row.account_qr} unoptimized width={40} /> : <Landmark aria-hidden />}
        </ItemMedia>
        <ItemContent><ItemTitle>{row.account_name || bankName(row, language)}</ItemTitle><ItemDescription>{[bankName(row, language), row.account_number].filter(Boolean).join(" · ")}</ItemDescription></ItemContent>
        <ItemActions><SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} /></ItemActions>
        <ItemFooter><StatusBadge active={Number(row.account_status) === 1} /></ItemFooter>
      </Item>
    ))}</ItemGroup>
  );

  const hasActiveBank = banks.some((bank) => Number(bank.bank_status) === 1);

  return (
    <SettingsListPageLayout
      id="account"
      title={title}
      description={t("settings.modules.account.description")}
      icon={CreditCard}
      addLabel={t("settings.storeBranch.addAccount")}
      onAdd={canManage && branchUuid && hasActiveBank && !sorting ? openCreate : undefined}
      loading={loading}
      loadingLabel={t("settings.loading", { title })}
      search={list.search}
      searching={refreshing || sorting}
      searchingLabel={t("settings.bankAccount.loadingAccounts")}
      onSearchChange={list.setSearch}
      onSearchApply={list.applySearch}
      orderBy={list.orderBy}
      onOrderChange={list.setOrderBy}
      orderOptions={[{ label: t("common.asc"), value: "ASC" }, { label: t("common.desc"), value: "DESC" }]}
      toolbarExtra={branchSelector}
      allSelected={list.allSelected}
      selectAllLabel={t("common.selectAll")}
      selectedCount={list.selectedRows.size}
      onToggleAll={list.toggleAll}
      hasRows={list.visibleRows.length > 0}
      table={table}
      mobileList={mobileList}
      empty={<SettingsEmptyRecords icon={<CreditCard aria-hidden />} title={title.toLowerCase()} description={!branchUuid ? t("settings.storeBranch.noBranch") : !hasActiveBank ? t("settings.bankAccount.addBankFirst") : undefined} />}
      page={list.page}
      pageStart={list.pageStart}
      pageEnd={list.pageEnd}
      total={list.total}
      totalPages={list.totalPages}
      limit={list.limit}
      onLimitChange={list.changeLimit}
      onPageChange={list.setPage}
    >
      <AccountFormDialog key={`${editing?.account_uuid ?? "new"}:${dialogOpen}`} banks={banks} branchUuid={branchUuid} editing={editing} open={dialogOpen} saving={saving} onOpenChange={setDialogOpen} onSave={handleSave} />
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        confirmPending={deleting}
        description={t("settings.bankAccount.deleteAccountConfirm")}
        open={Boolean(deleteTarget)}
        title={t("actions.delete")}
        onConfirm={() => void handleDelete()}
        onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}
      />
    </SettingsListPageLayout>
  );
}
