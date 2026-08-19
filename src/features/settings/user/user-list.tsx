"use client";

import type { ReactNode } from "react";
import { KeyRound, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SettingsMobileCard,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsRowActions,
  SettingsTableScroll,
  SettingsEmptyRecords,} from "@/features/settings/shared/settings-shell";
import { cn } from "@/lib/utils";
import type { User } from "@/services/user";
import { UserActiveBadge, UserAvatar, UserBadges, UserIdentity } from "./user-display";
import {
  branchName,
  isProtectedUser,
  roleName,
  userId,
  userValue
} from "./user-utils";

export function UserListSurface({
  allSelected,
  backgroundLoading,
  currentLoginUuid,
  pageStart,
  profileUrl,
  rows,
  selectedRows,
  title,
  toolbar,
  onChangePassword,
  onDelete,
  onEdit,
  onToggleAll,
  onToggleSelected
}: {
  allSelected: boolean;
  backgroundLoading: boolean;
  currentLoginUuid: string;
  pageStart: number;
  profileUrl: (profilePath: string | null) => string;
  rows: User[];
  selectedRows: Set<string>;
  title: string;
  toolbar: ReactNode;
  onChangePassword: (row: User) => void;
  onDelete: (row: User) => void;
  onEdit: (row: User) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur sm:px-4 lg:px-5">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black">{t("settings.userList")}</p>
          </div>
          <div className="min-w-0 xl:max-w-3xl">{toolbar}</div>
        </div>
        {backgroundLoading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner aria-hidden />
            {t("settings.refreshingList")}
          </div>
        ) : null}
      </div>
      {rows.length ? (
        <>
          <div className="hidden min-h-0 flex-1 md:flex">
            <UserDesktopTable
              allSelected={allSelected}
              currentLoginUuid={currentLoginUuid}
              pageStart={pageStart}
              profileUrl={profileUrl}
              rows={rows}
              selectedRows={selectedRows}
              onChangePassword={onChangePassword}
              onDelete={onDelete}
              onEdit={onEdit}
              onToggleAll={onToggleAll}
              onToggleSelected={onToggleSelected}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto md:hidden">
            <UserMobileList
              currentLoginUuid={currentLoginUuid}
              profileUrl={profileUrl}
              rows={rows}
              selectedRows={selectedRows}
              onChangePassword={onChangePassword}
              onDelete={onDelete}
              onEdit={onEdit}
              onToggleSelected={onToggleSelected}
            />
          </div>
        </>
      ) : (
        <SettingsEmptyRecords icon={<UsersRound aria-hidden />} title={title.toLowerCase()} />
      )}
    </div>
  );
}

// เปลี่ยนรหัสผ่านได้เฉพาะบัญชีของตัวเอง — API ต้องยืนยัน old_password ซึ่งแอดมินไม่รู้ของลูกน้อง
// (แอดมินตั้งรหัสใหม่ให้ลูกน้องได้ผ่านช่องรหัสผ่านในฟอร์มแก้ไขผู้ใช้แทน)
function UserRowActions({
  currentRow,
  onChangePassword,
  onDelete,
  onEdit,
  protectedRow,
  row
}: {
  currentRow: boolean;
  onChangePassword: (row: User) => void;
  onDelete: (row: User) => void;
  onEdit: (row: User) => void;
  protectedRow: boolean;
  row: User;
}) {
  const { t } = useTranslation();

  return (
    <SettingsRowActions
      row={row}
      editDisabled={protectedRow}
      deleteDisabled={protectedRow}
      actions={
        currentRow
          ? [
              {
                label: t("settings.changePassword"),
                icon: <KeyRound aria-hidden />,
                onSelect: onChangePassword
              }
            ]
          : undefined
      }
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

function UserDesktopTable({
  allSelected,
  currentLoginUuid,
  onChangePassword,
  onDelete,
  onEdit,
  onToggleAll,
  onToggleSelected,
  pageStart,
  profileUrl,
  rows,
  selectedRows
}: {
  allSelected: boolean;
  currentLoginUuid: string;
  onChangePassword: (row: User) => void;
  onDelete: (row: User) => void;
  onEdit: (row: User) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  pageStart: number;
  profileUrl: (profilePath: string | null) => string;
  rows: User[];
  selectedRows: Set<string>;
}) {
  const { t } = useTranslation();

  return (
    <SettingsTableScroll>
      <Table className="min-w-260">
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onCheckedChange={(checked) => onToggleAll(checked as boolean)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("fields.no")}</TableHead>
            <TableHead className="pl-5">{t("nav.user")}</TableHead>
            <TableHead>{t("fields.roles_name")}</TableHead>
            <TableHead>{t("nav.branch")}</TableHead>
            <TableHead>{t("fields.login_active")}</TableHead>
            <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <UserTableRow
              key={userId(row) || index}
              currentLoginUuid={currentLoginUuid}
              profileUrl={profileUrl}
              row={row}
              rowNumber={pageStart + index}
              selectedRows={selectedRows}
              onChangePassword={onChangePassword}
              onDelete={onDelete}
              onEdit={onEdit}
              onToggleSelected={onToggleSelected}
            />
          ))}
        </TableBody>
      </Table>
    </SettingsTableScroll>
  );
}

