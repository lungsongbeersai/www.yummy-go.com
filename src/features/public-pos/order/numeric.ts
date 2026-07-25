// Split out of utils.ts: the one primitive both product-domain and cart-domain need,
// kept standalone so those two files can import it without depending on each other.
export function numeric(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}
