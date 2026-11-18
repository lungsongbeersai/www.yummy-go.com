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
const legacyWebViewLayout = fileURLToPath(
  new URL("./scripts/postcss-legacy-webview-layout.cjs", import.meta.url)
);
const legacyWebView83 = fileURLToPath(
  new URL("./scripts/postcss-legacy-webview-83.cjs", import.meta.url)
);

const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    [legacyWebViewLayout]: {},
    [legacyWebViewOpacity]: {},
    [legacyWebViewGeometry]: {},
    [legacyWebViewLayers]: {},
    [legacyWebView83]: {},
  },
};

export default config;
