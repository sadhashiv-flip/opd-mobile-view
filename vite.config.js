import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

/** Must match `firebase` in package.json (compat CDN importScripts). */
const FIREBASE_JS_VERSION = "12.12.0";

function buildFirebaseMessagingSwBody(env) {
  const projectId = env.VITE_FIREBASE_PROJECT_ID?.trim() ?? "";
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY?.trim() ?? "",
    authDomain:
      env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ||
      (projectId ? `${projectId}.firebaseapp.com` : ""),
    projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ?? "",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? "",
    appId: env.VITE_FIREBASE_APP_ID?.trim() ?? "",
  };
  return `importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_JS_VERSION}/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_JS_VERSION}/firebase-messaging-compat.js');
firebase.initializeApp(${JSON.stringify(config)});
firebase.messaging();
`;
}

/** Serves / writes `firebase-messaging-sw.js` from Vite env (required for web FCM `getToken`). */
function firebaseMessagingSwPlugin() {
  let viteConfig;
  return {
    name: "firebase-messaging-sw",
    configResolved(config) {
      viteConfig = config;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url !== "/firebase-messaging-sw.js") {
          next();
          return;
        }
        const env = loadEnv(server.config.mode, server.config.root, "");
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.end(buildFirebaseMessagingSwBody(env));
      });
    },
    closeBundle() {
      if (!viteConfig) return;
      const env = loadEnv(viteConfig.mode, viteConfig.root, "");
      const outDir = path.resolve(viteConfig.root, viteConfig.build.outDir);
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        path.join(outDir, "firebase-messaging-sw.js"),
        buildFirebaseMessagingSwBody(env),
        "utf8",
      );
    },
  };
}

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
    plugins: [react(), firebaseMessagingSwPlugin()],
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
