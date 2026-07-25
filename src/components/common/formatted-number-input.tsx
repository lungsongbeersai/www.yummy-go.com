"use client";

import { type ComponentProps, useMemo, useState } from "react";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
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

  // โหมด uncontrolled: defaultValue เปลี่ยน (เช่นเปิดฟอร์มของอีกเรคคอร์ด) = ตั้งค่าใหม่
  useResetOnDeps([controlled, defaultValue, options], () => {
    if (!controlled) setRawValue(stripNumberFormat(defaultValue, options));
  });

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
