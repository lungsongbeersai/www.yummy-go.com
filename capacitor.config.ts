import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.yummygo.app",
  appName: "Yummy Go",
  webDir: "out",

  server: {
    url: "https://yummy-go.com",
    cleartext: false,
    androidScheme: "https",
  },

  android: {
    appendUserAgent: "YummyGoCapacitorAndroid",
    backgroundColor: "#ffffff",
    webContentsDebuggingEnabled: process.env.CAPACITOR_WEB_DEBUG === "1",
    allowMixedContent: false,
  },

  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: "#ffffff",
      style: "LIGHT",
    },

    SplashScreen: {
      backgroundColor: "#ffffff",
      showSpinner: false,
      launchShowDuration: 0,
    },
  },
};

export default config;