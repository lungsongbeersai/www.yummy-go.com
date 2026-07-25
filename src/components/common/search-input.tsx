"use client";

import { Search } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  onEnter?: () => void;
  // ปรับความสูง/พื้นหลังของกล่อง (compact h-9 vs touch h-11)
  className?: string;
  inputClassName?: string;
}

// กล่องค้นหามาตรฐาน: InputGroup (shadcn) + ไอคอนแว่นขยาย
// เดิม pattern นี้ถูกเขียนเองด้วยมือ ~16 จุด (ความสูง/focus ring/สี icon ไม่ตรงกัน)
export function SearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  id,
  name = "search",
  disabled,
  invalid,
  autoFocus,
  onEnter,
  className,
  inputClassName,
}: SearchInputProps) {
  return (
    <InputGroup className={cn("h-9 bg-background", className)}>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        name={name}
        type="search"
        autoComplete="off"
        spellCheck={false}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        className={inputClassName}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={
          onEnter
            ? (event) => {
                if (event.key === "Enter") onEnter();
              }
            : undefined
        }
      />
    </InputGroup>
  );
}
