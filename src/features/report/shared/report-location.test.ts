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
    zone_name_la: "ໂຊນ A",
    zone_name_eng: "Zone A",
  },
  {
    zone_uuid: "zone-b",
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
});
