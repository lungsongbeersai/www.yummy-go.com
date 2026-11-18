import type { Language } from "@/lib/language";

export const NATIVE_STARTUP_READY_EVENT = "yummy-go:startup-ready";
export const NATIVE_STARTUP_TIMEOUT_MS = 30_000;
export const LEGACY_ANDROID_WEBVIEW_MIN_VERSION = 83;

interface NativeStartupCopy {
  failedTitle: string;
  failedBody: string;
  unsupportedTitle: string;
  unsupportedBody: string;
  retry: string;
}

export const NATIVE_STARTUP_COPY: Record<Language, NativeStartupCopy> = {
  la: {
    failedTitle: "Yummy Go ໂຫຼດບໍ່ສຳເລັດ",
    failedBody: "ກະລຸນາກວດສອບອິນເຕີເນັດ ແລ້ວລອງໃໝ່. ຖ້າຍັງເປີດບໍ່ໄດ້ ກະລຸນາຕິດຕໍ່ຝ່າຍຊ່ວຍເຫຼືອ.",
    unsupportedTitle: "ກະລຸນາອັບເດດຕົວສະແດງໜ້າເວັບ",
    unsupportedBody: "ອັບເດດ Android System WebView ຜ່ານຮ້ານແອັບ ຫຼືຜູ້ດູແລເຄື່ອງ ແລ້ວເປີດ Yummy Go ອີກຄັ້ງ.",
    retry: "ລອງໃໝ່",
  },
  en: {
    failedTitle: "Yummy Go could not finish loading",
    failedBody: "Check your connection and try again. If the app still cannot open, contact support.",
    unsupportedTitle: "Update the device's web display",
    unsupportedBody: "Update Android System WebView through your app store or device administrator, then open Yummy Go again.",
    retry: "Try again",
  },
};

