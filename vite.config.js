import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

/**
 * Node 22.21.0 crashes on HTTPS WebSocket upgrade (Vite HMR) — https://github.com/nodejs/node/issues/60336
 * Fixed in Node 22.21.1+.
 */
function isNodeHttpsWebsocketUpgradeBroken() {
  const parts = process.versions.node.split(".").map((s) => Number.parseInt(s, 10));
  const [major = 0, minor = 0, patch = 0] = parts;
  return major === 22 && minor === 21 && patch === 0;
}

/** Hostnames/IPs included in the dev TLS cert (localhost + active LAN IPv4). */
function getDevLanHosts() {
  const hosts = ["localhost", "127.0.0.1"];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const net of ifaces ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        hosts.push(net.address);
      }
    }
  }
  return [...new Set(hosts)];
}

/** Must match `firebase` in package.json (compat CDN importScripts). */
const FIREBASE_JS_VERSION = "12.12.0";

/** Default tray icon for FCM background notifications (copied from `src/assets/images/logos/logo-sm.png`). */
const FCM_NOTIFICATION_ICON_URL = "/notification-icon.png";

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

function fcmExplicitSafePath(m) {
  var origin = self.location.origin;
  function tryRaw(raw) {
    if (!raw || typeof raw !== "string") return "";
    var v = raw.trim();
    if (!v || v.length > 512) return "";
    if (v.indexOf("/") === 0) {
      if (v.indexOf("//") === 0) return "";
      return v.split("?")[0].split("#")[0];
    }
    try {
      var u = new URL(v, origin);
      if (u.origin !== new URL(origin).origin) return "";
      var p = u.pathname.split("?")[0];
      return p.indexOf("/") === 0 ? p : "";
    } catch (e) {
      return "";
    }
  }
  var a = tryRaw(m.path);
  if (a) return a;
  a = tryRaw(m.link);
  if (a) return a;
  return tryRaw(m.url) || "";
}

function fcmSafeId(m) {
  var keys = ["id", "entity_id", "entityId", "target_id", "targetId"];
  for (var i = 0; i < keys.length; i++) {
    var v = (m[keys[i]] || "").trim();
    if (v && /^[\\w.-]+$/.test(v)) return v;
  }
  return "";
}

function fcmEnc(s) {
  return encodeURIComponent(s);
}

function fcmPickOrderKind(m) {
  var v = (m.order_kind || m.orderKind || "").trim();
  return v && /^[\\w.-]+$/.test(v) ? v : "";
}

function fcmPickInvoice(m, primaryId) {
  var v = (m.invoice_id || m.invoiceId || "").trim();
  if (v && /^[\\w.-]+$/.test(v)) return v;
  return primaryId || "";
}

function fcmPickClaimIdFromDetails(detailsStr) {
  if (!detailsStr || typeof detailsStr !== "string") return "";
  try {
    var o = JSON.parse(detailsStr);
    if (!o || typeof o !== "object") return "";
    var keys = ["claim_id", "claimId", "reimbursement_id", "id"];
    for (var i = 0; i < keys.length; i++) {
      var v = o[keys[i]];
      if (v == null) continue;
      var s =
        typeof v === "number" && isFinite(v) && Math.floor(v) === v
          ? String(v)
          : typeof v === "string"
            ? v.trim()
            : String(v).trim();
      if (s && /^[\\w.-]+$/.test(s)) return s;
    }
  } catch (e) {}
  return "";
}

function fcmPickClaimsRouteId(m) {
  var keys = ["claim_id", "claimId", "reimbursement_id", "reimbursementId"];
  for (var i = 0; i < keys.length; i++) {
    var v = (m[keys[i]] || "").trim();
    if (v && /^[\\w.-]+$/.test(v)) return v;
  }
  var fromDetails = fcmPickClaimIdFromDetails(m.details);
  if (fromDetails) return fromDetails;
  return fcmSafeId(m);
}

function fcmNormalizedType(m) {
  var raw = (m.type || m.notification_type || m.screen || "").trim();
  return raw.toLowerCase().replace(/\\s+/g, "_");
}

