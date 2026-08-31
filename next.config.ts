import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";

const appDir = dirname(fileURLToPath(import.meta.url));
const capacitorDevOrigin = process.env.CAPACITOR_DEV_ORIGIN?.trim();

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
  async headers() {
    return [
      {
        source: "/offline-sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" }
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

export default nextConfig;
