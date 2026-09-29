"use client";

import { useCallback, useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SettingsListPageLayout } from "@/features/settings/shared/settings-list-page-layout";
import { SettingsEmptyRecords, SettingsRowActions } from "@/features/settings/shared/settings-shell";
import type { Bank, SaveBankInput } from "@/services/bank-account";
import { useBankAccountStore } from "@/stores/bank-account-store";
import { useToastStore } from "@/stores/toast-store";
import { BankFormDialog } from "./bank-account-form-dialogs";
import { useClientSettingsList } from "./use-client-settings-list";

const bankId = (bank: Bank) => bank.bank_uuid;
const bankSearchText = (bank: Bank) => `${bank.bank_name_la} ${bank.bank_name_eng}`;

export function BankSettingsPage() {
  const { t, i18n } = useTranslation();
  const showToast = useToastStore((state) => state.show);
  const deleteBank = useBankAccountStore((state) => state.deleteBank);
  const fetchBanks = useBankAccountStore((state) => state.fetchBanks);
  const saveBank = useBankAccountStore((state) => state.saveBank);
  const [rows, setRows] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Bank | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bank | null>(null);
  const [deleting, setDeleting] = useState(false);
  const list = useClientSettingsList(rows, bankId, bankSearchText);
  const language = i18n.resolvedLanguage || i18n.language;
  const title = t("settings.modules.bank.title");

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      setRows(await fetchBanks());
    } catch (error) {
      showToast({ title: t("settings.bankAccount.loadBanksFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchBanks, showToast, t]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => { active = false; };
  }, [load]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: Bank) {
    setEditing(row);
    setDialogOpen(true);
  }

  async function handleSave(input: SaveBankInput) {
    if (!input.bank_name_la || saving) return;
    setSaving(true);
    try {
      await saveBank(input);
      setDialogOpen(false);
      await load(true);
      showToast({ title: t("settings.storeBranch.bankSaved"), tone: "success" });
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
      await deleteBank(deleteTarget.bank_uuid);
      setDeleteTarget(null);
      await load(true);
      showToast({ title: t("settings.bankAccount.bankDeleted"), tone: "success" });
    } catch (error) {
      showToast({ title: t("settings.storeBranch.deleteFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
    } finally {
      setDeleting(false);
    }
  }

  const table = (
    <Table containerClassName="min-h-0 flex-1 overflow-auto">
      <TableHeader className="sticky top-0 z-10 bg-muted"><TableRow>
        <TableHead className="w-px"><Checkbox aria-label={t("common.selectAll")} checked={list.allSelected} onCheckedChange={(checked) => list.toggleAll(checked === true)} /></TableHead>
        <TableHead className="w-px text-center">{t("fields.no")}</TableHead>
        <TableHead>{t("settings.storeBranch.bankNameLa")}</TableHead>
        <TableHead>{t("settings.storeBranch.bankNameEng")}</TableHead>
        <TableHead>{t("settings.storeBranch.status")}</TableHead>
        <TableHead className="w-px"><span className="sr-only">{t("common.actions")}</span></TableHead>
      </TableRow></TableHeader>
      <TableBody>{list.visibleRows.map((row, index) => (
        <TableRow key={row.bank_uuid} data-state={list.selectedRows.has(row.bank_uuid) ? "selected" : undefined}>
          <TableCell><Checkbox aria-label={t("common.selectRow", { name: row.bank_name_la })} checked={list.selectedRows.has(row.bank_uuid)} onCheckedChange={(checked) => list.toggleSelected(row.bank_uuid, checked === true)} /></TableCell>
          <TableCell className="text-center text-muted-foreground tabular-nums">{list.pageStart + index}</TableCell>
          <TableCell className="font-medium">{row.bank_name_la}</TableCell>
          <TableCell>{row.bank_name_eng || "—"}</TableCell>
          <TableCell><StatusBadge active={Number(row.bank_status) === 1} /></TableCell>
          <TableCell className="text-right"><SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} /></TableCell>
        </TableRow>
      ))}</TableBody>
    </Table>
  );

  const mobileList = (
    <ItemGroup className="@xl:grid @xl:grid-cols-2">{list.visibleRows.map((row) => {
      const name = (language.startsWith("en") ? row.bank_name_eng : row.bank_name_la) || row.bank_name_la || row.bank_name_eng;
      return <Item key={row.bank_uuid} variant="outline">
        <Checkbox aria-label={t("common.selectRow", { name })} checked={list.selectedRows.has(row.bank_uuid)} onCheckedChange={(checked) => list.toggleSelected(row.bank_uuid, checked === true)} />
        <ItemMedia className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary"><Landmark aria-hidden /></ItemMedia>
        <ItemContent><ItemTitle>{name}</ItemTitle><ItemDescription>{language.startsWith("en") ? row.bank_name_la : row.bank_name_eng}</ItemDescription></ItemContent>
        <ItemActions><SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} /></ItemActions>
        <ItemFooter><StatusBadge active={Number(row.bank_status) === 1} /></ItemFooter>
      </Item>;
    })}</ItemGroup>
  );

  return (
    <SettingsListPageLayout
      id="bank"
      title={title}
      description={t("settings.modules.bank.description")}
      icon={Landmark}
      addLabel={t("settings.storeBranch.addBank")}
      onAdd={openCreate}
      loading={loading}
      loadingLabel={t("settings.loading", { title })}
      search={list.search}
      searching={refreshing}
      searchingLabel={t("settings.bankAccount.loadingBanks")}
      onSearchChange={list.setSearch}
      onSearchApply={list.applySearch}
      orderBy={list.orderBy}
      onOrderChange={list.setOrderBy}
      orderOptions={[{ label: t("common.asc"), value: "ASC" }, { label: t("common.desc"), value: "DESC" }]}
      allSelected={list.allSelected}
      selectAllLabel={t("common.selectAll")}
      selectedCount={list.selectedRows.size}
      onToggleAll={list.toggleAll}
      hasRows={list.visibleRows.length > 0}
      table={table}
      mobileList={mobileList}
      empty={<SettingsEmptyRecords icon={<Landmark aria-hidden />} title={title.toLowerCase()} />}
      page={list.page}
      pageStart={list.pageStart}
      pageEnd={list.pageEnd}
      total={list.total}
      totalPages={list.totalPages}
      limit={list.limit}
      onLimitChange={list.changeLimit}
      onPageChange={list.setPage}
    >
      <BankFormDialog key={`${editing?.bank_uuid ?? "new"}:${dialogOpen}`} editing={editing} open={dialogOpen} saving={saving} onOpenChange={setDialogOpen} onSave={handleSave} />
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        confirmPending={deleting}
        description={t("settings.bankAccount.deleteBankConfirm")}
        open={Boolean(deleteTarget)}
        title={t("actions.delete")}
        onConfirm={() => void handleDelete()}
        onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}
      />
    </SettingsListPageLayout>
  );
}
