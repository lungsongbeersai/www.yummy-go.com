"use strict";

const CACHE_PREFIX = "yummy-go-offline-";
const DOCUMENT_CACHE = `${CACHE_PREFIX}documents-v1`;
const RSC_CACHE = `${CACHE_PREFIX}rsc-v1`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-v1`;
const CORE_ROUTES = ["/login"];

function cacheKey(kind, url) {
  const source = new URL(url, self.location.origin);
  return new URL(`/__offline_cache__/${kind}${source.pathname}`, self.location.origin).toString();
}

function isRscRequest(request) {
  const url = new URL(request.url);
  return request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
}

function isCacheableAsset(url) {
  return url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/_next/image" ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/locales/") ||
    /\.(?:js|css|woff2?|ttf|png|jpe?g|webp|svg|ico)$/i.test(url.pathname);
}

async function cacheDocumentAssets(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return;
  const html = await response.text();
  const urls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => {
      try {
        return new URL(match[1], self.location.origin);
      } catch {
        return null;
      }
    })
    .filter((url) => url && url.origin === self.location.origin && isCacheableAsset(url));
  const cache = await caches.open(ASSET_CACHE);
  await Promise.all(urls.map(async (url) => {
    try {
      if (await cache.match(url, { ignoreSearch: false })) return;
      const asset = await fetch(url, { credentials: "include", cache: "reload" });
      if (asset.ok) await cache.put(url, asset);
    } catch {
      // A single optional image/font must not invalidate the whole offline shell.
    }
  }));
}

async function warmRoute(route) {
  const url = new URL(route, self.location.origin);
  if (url.origin !== self.location.origin) return;
  try {
    const response = await fetch(url, { credentials: "include", cache: "reload" });
    if (!response.ok) return;
    const cache = await caches.open(DOCUMENT_CACHE);
    await cache.put(cacheKey("document", url), response.clone());
    await cacheDocumentAssets(response.clone());
  } catch {
    // Install must also succeed when an update happens during a network outage.
  }
}

async function warmRoutes(routes) {
  await Promise.all([...new Set(routes)].map(warmRoute));
}

self.addEventListener("install", (event) => {
  event.waitUntil(warmRoutes(CORE_ROUTES).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && ![DOCUMENT_CACHE, RSC_CACHE, ASSET_CACHE].includes(name))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "WARM_OFFLINE_ROUTES") return;
  const routes = Array.isArray(event.data.routes) ? event.data.routes.map(String) : [];
  event.waitUntil(warmRoutes(routes).then(
    () => event.ports[0]?.postMessage({ ok: true }),
    () => event.ports[0]?.postMessage({ ok: false }),
  ));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname === "/app-version.json") return;

  if (isRscRequest(request)) {
    event.respondWith((async () => {
      const cache = await caches.open(RSC_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(cacheKey("rsc", url), response.clone());
        return response;
      } catch (error) {
        const cached = await cache.match(cacheKey("rsc", url));
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(DOCUMENT_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(cacheKey("document", url), response.clone());
          await cacheDocumentAssets(response.clone());
        }
        return response;
      } catch {
        return (await cache.match(cacheKey("document", url))) ||
          (await cache.match(cacheKey("document", "/login"))) ||
          Response.error();
      }
    })());
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});
