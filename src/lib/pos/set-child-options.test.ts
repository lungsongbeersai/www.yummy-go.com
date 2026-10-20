import { describe, expect, it } from "vitest";
import {
  cartTasteName,
  cartItemSelectionNames,
  cartSelectionNames,
  setChildOptionNames,
  unscopedCartTastes,
} from "./set-child-options";

describe("setChildOptionNames", () => {
  it("keeps a selected SET option without sauces visible", () => {
    expect(setChildOptionNames([
      {
        set_detail_option_group_uuid_fk: "group-chicken",
        set_child_option_uuid_fk: "chicken",
        group_name_la: "ໄກ່",
        group_name_eng: "Chicken",
        taste_uuid_fks: [],
      },
    ])).toEqual(["ໄກ່"]);
  });

  it("uses the selected child label and falls back across languages", () => {
    const options = [
      { group_name_la: "ໝູ", group_name_eng: "Pork" },
      { group_name_la: " ", group_name_eng: "Chicken" },
      { child_option_name_la: "ໄກ່", group_name_la: " " },
      { group_name_la: " " },
    ];
    expect(setChildOptionNames(options)).toEqual(["ໝູ", "Chicken", "ໄກ່"]);
    expect(setChildOptionNames(options, "en-US")).toEqual(["Pork", "Chicken", "ໄກ່"]);
    expect(setChildOptionNames(undefined)).toEqual([]);
  });
});

describe("unscopedCartTastes", () => {
  const mala = { taste_uuid_fk: "mala", taste_name_la: "ນ້ຳຊຸບມາລ່າ" };
  const sesame = { taste_uuid_fk: "sesame", taste_name_la: "ແຈ່ວງາ" };

  it("leaves each SET sauce under its own component instead of duplicating it on the parent", () => {
    expect(unscopedCartTastes({
      tastes: [mala, sesame],
      toppings: [
        { topping_name: "Dumplings", tastes: [sesame] },
        { topping_name: "Noodles", tastes: [mala] },
      ],
    })).toEqual([]);
  });

  it("preserves legacy and independent parent tastes", () => {
    expect(unscopedCartTastes({ tastes: [mala, sesame] })).toEqual([mala, sesame]);
    expect(unscopedCartTastes({
      tastes: [mala, sesame],
      toppings: [{ tastes: [mala] }],
    })).toEqual([sesame]);
  });

  it("shows grouped selections only under their owning SET components", () => {
    const chicken = {
      set_detail_option_group_uuid_fk: "group-chicken",
      group_name_la: "ໄກ່",
    };
    const pork = {
      set_detail_option_group_uuid_fk: "group-pork",
      group_name_la: "ໝູ",
    };
    const dumplings = { set_child_options: [chicken], tastes: [sesame] };
    const noodles = { set_child_options: [pork], tastes: [mala] };
    expect(cartItemSelectionNames({
      set_child_options: [chicken],
      tastes: [sesame, mala],
      toppings: [dumplings, noodles],
    })).toEqual([]);
    expect(cartSelectionNames(dumplings)).toEqual(["ໄກ່", "ແຈ່ວງາ"]);
    expect(cartSelectionNames(noodles)).toEqual(["ໝູ", "ນ້ຳຊຸບມາລ່າ"]);
    expect(cartItemSelectionNames({ set_child_options: [chicken] }))
      .toEqual(["ໄກ່"]);
  });

  it("keeps the selected option before its independently localized sauce", () => {
    expect(cartSelectionNames({
      set_child_options: [{ group_name_la: "ໄກ່" }],
      tastes: [sesame],
    })).toEqual(["ໄກ່", "ແຈ່ວງາ"]);
    expect(cartTasteName({ taste_name_la: "ແຈ່ວງາ", taste_name_eng: "Sesame" }, "en"))
      .toBe("Sesame");
  });
});

describe("cartSelectionNames", () => {
  const sesame = { taste_uuid_fk: "sesame", taste_name_eng: "Sesame" };
  const chili = { taste_uuid: "chili", taste_name_eng: "Chili" };

  it("pairs each selected child with its own sauces on the same SET detail", () => {
    expect(cartSelectionNames({
      set_child_options: [
        { group_name_eng: "Chicken", taste_uuid_fks: ["sesame"] },
        { group_name_eng: "Pork", taste_uuid_fks: ["chili"] },
      ],
      tastes: [chili, sesame],
    }, "en")).toEqual(["Chicken", "Sesame", "Pork", "Chili"]);
  });

  it("shows a shared sauce for each child that selected it without repeating a trailing sauce", () => {
    expect(cartSelectionNames({
      set_child_options: [
        { group_name_eng: "Chicken", taste_uuid_fks: ["sesame"] },
        { group_name_eng: "Pork", taste_uuid_fks: ["sesame", "chili"] },
      ],
      tastes: [sesame, chili],
    }, "en")).toEqual(["Chicken", "Sesame", "Pork", "Sesame", "Chili"]);
  });

  it("preserves unassociated sauces when associations are missing or only partially available", () => {
    expect(cartSelectionNames({
      set_child_options: [
        { group_name_eng: "Chicken", taste_uuid_fks: ["sesame", "missing"] },
        { group_name_eng: "Pork" },
      ],
      tastes: [chili, sesame],
    }, "en")).toEqual(["Chicken", "Sesame", "Pork", "Chili"]);
    expect(cartSelectionNames({
      set_child_options: [
        { group_name_eng: "Chicken" },
        { group_name_eng: "Pork", taste_uuid_fks: [] },
      ],
      tastes: [chili, sesame],
    }, "en")).toEqual(["Chicken", "Pork", "Chili", "Sesame"]);
  });
});
