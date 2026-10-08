// The server mutation is already committed. Neither a refresh nor a printer
// failure can undo it or justify submitting the destructive request again.
export async function finishCommittedCartItemAction<PrintResult>({
  invalidate,
  refresh,
  print,
}: {
  invalidate: () => void;
  refresh: () => Promise<void>;
  print?: () => Promise<PrintResult>;
}) {
  invalidate();
  let refreshError: unknown;
  let printError: unknown;
  let printResult: PrintResult | undefined;
  try { await refresh(); } catch (error) { refreshError = error; }
  try { printResult = await print?.(); } catch (error) { printError = error; }
  return { refreshError, printError, printResult };
}
