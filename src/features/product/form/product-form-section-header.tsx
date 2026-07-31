import type { ReactNode } from "react";
import { CardHeader, CardTitle } from "@/components/ui/card";

export function ProductFormSectionNumber({ value }: { value: string }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-muted text-sm font-semibold tabular-nums text-muted-foreground">
      {value}
    </span>
  );
}

// หัวข้อทั้ง 5 ส่วนของฟอร์มเคยเขียนแยกกันเอง 4 แบบ (justify/flex-direction/โครง div ไม่ตรงกัน)
// รวมเป็นตัวเดียวเพื่อให้ระยะห่างและการวางปุ่มเหมือนกันทุกส่วน
export function ProductFormSectionHeader({
  action,
  hint,
  number,
  title
}: {
  action?: ReactNode;
  hint: string;
  number: string;
  title: string;
}) {
  return (
    <CardHeader className="flex-wrap gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <ProductFormSectionNumber value={number} />
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{hint}</p>
        </div>
      </div>
      {action ? <div className="flex shrink-0 gap-2 max-sm:w-full">{action}</div> : null}
    </CardHeader>
  );
}
