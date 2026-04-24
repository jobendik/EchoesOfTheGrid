import { defineConfig } from "vite";

// `base: "./"` keeps asset paths relative so the build works both on
// GitHub Pages (under `/repo-name/`) and when previewed locally.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2022",
  },
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
