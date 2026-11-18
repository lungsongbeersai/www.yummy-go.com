import { fileURLToPath } from "node:url";

const legacyWebViewOpacity = fileURLToPath(
  new URL("./scripts/postcss-legacy-webview-opacity.cjs", import.meta.url)
);
const legacyWebViewLayers = fileURLToPath(
  new URL("./scripts/postcss-legacy-webview-layers.cjs", import.meta.url)
);
const legacyWebViewGeometry = fileURLToPath(
  new URL("./scripts/postcss-legacy-webview-geometry.cjs", import.meta.url)
);

const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    [legacyWebViewOpacity]: {},
    [legacyWebViewGeometry]: {},
    [legacyWebViewLayers]: {},
  },
};

export default config;
