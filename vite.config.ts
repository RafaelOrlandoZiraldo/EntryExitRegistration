import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { loadEnv, type Plugin, type ViteDevServer } from "vite";
import { defineConfig } from "vitest/config";
import { createLocalApiMiddleware } from "./scripts/local-api-middleware";

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDirectory, "");
  const localApiPlugin =
    env.VITE_DATA_SOURCE === "api"
      ? ({
          name: "local-api",
          configureServer(server: ViteDevServer) {
            server.middlewares.use(createLocalApiMiddleware(env, rootDirectory));
          }
        } satisfies Plugin)
      : null;

  return {
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
    plugins: [react(), ...(localApiPlugin ? [localApiPlugin] : [])],
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
  };
});
