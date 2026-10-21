import { describe, expect, it } from "vitest";
import type { TableListRow } from "@/services/table";
import type { Zone } from "@/services/zone";
import {
  buildReportLocationOptions,
  reportLocationParams,
} from "./report-location";

const zones: Zone[] = [
  {
    zone_uuid: "zone-a",
    branch_uuid_fk: "branch-1",
    zone_name_la: "ໂຊນ A",
    zone_name_eng: "Zone A",
  },
  {
    zone_uuid: "zone-b",
    branch_uuid_fk: "branch-1",
    zone_name_la: "ໂຊນ B",
    zone_name_eng: "Zone B",
  },
];

const rows: TableListRow[] = [
  {
    zone_uuid: "zone-a",
    tables: [
      { table_uuid: "table-a1", table_name_la: "ໂຕະ A1", table_name_eng: "Table A1" },
    ],
  },
  {
    zone_uuid: "zone-b",
    tables: [
      { table_uuid: "table-b1", table_name_la: "ໂຕະ B1", table_name_eng: "Table B1" },
    ],
  },
];

describe("report location filters", () => {
  it("omits all-location sentinels from API params", () => {
    expect(reportLocationParams({ zoneUuid: "all", tableUuid: "all" })).toEqual({
      zone_uuid_fk: undefined,
      table_uuid_fk: undefined,
    });
  });

  it("maps selected zone and table to backend params", () => {
    expect(reportLocationParams({ zoneUuid: "zone-a", tableUuid: "table-a1" })).toEqual({
      zone_uuid_fk: "zone-a",
      table_uuid_fk: "table-a1",
    });
  });

  it("shows every table with its zone when all zones are selected", () => {
    const options = buildReportLocationOptions({
      allTablesLabel: "All tables",
      allZonesLabel: "All zones",
      branchUuid: "branch-1",
      language: "en",
      rows,
      selectedZoneUuid: "all",
      zones,
    });

    expect(options.zoneOptions).toEqual([
      { label: "All zones", value: "all" },
      { label: "Zone A", value: "zone-a" },
      { label: "Zone B", value: "zone-b" },
    ]);
    expect(options.tableOptions).toEqual([
      { label: "All tables", value: "all" },
      { label: "Zone A — Table A1", value: "table-a1" },
      { label: "Zone B — Table B1", value: "table-b1" },
    ]);
  });

  it("limits table choices to the selected zone", () => {
    const options = buildReportLocationOptions({
      allTablesLabel: "ທຸກໂຕະ",
      allZonesLabel: "ທຸກໂຊນ",
      branchUuid: "branch-1",
      language: "la",
      rows,
      selectedZoneUuid: "zone-b",
      zones,
    });

    expect(options.tableOptions).toEqual([
      { label: "ທຸກໂຕະ", value: "all" },
      { label: "ໂຕະ B1", value: "table-b1" },
    ]);
  });

  it("excludes zones and tables outside the selected branch from mixed responses", () => {
    const options = buildReportLocationOptions({
      allTablesLabel: "All tables",
      allZonesLabel: "All zones",
      branchUuid: "branch-1",
      language: "en",
      selectedZoneUuid: "all",
      zones: [...zones,
        { zone_uuid: "other-zone", branch_uuid_fk: "branch-2", zone_name: "Other branch" },
        { zone_uuid: "unknown-zone", zone_name: "Unknown branch" },
      ],
      rows: [...rows,
        { zone_uuid: "other-zone", branch_uuid_fk: "branch-2", tables: [{ table_uuid: "other-table" }] },
        { zone_uuid: "zone-a", branch_uuid_fk: "branch-2", tables: [{ table_uuid: "wrong-group-branch" }] },
        { zone_uuid: "zone-a", tables: [
          { table_uuid: "wrong-child-branch", branch_uuid_fk: "branch-2" },
          { table_uuid: "wrong-child-zone", zone_uuid_fk: "other-zone" },
        ] },
        { table_uuid: "unknown-zone-table", zone_uuid_fk: "unknown-zone" },
        { table_uuid: "other-flat-table", branch_uuid_fk: "branch-2", zone_uuid_fk: "zone-a" },
        { table_uuid: "own-flat-table", branch_uuid_fk: "branch-1", zone_uuid_fk: "zone-a", table_name: "Own table" },
      ],
    });

    expect(options.zoneOptions.map((option) => option.value)).toEqual(["all", "zone-a", "zone-b"]);
    expect(options.tableOptions.map((option) => option.value)).toEqual(["all", "table-a1", "table-b1", "own-flat-table"]);
  });

  it("shows only the new branch's locations after switching branch and rejects a stale zone", () => {
    const input = {
      allTablesLabel: "All tables", allZonesLabel: "All zones", language: "en", rows,
      zones: [...zones, { zone_uuid: "other-zone", branch_uuid_fk: "branch-2", zone_name: "Other branch" }],
    };
    const switched = buildReportLocationOptions({ ...input, branchUuid: "branch-2", selectedZoneUuid: "all" });
    expect(switched.zoneOptions.map((option) => option.value)).toEqual(["all", "other-zone"]);
    expect(switched.tableOptions.map((option) => option.value)).toEqual(["all"]);
    const stale = buildReportLocationOptions({ ...input, branchUuid: "branch-1", selectedZoneUuid: "other-zone" });
    expect(stale.tableOptions.map((option) => option.value)).toEqual(["all"]);
    const missing = buildReportLocationOptions({ ...input, branchUuid: "", selectedZoneUuid: "all" });
    expect(missing.zoneOptions.map((option) => option.value)).toEqual(["all"]);
    expect(missing.tableOptions.map((option) => option.value)).toEqual(["all"]);
  });
});
