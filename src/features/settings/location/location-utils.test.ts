import { describe, expect, it } from "vitest";
import {
  buildDistrictPayload,
  buildProvincePayload,
  groupDistrictRows,
  locationName,
  missingDistrictField,
  missingProvinceField,
  provinceLabel
} from "@/features/settings/location/location-utils";

describe("location utils", () => {
  it("groups districts by province with province fallbacks", () => {
    const provinceById = new Map([
      ["province-1", { province_uuid: "province-1", province_name: "Vientiane" }],
      ["province-2", { province_uuid: "province-2", province_name_la: "Luang Prabang" }]
    ]);

    const groups = groupDistrictRows(
      [
        { district_uuid: "district-1", district_name: "Chanthabuly", province_uuid_fk: "province-1" },
        { district_uuid: "district-2", district_name: "Sikhottabong", province_uuid_fk: "province-1" },
        { district_uuid: "district-3", district_name: "Xieng Ngeun", province_uuid_fk: "province-2" }
      ],
      provinceById
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]?.provinceName).toBe("Vientiane");
    expect(groups[0]?.districts.map(({ row }) => row.district_uuid)).toEqual(["district-1", "district-2"]);
    expect(groups[1]?.provinceName).toBe("Luang Prabang");
  });

  it("builds district create payload without district id", () => {
    expect(
      buildDistrictPayload({
        editing: null,
        nameEng: "Chanthabuly",
        nameLa: "ຈັນທະບູລີ",
        provinceUuid: "province-1"
      })
    ).toEqual({
      province_uuid_fk: "province-1",
      district_name_la: "ຈັນທະບູລີ",
      district_name_eng: "Chanthabuly"
    });
  });

  it("keeps the district id for edit payloads", () => {
    expect(
      buildDistrictPayload({
        editing: { district_uuid: "district-1", district_name: "Old" },
        nameEng: "Chanthabuly",
        nameLa: "ຈັນທະບູລີ",
        provinceUuid: "province-1"
      })
    ).toEqual({
      district_uuid: "district-1",
      province_uuid_fk: "province-1",
      district_name_la: "ຈັນທະບູລີ",
      district_name_eng: "Chanthabuly"
    });
  });

  it("builds province payloads and keeps id only on edit", () => {
    expect(buildProvincePayload({ editing: null, nameEng: " Vientiane ", nameLa: " Vientiane LA " })).toEqual({
      province_name_la: "Vientiane LA",
      province_name_eng: "Vientiane"
    });
    expect(
      buildProvincePayload({
        editing: { province_uuid: "province-1", province_name: "Old" },
        nameEng: "Vientiane",
        nameLa: "ວຽງຈັນ"
      })
    ).toEqual({
      province_uuid: "province-1",
      province_name_la: "ວຽງຈັນ",
      province_name_eng: "Vientiane"
    });
  });

  it("detects missing district required fields", () => {
    expect(missingDistrictField({ provinceUuid: "", nameLa: "ຈັນທະບູລີ" })).toBe("province");
    expect(missingDistrictField({ provinceUuid: "province-1", nameLa: "" })).toBe("name");
    expect(missingDistrictField({ provinceUuid: "province-1", nameLa: "ຈັນທະບູລີ" })).toBeNull();
  });

  it("detects missing province required fields", () => {
    expect(missingProvinceField({ nameLa: "" })).toBe("name");
    expect(missingProvinceField({ nameLa: "Vientiane LA" })).toBeNull();
  });

  it("uses name and province fallbacks", () => {
    expect(locationName({ province_name: "Display", province_name_la: "LA", province_name_eng: "EN" }, "province")).toBe("Display");
    expect(locationName({ province_name_la: "LA", province_name_eng: "EN" }, "province")).toBe("LA");
    expect(locationName({ province_name_eng: "EN" }, "province")).toBe("EN");
    expect(locationName({ district_name: "Display", district_name_la: "LA", district_name_eng: "EN" }, "district")).toBe("Display");
    expect(locationName({ district_name_la: "LA", district_name_eng: "EN" }, "district")).toBe("LA");
    expect(locationName({ district_name_eng: "EN" }, "district")).toBe("EN");
    expect(locationName(null, "district")).toBe("-");
    expect(provinceLabel({ province_name: "Display", province_name_la: "LA", province_name_eng: "EN" })).toBe("Display");
  });
});
