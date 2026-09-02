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
const loginFallbackPlugin: SerwistPlugin = {
  handlerDidError: async () => {
    const cache = await caches.open(PAGES_CACHE_NAME.html);
    return (await cache.match(LOGIN_PATH, { ignoreSearch: true })) ?? undefined;
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
const uploadedImageCaching: RuntimeCaching = {
  matcher: ({ url, request }) =>
    request.destination === "image" && url.pathname.includes("/uploaded/"),
  handler: new CacheFirst({
    cacheName: "yummy-uploaded-images",
    plugins: [
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
