"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { useAppStore } from "@/stores/app-store"

const Toaster = ({ ...props }: ToasterProps) => {
  // แอปนี้ไม่ได้ใช้ next-themes ตั้งค่าโหมดมืด/สว่างจริง (สลับผ่าน useAppStore + toggle class
  // "dark" บน <html> เอง) — ก่อนหน้านี้อ่าน theme จาก next-themes' useTheme() ที่ไม่มี
  // ThemeProvider ครอบอยู่เลย จึงได้ theme="system" เสมอไม่ว่าแอปจะอยู่โหมดไหนจริงๆ Sonner เลย
  // เลือกชุดสีข้อความของตัวเองตาม prefers-color-scheme ของเครื่อง ซึ่งอาจสวนทางกับพื้นหลังจริง
  // ของ toast (ที่มาจาก --popover ของแอป) ทำให้ตัวหนังสือกลายเป็นสีขาวบนพื้นสีขาว มองไม่เห็น
  const theme = useAppStore((state) => state.theme)

  return (
    <Sonner
      theme={theme}
      position="top-center"
      className="toaster group"
      // richColors ต้องเปิดเอง — ไม่งั้น sonner ใช้แค่ --normal-* กับทุก type เหมือนกันหมด
      // (--success-bg/--warning-bg/... ที่ set ไว้ใน style ด้านล่างจะไม่มีผลอะไรเลยถ้าไม่เปิด)
      richColors
      // ที่จอแคบ (มือถือ/Capacitor) sonner ใช้ --mobile-offset-top แทน --offset-top เฉย ๆ
      // (ดู sonner base CSS: @media max-width:600px บังคับ top ตัวนี้) ต้องเซ็ตทั้งคู่ ไม่งั้น
      // บนแอป native ที่จอแคบเสมอ ตัว toast จะไปทับแถบสถานะ (นาฬิกา/แบตเตอรี่/สัญญาณ) แทนที่จะ
      // เว้นพื้นที่ตาม safe-area-inset-top ให้จริง
      //
      // env(safe-area-inset-top) ล้วน ๆ ไม่พอ: บนอิลิเมนต์ position:fixed ของ sonner เอง
      // (ทดสอบจริงบน Galaxy S24 FE/Android 15) มันไม่ได้ค่า inset จริงกลับมาเหมือน
      // padding-top ของ .native-top-bar ที่เป็น in-flow block ธรรมดา (ดูคอมเมนต์
      // ~24-32px ใน globals.css) — toast เลยไปทับแถบสถานะเงียบ ๆ โดยไม่มี error ให้เห็น
      // ใช้ max() ตั้งพื้นกันเหมือน --pos-system-bottom-safe-area (globals.css) แทนการ
      // เชื่อ env() เพียวๆ — ค่าพื้น 2.5rem แรกยังชิดไปสำหรับเครื่องจอ punch-hole/notch สูง
      // ที่ผู้ใช้ทดสอบจริง จึงขยับพื้นขึ้นเป็น 3.5rem ให้เผื่อระยะมากขึ้นชัดเจน
      offset={{ top: "calc(max(env(safe-area-inset-top, 0px), 3.5rem) + 16px)" }}
      mobileOffset={{ top: "calc(max(env(safe-area-inset-top, 0px), 3.5rem) + 16px)" }}
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          // โทนสีต่อชนิด toast ผูกกับ design token เดิมของแอป (--success/--warning/--destructive/--info)
          // แทนสี default ของ sonner เอง ให้ error/warning/success แยกออกจากกันชัดเจนตั้งแต่มองแวบแรก
          // Compiled tokens also receive the native WebView color fallbacks.
          // Inline color-mix expressions bypass the CSS compatibility compiler.
          "--success-bg": "var(--toast-success-bg)",
          "--success-border": "var(--toast-success-border)",
          "--success-text": "var(--toast-success-text)",
          "--error-bg": "var(--toast-error-bg)",
          "--error-border": "var(--toast-error-border)",
          "--error-text": "var(--toast-error-text)",
          "--warning-bg": "var(--toast-warning-bg)",
          "--warning-border": "var(--toast-warning-border)",
          "--warning-text": "var(--toast-warning-text)",
          "--info-bg": "var(--toast-info-bg)",
          "--info-border": "var(--toast-info-border)",
          "--info-text": "var(--toast-info-text)",
          "--border-radius": "var(--radius)",
          fontFamily: "var(--font-sans), var(--font-lao-ui)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          actionButton: "!rounded-md !bg-foreground !px-3 !font-bold !text-background",
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
