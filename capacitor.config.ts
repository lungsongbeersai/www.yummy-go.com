import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.yummygo.app",
  appName: "Yummy Go",
  webDir: "out",

  server: {
    url: "https://yummy-go.com",
    cleartext: false,
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