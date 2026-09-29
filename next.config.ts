import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";

const appDir = dirname(fileURLToPath(import.meta.url));
const capacitorDevOrigin = process.env.CAPACITOR_DEV_ORIGIN?.trim();

const nextConfig: NextConfig = {
  // Dev server only (`next dev`); a production build ignores this list.
  // Next dev blocks /_next/static/chunks/*.js with 403 for any origin not listed (localhost is
  // always allowed), so a phone that opens the dev server by LAN IP loads the HTML and then
  // spins forever. Two ways to test Capacitor Android on a real phone:
  //   - USB (simplest): `adb reverse tcp:3000 tcp:3000`, then the app with
  //     CAPACITOR_SERVER_URL=http://localhost:3000 — localhost needs no entry here.
  //   - Wi-Fi: start the dev server with CAPACITOR_DEV_ORIGIN=<LAN IP> (see `ipconfig`) and the
  //     app with CAPACITOR_SERVER_URL=http://<LAN IP>:3000. No IP is hard-coded: it changes
  //     with the network.
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
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }
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
        destination: "/posAll?t=:token",
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
        destination: "/posAll/order",
        permanent: false
      },
      {
        source: "/sales/open-table-sale",
        destination: "/posAll/tables",
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
