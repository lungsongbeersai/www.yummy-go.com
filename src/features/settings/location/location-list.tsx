"use client";

import { Fragment } from "react";
import { ChevronDown, ChevronRight, MapPin, MapPinned } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle
} from "@/components/ui/item";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SettingsRowActions } from "@/features/settings/shared/settings-shell";
import { SettingsIconTile } from "@/features/settings/shared/settings-tones";
import { locationId, locationValue, type LocationKind, type NumberedDistrictGroup } from "./location-utils";
import type { LocationSettingsRow } from "./location-types";

type RowHandlers = {
  canManage: boolean;
  selectedRows: Set<string>;
  onDelete: (row: LocationSettingsRow) => void;
  onEdit: (row: LocationSettingsRow) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
};

type GroupProps = {
  collapsedProvinces: Set<string>;
  groups: NumberedDistrictGroup[];
  onToggleProvinceCollapse: (provinceId: string) => void;
};

// Each record has a Lao and an English name; the Lao one leads (it is what staff read), the
// English one follows. The old table also had a "name" column that always repeated one of them.
function names(row: LocationSettingsRow, kind: LocationKind) {
  return {
    en: locationValue(row, `${kind}_name_eng`, "-"),
    la: locationValue(row, `${kind}_name_la`, locationValue(row, `${kind}_name`, "-"))
  };
}

export const LOCATION_ICONS = { district: MapPinned, province: MapPin } as const;

function LocationIcon({ kind }: { kind: LocationKind }) {
  return <SettingsIconTile icon={LOCATION_ICONS[kind]} />;
}

