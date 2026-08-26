import Image from "next/image";
import { Spinner } from "@/components/ui/spinner";

// หน้าจอนี้โชว์ระหว่างเช็คสิทธิ์ (AuthGuard) เฉพาะบน Capacitor — เว็บยังใช้ LoadingState skeleton เดิม
// ใช้พื้นหลัง bg-background ตามธีมจริง (ไม่ใช่เขียวของ native splash) เหมือน Flutter reference ที่แยก
// native splash (เขียว) ออกจากหน้ารอสิทธิ์ในแอป (พื้นหลังธีมปกติ) เป็นคนละชั้นกัน
export function NativeLoadingScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
      <div className="flex size-24 items-center justify-center rounded-full border border-border bg-card shadow-[0_16px_36px_-26px_rgba(15,23,42,0.55)]">
        <Image
          src="/brand/icon.png"
          alt="Yummy Go"
          width={56}
          height={56}
          priority
          className="size-14 object-contain"
        />
      </div>
      <span className="text-lg font-bold text-foreground">Yummy Go</span>
      <Spinner className="size-6 text-primary" />
    </div>
  );
}
