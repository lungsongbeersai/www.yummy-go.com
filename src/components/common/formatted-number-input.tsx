"use client";

import { type ComponentProps, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatNumberInput, stripNumberFormat } from "@/lib/number-format";

type InputProps = ComponentProps<typeof Input>;

export interface FormattedNumberInputProps
  extends Omit<InputProps, "defaultValue" | "inputMode" | "name" | "onChange" | "type" | "value"> {
  decimal?: boolean;
  defaultValue?: string | number | null;
  name?: string;
  onValueChange?: (value: string) => void;
  value?: string | number | null;
}

export function FormattedNumberInput({
  decimal = false,
  defaultValue,
  name,
  onValueChange,
  value,
  ...props
}: FormattedNumberInputProps) {
  const controlled = value !== undefined;
  const options = useMemo(() => ({ decimal }), [decimal]);
  const [rawValue, setRawValue] = useState(() => stripNumberFormat(defaultValue, options));
  const currentRawValue = controlled ? stripNumberFormat(value, options) : rawValue;

  useEffect(() => {
    if (!controlled) setRawValue(stripNumberFormat(defaultValue, options));
  }, [controlled, defaultValue, options]);

  function updateValue(nextValue: string) {
    const nextRawValue = stripNumberFormat(nextValue, options);
    if (!controlled) setRawValue(nextRawValue);
    onValueChange?.(nextRawValue);
  }

  return (
    <>
      <Input
        {...props}
        inputMode={decimal ? "decimal" : "numeric"}
        type="text"
        value={formatNumberInput(currentRawValue, options)}
        onChange={(event) => updateValue(event.target.value)}
      />
      {name ? (
        <input
          disabled={props.disabled}
          name={name}
          type="hidden"
          value={currentRawValue}
          readOnly
        />
      ) : null}
    </>
  );
}
