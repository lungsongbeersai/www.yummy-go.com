import { defaultCache, PAGES_CACHE_NAME } from "@serwist/next/worker";
import { NetworkFirst, NetworkOnly, Serwist } from "serwist";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig, SerwistPlugin } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const LOGIN_PATH = "/login";

// Backend (api.yummy-go.com) เป็น cross-origin เสมอ และมีระบบ cache/queue ของตัวเองอยู่แล้ว
// (offline-sync.ts: Dexie + Local Printer Agent) ต้องปล่อยผ่าน SW ทั้งหมด ไม่งั้นเกิด cache
// สองระบบแข่งกัน — /app-version.json ก็ต้องสดเสมอเพราะ AppUpdateChecker poll เช็คเวอร์ชันจากมัน
const bypassBackendAndVersionCheck: RuntimeCaching = {
  matcher: ({ url }) => url.pathname.startsWith("/api/") || url.pathname === "/app-version.json",
  handler: new NetworkOnly(),
};

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
  networkTimeoutSeconds: 10,
  plugins: [loginFallbackPlugin],
});

const navigationCaching: RuntimeCaching = {
  matcher: ({ request }) => request.mode === "navigate",
  handler: documentStrategy,
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [bypassBackendAndVersionCheck, navigationCaching, ...defaultCache],
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
