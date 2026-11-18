export type ProductActionKind = "selection" | "order";

interface ProductActionLease {
  isCurrent: () => boolean;
  isScopeCurrent: () => boolean;
  finish: () => boolean;
}

interface ActiveProductAction {
  kind: ProductActionKind;
  key: string;
  activation: object | null;
}

interface ProductActionScope {
  key: string;
  activate: () => () => void;
}

/** Option reads can be replaced or dismissed. A financial send keeps its
 * owner until it settles, and a late read can never release that owner. */
export function createProductActionRequest() {
  let active: ActiveProductAction | null = null;
  let currentScope: ProductActionScope | null = null;
  let currentActivation: object | null = null;

  return {
    createScope(key: string): ProductActionScope {
      const scope: ProductActionScope = {
        key,
        activate() {
          const activation = {};
          currentScope = scope;
          currentActivation = activation;
          if (active?.kind === "selection") active = null;
          return () => {
            if (currentActivation !== activation) return;
            currentScope = null;
            currentActivation = null;
            if (active?.kind === "selection") active = null;
          };
        },
      };
      return scope;
    },
    begin(kind: ProductActionKind, key: string, scope = currentScope): ProductActionLease | null {
      if (scope !== currentScope) return null;
      if (active?.kind === "order" || active?.key === key) return null;
      const action = { kind, key, activation: currentActivation };
      active = action;
      return {
        isCurrent: () => active === action && currentActivation === action.activation,
        // Background cart refresh may finish after the send releases its lock.
        isScopeCurrent: () => currentActivation === action.activation,
        finish: () => {
          if (active !== action) return false;
          active = null;
          return true;
        },
      };
    },
    cancelSelection() {
      if (active?.kind !== "selection") return false;
      active = null;
      return true;
    },
  };
}
