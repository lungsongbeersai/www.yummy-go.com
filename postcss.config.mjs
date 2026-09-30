import { fileURLToPath } from "node:url";

const legacyWebViewOpacity = fileURLToPath(
  new URL("./scripts/postcss-legacy-webview-opacity.cjs", import.meta.url)
);

const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    [legacyWebViewOpacity]: {},
  },
};

export default config;
