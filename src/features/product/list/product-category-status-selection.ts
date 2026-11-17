interface CategoryStatusRequest {
  scope: string;
  version: number;
  needsResolution: boolean;
}

export function createProductCategoryStatusSelection() {
  let resolvedScope: string | null = null;
  let version = 0;
  const isCurrent = (request: CategoryStatusRequest) => request.version === version;

  return {
    begin(scope: string): CategoryStatusRequest {
      return { scope, version: ++version, needsResolution: scope !== resolvedScope };
    },
    isCurrent,
    complete(request: CategoryStatusRequest) {
      if (!isCurrent(request)) return false;
      resolvedScope = request.scope;
      return true;
    },
    selectManually(scope: string) {
      version += 1;
      resolvedScope = scope;
    },
    cancel() {
      version += 1;
    },
  };
}
