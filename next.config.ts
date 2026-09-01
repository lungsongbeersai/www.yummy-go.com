import type { NextConfig } from "next";
import { createHash } from "crypto";
import { readFileSync, readdirSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import withSerwistInit from "@serwist/next";

const appDir = dirname(fileURLToPath(import.meta.url));
const capacitorDevOrigin = process.env.CAPACITOR_DEV_ORIGIN?.trim();

function originOf(value: string | undefined, fallback: string) {
  try {
    return new URL(value || fallback).origin;
  } catch {
    return new URL(fallback).origin;
  }
}

const backendOrigin = originOf(
  process.env.NEXT_PUBLIC_BASE_URL,
  "https://api.yummy-go.com",
);
const printerAgentOrigin = originOf(
  process.env.NEXT_PUBLIC_PRINTER_AGENT_URL,
  "http://127.0.0.1:7777",
);
const remoteImageOrigins = [
  "https://plc-files.sgp1.vultrobjects.com",
  "https://placehold.co",
  "https://flagcdn.com",
];
const serviceWorkerConnectSources = Array.from(new Set([
  "'self'",
  backendOrigin,
  printerAgentOrigin,
  "http://127.0.0.1:7777",
  "http://localhost:7777",
  ...remoteImageOrigins,
]));
const serviceWorkerCsp = [
  "default-src 'self'",
  "script-src 'self'",
  `connect-src ${serviceWorkerConnectSources.join(" ")}`,
].join("; ");

// InjectManifest (classic mode) ใช้ webpack เท่านั้น — Next.js 16 เปลี่ยน `next build` (ไม่ใช่แค่
// `next dev`) ให้ใช้ Turbopack เป็นค่าเริ่มต้นด้วยเช่นกัน scripts.build ใน package.json จึงต้องส่ง
// --webpack ตรงๆ (ไม่งั้น InjectManifest ไม่ทำงานเลย แต่ build จะ "ผ่าน" เงียบๆ โดยไม่มี offline-sw.js)
// ทดสอบ service worker จริงต้อง `npm run build && npm start` เท่านั้น — disable ใน dev เพราะ
// Turbopack ไม่รองรับ InjectManifest ตามคำแนะนำทางการของ @serwist/next เอง
// ดีฟอลต์ของ @serwist/next คือ globPublicPatterns: ["**/*"] กวาดทั้ง public/ เข้า precache
// (บล็อก SW install จนกว่าจะครบ) รวมไดรเวอร์เครื่องพิมพ์/ตัวติดตั้ง/โมเดล 3D/ฟอนต์ที่ไม่ได้ใช้จริง
// ไป ~64MB — ยิ่งไฟล์เยอะ SW เวอร์ชันใหม่ยิ่ง activate ช้าหลัง deploy ทำให้ refresh ธรรมดา (ผ่าน SW)
// เจอของเก่าอยู่ ต่างจาก Ctrl+Shift+R ที่ bypass SW ไปเลยจึงดูเหมือน "ใหม่" แต่ไม่ได้ช่วยให้ SW อัปเดตเร็วขึ้น
// รายการนี้ตัดเหลือเฉพาะไฟล์ที่แอปใช้จริง (เทียบกับ src/design-system/fonts.ts และ grep การอ้างอิงจริง)
// app-version.json ตัดออกด้วย เพราะ PrecacheRoute ถูก register ก่อน runtimeCaching เสมอ (ดู sw.ts) การ
// precache มันจะ "ชนะ" NetworkOnly bypass ที่ตั้งใจไว้ ทำให้เวอร์ชันเช็คได้ค่าเก่าที่แช่แข็งไว้ตอน SW install
//
// เดิมใช้ `globPublicPatterns` (glob ของ @serwist/next เอง) แต่ package `glob` คืน path เป็น backslash
// บน Windows แม้ pattern จะเขียนด้วย "/" — ทำให้ manifest URL ผิด (เช่น "/auth\login-hero.png") และ 404
// ตอน SW install บนเครื่องที่ build ด้วย Windows (รวม `electron:pack` ที่ build installer บน Windows ตรงๆ)
// เดิน directory เองแล้ว join ด้วย "/" ตรงๆ แทน เลี่ยงปัญหานี้ทั้งหมดไม่ว่าจะ build จากแพลตฟอร์มไหน
const PRECACHE_PUBLIC_INCLUDES = [
  "auth",
  "brand",
  "fonts/Noto_Sans/NotoSans-VariableFont_wdth,wght.ttf",
  "fonts/Noto_Sans_Lao/NotoSansLao-VariableFont_wdth,wght.ttf",
  "fonts/saysettha_ot.ttf",
  "fonts/times.ttf",
  "fonts/window-open-fonts.css",
  "landing",
  "locales",
  "manifest.webmanifest",
  "pos",
  "sounds",
];

function collectPublicPrecacheEntries(publicDir: string, includes: string[]) {
  const entries: { url: string; revision: string }[] = [];

  function addFile(relPath: string) {
    const revision = createHash("md5")
      .update(readFileSync(join(publicDir, relPath)))
      .digest("hex");
    entries.push({ url: `/${relPath.split(/[\\/]/).join("/")}`, revision });
  }

  function walk(relPath: string) {
    const absPath = join(publicDir, relPath);
    if (statSync(absPath).isDirectory()) {
      for (const name of readdirSync(absPath)) walk(join(relPath, name));
    } else {
      addFile(relPath);
    }
  }

  for (const include of includes) walk(include);
  return entries;
}

const withSerwist = withSerwistInit({
  swSrc: "src/service-worker/sw.ts",
  swDest: "public/offline-sw.js",
  swUrl: "/offline-sw.js",
  cacheOnNavigation: false,
  additionalPrecacheEntries: collectPublicPrecacheEntries(join(appDir, "public"), PRECACHE_PUBLIC_INCLUDES),
  // offline-app-runtime.tsx ควบคุมการ register/reload เอง (ต้องจับ controllerchange + postMessage
  // WARM_OFFLINE_ROUTES ตามจังหวะ login ของแอป) — ปล่อยให้ Serwist auto-register จะ register ซ้ำ
  register: false,
  reloadOnOnline: false,
  disable: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  // 192.168.100.247 คือ LAN IP เครื่อง dev ปัจจุบัน ให้ Capacitor Android ทดสอบผ่าน Wi-Fi ได้
  // (ไม่งั้น Next dev server บล็อก /_next/static/chunks/*.js เป็น 403 ทุกไฟล์ เพราะ origin ไม่อยู่ใน allowlist)
  // เปลี่ยนค่านี้ถ้า PC เปลี่ยนเครือข่าย — เช็คด้วย `ipconfig` (adapter Wi-Fi)
  allowedDevOrigins: [
    "127.0.0.1",
    ...(capacitorDevOrigin ? [capacitorDevOrigin] : []),
  ],
  output: "standalone",
  typedRoutes: true,
  // withSerwistInit ใส่ webpack() config function ให้เสมอ (แม้ disable:true ในนั้นก็ตาม) — Next.js 16
  // เห็น webpack key อยู่แล้วปฏิเสธรัน Turbopack ทันทีถ้าไม่มี turbopack key คู่กัน ใส่ {} ว่างไว้แค่
  // silence check นี้ (dev ยังคงใช้ Turbopack ตามปกติ ไม่ได้เปลี่ยนพฤติกรรมอะไรจริง)
  turbopack: {},
  async headers() {
    return [
      {
        source: "/offline-sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: serviceWorkerCsp }
        ]
      },
      {
        source: "/app-version.json",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, max-age=0"
          }
        ]
      }
    ];
  },
  async redirects() {
    return [
      {
        source: "/sale/counter-checkout",
        destination: "/sales/sales-list",
        permanent: false
      },
      // QR codes printed for tables link to /q/<token>; the public POS reads it from ?t=
      {
        source: "/q/:token",
        destination: "/pos?t=:token",
        permanent: false
      },
      // legacy typo route inherited from backend field names (unite_*)
      {
        source: "/setting/unite",
        destination: "/settings/unit",
        permanent: true
      },
      // P2.1 route renames — keep old bookmarks/links working; not settled long enough for permanent:true
      // (no bare "/setting" entry: the settings hub page was removed — every settings link
      // is now a real /settings/<module> destination, so only the wildcard below applies)
      {
        source: "/setting/:path*",
        destination: "/settings/:path*",
        permanent: false
      },
      {
        source: "/product",
        destination: "/products",
        permanent: false
      },
      {
        source: "/product/:path*",
        destination: "/products/:path*",
        permanent: false
      },
      {
        source: "/printer",
        destination: "/printers",
        permanent: false
      },
      {
        source: "/printer/:path*",
        destination: "/printers/:path*",
        permanent: false
      },
      {
        source: "/sale/order-customer",
        destination: "/pos/order",
        permanent: false
      },
      {
        source: "/sales/open-table-sale",
        destination: "/pos/tables",
        permanent: false
      }
    ];
  },
  outputFileTracingRoot: appDir,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [55, 60, 75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "plc-files.sgp1.vultrobjects.com",
        pathname: "/api.yummy-go.com/uploaded/**"
      },
      {
        protocol: "https",
        hostname: "plc-files.sgp1.vultrobjects.com",
        pathname: "/api.yummy-go.com/products/**"
      },
      {
        protocol: "https",
        hostname: "api.yummy-go.com",
        pathname: "/uploaded/**"
      },
      {
        protocol: "https",
        hostname: "api.yummy-go.com",
        pathname: "/uploads/**"
      },
      {
        protocol: "https",
        hostname: "placehold.co"
      },
      {
        protocol: "https",
        hostname: "flagcdn.com",
        pathname: "/w80/**"
      }
    ]
  },
  typescript: {
    ignoreBuildErrors: false
  }
};

export default withSerwist(nextConfig);
