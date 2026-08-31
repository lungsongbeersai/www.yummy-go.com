import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".claude/**",
      ".next/**",
      ".worktrees/**",
      "android/app/build/**",
      "dist/**",
      "dist-electron/**",
      "node_modules/**",
      "out/**",
      "release/**",
      "next-env.d.ts",
      // สร้างจาก src/service-worker/sw.ts ตอน build (@serwist/next) — minified, ไม่ใช่ source ที่เขียนเอง
      "public/offline-sw.js"
    ]
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-empty-object-type": "off"
    }
  }
];

export default eslintConfig;
