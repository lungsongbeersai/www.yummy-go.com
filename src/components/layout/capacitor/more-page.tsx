"use client";

import { useMemo } from "react";
import { Accordion } from "@/components/ui/accordion";
import { buildNativeNavigationModel } from "@/components/layout/native-navigation-model";
import { useAppShellData } from "@/components/layout/use-app-shell-data";
import {
  MoreGroupRow,
  MoreListRow,
  needsMoreGroupDropdown,
} from "@/components/layout/capacitor/more-list-row";

// หน้าเต็มจอแทน bottom sheet เดิม — ตรงกับ Flutter reference ที่แตะ "More" แล้วเด้งไปหน้าใหม่
// ไม่ใช่ sheet ลอยทับ (จึงมี header กระดิ่ง/โปรไฟล์ของตัวเองจาก NativeTopBar เหมือนหน้าอื่น ๆ)
export function NativeMorePage() {
  const { menuItems, pathname } = useAppShellData();
  const model = useMemo(() => buildNativeNavigationModel(menuItems), [menuItems]);

  return (
    <Accordion type="multiple" className="w-full flex-col rounded-none border-none py-2">
      {model.more.map((item) =>
        needsMoreGroupDropdown(item) ? (
          <MoreGroupRow key={item.title} item={item} pathname={pathname} />
        ) : (
          <MoreListRow key={item.path ?? item.title} item={item} pathname={pathname} />
        ),
      )}
    </Accordion>
  );
}
