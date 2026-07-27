import type { DeviceCapability } from "@/features/landing/scene-quality";

// navigator.deviceMemory ยังเป็น non-standard (ไม่มีใน Safari/Firefox) จึงต้องประกาศเอง
interface NavigatorWithDeviceMemory extends Navigator {
  deviceMemory?: number;
}

/** อ่านสเปกเครื่องจาก DOM — แยกจาก scene-quality.ts เพื่อให้ logic ทั้งหมดเทสต์ใน node ได้ */
export function readDeviceCapability(): DeviceCapability {
  const runtimeNavigator = navigator as NavigatorWithDeviceMemory;

  return {
    hardwareConcurrency: runtimeNavigator.hardwareConcurrency ?? 0,
    deviceMemory: runtimeNavigator.deviceMemory ?? 0,
    devicePixelRatio: window.devicePixelRatio || 1,
    viewportWidth: window.innerWidth,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches
  };
}
