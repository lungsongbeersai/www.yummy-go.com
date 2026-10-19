import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // URL fixtures stay deterministic when a developer or CI exports production config.
    env: { NEXT_PUBLIC_BASE_URL: "" },
    globals: true,
    include: ["src/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
