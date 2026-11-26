import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: __dirname,
  base: "./",
  resolve: { alias: { "@": path.resolve(__dirname, "../src") } },
  build: { outDir: "dist", emptyOutDir: true },
});
