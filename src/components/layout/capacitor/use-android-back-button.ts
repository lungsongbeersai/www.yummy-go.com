"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { useRouter } from "next/navigation";
import {
  resolveAndroidBackAction,
  type NativeNavigationModel,
} from "@/components/layout/native-navigation-model";
import { internalRoute } from "@/lib/routes";

// ไม่เช็ค isCapacitorNativeApp() ที่นี่ — hook นี้ mount ได้เฉพาะใต้ NativeAppShell
// ซึ่ง (protected)/layout.tsx เลือกให้ก็ต่อเมื่อ isCapacitorNativeApp() true อยู่แล้ว (Task 4 Step 5)
export function useAndroidBackButton({
  model,
  onCloseOverlay,
  overlayOpen,
  pathname,
}: {
  model: NativeNavigationModel;
  onCloseOverlay: () => void;
  overlayOpen: boolean;
  pathname: string;
}) {
  const router = useRouter();

  useEffect(() => {
    // addListener คืน Promise ของ handle — ต้องเก็บไว้ถอดตอน unmount ไม่งั้น listener ซ้อนกันทุกครั้งที่ deps เปลี่ยน
    const handle = App.addListener("backButton", ({ canGoBack }) => {
      const action = resolveAndroidBackAction({
        canGoBack,
        model,
        overlayOpen,
        pathname,
      });

      switch (action.type) {
        case "close-overlay":
          onCloseOverlay();
          return;
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
  }, [model, onCloseOverlay, overlayOpen, pathname, router]);
}
