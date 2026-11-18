export interface ExportCurrentGuard {
  (): boolean;
  subscribe: (invalidate: () => void) => () => void;
}

export function createExportScope(scopeKey: string, isOwnerCurrent: () => boolean) {
  let active = false;
  const listeners = new Set<() => void>();
  const isCurrent: ExportCurrentGuard = Object.assign(() => active && isOwnerCurrent(), {
    subscribe: (invalidate: () => void) => {
      listeners.add(invalidate);
      return () => { listeners.delete(invalidate); };
    },
  });
  return {
    scopeKey,
    isCurrent,
    activate() {
      active = true;
      return () => {
        active = false;
        listeners.forEach(invalidate => invalidate());
        listeners.clear();
      };
    },
  };
}
