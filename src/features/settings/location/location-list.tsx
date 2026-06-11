"use client";

import { Fragment, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, MapPin, MapPinned } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsRowActions,
  SettingsTableScroll
} from "@/features/settings/shared/settings-shell";
import {
  locationId,
  locationName,
  locationValue,
  provinceLabel,
  type LocationKind,
  type NumberedDistrictGroup
} from "./location-utils";
import type { LocationLabels, LocationSettingsRow } from "./location-types";

export function LocationListSurface({
  allCollapsed,
  allSelected,
  backgroundLoading,
  canManage,
  collapsedProvinces,
  districtGroups,
  kind,
  labels,
  listTitle,
  page,
  pageEnd,
  pageStart,
  provinceById,
  refreshLabel,
  rows,
  selectedRows,
  title,
  toolbar,
  total,
  totalPages,
  onDelete,
  onEdit,
  onToggleAll,
  onToggleAllGroups,
  onToggleProvinceCollapse,
  onToggleSelected
}: {
  allCollapsed: boolean;
  allSelected: boolean;
  backgroundLoading: boolean;
  canManage: boolean;
  collapsedProvinces: Set<string>;
  districtGroups: NumberedDistrictGroup[];
  kind: LocationKind;
  labels: LocationLabels;
  listTitle: string;
  page: number;
  pageEnd: number;
  pageStart: number;
  provinceById: Map<string, LocationSettingsRow>;
  refreshLabel: string;
  rows: LocationSettingsRow[];
  selectedRows: Set<string>;
  title: string;
  toolbar: ReactNode;
  total: number;
  totalPages: number;
  onDelete: (row: LocationSettingsRow) => void;
  onEdit: (row: LocationSettingsRow) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleAllGroups: () => void;
  onToggleProvinceCollapse: (provinceId: string) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const tableColumnCount = 3 + (kind === "district" ? 1 : 0) + (canManage ? 1 : 0);
  const groupToggleAction =
    kind === "district" && districtGroups.length > 0 ? (
      <Button
        size="xs"
        type="button"
        variant="outline"
        onClick={onToggleAllGroups}
      >
        {allCollapsed ? <ChevronsUpDown data-icon="inline-start" /> : <ChevronsDownUp data-icon="inline-start" />}
        {allCollapsed ? t("actions.expandAll") : t("actions.collapseAll")}
      </Button>
    ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur sm:px-4 lg:px-5">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="text-sm font-black">{listTitle}</p>
              {groupToggleAction}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("common.showingRange", { start: pageStart, end: pageEnd, total })} - {t("common.page", { current: page, total: totalPages })}
            </p>
          </div>
          <div className="min-w-0 xl:max-w-[48rem]">{toolbar}</div>
        </div>
        {backgroundLoading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner aria-hidden />
            {refreshLabel}
          </div>
        ) : null}
      </div>
      {rows.length ? (
        <>
          <div className="hidden min-h-0 flex-1 md:flex">
            <LocationTable
              allSelected={allSelected}
              canManage={canManage}
              collapsedProvinces={collapsedProvinces}
              kind={kind}
              labels={labels}
              districtGroups={districtGroups}
              pageStart={pageStart}
              provinceById={provinceById}
              rows={rows}
              selectedRows={selectedRows}
              tableColumnCount={tableColumnCount}
              onDelete={onDelete}
              onEdit={onEdit}
              onToggleAll={onToggleAll}
              onToggleProvinceCollapse={onToggleProvinceCollapse}
              onToggleSelected={onToggleSelected}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto md:hidden">
            <LocationMobileList
              canManage={canManage}
              collapsedProvinces={collapsedProvinces}
              kind={kind}
              labels={labels}
              districtGroups={districtGroups}
              pageStart={pageStart}
              provinceById={provinceById}
              rows={rows}
              selectedRows={selectedRows}
              onDelete={onDelete}
              onEdit={onEdit}
              onToggleProvinceCollapse={onToggleProvinceCollapse}
              onToggleSelected={onToggleSelected}
            />
          </div>
        </>
      ) : (
        <div className="flex min-h-72 flex-1 items-center justify-center p-4">
          <Empty className="max-w-md border border-dashed bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {kind === "province" ? <MapPin aria-hidden /> : <MapPinned aria-hidden />}
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

function LocationTable({
  allSelected,
  canManage,
  collapsedProvinces,
  districtGroups,
  kind,
  labels,
  onDelete,
  onEdit,
  onToggleAll,
  onToggleProvinceCollapse,
  onToggleSelected,
  pageStart,
  provinceById,
  rows,
  selectedRows,
  tableColumnCount
}: {
  allSelected: boolean;
  canManage: boolean;
  collapsedProvinces: Set<string>;
  districtGroups: NumberedDistrictGroup[];
  kind: LocationKind;
  labels: LocationLabels;
  onDelete: (row: LocationSettingsRow) => void;
  onEdit: (row: LocationSettingsRow) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleProvinceCollapse: (provinceId: string) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  pageStart: number;
  provinceById: Map<string, LocationSettingsRow>;
  rows: LocationSettingsRow[];
  selectedRows: Set<string>;
  tableColumnCount: number;
}) {
  const { t } = useTranslation();

  return (
    <SettingsTableScroll>
      <Table className={kind === "province" ? "min-w-[860px]" : "min-w-[940px]"}>
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => onToggleAll(event.target.checked)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">{labels.no}</TableHead>
            <TableHead>{kind === "province" ? labels.province : labels.district}</TableHead>
            {kind === "province" ? (
              <>
                <TableHead>{t("fields.province_name_la")}</TableHead>
                <TableHead>{t("fields.province_name_eng")}</TableHead>
              </>
            ) : (
              <TableHead>{labels.province}</TableHead>
            )}
            {canManage ? <TableHead className="w-16 text-right">{t("common.actions")}</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {kind === "district"
            ? districtGroups.map((group) => {
                const collapsed = collapsedProvinces.has(group.provinceId);
                return (
                  <Fragment key={group.provinceId}>
                    <TableRow className="bg-muted/40 hover:bg-muted/60">
                      <TableCell colSpan={tableColumnCount} className="px-2 py-0">
                        <Button
                          aria-expanded={!collapsed}
                          aria-label={collapsed ? t("settings.expandProvince", { province: group.provinceName }) : t("settings.collapseProvince", { province: group.provinceName })}
                          type="button"
                          variant="ghost"
                          className="h-auto w-full justify-start px-2 py-2 text-left font-bold"
                          onClick={() => onToggleProvinceCollapse(group.provinceId)}
                        >
                          {collapsed ? <ChevronRight data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
                          <MapPin data-icon="inline-start" />
                          <span className="min-w-0 flex-1 truncate">{group.provinceName}</span>
                          <Badge className="bg-primary/10 text-primary tabular-nums">{group.districts.length}</Badge>
                        </Button>
                      </TableCell>
                    </TableRow>
                    {collapsed ? null : group.districts.length ? (
                      group.districts.map(({ row, rowNumber }) => (
                        <LocationTableRow
                          key={locationId(row, kind) || rowNumber}
                          canManage={canManage}
                          kind={kind}
                          provinceById={provinceById}
                          row={row}
                          rowNumber={rowNumber}
                          selectedRows={selectedRows}
                          onDelete={onDelete}
                          onEdit={onEdit}
                          onToggleSelected={onToggleSelected}
                        />
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={tableColumnCount} className="h-16 text-center text-sm text-muted-foreground">
                          {t("settings.emptyProvinceDistricts")}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            : rows.map((row, index) => (
                <LocationTableRow
                  key={locationId(row, kind) || pageStart + index}
                  canManage={canManage}
                  kind={kind}
                  provinceById={provinceById}
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

function LocationTableRow({
  canManage,
  kind,
  onDelete,
  onEdit,
  onToggleSelected,
  provinceById,
  row,
  rowNumber,
  selectedRows
}: {
  canManage: boolean;
  kind: LocationKind;
  onDelete: (row: LocationSettingsRow) => void;
  onEdit: (row: LocationSettingsRow) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  provinceById: Map<string, LocationSettingsRow>;
  row: LocationSettingsRow;
  rowNumber: number;
  selectedRows: Set<string>;
}) {
  const { t } = useTranslation();
  const id = locationId(row, kind);
  const name = locationName(row, kind);
  const selected = selectedRows.has(id);
  const relatedProvince = provinceById.get(locationValue(row, "province_uuid_fk"));
  const laoName = locationValue(row, `${kind}_name_la`, "-");
  const englishName = locationValue(row, `${kind}_name_eng`, "-");

  return (
    <TableRow className="h-14" data-state={selected ? "selected" : undefined}>
      <TableCell className="w-10 px-2">
        <Checkbox
          aria-label={t("common.selectRow", { name })}
          checked={selected}
          onChange={(event) => onToggleSelected(id, event.target.checked)}
        />
      </TableCell>
      <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black tabular-nums text-muted-foreground">{rowNumber}</TableCell>
      <TableCell className="max-w-[30rem]">
        <div className="flex min-w-0 items-center gap-3">
          <LocationIcon kind={kind} />
          <div className="min-w-0">
            <p className="truncate font-black">{name}</p>
            {kind === "district" ? <p className="truncate text-xs text-muted-foreground">{laoName} / {englishName}</p> : null}
          </div>
        </div>
      </TableCell>
      {kind === "province" ? (
        <>
          <TableCell className="max-w-[18rem] text-muted-foreground">
            <span className="block truncate">{laoName}</span>
          </TableCell>
          <TableCell className="max-w-[18rem] text-muted-foreground">
            <span className="block truncate">{englishName}</span>
          </TableCell>
        </>
      ) : (
        <TableCell className="max-w-[18rem] text-muted-foreground">
          <span className="block truncate">{relatedProvince ? provinceLabel(relatedProvince) : provinceLabel(row)}</span>
        </TableCell>
      )}
      {canManage ? (
        <TableCell className="text-right">
          <SettingsRowActions row={row} onEdit={onEdit} onDelete={onDelete} />
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function LocationMobileList({
  canManage,
  collapsedProvinces,
  districtGroups,
  kind,
  labels,
  onDelete,
  onEdit,
  onToggleProvinceCollapse,
  onToggleSelected,
  pageStart,
  provinceById,
  rows,
  selectedRows
}: {
  canManage: boolean;
  collapsedProvinces: Set<string>;
  districtGroups: NumberedDistrictGroup[];
  kind: LocationKind;
  labels: LocationLabels;
  onDelete: (row: LocationSettingsRow) => void;
  onEdit: (row: LocationSettingsRow) => void;
  onToggleProvinceCollapse: (provinceId: string) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  pageStart: number;
  provinceById: Map<string, LocationSettingsRow>;
  rows: LocationSettingsRow[];
  selectedRows: Set<string>;
}) {
  const { t } = useTranslation();

  return (
    <SettingsMobileList>
      {kind === "district"
        ? districtGroups.map((group) => {
            const collapsed = collapsedProvinces.has(group.provinceId);
            return (
              <div key={group.provinceId} className="flex flex-col gap-2">
                <Button
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? t("settings.expandProvince", { province: group.provinceName }) : t("settings.collapseProvince", { province: group.provinceName })}
                  type="button"
                  variant="outline"
                  className="min-h-11 justify-start px-3 text-left"
                  onClick={() => onToggleProvinceCollapse(group.provinceId)}
                >
                  {collapsed ? <ChevronRight data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
                  <MapPin data-icon="inline-start" />
                  <span className="min-w-0 flex-1 truncate">{group.provinceName}</span>
                  <Badge className="bg-primary/10 text-primary tabular-nums">{group.districts.length}</Badge>
                </Button>
                {collapsed ? null : group.districts.length ? (
                  group.districts.map(({ row, rowNumber }) => (
                    <LocationMobileCard
                      key={locationId(row, kind) || rowNumber}
                      canManage={canManage}
                      kind={kind}
                      labels={labels}
                      provinceById={provinceById}
                      row={row}
                      rowNumber={rowNumber}
                      selectedRows={selectedRows}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onToggleSelected={onToggleSelected}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    {t("settings.emptyProvinceDistricts")}
                  </div>
                )}
              </div>
            );
          })
        : rows.map((row, index) => (
            <LocationMobileCard
              key={locationId(row, kind) || pageStart + index}
              canManage={canManage}
              kind={kind}
              labels={labels}
              provinceById={provinceById}
              row={row}
              rowNumber={pageStart + index}
              selectedRows={selectedRows}
              onDelete={onDelete}
              onEdit={onEdit}
              onToggleSelected={onToggleSelected}
            />
          ))}
    </SettingsMobileList>
  );
}

function LocationMobileCard({
  canManage,
  kind,
  labels,
  onDelete,
  onEdit,
  onToggleSelected,
  provinceById,
  row,
  rowNumber,
  selectedRows
}: {
  canManage: boolean;
  kind: LocationKind;
  labels: LocationLabels;
  onDelete: (row: LocationSettingsRow) => void;
  onEdit: (row: LocationSettingsRow) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  provinceById: Map<string, LocationSettingsRow>;
  row: LocationSettingsRow;
  rowNumber: number;
  selectedRows: Set<string>;
}) {
  const { t } = useTranslation();
  const id = locationId(row, kind);
  const name = locationName(row, kind);
  const selected = selectedRows.has(id);
  const relatedProvince = provinceById.get(locationValue(row, "province_uuid_fk"));

  return (
    <SettingsMobileCard
      actions={canManage ? <SettingsRowActions row={row} onEdit={onEdit} onDelete={onDelete} /> : undefined}
      badges={<Badge className="shrink-0 tabular-nums">{rowNumber}</Badge>}
      checked={selected}
      leading={<LocationIcon kind={kind} />}
      selectLabel={t("common.selectRow", { name })}
      selected={selected}
      subtitle={
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="block truncate">
            {locationValue(row, `${kind}_name_la`, "-")} / {locationValue(row, `${kind}_name_eng`, "-")}
          </span>
        </span>
      }
      title={name}
      onCheckedChange={(checked) => onToggleSelected(id, checked)}
    >
      {kind === "district" ? (
        <SettingsMobileMetaGrid>
          <SettingsMobileMeta label={labels.province} value={relatedProvince ? provinceLabel(relatedProvince) : provinceLabel(row)} />
        </SettingsMobileMetaGrid>
      ) : null}
    </SettingsMobileCard>
  );
}

function LocationIcon({ kind }: { kind: LocationKind }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
      {kind === "province" ? <MapPin aria-hidden /> : <MapPinned aria-hidden />}
    </span>
  );
}
