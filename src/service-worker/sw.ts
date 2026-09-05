import { defaultCache, PAGES_CACHE_NAME } from "@serwist/next/worker";
import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig, SerwistPlugin } from "serwist";

declare const process: {
  env: { NEXT_PUBLIC_PRINTER_AGENT_URL?: string };
};

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const LOGIN_PATH = "/login";
const LOCAL_AGENT_ORIGIN = new URL(
  process.env.NEXT_PUBLIC_PRINTER_AGENT_URL ?? "http://127.0.0.1:7777",
).origin;

// Backend และ Local Agent มีระบบ cache/queue ของตัวเองอยู่แล้ว (offline-sync.ts: Dexie + Agent)
// ต้องปล่อยผ่าน SW ทั้งหมด ไม่งั้นเกิด cache สองระบบแข่งกัน — /app-version.json ก็ต้องสดเสมอ
// เพราะ AppUpdateChecker poll เช็คเวอร์ชันจากมัน
const bypassBackendAndVersionCheck: RuntimeCaching = {
  matcher: ({ url }) =>
    url.pathname.startsWith("/api/") ||
    url.pathname === "/app-version.json" ||
    url.origin === LOCAL_AGENT_ORIGIN,
  handler: new NetworkOnly(),
};

// เน็ตร้าน/เน็ตมือถือลูกค้าช้าได้บ่อย — รอนานกว่านี้เท่ากับ "กดแล้วค้าง" ในสายตาคนใช้แล้ว
// NetworkFirst พอครบเวลานี้จะ fallback ไปแคชเก่าทันที แล้วอัปเดตแคชต่อเบื้องหลังเมื่อเน็ตกลับมา
const SLOW_NETWORK_TIMEOUT_SECONDS = 4;

