"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { useRouter } from "next/navigation";
import {
  resolveAndroidBackAction,
  type NativeNavigationModel,
} from "@/components/layout/native-navigation-model";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";
import { internalRoute } from "@/lib/routes";

// Dialog/Sheet/AlertDialog ของ feature (เช่น payment dialog บน /pos/order) shell ไม่รู้จัก
// แต่ทุกตัวมี data-slot ของ shadcn เสมอ จึงเช็คจาก DOM แทนการเดินสาย state ทุกหน้าเข้ามาที่ shell
const OPEN_OVERLAY_SELECTOR =
  '[data-slot="dialog-content"], [data-slot="sheet-content"], [data-slot="alert-dialog-content"]';

// เช็ค isCapacitorNativeApp() ตรงนี้แล้ว (ต่างจากเดิมที่พึ่งพา "mount ได้เฉพาะใต้ NativeAppShell"
// อย่างเดียว) — ProtectedShell สลับไปใช้ AppShell (แบบ desktop) แทนได้แล้วตอนจอกว้าง/แนวนอน
// แม้ยังรันบน Capacitor อยู่ (ดู protected-shell.tsx) ปุ่ม back ฮาร์ดแวร์ต้องยังทำงานไม่ว่า
// shell ไหนกำลังโชว์อยู่ จึงเรียก hook นี้จากทั้งสอง shell แล้วให้การ์ดตัวเองแทนพึ่งจุดเรียกเดียว
export function useAndroidBackButton({
  model,
  pathname,
}: {
  model: NativeNavigationModel;
  pathname: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!isCapacitorNativeApp()) return;

    // addListener คืน Promise ของ handle — ต้องเก็บไว้ถอดตอน unmount ไม่งั้น listener ซ้อนกันทุกครั้งที่ deps เปลี่ยน
    const handle = App.addListener("backButton", ({ canGoBack }) => {
      // อ่าน DOM สด ๆ ตอนกดทุกครั้ง (ไม่ memo) เพราะ overlay ของ feature เปิด/ปิดได้โดย shell ไม่รู้
      // ส่ง Escape ให้ Radix ปิดตัวที่เปิดอยู่เอง แทนที่จะพยายามรู้ว่าตัวไหนเปิดและปิดยังไง
      if (document.querySelector(OPEN_OVERLAY_SELECTOR)) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
        );
        return;
      }

      const action = resolveAndroidBackAction({
        canGoBack,
        model,
        pathname,
      });

      switch (action.type) {
        case "navigate":
          router.push(internalRoute(action.path));
          return;
        case "history-back":
          router.back();
          return;
        case "minimize":
          // ห้าม App.exitApp() — ผู้ใช้ POS กดพลาดแล้วแอปตายกลางบิล
          void App.minimizeApp();
          return;
      }
    });

    return () => {
      void handle.then((listener) => listener.remove());
    };
  }, [model, pathname, router]);
}
