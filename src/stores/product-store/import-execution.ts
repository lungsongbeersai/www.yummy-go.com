import type { ProductImportDraft } from "@/features/product/list/product-import-utils";
import { normalizeProductImportKey } from "@/lib/product-import";
import type { Product, SaveProductInput } from "@/services/product";

export interface ProductImportExecutionResult {
  succeededKeys: string[];
  failures: Record<string, string>;
}

export interface ProductImportReconcileCandidate {
  key: string;
  payload: SaveProductInput;
}

export type ProductImportResultTone = "success" | "partial" | "error";

export function productMatchesImportPayload(
  product: Product,
  payload: SaveProductInput,
): boolean {
  const expectedCode = normalizeProductImportKey(payload.prod_code);
  const actualCode = normalizeProductImportKey(product.prod_code);
  if (!expectedCode || actualCode !== expectedCode) return false;

  const expectedBranch = normalizeProductImportKey(payload.branch_uuid_fk);
  const actualBranch = normalizeProductImportKey(product.branch_uuid_fk);
  if (expectedBranch && actualBranch && actualBranch !== expectedBranch) {
    return false;
  }

  const expectedNames = new Set(
    [payload.prod_name_la, payload.prod_name_eng]
      .map(normalizeProductImportKey)
      .filter(Boolean),
  );
  const actualNames = [
    product.prod_name,
    product.prod_name_la,
    product.prod_name_eng,
  ]
    .map(normalizeProductImportKey)
    .filter(Boolean);

  return (
    expectedNames.size > 0 &&
    actualNames.some((name) => expectedNames.has(name))
  );
}

export function productImportResultTone(
  succeeded: number,
  failed: number,
): ProductImportResultTone {
  if (failed > 0) return succeeded > 0 ? "partial" : "error";
  return "success";
}

export async function executeProductImportDrafts(
  drafts: ProductImportDraft[],
  alreadySucceeded: ReadonlySet<string>,
  save: (payload: SaveProductInput) => Promise<Product>,
  reconcile: (
    candidates: readonly ProductImportReconcileCandidate[],
  ) => Promise<ReadonlySet<string>>,
): Promise<ProductImportExecutionResult> {
  const succeededKeys = new Set(alreadySucceeded);
  const failures: Record<string, string> = {};
  const reconcileCandidates: ProductImportReconcileCandidate[] = [];

  for (const draft of drafts) {
    if (
      succeededKeys.has(draft.key) ||
      draft.validationErrors.length ||
      !draft.payload
    ) {
      continue;
    }

    try {
      await save(draft.payload);
      succeededKeys.add(draft.key);
    } catch (error) {
      failures[draft.key] =
        error instanceof Error ? error.message : "Import failed";
      reconcileCandidates.push({ key: draft.key, payload: draft.payload });
    }
  }

  if (reconcileCandidates.length) {
    try {
      const reconciledKeys = await reconcile(reconcileCandidates);
      reconcileCandidates.forEach(({ key }) => {
        if (!reconciledKeys.has(key)) return;
        succeededKeys.add(key);
        delete failures[key];
      });
    } catch {
      // Preserve the original mutation errors when the confirmation read also fails.
    }
  }

  return { succeededKeys: [...succeededKeys], failures };
}
