import { describe, expect, it } from "vitest";
import { mapApiProdItem } from "./normalizers";

describe("POS product normalizers", () => {
  it("maps nested SET tastes onto their owning detail", () => {
    const item = mapApiProdItem({
      prod_uuid: "prod-set",
      prod_name: "SET",
      prod_status_imge: 2,
      prod_image: "#10b981",
      details: [
        {
          pro_detail_uuid: "detail-chicken",
          set_taste_max_select: 2,
          set_tastes: [
            {
              taste_uuid: "taste-mala",
              taste_name_la: "ແຈ່ວມາລ່າ",
              taste_status: 1,
            },
          ],
          set_option_groups: [
            {
              set_detail_option_group_uuid: "group-sauce",
              set_child_option_uuid_fk: "child-chicken",
              group_name_la: "ນ້ຳຈິ້ມ",
              max_select: 1,
              taste_uuid_fks: ["taste-mala"],
              tastes: [
                {
                  taste_uuid: "taste-mala",
                  taste_name_la: "ແຈ່ວມາລ່າ",
                  taste_status: 1,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(item.details[0]).toMatchObject({
      proDetailUuid: "detail-chicken",
      setTasteMaxSelect: 2,
      setTastes: [
        {
          tasteUuid: "taste-mala",
          tasteNameLa: "ແຈ່ວມາລ່າ",
          tasteStatus: 1,
        },
      ],
      setOptionGroups: [
        {
          setDetailOptionGroupUuid: "group-sauce",
          setChildOptionUuidFk: "child-chicken",
          groupNameLa: "ນ້ຳຈິ້ມ",
          maxSelect: 1,
          tasteUuidFks: ["taste-mala"],
          tastes: [{ tasteUuid: "taste-mala" }],
        },
      ],
    });
  });
});
