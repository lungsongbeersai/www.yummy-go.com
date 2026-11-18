import { createUuid } from "@/lib/uuid";

export const createMutationUuid = createUuid;

export function ensureSplitItemUuidMap(
  selections: Array<Record<string, number>>,
  existing: Record<string, string> = {},
  uuidFactory: () => string = createMutationUuid,
) {
  const next = { ...existing };
  for (const selection of selections) {
    for (const sourceUuid of Object.keys(selection || {})) {
      if (!next[sourceUuid]) next[sourceUuid] = uuidFactory();
    }
  }
  return next;
}
