export function createMutationUuid() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

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
