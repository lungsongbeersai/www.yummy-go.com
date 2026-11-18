/** A payment response belongs to one committed view activation. Printing has
 * its own job/session lifetime and must not depend on this view staying open. */
export function createPaymentViewScope(key: string) {
  let activation: object | null = {};

  return {
    key,
    activate() {
      const current = {};
      activation = current;
      return () => {
        if (activation === current) activation = null;
      };
    },
    capture() {
      const current = activation;
      return () => current !== null && activation === current;
    },
  };
}
