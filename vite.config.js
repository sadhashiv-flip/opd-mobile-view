import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

/** Optional dev-only proxy to avoid browser CORS when the app and API are on different origins. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_DEV_API_PROXY_TARGET?.trim();
  /** Default on so LAN / device testing gets a secure context for camera+mic. Set VITE_DEV_SERVER_HTTPS=false for plain http. */
  const devHttpsOff =
    env.VITE_DEV_SERVER_HTTPS === "false" ||
    env.VITE_DEV_SERVER_HTTPS === "0" ||
    env.VITE_DEV_SERVER_HTTPS === "no";
  const devHttps = !devHttpsOff;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": srcDir,
      },
    },
    server: {
      port: 3000,
      host: true,
      ...(devHttps ? { https: true } : {}),
      ...(proxyTarget
        ? {
            proxy: {
              "/dev-api": {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/dev-api/, "") || "/",
              },
            },
          }
        : {}),
    },
    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom"],
          },
        },
      },
    },
    preview: {
      port: 3000,
      host: true,
    },
  };
});
