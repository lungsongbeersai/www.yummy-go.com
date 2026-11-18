import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";
import packageManifest from "./package.json";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const appDir = dirname(fileURLToPath(import.meta.url));
const capacitorDevOrigin = process.env.CAPACITOR_DEV_ORIGIN?.trim();
const transpilePackages = ["html2canvas-pro", "@date-fns/tz", "react-redux"];

interface WebpackCacheConfig {
  cache?: boolean | { type?: string; version?: string };
}

function legacyCssFingerprint() {
  const scripts = readdirSync(new URL("./scripts/", import.meta.url))
    .filter(name => /^(?:postcss-)?legacy-.*\.cjs$/.test(name)).sort();
  const hash = createHash("sha256");
  for (const name of ["postcss.config.mjs", ...scripts.map(name => `scripts/${name}`)]) {
    hash.update(name).update("\0").update(readFileSync(new URL(name, import.meta.url)));
  }
  return hash.digest("hex");
}

const nextConfig: NextConfig = {
  // Distributed PDF, calendar and chart dependencies contain class static
  // blocks or logical assignment. Compile them to the same native target.
  transpilePackages,
  turbopack: {},
  webpack(config: WebpackCacheConfig) {
    // Next 16's cache omits these targets and dependency opt-ins. A stale cache
    // can otherwise retain unsupported syntax even after a successful build.
    // CSS is compiled on both sides; PostCSS's lazy local plugins are not all
    // tracked as loader dependencies. Hash their contents at build time only.
    if (config.cache && typeof config.cache === "object" && config.cache.type === "filesystem") {
      config.cache.version = `${config.cache.version ?? ""}|yummy-go-browser:${JSON.stringify({
        browserslist: packageManifest.browserslist,
        transpilePackages,
        legacyCss: legacyCssFingerprint(),
      })}`;
    }
    return config;
  },
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
