import { describe, expect, it, vi } from "vitest";
import type { ProductImportDraft } from "@/features/product/list/product-import-utils";
import type { Product } from "@/services/product";
import {
  executeProductImportDrafts,
  productMatchesImportPayload,
  productImportResultTone,
} from "./import-execution";

function draft(
  key: string,
  code: string,
  validationErrors: string[] = [],
): ProductImportDraft {
  return {
    key,
    type: "normal",
    sheetName: "Normal",
    rowNumbers: [2],
    productCode: code,
    productNameLa: code,
    productNameEng: code,
    categoryName: "Food",
    unitName: "Plate",
    sizeNames: ["Regular"],
    details: [
      {
        rowNumber: 2,
        referenceName: "Regular",
        costPrice: 10,
        salePrice: 20,
      },
    ],
    detailCount: 1,
    salePrice: 20,
    targetProductUuid: "",
    existingDetails: [],
    validationErrors,
    warnings: [],
    payload: {
      branch_uuid_fk: "branch-1",
      cate_uuid_fk: "category-1",
      unite_uuid_fk: "unit-1",
      prod_code: code,
      prod_name_la: code,
      details: [
        {
          size_uuid_fk: "size-1",
          pro_detail_bprice: 10,
          pro_detail_sprice: 20,
          pro_detail_qty_stock: 100,
          pro_detail_stock: 2,
        },
      ],
    },
    executionStatus: "pending",
    executionError: "",
  };
}

describe("executeProductImportDrafts", () => {
  it("never retries succeeded products and retries a failed product once", async () => {
    let failingAttempts = 0;
    const save = vi.fn(async (payload) => {
      const code = String(payload.prod_code);
      if (code === "FAIL" && failingAttempts === 0) {
        failingAttempts += 1;
        throw new Error("network timeout");
      }
      return { prod_uuid: `saved-${code}`, prod_code: code } as Product;
    });
    const drafts = [draft("success-key", "OK"), draft("failed-key", "FAIL")];

    const first = await executeProductImportDrafts(
      drafts,
      new Set(),
      save,
      async () => new Set(),
    );
    const second = await executeProductImportDrafts(
      drafts,
      new Set(first.succeededKeys),
      save,
      async () => new Set(),
    );

    expect(first).toEqual({
      succeededKeys: ["success-key"],
      failures: { "failed-key": "network timeout" },
    });
    expect(second).toEqual({
      succeededKeys: ["success-key", "failed-key"],
      failures: {},
    });
    expect(save.mock.calls.map(([payload]) => payload.prod_code)).toEqual([
      "OK",
      "FAIL",
      "FAIL",
    ]);
  });

  it("does not save drafts with validation errors or missing payloads", async () => {
    const invalid = draft("invalid-key", "INVALID", ["Duplicate product code"]);
    const missingPayload = { ...draft("missing-key", "MISSING"), payload: null };
    const save = vi.fn();

    const result = await executeProductImportDrafts(
      [invalid, missingPayload],
      new Set(),
      save,
      async () => new Set(),
    );

    expect(save).not.toHaveBeenCalled();
    expect(result).toEqual({ succeededKeys: [], failures: {} });
  });

  it("reconciles a committed save after the response is lost and never sends it again", async () => {
    const products: Product[] = [];
    const save = vi.fn(async (payload) => {
      products.push({
        prod_uuid: "saved-ambiguous",
        prod_code: payload.prod_code,
        prod_name_la: payload.prod_name_la,
        branch_uuid_fk: payload.branch_uuid_fk,
      });
      throw new Error("network timeout");
    });
    const reconcile = vi.fn(
      async (
        candidates: ReadonlyArray<{
          key: string;
          payload: NonNullable<ProductImportDraft["payload"]>;
        }>,
      ) =>
        new Set(
          candidates
            .filter(({ payload }) =>
              products.some((product) =>
                productMatchesImportPayload(product, payload),
              ),
            )
            .map(({ key }) => key),
        ),
    );
    const drafts = [draft("ambiguous-key", "AMBIGUOUS")];

    const first = await executeProductImportDrafts(
      drafts,
      new Set(),
      save,
      reconcile,
    );
    const second = await executeProductImportDrafts(
      drafts,
      new Set(first.succeededKeys),
      save,
      reconcile,
    );

    expect(first).toEqual({
      succeededKeys: ["ambiguous-key"],
      failures: {},
    });
    expect(second).toEqual(first);
    expect(save).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledTimes(1);
  });
});

describe("productMatchesImportPayload", () => {
  it("requires the same branch, normalized code, and at least one matching name", () => {
    const payload = draft("match-key", "ＡＢＣ  123").payload!;

    expect(
      productMatchesImportPayload(
        {
          prod_uuid: "product-1",
          prod_code: "abc 123",
          prod_name: "ＡＢＣ 123",
          branch_uuid_fk: "branch-1",
        },
        payload,
      ),
    ).toBe(true);
    expect(
      productMatchesImportPayload(
        {
          prod_uuid: "product-2",
          prod_code: "abc 123",
          prod_name: "Different product",
          branch_uuid_fk: "branch-1",
        },
        payload,
      ),
    ).toBe(false);
    expect(
      productMatchesImportPayload(
        {
          prod_uuid: "product-3",
          prod_code: "abc 123",
          prod_name: "ＡＢＣ 123",
          branch_uuid_fk: "branch-2",
        },
        payload,
      ),
    ).toBe(false);
  });
});

describe("productImportResultTone", () => {
  it("uses partial feedback for mixed results", () => {
    expect(productImportResultTone(1, 1)).toBe("partial");
    expect(productImportResultTone(0, 1)).toBe("error");
    expect(productImportResultTone(2, 0)).toBe("success");
  });
});
