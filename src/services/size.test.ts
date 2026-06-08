import { describe, expect, it } from "vitest";
import { sizePayloadForStatus } from "@/services/size";

describe("size service helpers", () => {
  it("builds settings size payload with status 1", () => {
    expect(
      sizePayloadForStatus(
        {
          size_uuid: "",
          size_name_la: "Small",
          size_name_eng: "Small",
          store_uuid_fk: "store-1"
        },
        1
      )
    ).toMatchObject({
      size_uuid: "",
      size_name_la: "Small",
      size_name_eng: "Small",
      store_uuid_fk: "store-1",
      status_sort_fk: 1
    });
  });

  it("builds product set option payload with status 2", () => {
    expect(
      sizePayloadForStatus(
        {
          size_uuid: "",
          size_name_la: "Set item",
          size_name_eng: "Set item",
          store_uuid_fk: "store-1"
        },
        2
      )
    ).toMatchObject({
      size_uuid: "",
      size_name_la: "Set item",
      size_name_eng: "Set item",
      store_uuid_fk: "store-1",
      status_sort_fk: 2
    });
  });
});