// เอกสาร (navigation) เท่านั้น — RSC/prefetch แยกออกไปให้ defaultCache ของ @serwist/next จัดการ
// (แยกแคช rsc/rscPrefetch/html ให้อยู่แล้ว ละเอียดกว่าที่เขียนเองเดิม) ส่วนอันนี้ต้อง fallback ไป
// /login เสมอเมื่อออฟไลน์และไม่เคยเปิดหน้านั้นมาก่อน กัน browser error page เปล่า ๆ
//
// If /login itself is not cached either — e.g. a brand new SW version just
// activated (this app deploys and updates its SW often) and the device went
// offline again before it got a chance to re-warm /login's entry under the
// new build's cache name — handlerDidError returning undefined here used to
// let the "no-response" WorkboxError propagate out of the fetch handler as a
// REJECTED promise, which Android's WebView shows as its own native
// "net::ERR_FAILED" page instead of anything this app controls. A tiny
// self-contained HTML response (no cache, no chunks, nothing that can itself
// be missing) guarantees a navigation never falls through to that.
function offlineFallbackResponse(): Response {
  return new Response(
    `<!doctype html><html lang="lo"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<title>Yummy Go</title><style>` +
      `body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
      `background:#16a34a;color:#fff;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px;box-sizing:border-box}` +
      `p{font-size:1.05rem;line-height:1.6;max-width:28rem}` +
      `button{margin-top:1rem;padding:.6rem 1.75rem;border-radius:.5rem;border:none;background:#fff;color:#16a34a;font-weight:600;font-size:1rem}` +
      `</style></head><body><div><p>ອອບລາຍຢູ່ ແລະ ຍັງບໍ່ມີໜ້ານີ້ຢູ່ໃນເຄື່ອງ — ກະລຸນາເຊື່ອມຕໍ່ອິນເຕີເນັດ ແລ້ວລອງໃໝ່</p>` +
      `<button onclick="location.reload()">ລອງໃໝ່</button></div>` +
      `<script>addEventListener("online", () => location.reload());</script></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

const loginFallbackPlugin: SerwistPlugin = {
  handlerDidError: async () => {
    const cache = await caches.open(PAGES_CACHE_NAME.html);
    return (await cache.match(LOGIN_PATH, { ignoreSearch: true })) ?? offlineFallbackResponse();
  },
};

const documentStrategy = new NetworkFirst({
  cacheName: PAGES_CACHE_NAME.html,
  networkTimeoutSeconds: SLOW_NETWORK_TIMEOUT_SECONDS,
  // Offline, /pos/order?table_uuid=... must resolve to the one warmed /pos/order
  // shell (the page reads the table from the query client-side). Without this the
  // per-table URL misses the cache and loginFallbackPlugin bounces to /login.
  // NetworkFirst still fetches fresh first when online, so this only affects the
  // offline cache lookup.
  matchOptions: { ignoreSearch: true },
  plugins: [loginFallbackPlugin],
});

const navigationCaching: RuntimeCaching = {
  matcher: ({ request }) => request.mode === "navigate",
  handler: documentStrategy,
};

// RSC payload คือ request ที่เกิดทุกครั้งที่กด <Link>/router.push ในแอป (การเปลี่ยนหน้า
// แบบ client-side ทั้งหมด — กดเลือกโต๊ะ กดเข้าเมนู ฯลฯ) ของเดิมจาก defaultCache ไม่ตั้ง
// timeout เลย ถ้าเน็ตแค่ "ช้า" (ไม่ถึงกับขาด) จะรอ network ไม่มีกำหนดก่อนยอม fallback
// ไปแคช — override เฉพาะจุดนี้ด้วย timeout สั้นๆ ต้องอยู่ก่อน ...defaultCache ใน array
// (Serwist ใช้ตัวจับคู่แรกที่ match) prefetch (Next-Router-Prefetch) ปล่อยให้ defaultCache
// จัดการตามเดิมเพราะเป็นงานเบื้องหลัง ผู้ใช้ไม่ได้รอมันตรงๆ
const rscNavigationCaching: RuntimeCaching = {
  matcher: ({ request, url, sameOrigin }) =>
    sameOrigin &&
    !url.pathname.startsWith("/api/") &&
    request.headers.get("RSC") === "1" &&
    request.headers.get("Next-Router-Prefetch") !== "1",
  handler: new NetworkFirst({
    cacheName: PAGES_CACHE_NAME.rsc,
    networkTimeoutSeconds: SLOW_NETWORK_TIMEOUT_SECONDS,
  }),
};

// รูปสินค้า/โลโก้ร้าน เสิร์ฟจาก ${NEXT_PUBLIC_BASE_URL}/uploaded/... บน origin ของ backend
// (คนละ origin, opaque) — CacheFirst เก็บไว้ตอนออนไลน์ ครั้งถัดไปดึงจากแคชเลย เพื่อให้เมนู POS
// ตอนออฟไลน์ยังมีรูป จำกัดจำนวน/อายุกันแคชบวมด้วย ExpirationPlugin
// ครอบทั้ง /uploaded/ (เส้นทางเดิม), /uploads/ และ /products/ ตาม images.remotePatterns
// ใน next.config.ts — ทั้งสามชื่อโฟลเดอร์ถูกใช้จริงกับรูปสินค้า
const UPLOADED_IMAGE_PATH = /\/(?:uploaded|uploads|products)\//;

// <Image> ของ next/image ไม่ได้ขอ URL ปลายทางตรง ๆ แต่ขอผ่าน optimizer เป็น
// /_next/image?url=<ต้นทาง>&w=..&q=.. บน origin ของแอปเอง — matcher เดิมเช็ค
// url.pathname จึงไม่เคยเจอ "/uploaded/" เลยสักครั้ง รูปสินค้าไม่เคยถูกแคช
// เมนู POS ตอนออฟไลน์จึงขึ้นเป็นไอคอนรูปเปล่าทั้งหน้า
function isUploadedImageRequest(url: URL) {
  if (UPLOADED_IMAGE_PATH.test(url.pathname)) return true;
  if (url.pathname !== "/_next/image") return false;
  const source = url.searchParams.get("url");
  return Boolean(source) && UPLOADED_IMAGE_PATH.test(source as string);
}

// next/image requests a different w= for the same product depending on
// where it renders (grid card vs. a 40-44px cart-line thumbnail, see
// order-customer-product-card.tsx vs. cart-items.tsx) — opening the menu
// online only ever warms the grid's width. An order taken offline for a
// product that had never been *ordered* online before (Android offline
// order-taking) hits the cart-line width for the first time with no network
// to fetch it, rendering a broken image.
//
// matchOptions: { ignoreSearch: true } (tried first, reversing the earlier
// "each rendered width is its own entry" call in docs/Decisions.md) is
// wrong for this specifically: Cache API ignoreSearch drops the ENTIRE
// query string, including url= — the part that says WHICH product this is
// — so it collapsed every /_next/image entry into one shared bucket and
// any product could answer any other's request. Only w=/q= should be
// ignored, url= must stay part of the key — a plain matchOptions cannot
// express that split, so a cacheKeyWillBeUsed plugin rewrites the key to
// just the decoded source URL, for both the read and the write side.
const imageCacheKeyPlugin: SerwistPlugin = {
  cacheKeyWillBeUsed: async ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname !== "/_next/image") return request;
    const source = url.searchParams.get("url");
    if (!source || !UPLOADED_IMAGE_PATH.test(source)) return request;
    return `${url.origin}/_next/image?url=${encodeURIComponent(source)}`;
  },
};

const uploadedImageCaching: RuntimeCaching = {
  matcher: ({ url, request }) =>
    request.destination === "image" && isUploadedImageRequest(url),
  handler: new CacheFirst({
    cacheName: "yummy-uploaded-images",
    plugins: [
      imageCacheKeyPlugin,
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 30 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    bypassBackendAndVersionCheck,
    navigationCaching,
    rscNavigationCaching,
    uploadedImageCaching,
    ...defaultCache,
  ],
});

serwist.addEventListeners();

// เข้าแคช /login ไว้ล่วงหน้าตั้งแต่ install เพื่อให้ loginFallbackPlugin มีอะไรให้ fallback ตั้งแต่
// ครั้งแรกที่ใช้งาน — เรียกผ่าน strategy.handle() แทน fetch() ตรง ๆ เพราะ fetch จากใน SW เองไม่วิ่ง
// เข้า fetch listener ของตัวเอง ต้องเรียก strategy ตรง ๆ ถึงจะเขียนแคชให้จริง
self.addEventListener("install", (event) => {
  event.waitUntil(
    documentStrategy.handle({ event, request: LOGIN_PATH }).catch(() => undefined),
  );
});

// offline-app-runtime.tsx postMessage มาตอน login สำเร็จ ให้เข้าแคชหน้าที่จำเป็นสำหรับงานขาย
// ตอนออฟไลน์ล่วงหน้า (รายชื่อหน้ามาจาก offline-routes.ts ฝั่งแอป — คนละความรับผิดชอบกันชัดเจน)
self.addEventListener("message", (event) => {
  if (event.data?.type !== "WARM_OFFLINE_ROUTES") return;
  const routes: string[] = Array.isArray(event.data.routes) ? event.data.routes.map(String) : [];
  event.waitUntil(
    Promise.all(
      routes.map((route) => {
        const url = new URL(route, self.location.origin);
        if (url.origin !== self.location.origin) return Promise.resolve();
        return documentStrategy.handle({ event, request: url.pathname }).catch(() => undefined);
      }),
    ).then(
      () => event.ports[0]?.postMessage({ ok: true }),
      () => event.ports[0]?.postMessage({ ok: false }),
    ),
  );
});
