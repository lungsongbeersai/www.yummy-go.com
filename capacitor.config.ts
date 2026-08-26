import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.yummygo.app",
  appName: "Yummy Go",
  // ตัวแอปใช้ production URL; ไฟล์ fallback นี้ทำให้ native project sync/build ได้แบบทำซ้ำได้
  webDir: "capacitor-web",

  server: {
    // DEV ONLY: ชี้เข้า dev server ในเครื่องผ่าน Wi-Fi LAN IP (มือถือกับ PC ต้องอยู่วง Wi-Fi เดียวกัน)
    // เปลี่ยน IP นี้ถ้า PC เปลี่ยนเครือข่าย/เช็คด้วย `ipconfig` (adapter Wi-Fi)
    // ต้องเปลี่ยนกลับเป็น https://yummy-go.com ก่อน sync/build ตัว release จริง

    // url: "https://yummy-go.com",
    // cleartext: false,


     url: "http://192.168.100.247:3000",
    cleartext: true,

    androidScheme: "https",
    iosScheme: "https",
  },

  android: {
    appendUserAgent: "YummyGoCapacitorAndroid",
    backgroundColor: "#16a34a",
    // เปิดไว้ชั่วคราวเพื่อ debug ปัญหา AuthGuard ค้างบนเครื่องจริง — ปิดกลับก่อน build release
    webContentsDebuggingEnabled: true,
  },

  ios: {
    appendUserAgent: "YummyGoCapacitoriOS",
    backgroundColor: "#16a34a",
    contentInset: "automatic",
  },

  plugins: {
    // Android: MainActivity.java ควบคุมสี/ไอคอนของ status & navigation bar เองแบบ dynamic
    // ตามโหมดสว่าง/มืดของเครื่องอยู่แล้ว (ไม่งั้นค่าคงที่ตรงนี้จะไปทับหลัง native init เสร็จ)
    // เหลือแค่ style: "DEFAULT" ไว้ให้ iOS ใช้ auto ตาม appearance ของเครื่อง
    StatusBar: {
      style: "DEFAULT",
    },

    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: true,
      backgroundColor: "#16a34a",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
