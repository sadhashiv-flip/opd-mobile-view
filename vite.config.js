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
var messaging = firebase.messaging();

function mergeFcmDetails(d) {
  var out = {};
  if (!d || typeof d !== "object") return out;
  for (var k in d) {
    if (Object.prototype.hasOwnProperty.call(d, k) && d[k] != null) out[k] = String(d[k]);
  }
  var detailsStr = d.details;
  if (detailsStr && typeof detailsStr === "string") {
    try {
      var parsed = JSON.parse(detailsStr);
      if (parsed && typeof parsed === "object") {
        for (var k2 in parsed) {
          if (Object.prototype.hasOwnProperty.call(parsed, k2) && out[k2] === undefined) {
            out[k2] = String(parsed[k2]);
          }
        }
      }
    } catch (e) {}
  }
  return out;
}

function fcmSupportTicketPath(d) {
  var m = mergeFcmDetails(d || {});
  var p = (m.path || m.link || m.url || "").trim();
  var prefix = "/services/support/ticket/";
  if (p.indexOf(prefix) === 0) return p.split("?")[0].split("#")[0];
  try {
    if (p.indexOf("http") === 0) {
      var u = new URL(p);
      if (u.pathname.indexOf(prefix) === 0) return u.pathname;
    }
  } catch (e) {}
  var tid = (m.ticket_id || m.ticketId || "").trim();
  var tl = (m.type || "").toLowerCase();
  if (!tid && (tl.indexOf("support") >= 0 || tl.indexOf("ticket") >= 0 || tl.indexOf("help") >= 0)) {
    tid = (m.id || "").trim();
  }
  if (tid) return prefix + encodeURIComponent(tid);
  return "";
}

messaging.onBackgroundMessage(function (payload) {
  console.log("[FCM] background push received", {
    messageId: payload.messageId,
    from: payload.from,
    collapseKey: payload.collapseKey,
    notification: payload.notification,
    data: payload.data,
  });
  var path = fcmSupportTicketPath(payload.data || {});
  var data = payload.data || {};
  var title =
    (payload.notification && payload.notification.title) ||
    data.title ||
    "Notification";
  var body =
    (payload.notification && payload.notification.body) || data.body || "";
  if (path) console.log("[FCM] resolved ticket path from background payload", path);
  if (!payload.notification && path && self.registration.showNotification) {
    return self.registration.showNotification(title, {
      body: body,
      icon: "/favicon.ico",
      data: Object.assign({}, data, { path: path }),
    });
  }
});

self.addEventListener("notificationclick", function (event) {
  console.log("[FCM] notification click", {
    title: event.notification.title,
    data: event.notification.data,
  });
  event.notification.close();
  var nd = event.notification.data || {};
  var path = nd.path || fcmSupportTicketPath(nd);
  if (path) console.log("[FCM] notification click → path", path);
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var c = clientList[i];
        if (c.url.indexOf(self.location.origin) === 0 && "focus" in c) {
          if (path) c.postMessage({ type: "FCM_NAVIGATE", path: path });
          return c.focus();
        }
      }
      if (clients.openWindow) {
        var target = path ? self.location.origin + path : self.location.origin + "/";
        return clients.openWindow(target);
      }
    }),
  );
});
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

// Some LAN or WebView clients omit Accept: text/html on GET navigations, so Vite's SPA htmlFallbackMiddleware
// skips and paths like /dashboard return 404. Patch Accept before that runs (dev + preview).
function spaAcceptPatchMiddleware() {
  return function spaAcceptPatch(req, _res, next) {
      if (req.method !== "GET" && req.method !== "HEAD") return next();

      const raw = req.url?.split("?")[0]?.split("#")[0] ?? "";
      if (
        raw.startsWith("/@") ||
        raw.startsWith("/node_modules") ||
        raw.startsWith("/src") ||
        raw.startsWith("/assets") ||
        raw.startsWith("/dev-api") ||
        raw === "/firebase-messaging-sw.js" ||
        raw === "/favicon.ico"
      ) {
        return next();
      }

      const accept = req.headers.accept ?? "";
      const acceptOk =
        accept === "" ||
        accept.includes("text/html") ||
        accept.includes("*/*");
      if (acceptOk) return next();

      const dest = req.headers["sec-fetch-dest"];
      const looksLikeDocNavigation = dest === "document" || dest === "iframe";

      /** Root `/` has an empty first segment — must still patch Accept or html-fallback skips and returns 404. */
      const isRootOrIndex =
        raw === "/" || raw === "" || raw === "/index.html";

      const firstSeg = raw.replace(/^\//, "").split("/")[0] ?? "";
      const looksLikeSpaPath =
        isRootOrIndex ||
        (firstSeg.length > 0 && !firstSeg.includes("."));

      if (looksLikeDocNavigation || looksLikeSpaPath) {
        req.headers.accept = `${accept},text/html`;
      }
      next();
    };
}

function spaNavigationAcceptPatchPlugin() {
  return {
    name: "spa-navigation-accept-patch",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(spaAcceptPatchMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(spaAcceptPatchMiddleware());
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
    appType: "spa",
    plugins: [spaNavigationAcceptPatchPlugin(), react(), firebaseMessagingSwPlugin()],
    resolve: {
      alias: {
        "@": srcDir,
      },
    },
    server: {
      port: 3000,
      /** Listen on all interfaces so LAN devices can reach this machine (pair with Windows Firewall rule). */
      host: true,
      /** Allow any Host header (localhost, LAN IP, .local names) — avoids dev-only 403 from host checks. */
      allowedHosts: true,
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
      allowedHosts: true,
    },
  };
});
