// Call from a user gesture. Some native WebViews omit or reject the async
// clipboard API, while their selected-text copy command remains available.
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Try the selected-text path before reporting that the copy failed.
  }

  if (typeof document === "undefined" || !document.body || typeof document.execCommand !== "function") {
    return false;
  }

  const activeElement = document.activeElement as HTMLElement | null;
  const selectionControl = activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA"
    ? activeElement as HTMLInputElement | HTMLTextAreaElement
    : null;
  const selectionStart = selectionControl?.selectionStart ?? null;
  const selectionEnd = selectionControl?.selectionEnd ?? null;
  const selectionDirection = selectionControl?.selectionDirection ?? undefined;
  // Radix traps focus inside its active dialog. An input appended to body can
  // lose its selection immediately and cause copy to target another element.
  const container = activeElement?.closest('[role="dialog"], [role="alertdialog"]') ?? document.body;
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.left = "-10000px";
  container.appendChild(input);

  try {
    input.focus({ preventScroll: true });
    input.select();
    input.setSelectionRange(0, text.length);
    if (document.activeElement !== input || input.selectionStart !== 0 || input.selectionEnd !== text.length) {
      return false;
    }
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    input.remove();
    try {
      activeElement?.focus?.({ preventScroll: true });
      if (selectionControl && selectionStart !== null && selectionEnd !== null) {
        selectionControl.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
      }
    } catch {
      // A dialog may close while copying; keep the copy result in that case.
    }
  }
}