function fcmTypedDeepLinkPath(m) {
  var t = fcmNormalizedType(m);
  if (!t) return "";
  var id = fcmSafeId(m);
  switch (t) {
    case "video_call":
    case "video":
    case "ongoing_appointment":
    case "live_consultation":
    case "appointment_video":
      return id ? "/video/" + fcmEnc(id) : "";
    case "consultation_chat":
    case "medical_chat":
    case "consultation_message":
      return id ? "/medical-records/consultations/chat/" + fcmEnc(id) : "";
    case "pharmacy_prescription":
    case "prescription":
      return id ? "/pharmacy/prescription/" + fcmEnc(id) : "";
    case "health_club":
    case "blog":
    case "article":
      return id ? "/health-club/" + fcmEnc(id) : "";
    case "fitness_tag":
    case "workout_tag":
    case "fitness_category":
      return id ? "/services/fitness/tag/" + fcmEnc(id) : "";
    case "chronic":
    case "chronic_condition":
    case "chronic_program":
      return id ? "/services/chronic/" + fcmEnc(id) : "";
    case "claim":
    case "reimbursement": {
      var cid = fcmPickClaimsRouteId(m);
      return cid ? "/claims/" + fcmEnc(cid) : "";
    }
    case "wallet":
    case "wallet_subscription":
    case "opd_wallet":
      return id ? "/wallet/" + fcmEnc(id) : "";
    case "lab_order":
    case "order_lab":
      return id ? "/order/lab/" + fcmEnc(id) : "";
    case "gym_order":
      return id ? "/order/gym/" + fcmEnc(id) : "";
    case "consultation_order":
      return id ? "/order/consultation/" + fcmEnc(id) : "";
    case "order":
    case "invoice": {
      var kind = fcmPickOrderKind(m);
      var inv = fcmPickInvoice(m, id);
      return kind && inv ? "/order/" + fcmEnc(kind) + "/" + fcmEnc(inv) : "";
    }
    case "digital_diary":
    case "diary":
    case "diary_log":
      return id ? "/digital-diary/" + fcmEnc(id) : "";
    case "notifications":
    case "notification_inbox":
    case "notification_list":
    case "notification":
      return "/notifications";
    case "dashboard":
    case "home":
      return "/dashboard";
    case "services":
    case "services_hub":
      return "/services";
    case "orders":
    case "orders_list":
    case "my_orders":
      return "/orders";
    case "cart":
    case "cart_overview":
      return "/cart-overview";
    default:
      return "";
  }
}

function fcmNavigatePath(d) {
  var m = mergeFcmDetails(d || {});
  var ex = fcmExplicitSafePath(m);
  if (ex) return ex;
  var st = fcmSupportTicketPath(d);
  if (st) return st;
  return fcmTypedDeepLinkPath(m) || "";
}

/** Flat string-only data for {@link ServiceWorkerRegistration#showNotification} (Chrome is strict). */
function fcmSanitizeNotificationData(merged, path) {
  var out = {};
  if (path) out.path = String(path);
  if (!merged || typeof merged !== "object") return out;
  var n = 0;
  for (var k in merged) {
    if (!Object.prototype.hasOwnProperty.call(merged, k)) continue;
    if (n++ >= 48) break;
    try {
      out[String(k).slice(0, 64)] = String(merged[k]).slice(0, 1000);
    } catch (e) {}
  }
  return out;
}

/** Prefer messageId so each push gets a distinct tray entry (collapseKey alone replaces the previous). */
function fcmNotificationTag(payload) {
  if (payload.messageId) return "fcm-" + String(payload.messageId);
  if (payload.collapseKey) return "fcm-" + String(payload.collapseKey) + "-" + Date.now();
  return "fcm-bg-" + Date.now();
}

