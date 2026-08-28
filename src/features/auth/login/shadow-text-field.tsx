"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Android/Chromium ผูกเมนู native ตัด/คัดลอก/วาง (พื้นหลังดำ ธีมไม่ได้ ไม่มี API ให้ปิด — ยืนยัน
// แล้วว่าใช้ได้กับทุก element ที่เป็น "จุดแก้ไขข้อความได้" ไม่ว่าจะเป็น <input>/<textarea>/
// contentEditable ก็ตาม) วิธีเดียวที่หลีกเลี่ยงได้จริงคือไม่ให้นิ้วแตะโดน element ที่แก้ไขได้เลย
//
// <input> จริงยังอยู่ตำแหน่งเดิมทุกอย่าง (autofill/password manager ยังหาเจอ, IME ภาษาลาว
// พิมพ์ผ่าน input จริงตามปกติทุกตัวอักษร ไม่ได้ทำ text engine เองเลย) แค่โปร่งใส + pointer-events
// none กันไม่ให้นิ้วแตะโดนตัวมันโดยตรง — เนื้อหาที่เห็นเป็นแค่ <div> ธรรมดาทับไว้ข้างบน (ไม่ editable
// เลย ไม่มีเหตุผลให้ระบบยกเมนูขึ้นมา) กดที่ div นี้แล้วสั่ง .focus() ไปที่ input จริงแทน
export function ShadowTextField({
  autoComplete,
  className,
  id,
  mask = false,
  name,
  onChange,
  required,
  spellCheck,
  type,
  value,
}: {
  autoComplete: string;
  className?: string;
  id: string;
  mask?: boolean;
  name: string;
  onChange: (value: string) => void;
  required?: boolean;
  spellCheck?: boolean;
  type: "email" | "password" | "text";
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const displayText = mask ? "•".repeat(value.length) : value;

  return (
    <div
      className={cn(
        "relative flex h-12 items-center overflow-hidden rounded-lg border border-border bg-card px-4 shadow-sm transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10",
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        type={type}
        autoComplete={autoComplete}
        spellCheck={spellCheck}
        required={required}
        // pointer-events-none กันนิ้วแตะโดน input จริงโดยตรง (ต้นเหตุที่ระบบยกเมนูตัด/คัดลอก/วาง
        // ขึ้นมา) — ยังคง .focus() ผ่าน JS ได้ปกติ คีย์บอร์ด/IME/Tab/screen reader ทำงานเหมือน
        // input ทั่วไปทุกอย่าง เพราะมันคือ input จริง ไม่ได้ซ่อนจาก a11y tree แค่ซ่อนจากสายตา
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
        style={{ pointerEvents: "none" }}
      />

      <span
        aria-hidden="true"
        className="pointer-events-none flex-1 select-none truncate text-sm font-semibold text-foreground"
      >
        {displayText}
        {focused ? (
          <span className="ml-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-primary align-middle" />
        ) : null}
      </span>
    </div>
  );
}
