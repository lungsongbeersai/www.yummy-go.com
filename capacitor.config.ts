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
    // เปิดเฉพาะตอนทดสอบเครื่องจริงผ่าน USB (มี CAPACITOR_SERVER_URL เท่านั้น) — ให้ต่อ
    // chrome://inspect ดู console/network ของ WebView ได้ ส่วน production build (ไม่มี
    // env นี้) ปิดไว้เหมือนเดิมเพราะเปิดทิ้งไว้เท่ากับให้เครื่องที่ต่อ USB inspect แอปจริงได้
    webContentsDebuggingEnabled: Boolean(localServerUrl),
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
