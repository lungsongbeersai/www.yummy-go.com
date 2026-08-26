import { Capacitor, registerPlugin } from "@capacitor/core";

interface NativeThemePlugin {
  setDarkMode(options: { dark: boolean }): Promise<void>;
}

// custom native plugin (android/.../NativeThemePlugin.java) — ไม่มี web implementation
// เพราะสีแถบสถานะ/แถบระบบเป็นเรื่องของ Android เท่านั้น
const NativeTheme = registerPlugin<NativeThemePlugin>("NativeTheme");

export function syncNativeStatusBarTheme(isDark: boolean) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
  void NativeTheme.setDarkMode({ dark: isDark }).catch(() => {
    // เครื่องเก่า/ยังไม่ sync native project — ปล่อยผ่าน ไม่ใช่ error ที่ผู้ใช้ต้องเห็น
  });
}
