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
          "--border-radius": "var(--radius)",
          fontFamily: "var(--font-sans), var(--font-noto-sans-lao)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
