import { isCapacitorNativeApp } from "@/lib/capacitor-platform";

export function canProgrammaticallyFocusTextInput() {
  if (typeof window === "undefined") return false;
  if (isCapacitorNativeApp()) return false;

  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function canMoveCaretWithoutOpeningKeyboard(input: HTMLInputElement) {
  return document.activeElement === input;
}
