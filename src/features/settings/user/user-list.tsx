"use client";

import { KeyRound, Power, PowerOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle
} from "@/components/ui/item";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SettingsRowActions } from "@/features/settings/shared/settings-shell";
import type { User } from "@/services/user";
import { UserActiveBadge, UserAvatar, UserBadges } from "./user-display";
import { branchName, deportmentName, isProtectedUser, positionName, roleName, userId, userValue, zoneName } from "./user-utils";

type UserListProps = {
  currentLoginUuid: string;
  profileUrl: (profilePath: string | null) => string;
  rows: User[];
  selectedRows: Set<string>;
  onChangePassword: (row: User) => void;
  onDelete: (row: User) => void;
  onEdit: (row: User) => void;
  onToggleActive: (row: User) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
};

// เปลี่ยนรหัสผ่านได้เฉพาะบัญชีของตัวเอง — API ต้องยืนยัน old_password ซึ่งแอดมินไม่รู้ของลูกน้อง
// (แอดมินตั้งรหัสใหม่ให้ลูกน้องได้ผ่านช่องรหัสผ่านในฟอร์มแก้ไขผู้ใช้แทน)
function UserRowActions({
  currentRow,
  protectedRow,
  row,
  onChangePassword,
  onDelete,
  onEdit,
  onToggleActive
}: Pick<UserListProps, "onChangePassword" | "onDelete" | "onEdit" | "onToggleActive"> & {
  currentRow: boolean;
  protectedRow: boolean;
  row: User;
}) {
  const { t } = useTranslation();
  const active = Number(row.login_active ?? 1) === 1;
  return (
    <SettingsRowActions
      row={row}
      editDisabled={protectedRow}
      deleteDisabled={protectedRow}
      actions={[
        {
          label: t(active ? "settings.userDisable" : "settings.userEnable"),
          icon: active ? <PowerOff aria-hidden /> : <Power aria-hidden />,
          disabled: protectedRow || currentRow,
          onSelect: onToggleActive
        },
        ...(currentRow ? [{ label: t("settings.changePassword"), icon: <KeyRound aria-hidden />, onSelect: onChangePassword }] : [])
      ]}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

function rowFlags(row: User, currentLoginUuid: string) {
  const id = userId(row);
  return {
    currentRow: Boolean(currentLoginUuid && id === currentLoginUuid),
    displayName: userValue(row, "login_name", "-"),
    email: userValue(row, "login_email", "-"),
    id,
    protectedRow: isProtectedUser(row)
  };
}

export function UserTable({
  allSelected,
  pageStart,
  onToggleAll,
  ...props
}: UserListProps & { allSelected: boolean; pageStart: number; onToggleAll: (checked: boolean) => void }) {
  const { currentLoginUuid, profileUrl, rows, selectedRows, onToggleSelected } = props;
  const { t } = useTranslation();

  return (
    <Table containerClassName="min-h-0 flex-1 overflow-auto">
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow>
          <TableHead className="w-px">
            <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onCheckedChange={(checked) => onToggleAll(checked === true)} />
          </TableHead>
          {/* w-px: checkbox, number and actions shrink to their content. */}
          <TableHead className="w-px text-center">{t("fields.no")}</TableHead>
          <TableHead className="min-w-64">{t("nav.user")}</TableHead>
          <TableHead>{t("nav.branch")}</TableHead>
          <TableHead>{t("nav.zone")}</TableHead>
          <TableHead>{t("fields.login_active")}</TableHead>
          <TableHead className="w-px">
            <span className="sr-only">{t("common.actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const { currentRow, displayName, email, id, protectedRow } = rowFlags(row, currentLoginUuid);
          const selected = selectedRows.has(id);
          return (
            <TableRow key={id || index} data-state={selected ? "selected" : undefined}>
              <TableCell>
                {/* Your own account and protected accounts can't be bulk-edited, so they can't be selected. */}
                <Checkbox
                  aria-label={t("common.selectRow", { name: displayName })}
                  checked={selected}
                  disabled={protectedRow || currentRow}
                  onCheckedChange={(checked) => onToggleSelected(id, checked === true)}
                />
              </TableCell>
              <TableCell className="text-center text-muted-foreground tabular-nums">{pageStart + index}</TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <UserAvatar label={displayName} src={profileUrl(userValue(row, "login_profile"))} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {displayName}
                      </span>
                      <UserBadges currentRow={currentRow} protectedRow={protectedRow} />
                    </span>
                    <span className="truncate text-muted-foreground" translate="no">{email}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {deportmentName(row)} · {positionName(row)} · {roleName(row)}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{branchName(row)}</TableCell>
              <TableCell className="text-muted-foreground">{zoneName(row, t("settings.allZones"))}</TableCell>
              <TableCell>
                <UserActiveBadge status={userValue(row, "login_active", "1")} />
              </TableCell>
              <TableCell className="text-right">
                <UserRowActions {...props} currentRow={currentRow} protectedRow={protectedRow} row={row} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// Narrow pages: one Item per account, two columns once there is room.
export function UserMobileList(props: UserListProps) {
  const { currentLoginUuid, profileUrl, rows, selectedRows, onToggleSelected } = props;
  const { t } = useTranslation();

  return (
    <ItemGroup className="@xl:grid @xl:grid-cols-2">
      {rows.map((row, index) => {
        const { currentRow, displayName, email, id, protectedRow } = rowFlags(row, currentLoginUuid);
        return (
          <Item key={id || index} variant="outline">
            <Checkbox
              aria-label={t("common.selectRow", { name: displayName })}
              checked={selectedRows.has(id)}
              disabled={protectedRow || currentRow}
              onCheckedChange={(checked) => onToggleSelected(id, checked === true)}
            />
            <ItemMedia>
              <UserAvatar label={displayName} src={profileUrl(userValue(row, "login_profile"))} />
            </ItemMedia>
            {/* min-w-0 keeps long identity text from pushing the action menu onto its own line. */}
            <ItemContent className="min-w-0">
              <ItemTitle className="w-full">
                <span className="truncate" translate="no">
                  {displayName}
                </span>
              </ItemTitle>
              <ItemDescription>
                <span translate="no">{email}</span>
                <span className="block">{deportmentName(row)} · {positionName(row)} · {roleName(row)}</span>
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <UserRowActions {...props} currentRow={currentRow} protectedRow={protectedRow} row={row} />
            </ItemActions>
            <ItemFooter className="flex-wrap justify-start gap-x-3 gap-y-1">
              <UserActiveBadge status={userValue(row, "login_active", "1")} />
              <UserBadges currentRow={currentRow} protectedRow={protectedRow} />
              <span className="text-muted-foreground">
                {branchName(row)} · {zoneName(row, t("settings.allZones"))}
              </span>
            </ItemFooter>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
