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
  // The committed response already identifies the print job. Reloading the
  // bill is independent and must not hold that job behind a slow cart read.
  const [refreshOutcome, printOutcome] = await Promise.allSettled([
    Promise.resolve().then(refresh),
    Promise.resolve().then(() => print?.()),
  ]);
  if (refreshOutcome.status === "rejected") refreshError = refreshOutcome.reason;
  if (printOutcome.status === "rejected") printError = printOutcome.reason;
  else printResult = printOutcome.value;
  return { refreshError, printError, printResult };
}
