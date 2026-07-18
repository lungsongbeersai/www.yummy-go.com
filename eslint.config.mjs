import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".claude/**",
      ".next/**",
      "android/app/build/**",
      "dist/**",
      "dist-electron/**",
      "node_modules/**",
      "out/**",
      "release/**",
      "next-env.d.ts"
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
