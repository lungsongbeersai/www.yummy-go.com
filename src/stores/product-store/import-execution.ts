import type { ProductImportDraft } from "@/features/product/list/product-import-utils";
import type { Product, SaveProductInput } from "@/services/product";

export interface ProductImportExecutionResult {
  succeededKeys: string[];
  failures: Record<string, string>;
}

export type ProductImportResultTone = "success" | "partial" | "error";

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
): Promise<ProductImportExecutionResult> {
  const succeededKeys = new Set(alreadySucceeded);
  const failures: Record<string, string> = {};

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
    }
  }

  return { succeededKeys: [...succeededKeys], failures };
}
