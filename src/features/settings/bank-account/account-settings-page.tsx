"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { CreditCard, Landmark } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { StatusBadge } from "@/components/common/status-badge";
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
import { AccountFormDialog } from "./bank-account-form-dialogs";
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

export function AccountSettingsPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.show);
  const deleteBranchAccount = useBankAccountStore((state) => state.deleteBranchAccount);
  const fetchBanks = useBankAccountStore((state) => state.fetchBanks);
  const fetchBranchAccounts = useBankAccountStore((state) => state.fetchBranchAccounts);
  const fetchBranches = useBankAccountStore((state) => state.fetchBranches);
  const saveBranchAccount = useBankAccountStore((state) => state.saveBranchAccount);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchUuid, setBranchUuid] = useState("");
  const [rows, setRows] = useState<BranchAccount[]>([]);
  const [referencesReady, setReferencesReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BranchAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BranchAccount | null>(null);
  const [deleting, setDeleting] = useState(false);
  const list = useClientSettingsList(rows, accountId, accountSearchText);
  const clearSelection = list.clearSelection;
  const language = i18n.resolvedLanguage || i18n.language;
  const title = t("settings.modules.account.title");

  const loadAccounts = useCallback(async (targetBranch: string, background = false) => {
    if (!targetBranch) {
      setRows([]);
      setLoading(false);
      return;
    }
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      setRows(await fetchBranchAccounts(targetBranch));
    } catch (error) {
      setRows([]);
      showToast({ title: t("settings.storeBranch.transferAccountsLoadFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchBranchAccounts, showToast, t]);

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
        setBranches(nextBranches);
        const ownBranch = nextBranches.find((branch) => branch.branch_uuid === user?.branch_uuid);
        setBranchUuid(ownBranch?.branch_uuid || nextBranches[0]?.branch_uuid || "");
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
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: BranchAccount) {
    setEditing(row);
    setDialogOpen(true);
  }

  async function handleSave(input: SaveBranchAccountInput) {
    if (!input.bank_uuid_fk || !input.account_name || !input.account_number || saving) return;
    setSaving(true);
    try {
      await saveBranchAccount(input);
      setDialogOpen(false);
      await loadAccounts(branchUuid, true);
      showToast({ title: t("settings.storeBranch.transferAccountSaved"), tone: "success" });
    } catch (error) {
      showToast({ title: t("settings.saveFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteBranchAccount(deleteTarget.account_uuid, branchUuid);
      setDeleteTarget(null);
      await loadAccounts(branchUuid, true);
      showToast({ title: t("settings.bankAccount.accountDeleted"), tone: "success" });
    } catch (error) {
      showToast({ title: t("settings.storeBranch.deleteFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
    } finally {
      setDeleting(false);
    }
  }

  const branchSelector = branches.length > 1 ? (
    <Select value={branchUuid} onValueChange={(value) => { setBranchUuid(value); list.setPage(1); }}>
      <SelectTrigger aria-label={t("nav.branch")} className="w-full @xl:w-64"><SelectValue placeholder={t("settings.storeBranch.noBranch")} /></SelectTrigger>
      <SelectContent position="popper"><SelectGroup>
        {branches.map((branch) => <SelectItem key={branch.branch_uuid} value={branch.branch_uuid}>{branchName(branch, language)}</SelectItem>)}
      </SelectGroup></SelectContent>
    </Select>
  ) : null;

  const table = (
    <Table containerClassName="min-h-0 flex-1 overflow-auto">
      <TableHeader className="sticky top-0 z-10 bg-muted"><TableRow>
        <TableHead className="w-px"><Checkbox aria-label={t("common.selectAll")} checked={list.allSelected} onCheckedChange={(checked) => list.toggleAll(checked === true)} /></TableHead>
        <TableHead className="w-px text-center">{t("fields.no")}</TableHead>
        <TableHead>{t("settings.storeBranch.accountName")}</TableHead>
        <TableHead>{t("settings.storeBranch.bank")}</TableHead>
        <TableHead>{t("settings.storeBranch.accountNumber")}</TableHead>
        <TableHead>{t("settings.storeBranch.accountQr")}</TableHead>
        <TableHead>{t("settings.storeBranch.status")}</TableHead>
        <TableHead className="w-px"><span className="sr-only">{t("common.actions")}</span></TableHead>
      </TableRow></TableHeader>
      <TableBody>{list.visibleRows.map((row, index) => (
        <TableRow key={row.account_uuid} data-state={list.selectedRows.has(row.account_uuid) ? "selected" : undefined}>
          <TableCell><Checkbox aria-label={t("common.selectRow", { name: row.account_name || bankName(row, language) })} checked={list.selectedRows.has(row.account_uuid)} onCheckedChange={(checked) => list.toggleSelected(row.account_uuid, checked === true)} /></TableCell>
          <TableCell className="text-center text-muted-foreground tabular-nums">{list.pageStart + index}</TableCell>
          <TableCell className="font-medium">{row.account_name || "—"}</TableCell>
          <TableCell>{bankName(row, language)}</TableCell>
          <TableCell className="tabular-nums" translate="no">{row.account_number || "—"}</TableCell>
          <TableCell>{row.account_qr ? <Image alt={t("settings.storeBranch.accountQr")} className="size-10 rounded border bg-background object-contain p-1" height={40} src={row.account_qr} unoptimized width={40} /> : "—"}</TableCell>
          <TableCell><StatusBadge active={Number(row.account_status) === 1} /></TableCell>
          <TableCell className="text-right"><SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} /></TableCell>
        </TableRow>
      ))}</TableBody>
    </Table>
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
      onAdd={branchUuid && hasActiveBank ? openCreate : undefined}
      loading={loading}
      loadingLabel={t("settings.loading", { title })}
      search={list.search}
      searching={refreshing}
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
