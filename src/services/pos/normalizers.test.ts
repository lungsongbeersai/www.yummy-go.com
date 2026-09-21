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
    });
  });
});