function LocationTableHeader({
  allSelected,
  canManage,
  kind,
  onToggleAll
}: {
  allSelected: boolean;
  canManage: boolean;
  kind: LocationKind;
  onToggleAll: (checked: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <TableHeader className="sticky top-0 z-10 bg-muted">
      <TableRow>
        <TableHead className="w-px">
          <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onCheckedChange={(checked) => onToggleAll(checked === true)} />
        </TableHead>
        {/* w-px: checkbox, number and actions shrink to their content; the name columns take the spare width. */}
        <TableHead className="w-px text-center">{t("fields.no")}</TableHead>
        <TableHead className="min-w-56">{t(`fields.${kind}_name_la`)}</TableHead>
        <TableHead>{t(`fields.${kind}_name_eng`)}</TableHead>
        {canManage ? (
          <TableHead className="w-px">
            <span className="sr-only">{t("common.actions")}</span>
          </TableHead>
        ) : null}
      </TableRow>
    </TableHeader>
  );
}

function LocationTableRow({
  canManage,
  kind,
  row,
  rowNumber,
  selectedRows,
  onDelete,
  onEdit,
  onToggleSelected
}: RowHandlers & { kind: LocationKind; row: LocationSettingsRow; rowNumber: number }) {
  const { t } = useTranslation();
  const id = locationId(row, kind);
  const { en, la } = names(row, kind);
  const selected = selectedRows.has(id);

  return (
    <TableRow data-state={selected ? "selected" : undefined}>
      <TableCell>
        <Checkbox aria-label={t("common.selectRow", { name: la })} checked={selected} onCheckedChange={(checked) => onToggleSelected(id, checked === true)} />
      </TableCell>
      <TableCell className="text-center text-muted-foreground tabular-nums">{rowNumber}</TableCell>
      <TableCell>
        <span className="flex items-center gap-3 font-medium">
          <LocationIcon kind={kind} />
          {la}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground">{en}</TableCell>
      {canManage ? (
        <TableCell className="text-right">
          <SettingsRowActions row={row} onEdit={onEdit} onDelete={onDelete} />
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function LocationItem({
  canManage,
  kind,
  row,
  selectedRows,
  onDelete,
  onEdit,
  onToggleSelected
}: RowHandlers & { kind: LocationKind; row: LocationSettingsRow }) {
  const { t } = useTranslation();
  const id = locationId(row, kind);
  const { en, la } = names(row, kind);

  return (
    <Item variant="outline">
      <Checkbox aria-label={t("common.selectRow", { name: la })} checked={selectedRows.has(id)} onCheckedChange={(checked) => onToggleSelected(id, checked === true)} />
      <ItemMedia>
        <LocationIcon kind={kind} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{la}</ItemTitle>
        <ItemDescription>{en}</ItemDescription>
      </ItemContent>
      {canManage ? (
        <ItemActions>
          <SettingsRowActions row={row} onEdit={onEdit} onDelete={onDelete} />
        </ItemActions>
      ) : null}
    </Item>
  );
}

// Collapsible province header shared by the district table and cards: chevron, name, count.
function ProvinceGroupToggle({
  collapsed,
  count,
  name,
  onToggle
}: {
  collapsed: boolean;
  count: number;
  name: string;
  onToggle: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="ghost"
      className="w-full justify-start"
      aria-expanded={!collapsed}
      aria-label={collapsed ? t("settings.expandProvince", { province: name }) : t("settings.collapseProvince", { province: name })}
      onClick={onToggle}
    >
      {collapsed ? <ChevronRight data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
      <MapPin data-icon="inline-start" />
      <span className="truncate">{name}</span>
      <Badge variant="secondary" className="tabular-nums">
        {count}
      </Badge>
    </Button>
  );
}

export function ProvinceTable({
  allSelected,
  pageStart,
  rows,
  onToggleAll,
  ...handlers
}: RowHandlers & { allSelected: boolean; pageStart: number; rows: LocationSettingsRow[]; onToggleAll: (checked: boolean) => void }) {
  return (
    <Table containerClassName="min-h-0 flex-1 overflow-auto">
      <LocationTableHeader allSelected={allSelected} canManage={handlers.canManage} kind="province" onToggleAll={onToggleAll} />
      <TableBody>
        {rows.map((row, index) => (
          <LocationTableRow key={locationId(row, "province") || index} {...handlers} kind="province" row={row} rowNumber={pageStart + index} />
        ))}
      </TableBody>
    </Table>
  );
}

export function ProvinceMobileList({ rows, ...handlers }: RowHandlers & { rows: LocationSettingsRow[] }) {
  return (
    <ItemGroup className="@xl:grid @xl:grid-cols-2">
      {rows.map((row, index) => (
        <LocationItem key={locationId(row, "province") || index} {...handlers} kind="province" row={row} />
      ))}
    </ItemGroup>
  );
}

// Districts are grouped under their province (the group header replaces the old per-row
// province column, which repeated the same name on every row of a group).
export function DistrictTable({
  allSelected,
  collapsedProvinces,
  groups,
  onToggleAll,
  onToggleProvinceCollapse,
  ...handlers
}: RowHandlers & GroupProps & { allSelected: boolean; onToggleAll: (checked: boolean) => void }) {
  const { t } = useTranslation();
  const columnCount = handlers.canManage ? 5 : 4;

  return (
    <Table containerClassName="min-h-0 flex-1 overflow-auto">
      <LocationTableHeader allSelected={allSelected} canManage={handlers.canManage} kind="district" onToggleAll={onToggleAll} />
      <TableBody>
        {groups.map((group) => {
          const collapsed = collapsedProvinces.has(group.provinceId);
          return (
            <Fragment key={group.provinceId}>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableCell colSpan={columnCount}>
                  <ProvinceGroupToggle
                    collapsed={collapsed}
                    count={group.districts.length}
                    name={group.provinceName}
                    onToggle={() => onToggleProvinceCollapse(group.provinceId)}
                  />
                </TableCell>
              </TableRow>
              {collapsed ? null : group.districts.length ? (
                group.districts.map(({ row, rowNumber }) => (
                  <LocationTableRow key={locationId(row, "district") || rowNumber} {...handlers} kind="district" row={row} rowNumber={rowNumber} />
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columnCount} className="text-center text-muted-foreground">
                    {t("settings.emptyProvinceDistricts")}
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function DistrictMobileList({
  collapsedProvinces,
  groups,
  onToggleProvinceCollapse,
  ...handlers
}: RowHandlers & GroupProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const collapsed = collapsedProvinces.has(group.provinceId);
        return (
          <section key={group.provinceId} className="flex flex-col gap-2">
            <ProvinceGroupToggle
              collapsed={collapsed}
              count={group.districts.length}
              name={group.provinceName}
              onToggle={() => onToggleProvinceCollapse(group.provinceId)}
            />
            {collapsed ? null : group.districts.length ? (
              <ItemGroup className="@xl:grid @xl:grid-cols-2">
                {group.districts.map(({ row, rowNumber }) => (
                  <LocationItem key={locationId(row, "district") || rowNumber} {...handlers} kind="district" row={row} />
                ))}
              </ItemGroup>
            ) : (
              <p className="text-center text-xs text-muted-foreground">{t("settings.emptyProvinceDistricts")}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