function UserTableRow({
  currentLoginUuid,
  onChangePassword,
  onDelete,
  onEdit,
  onToggleSelected,
  profileUrl,
  row,
  rowNumber,
  selectedRows
}: {
  currentLoginUuid: string;
  onChangePassword: (row: User) => void;
  onDelete: (row: User) => void;
  onEdit: (row: User) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  profileUrl: (profilePath: string | null) => string;
  row: User;
  rowNumber: number;
  selectedRows: Set<string>;
}) {
  const { t } = useTranslation();
  const id = userId(row);
  const email = userValue(row, "login_email", "-");
  const selected = selectedRows.has(id);
  const protectedRow = isProtectedUser(row);
  const currentRow = Boolean(currentLoginUuid && id === currentLoginUuid);

  return (
    <TableRow
      className={cn("h-14", currentRow && "bg-primary/5")}
      data-state={selected ? "selected" : undefined}
    >
      <TableCell className="w-10 px-2">
        <Checkbox aria-label={t("common.selectRow", { name: email })} checked={selected} onCheckedChange={(checked) => onToggleSelected(id, checked as boolean)} />
      </TableCell>
      <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black text-muted-foreground">{rowNumber}</TableCell>
      <TableCell className="max-w-md">
        <UserIdentity
          currentRow={currentRow}
          email={email}
          protectedRow={protectedRow}
          src={profileUrl(userValue(row, "login_profile"))}
        />
      </TableCell>
      <TableCell className="max-w-72 truncate text-muted-foreground">{roleName(row)}</TableCell>
      <TableCell className="max-w-72 truncate text-muted-foreground">{branchName(row)}</TableCell>
      <TableCell>
        <UserActiveBadge status={userValue(row, "login_active", "1")} />
      </TableCell>
      <TableCell className="text-right">
        <UserRowActions
          currentRow={currentRow}
          protectedRow={protectedRow}
          row={row}
          onChangePassword={onChangePassword}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      </TableCell>
    </TableRow>
  );
}

function UserMobileList({
  currentLoginUuid,
  onChangePassword,
  onDelete,
  onEdit,
  onToggleSelected,
  profileUrl,
  rows,
  selectedRows
}: {
  currentLoginUuid: string;
  onChangePassword: (row: User) => void;
  onDelete: (row: User) => void;
  onEdit: (row: User) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  profileUrl: (profilePath: string | null) => string;
  rows: User[];
  selectedRows: Set<string>;
}) {
  return (
    <div className="flex min-h-full flex-col gap-2 p-3">
      {rows.map((row, index) => (
        <UserMobileCard
          key={userId(row) || index}
          currentLoginUuid={currentLoginUuid}
          profileUrl={profileUrl}
          row={row}
          selectedRows={selectedRows}
          onChangePassword={onChangePassword}
          onDelete={onDelete}
          onEdit={onEdit}
          onToggleSelected={onToggleSelected}
        />
      ))}
    </div>
  );
}

function UserMobileCard({
  currentLoginUuid,
  onChangePassword,
  onDelete,
  onEdit,
  onToggleSelected,
  profileUrl,
  row,
  selectedRows
}: {
  currentLoginUuid: string;
  onChangePassword: (row: User) => void;
  onDelete: (row: User) => void;
  onEdit: (row: User) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  profileUrl: (profilePath: string | null) => string;
  row: User;
  selectedRows: Set<string>;
}) {
  const { t } = useTranslation();
  const id = userId(row);
  const email = userValue(row, "login_email", "-");
  const selected = selectedRows.has(id);
  const protectedRow = isProtectedUser(row);
  const currentRow = Boolean(currentLoginUuid && id === currentLoginUuid);

  return (
    <SettingsMobileCard
      actions={
        <UserRowActions
          currentRow={currentRow}
          protectedRow={protectedRow}
          row={row}
          onChangePassword={onChangePassword}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      }
      badges={<UserBadges currentRow={currentRow} protectedRow={protectedRow} />}
      checked={selected}
      className={currentRow ? "bg-primary/5" : undefined}
      leading={<UserAvatar email={email} src={profileUrl(userValue(row, "login_profile"))} />}
      selectLabel={t("common.selectRow", { name: email })}
      selected={selected}
      title={<span translate="no">{email}</span>}
      onCheckedChange={(checked) => onToggleSelected(id, checked)}
    >
      <SettingsMobileMetaGrid>
        <SettingsMobileMeta label={t("fields.roles_name")} value={roleName(row)} />
        <SettingsMobileMeta label={t("nav.branch")} value={branchName(row)} />
        <SettingsMobileMeta
          label={t("fields.login_active")}
          value={<UserActiveBadge status={userValue(row, "login_active", "1")} />}
        />
      </SettingsMobileMetaGrid>
    </SettingsMobileCard>
  );
}
