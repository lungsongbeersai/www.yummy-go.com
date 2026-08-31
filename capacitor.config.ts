import type { CapacitorConfig } from "@capacitor/cli";

const localServerUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.yummygo.app",
  appName: "Yummy Go",
  // ตัวแอปใช้ production URL; ไฟล์ fallback นี้ทำให้ native project sync/build ได้แบบทำซ้ำได้
  webDir: "capacitor-web",

  server: {
    // Release ใช้ Production เสมอ ส่วนการทดสอบเครื่องจริงให้กำหนด
    // CAPACITOR_SERVER_URL=http://<LAN-IP>:3000 เฉพาะคำสั่ง cap run
    url: localServerUrl || "https://yummy-go.com",
    cleartext: Boolean(localServerUrl?.startsWith("http://")),

    androidScheme: "https",
    iosScheme: "https",
  },

  android: {
    appendUserAgent: "YummyGoCapacitorAndroid",
    backgroundColor: "#16a34a",
    webContentsDebuggingEnabled: false,
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
