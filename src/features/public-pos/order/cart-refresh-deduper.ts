interface ActiveCartRefresh {
  key: string;
  request: Promise<void>;
}

export function createCartRefreshDeduper() {
  let activeRefresh: ActiveCartRefresh | null = null;

  return (key: string, refresh: () => Promise<void>) => {
    if (activeRefresh?.key === key) return activeRefresh.request;

    const request = refresh().finally(() => {
      if (activeRefresh?.request === request) activeRefresh = null;
    });
    activeRefresh = { key, request };
    return request;
  };
}