messaging.onBackgroundMessage(function (payload) {
  console.log("[FCM] background push received", {
    messageId: payload.messageId,
    from: payload.from,
    collapseKey: payload.collapseKey,
    notification: payload.notification,
    data: payload.data,
  });
  var merged = mergeFcmDetails(payload.data || {});
  var path = fcmNavigatePath(payload.data || {});
  var title =
    (payload.notification && payload.notification.title) ||
    merged.title ||
    "Notification";
  var body =
    (payload.notification && payload.notification.body) || merged.body || "";
  if (path) console.log("[FCM] resolved deep-link path from background payload", path);

  var perm = typeof Notification !== "undefined" ? Notification.permission : "unknown";
  if (perm !== "granted") {
    console.warn(
      "[FCM] system notification skipped: Notification.permission is",
      perm,
      "— allow notifications for this site in browser settings.",
    );
    return Promise.resolve();
  }

  if (!self.registration || !self.registration.showNotification) {
    console.warn("[FCM] showNotification unavailable (no registration)");
    return Promise.resolve();
  }

  var icon =
    (payload.notification && payload.notification.icon) || "${FCM_NOTIFICATION_ICON_URL}";
  var clickData = fcmSanitizeNotificationData(merged, path);
  var tag = fcmNotificationTag(payload);
  var nTitle = String(title).trim() || "Notification";
  var nBody = String(body || "");
  var opts = {
    body: nBody,
    icon: icon,
    tag: tag,
    data: clickData,
    silent: false,
  };

  return self.registration
    .showNotification(nTitle, opts)
    .catch(function (e) {
      console.error("[FCM] showNotification failed (with data)", e && (e.message || e));
      var minimalData = path ? { path: String(path) } : {};
      return self.registration.showNotification(nTitle, {
        body: nBody,
        icon: icon,
        tag: tag,
        silent: false,
        data: minimalData,
      });
    })
    .catch(function (e2) {
      console.error("[FCM] showNotification failed (minimal options)", e2 && (e2.message || e2));
    });
});

self.addEventListener("notificationclick", function (event) {
  console.log("[FCM] notification click", {
    title: event.notification.title,
    data: event.notification.data,
  });
  event.notification.close();
  var nd = event.notification.data || {};
  var path = nd.path || fcmNavigatePath(nd);
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
        raw === "/vite.svg" ||
        raw === FCM_NOTIFICATION_ICON_URL
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

/** Prints LAN https URLs so mobile web can use camera / QR over Wi‑Fi. */
function logMobileLanHttpsUrlsPlugin() {
  return {
    name: "log-mobile-lan-https-urls",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        const useHttps = Boolean(server.config.server.https);
        const port = server.config.server.port ?? 3000;
        if (!useHttps) {
          console.warn(
            "\n[dev] HTTPS is off — camera / QR scan will NOT work on a phone using http://<LAN-IP>.\n" +
              "      Remove VITE_DEV_SERVER_HTTPS=false from .env and restart.\n",
          );
          return;
        }
        if (isNodeHttpsWebsocketUpgradeBroken()) {
          console.warn(
            `\n[dev] Node ${process.versions.node} breaks HTTPS + hot reload (server crash on phone/browser open).\n` +
              "      Upgrade to Node 22.21.1 or newer (https://nodejs.org/en/download), then restart.\n" +
              "      HMR is disabled for this session so https:// LAN testing still works.\n",
          );
        }
        import("node:os")
          .then((os) => {
            const ips = [];
            for (const ifaces of Object.values(os.networkInterfaces())) {
              for (const net of ifaces ?? []) {
                if (net.family === "IPv4" && !net.internal) {
                  ips.push(net.address);
                }
              }
            }
            if (ips.length === 0) return;
            console.info("\n[dev] Mobile QR / camera — open on your phone (same Wi‑Fi):\n");
            for (const ip of ips) {
              console.info(`      https://${ip}:${port}/`);
            }
            console.info(
              "\n      Use https:// (not http://). Accept the certificate warning once, then allow camera.\n",
            );
          })
          .catch(() => {
            // ignore
          });
      });
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
  const disableHmr =
    devHttps && isNodeHttpsWebsocketUpgradeBroken();

  const devPlugins = [
    spaNavigationAcceptPatchPlugin(),
    logMobileLanHttpsUrlsPlugin(),
  ];
  if (devHttps) {
    devPlugins.push(
      basicSsl({
        name: "opd-mobile-dev",
        domains: getDevLanHosts(),
      }),
    );
  }
  devPlugins.push(react(), firebaseMessagingSwPlugin());

  return {
    appType: "spa",
    plugins: devPlugins,
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
      /** Prevents Node 22.21.0 crash when a client opens https:// (HMR WebSocket upgrade). */
      ...(disableHmr ? { hmr: false } : {}),
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
