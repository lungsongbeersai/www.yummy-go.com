type SessionStoreReset = () => void;

const sessionStoreResets = new Map<string, SessionStoreReset>();
let sessionGeneration = 0;

export function createSessionGuard() {
  const generation = sessionGeneration;
  return () => generation === sessionGeneration;
}

export function registerSessionStoreReset(name: string, reset: SessionStoreReset) {
  sessionStoreResets.set(name, reset);
}

export function resetSessionStores() {
  sessionGeneration += 1;
  sessionStoreResets.forEach((reset) => reset());
}
