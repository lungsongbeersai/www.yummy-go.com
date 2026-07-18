import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";

const appDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
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
        destination: "/setting/unit",
        permanent: true
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
