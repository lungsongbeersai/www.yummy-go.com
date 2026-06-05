import { describe, expect, it } from "vitest";
import { buildToppingPayload, missingToppingField, toppingName } from "@/features/settings/topping/topping-utils";

describe("topping utils", () => {
  it("builds create payload without a topping id", () => {
    expect(
      buildToppingPayload({
        editing: null,
        nameEng: "Egg ",
        nameLa: " Egg Lao ",
        storeUuid: "store-1"
      })
    ).toEqual({
      store_uuid_fk: "store-1",
      topping_name_la: "Egg Lao",
      topping_name_eng: "Egg"
    });
  });

  it("keeps the topping id for edit payloads", () => {
    expect(
      buildToppingPayload({
        editing: { topping_uuid: "topping-1", topping_name: "Display" },
        nameEng: "Cheese",
        nameLa: "Cheese Lao",
        storeUuid: "store-1"
      })
    ).toEqual({
      store_uuid_fk: "store-1",
      topping_uuid: "topping-1",
      topping_name_la: "Cheese Lao",
      topping_name_eng: "Cheese"
    });
  });

  it("detects missing required fields", () => {
    expect(missingToppingField({ storeUuid: "", nameLa: "Name" })).toBe("store");
    expect(missingToppingField({ storeUuid: "store-1", nameLa: "" })).toBe("name");
    expect(missingToppingField({ storeUuid: "store-1", nameLa: "   " })).toBe("name");
    expect(missingToppingField({ storeUuid: "store-1", nameLa: "Egg" })).toBeNull();
  });

  it("uses topping name fallbacks", () => {
    expect(toppingName({ topping_uuid: "topping-1", topping_name: "Display", topping_name_la: "LA", topping_name_eng: "EN" })).toBe("Display");
    expect(toppingName({ topping_uuid: "topping-1", topping_name_la: "LA", topping_name_eng: "EN" })).toBe("LA");
    expect(toppingName({ topping_uuid: "topping-1", topping_name_eng: "EN" })).toBe("EN");
    expect(toppingName(null)).toBe("-");
  });
});
