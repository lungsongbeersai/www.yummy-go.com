"use client";

import type { ReactNode } from "react";
import { UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SettingsMobileCard,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsRowActions,
  SettingsTableScroll
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
  page,
  pageEnd,
  pageStart,
  profileUrl,
  rows,
  selectedRows,
  title,
  toolbar,
  total,
  totalPages,
  onDelete,
  onEdit,
  onToggleAll,
  onToggleSelected
}: {
  allSelected: boolean;
  backgroundLoading: boolean;
  currentLoginUuid: string;
  page: number;
  pageEnd: number;
  pageStart: number;
  profileUrl: (profilePath: string | null) => string;
  rows: User[];
  selectedRows: Set<string>;
  title: string;
  toolbar: ReactNode;
  total: number;
  totalPages: number;
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
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("common.showingRange", { start: pageStart, end: pageEnd, total })} - {t("common.page", { current: page, total: totalPages })}
            </p>
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
              onDelete={onDelete}
              onEdit={onEdit}
              onToggleSelected={onToggleSelected}
            />
          </div>
        </>
      ) : (
        <div className="flex min-h-72 flex-1 items-center justify-center p-4">
          <Empty className="max-w-md border border-dashed bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersRound aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{t("settings.noRecords", { title: title.toLowerCase() })}</EmptyTitle>
              <EmptyDescription>{t("empty.adjustSearch")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </div>
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
