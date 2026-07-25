"use client";

import type { ReactNode } from "react";
import { UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SettingsListSurface,
  SettingsMobileCard,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsRowActions,
  SettingsTableScroll,
} from "@/features/settings/shared/settings-shell";
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
  onDelete: (row: User) => void;
  onEdit: (row: User) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <SettingsListSurface
      backgroundLoading={backgroundLoading}
      emptyIcon={<UsersRound aria-hidden />}
      emptyTitle={title.toLowerCase()}
      hasRows={rows.length > 0}
      listTitle={t("settings.userList")}
      mobileList={
        <UserMobileList
          currentLoginUuid={currentLoginUuid}
          profileUrl={profileUrl}
          rows={rows}
          selectedRows={selectedRows}
          onDelete={onDelete}
          onEdit={onEdit}
          onToggleSelected={onToggleSelected}
        />
      }
      refreshLabel={t("settings.refreshingList")}
      table={
        <UserDesktopTable
          allSelected={allSelected}
          currentLoginUuid={currentLoginUuid}
          pageStart={pageStart}
          profileUrl={profileUrl}
          rows={rows}
          selectedRows={selectedRows}
          onDelete={onDelete}
          onEdit={onEdit}
          onToggleAll={onToggleAll}
          onToggleSelected={onToggleSelected}
        />
      }
      toolbar={toolbar}
      toolbarClassName="min-w-0 xl:max-w-3xl"
    />
  );
}

function UserDesktopTable({
  allSelected,
  currentLoginUuid,
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
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => onToggleAll(event.target.checked)} />
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
  onDelete,
  onEdit,
  onToggleSelected,
  profileUrl,
  row,
  rowNumber,
  selectedRows
}: {
  currentLoginUuid: string;
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
        <Checkbox aria-label={t("common.selectRow", { name: email })} checked={selected} onChange={(event) => onToggleSelected(id, event.target.checked)} />
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
        <SettingsRowActions
          row={row}
          editDisabled={protectedRow}
          deleteDisabled={protectedRow}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </TableCell>
    </TableRow>
  );
}

function UserMobileList({
  currentLoginUuid,
  onDelete,
  onEdit,
  onToggleSelected,
  profileUrl,
  rows,
  selectedRows
}: {
  currentLoginUuid: string;
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
  onDelete,
  onEdit,
  onToggleSelected,
  profileUrl,
  row,
  selectedRows
}: {
  currentLoginUuid: string;
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
        <SettingsRowActions
          row={row}
          editDisabled={protectedRow}
          deleteDisabled={protectedRow}
          onEdit={onEdit}
          onDelete={onDelete}
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
