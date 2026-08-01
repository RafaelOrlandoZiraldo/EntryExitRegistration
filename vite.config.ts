import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          recharts: ["recharts"]
        }
      }
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDirectory, "./src"),
      "@app": path.resolve(rootDirectory, "./src/app"),
      "@domain": path.resolve(rootDirectory, "./src/domain"),
      "@application": path.resolve(rootDirectory, "./src/application"),
      "@infrastructure": path.resolve(rootDirectory, "./src/infrastructure"),
      "@features": path.resolve(rootDirectory, "./src/features"),
      "@shared": path.resolve(rootDirectory, "./src/shared")
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts",
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
    css: true
  }
});
