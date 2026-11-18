/** The visible viewport can be shorter than 320px while a keyboard is open. */
export function paymentDialogViewportHeight(viewportHeight: number | undefined, windowHeight: number): string {
  const height = [viewportHeight, windowHeight].find(value => typeof value === "number" && Number.isFinite(value) && value > 0);
  return height === undefined ? "100vh" : `${Math.max(1, Math.floor(height))}px`;
}
