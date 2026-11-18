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
import { useNativeHeaderStore } from "@/stores/native-header-store";
import { useNavigationGuardStore } from "@/stores/navigation-guard-store";

// Portal-based menus are overlays too: Android Back closes the appearance
// popover before navigating, just as Escape does in the browser.
const OPEN_OVERLAY_SELECTOR = [
  "dialog-content",
  "sheet-content",
  "alert-dialog-content",
  "popover-content",
  "dropdown-menu-content",
  "select-content",
].map((slot) => `[data-slot="${slot}"][data-state="open"]`).join(", ");

// NativeAppShell keeps this listener mounted while its presentation changes.
export function useAndroidBackButton({
  model,
  pathname,
}: {
  model: NativeNavigationModel;
  pathname: string;
}) {
  const router = useRouter();
  const backAction = useNativeHeaderStore((state) => state.backAction);
  const runGuardedNavigation = useNavigationGuardStore((state) => state.run);

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

      // ใช้ override เดียวกับปุ่ม Back บน NativeTopBar เพื่อให้หน้ารับออเดอร์เปิด
      // dialog เตือน draft ก่อนออก ไม่ข้ามไป router.back() เมื่อกดปุ่ม Back ของ Android
      if (backAction) {
        backAction();
        return;
      }

      const action = resolveAndroidBackAction({
        canGoBack,
        model,
        pathname,
      });

      switch (action.type) {
        case "navigate":
          runGuardedNavigation(() => {
            router.push(internalRoute(action.path));
          });
          return;
        case "history-back":
          runGuardedNavigation(() => router.back());
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
  }, [backAction, model, pathname, router, runGuardedNavigation]);
}
