import { describe, expect, it } from "vitest";
import {
  branchServiceCharge,
  buildTablePayload,
  flattenTableRows,
  groupTableRows,
  missingTableField,
  serviceChargeSummary
} from "@/features/settings/table/table-utils";
import type { TableListRow } from "@/services/table";
import type { Zone } from "@/services/zone";

describe("table utils", () => {
  it("flattens grouped zone responses with zone fallback", () => {
    const rows: TableListRow[] = [
      {
        zone_uuid: "zone-1",
        zone_name: "Indoor",
        total_tables: 1,
        tables: [{ table_uuid: "table-1", table_name: "T01" }]
      }
    ];

    expect(flattenTableRows(rows)).toEqual([
      {
        table_uuid: "table-1",
        table_name: "T01",
        zone_uuid_fk: "zone-1",
        zone_name: "Indoor"
      }
    ]);
  });

  it("groups flat table rows by zone option", () => {
    const zones = new Map<string, Zone>([["zone-1", { zone_uuid: "zone-1", zone_name: "Patio" }]]);
    const groups = groupTableRows([{ table_uuid: "table-1", table_name: "A1", zone_uuid_fk: "zone-1" }], zones);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      zoneId: "zone-1",
      zoneName: "Patio",
      totalTables: 1
    });
  });

  it("formats branch service charge fallback", () => {
    const active = branchServiceCharge({ charge_status: 1, charge_name: 7.5 });
    const inactive = branchServiceCharge({ charge_status: 2, charge_name: 10 });

    expect(active).toEqual({ active: true, percent: 7.5, percentLabel: "7.5%" });
    expect(serviceChargeSummary({ activeLabel: "Active", inactiveLabel: "Inactive", loading: false, loadingLabel: "Loading", serviceCharge: active })).toBe("Active / 7.5%");
    expect(serviceChargeSummary({ activeLabel: "Active", inactiveLabel: "Inactive", loading: false, loadingLabel: "Loading", serviceCharge: inactive })).toBe("Inactive / 0%");
    expect(serviceChargeSummary({ activeLabel: "Active", inactiveLabel: "Inactive", loading: true, loadingLabel: "Loading", serviceCharge: active })).toBe("Loading");
  });

  it("builds create payload with an empty table id", () => {
    expect(
      buildTablePayload({
        branchUuid: "branch-1",
        chargeStatus: "1",
        editing: null,
        nameEng: "A1",
        nameLa: "ໂຕະ 1",
        seats: "4",
        zoneUuid: "zone-1"
      })
    ).toEqual({
      branch_uuid_fk: "branch-1",
      zone_uuid_fk: "zone-1",
      table_uuid: "",
      table_name_la: "ໂຕະ 1",
      table_name_eng: "A1",
      table_qty: 4,
      charge_status: 1
    });
  });

  it("keeps the table id for edit payloads", () => {
    expect(
      buildTablePayload({
        branchUuid: "branch-1",
        chargeStatus: "2",
        editing: { table_uuid: "table-1", table_name: "A1" },
        nameEng: "",
        nameLa: "A1",
        seats: "",
        zoneUuid: "zone-1"
      })
    ).toEqual({
      branch_uuid_fk: "branch-1",
      zone_uuid_fk: "zone-1",
      table_uuid: "table-1",
      table_name_la: "A1",
      table_name_eng: "",
      charge_status: 2
    });
  });

  it("detects missing required fields", () => {
    expect(missingTableField({ branchUuid: "", nameLa: "A1", zoneUuid: "zone-1" })).toBe("branch");
    expect(missingTableField({ branchUuid: "branch-1", nameLa: "A1", zoneUuid: "" })).toBe("zone");
    expect(missingTableField({ branchUuid: "branch-1", nameLa: "", zoneUuid: "zone-1" })).toBe("name");
    expect(missingTableField({ branchUuid: "branch-1", nameLa: "A1", zoneUuid: "zone-1" })).toBeNull();
  });
});
