"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { useLatestValue } from "@/hooks/use-latest-value";
import { useResetOnChange } from "@/hooks/use-reset-on-change";

type ColorPickerInputProps = Omit<ComponentProps<typeof Input>, "defaultValue" | "onChange" | "type" | "value"> & {
  /** A #rrggbb colour. */
  value: string;
  /** Called once the user settles on a colour (the picker closes), not on every drag step. */
  onValueChange: (value: string) => void;
};

// The native colour input fires React's onChange on every step of a drag across the palette,
// dozens of times a second. Wired straight to form state, each step re-rendered the whole
// form (the product form is ~2,000 lines of components), which made dragging lag. Here the
// drag only updates this input's own state; the form hears about it once, on the native
// "change" event, which the browser fires when the user commits (closes the picker).
export function ColorPickerInput({ value, onValueChange, ...props }: ColorPickerInputProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const onValueChangeRef = useLatestValue(onValueChange);

  // A new value from outside (a colour picked from the list, typed code) wins over the draft.
  useResetOnChange(value, () => setDraft(value));

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const commit = () => onValueChangeRef.current(input.value);
    input.addEventListener("change", commit);
    return () => input.removeEventListener("change", commit);
  }, [onValueChangeRef]);

  return (
    <Input
      {...props}
      ref={inputRef}
      type="color"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
    />
  );
}
