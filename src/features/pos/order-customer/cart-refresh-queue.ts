interface RefreshEntry {
  key: string;
  pending: boolean;
  refresh: () => Promise<void>;
  request: Promise<void>;
}

// A notification received during a read may describe a change made after that
// read started. Coalesce bursts, but always perform one trailing read.
export function createCartRefreshQueue() {
  let active: RefreshEntry | null = null;
  const run = (key: string, refresh: () => Promise<void>): Promise<void> => {
    if (active?.key === key) {
      active.pending = true;
      active.refresh = refresh;
      return active.request;
    }
    const entry: RefreshEntry = { key, pending: false, refresh, request: Promise.resolve() };
    entry.request = Promise.resolve().then(async () => {
      if (active !== entry) return;
      do {
        entry.pending = false;
        try {
          await entry.refresh();
        } catch (error) {
          if (!entry.pending) throw error;
        }
      } while (entry.pending && active === entry);
    }).finally(() => {
      if (active === entry) active = null;
    });
    active = entry;
    return entry.request;
  };
  return Object.assign(run, { cancel: () => { active = null; } });
}