// This must execute directly from HTML, before Next or React can fail to parse.
// Keep ES5 syntax and no imports in the emitted script. Its Android conditions
// mirror android-webview-compat.ts; tests compare the two for supported engines.
export const nativeStartupScript = `
(function () {
  var root = document.documentElement;
  var ua = navigator.userAgent || "";
  var cap = window.Capacitor;
  var nativeAndroid = ua.indexOf("YummyGoCapacitorAndroid") !== -1;
  try {
    nativeAndroid = nativeAndroid || !!(cap && cap.isNativePlatform && cap.isNativePlatform() && cap.getPlatform() === "android");
  } catch (_) {}
  if (!nativeAndroid) return;

  // Chromium 83 has String.replace but not replaceAll. Install this before
  // loading Next so imported catalogs and payment parsers can use the same API.
  if (typeof String.prototype.replaceAll !== "function") {
    Object.defineProperty(String.prototype, "replaceAll", {
      configurable: true,
      writable: true,
      value: function (searchValue, replaceValue) {
        "use strict";
        var receiver = this;
        if (receiver === null || receiver === undefined) throw new TypeError("String.replaceAll called on null or undefined");
        function text(value) {
          if (typeof value === "symbol") throw new TypeError("Cannot convert a Symbol value to a string");
          return String(value);
        }
        if (searchValue !== null && searchValue !== undefined) {
          var match = typeof Symbol !== "undefined" && Symbol.match ? searchValue[Symbol.match] : undefined;
          var regularExpression = match !== undefined ? !!match : Object.prototype.toString.call(searchValue) === "[object RegExp]";
          if (regularExpression && text(searchValue.flags).indexOf("g") === -1) {
            throw new TypeError("String.replaceAll requires a global regular expression");
          }
          var replace = typeof Symbol !== "undefined" && Symbol.replace ? searchValue[Symbol.replace] : undefined;
          if (replace !== undefined && replace !== null) {
            if (typeof replace !== "function") throw new TypeError("Symbol.replace must be a function");
            return replace.call(searchValue, receiver, replaceValue);
          }
        }
        var search = text(searchValue);
        var escaped = "";
        var special = "\\\\^$.*+?()[]{}|";
        for (var index = 0; index < search.length; index += 1) {
          var character = search.charAt(index);
          escaped += special.indexOf(character) !== -1 ? "\\\\" + character : character;
        }
        return text(receiver).replace(new RegExp(escaped, "g"), replaceValue);
      }
    });
  }

  root.classList.add("capacitor-native", "capacitor-android");
  var androidMatch = /Android\\s+(\\d+)/i.exec(ua);
  var engineMatch = /(?:Chrome|CriOS)\\/(\\d+)/i.exec(ua);
  var androidVersion = androidMatch ? Number(androidMatch[1]) : null;
  var engineVersion = engineMatch ? Number(engineMatch[1]) : null;
  var css = window.CSS;
  var legacy83 = (engineVersion !== null && engineVersion < 88) || !(css && css.supports && css.supports("selector(:where(*))"));
  root.classList.toggle("android-webview-83", legacy83);
  function supports(property, value) {
    return !!(css && css.supports && css.supports(property, value));
  }
  var rendering = supports("filter", "none") && supports("mix-blend-mode", "normal") &&
    (supports("backdrop-filter", "blur(1px)") || supports("-webkit-backdrop-filter", "blur(1px)")) &&
    (supports("mask-image", "linear-gradient(#000, #000)") || supports("-webkit-mask-image", "linear-gradient(#000, #000)"));
  var override = "";
  try { override = (localStorage.getItem("yummy-go-rendering-compat") || "").replace(/^\\s+|\\s+$/g, "").toLowerCase(); } catch (_) {}
  var compat = override === "on" || (override !== "off" &&
    ((androidVersion !== null && androidVersion <= 11) || (engineVersion !== null && engineVersion < 100) || !rendering));
  root.classList.toggle("android-webview-compat", compat);
  root.classList.toggle("swan1-legacy-colors", /\\(Linux;\\s*Android\\s+\\d+;\\s*Swan 1 Build\\/[^;]+;\\s*wv\\)/i.test(ua));
  root.setAttribute("data-android-webview-compat", compat ? "on" : "off");
  root.setAttribute("data-native-startup", "loading");

  var ready = false;
  var reactReady = false;
  var timeout = null;
  // CSS.supports accepts selector() as a single argument, unlike property tests.
  var unsupported = (engineVersion !== null && engineVersion < ${LEGACY_ANDROID_WEBVIEW_MIN_VERSION}) || !(css && css.supports && css.supports("selector(*)"));

  function showFailure(state) {
    if (ready) return;
    root.setAttribute("data-native-startup", state);
    var heading = document.getElementById("native-startup-heading");
    if (heading && heading.focus) heading.focus();
  }
  function finishIfReady() {
    if (!reactReady || unsupported) return false;
    // React can mount before the stylesheet arrives. A later CSS load must
    // recover the initial screen without requiring a second React commit.
    var computed = window.getComputedStyle(root);
    var styles = computed.getPropertyValue("--yummy-go-styles-ready");
    if (styles.replace(/\\s/g, "") !== "1") return false;
    // A cached stylesheet from the previous Chrome 88 build lacks the selector
    // fallback. Keep the recovery screen until this engine's CSS actually loads.
    if (legacy83 && computed.getPropertyValue("--yummy-go-legacy83-ready").replace(/\\s/g, "") !== "1") return false;
    ready = true;
    if (timeout !== null) window.clearTimeout(timeout);
    root.setAttribute("data-native-startup", "ready");
    window.removeEventListener("${NATIVE_STARTUP_READY_EVENT}", onReady);
    document.removeEventListener("load", onAssetLoad, true);
    document.removeEventListener("error", onAssetError, true);
    document.removeEventListener("click", onRetry);
    return true;
  }
  function onReady() {
    reactReady = true;
    finishIfReady();
  }
  function startupAsset(event) {
    var target = event.target;
    if (!target || (target.tagName !== "SCRIPT" && target.tagName !== "LINK")) return "";
    var url = target.src || target.href || "";
    return url.indexOf("/_next/static/") === 0 || url.indexOf(window.location.origin + "/_next/static/") === 0 ? url : "";
  }
  function onAssetLoad(event) {
    if (startupAsset(event)) finishIfReady();
  }
  function onAssetError(event) {
    if (startupAsset(event)) showFailure(unsupported ? "unsupported" : "failed");
  }
  function onRetry(event) {
    if (event.target && event.target.id === "native-startup-retry") window.location.reload();
  }
  function start() {
    document.removeEventListener("DOMContentLoaded", start);
    var version = document.getElementById("native-startup-version");
    if (version && engineVersion !== null) version.textContent = "WebView " + engineVersion;
    if (!ready && unsupported) showFailure("unsupported");
  }
  window.addEventListener("${NATIVE_STARTUP_READY_EVENT}", onReady);
  // Resource load events stop at document; they do not reach window capture.
  document.addEventListener("load", onAssetLoad, true);
  document.addEventListener("error", onAssetError, true);
  document.addEventListener("click", onRetry);
  // DOMContentLoaded can itself wait on a hung deferred bundle. Bound startup
  // from this independent script; readiness never waits on auth or API calls.
  if (unsupported) showFailure("unsupported");
  else timeout = window.setTimeout(function () { if (!finishIfReady()) showFailure("failed"); }, ${NATIVE_STARTUP_TIMEOUT_MS});
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
`;

// The error screen must remain readable when the external Tailwind stylesheet
// cannot load or parse. These scoped platform styles reuse theme tokens when
// available and supply the same light-theme values when CSS is unavailable.
export const nativeStartupStyles = `
html.capacitor-android, html.capacitor-android body {
  background-color: var(--background, #f5f7fa);
}
#native-startup-fallback { display: none; }
html[data-native-startup="failed"] #native-startup-fallback,
html[data-native-startup="unsupported"] #native-startup-fallback {
  display: flex; position: fixed; top: 0; right: 0; bottom: 0; left: 0;
  z-index: 2147483647; box-sizing: border-box; align-items: center; justify-content: center;
  overflow: auto; padding: 24px; background: var(--background, #f5f7fa);
  color: var(--foreground, #1f2937); font-family: var(--font-lao-ui, sans-serif);
}
#native-startup-fallback section { max-width: 440px; text-align: center; }
#native-startup-fallback h1 { margin: 0 0 16px; font-size: 22px; line-height: 1.5; }
#native-startup-fallback p { margin: 0 0 16px; font-size: 16px; line-height: 1.7; }
#native-startup-fallback [data-startup-copy="unsupported"] { display: none; }
html[data-native-startup="unsupported"] #native-startup-fallback [data-startup-copy="failed"] { display: none; }
html[data-native-startup="unsupported"] #native-startup-fallback [data-startup-copy="unsupported"] { display: block; }
#native-startup-retry {
  min-height: 48px; padding: 12px 24px; border: 2px solid currentColor; border-radius: 8px;
  background: var(--primary, #007956); color: var(--primary-foreground, #ecfdf5);
  font: inherit; cursor: pointer;
}
`;
