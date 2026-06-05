import { describe, expect, it } from "vitest";
import { buildZonePayload, missingZoneField, zoneName } from "@/features/settings/zone/zone-utils";

describe("zone utils", () => {
  it("builds create payload with an empty zone id", () => {
    expect(
      buildZonePayload({
        branchUuid: "branch-1",
        editing: null,
        nameEng: "Patio",
        nameLa: "Outdoor"
      })
    ).toEqual({
      branch_uuid_fk: "branch-1",
      zone_uuid: "",
      zone_name_la: "Outdoor",
      zone_name_eng: "Patio"
    });
  });

  it("keeps the zone id for edit payloads", () => {
    expect(
      buildZonePayload({
        branchUuid: "branch-1",
        editing: { zone_uuid: "zone-1", zone_name: "Indoor" },
        nameEng: "Inside",
        nameLa: "Indoor"
      })
    ).toEqual({
      branch_uuid_fk: "branch-1",
      zone_uuid: "zone-1",
      zone_name_la: "Indoor",
      zone_name_eng: "Inside"
    });
  });

  it("detects missing required fields", () => {
    expect(missingZoneField({ branchUuid: "", nameLa: "Indoor" })).toBe("branch");
    expect(missingZoneField({ branchUuid: "branch-1", nameLa: "" })).toBe("name");
    expect(missingZoneField({ branchUuid: "branch-1", nameLa: "Indoor" })).toBeNull();
  });

  it("uses zone name fallbacks", () => {
    expect(zoneName({ zone_uuid: "zone-1", zone_name: "Display", zone_name_la: "LA", zone_name_eng: "EN" })).toBe("Display");
    expect(zoneName({ zone_uuid: "zone-1", zone_name_la: "LA", zone_name_eng: "EN" })).toBe("LA");
    expect(zoneName({ zone_uuid: "zone-1", zone_name_eng: "EN" })).toBe("EN");
    expect(zoneName(null)).toBe("-");
  });
});
