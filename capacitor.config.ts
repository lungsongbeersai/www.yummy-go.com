import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.yummygo.app",
  appName: "Yummy Go",
  // ตัวแอปใช้ production URL; ไฟล์ fallback นี้ทำให้ native project sync/build ได้แบบทำซ้ำได้
  webDir: "capacitor-web",

  server: {
    // DEV ONLY: ชี้เข้า dev server ในเครื่องผ่าน `adb reverse tcp:3000 tcp:3000`
    // ต้องเปลี่ยนกลับเป็น https://yummy-go.com ก่อน sync/build ตัว release จริง
    url: "http://localhost:3000",
    cleartext: true,
    androidScheme: "https",
    iosScheme: "https",
  },

  android: {
    appendUserAgent: "YummyGoCapacitorAndroid",
    backgroundColor: "#16a34a",
    webContentsDebuggingEnabled: process.env.CAPACITOR_WEB_DEBUG === "1",
  },

  ios: {
    appendUserAgent: "YummyGoCapacitoriOS",
    backgroundColor: "#16a34a",
    contentInset: "automatic",
  },

  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: "#16a34a",
      style: "LIGHT",
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
