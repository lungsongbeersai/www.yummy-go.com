import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { getAndroidWebViewCompatInfo } from "@/lib/android-webview-compat";
import {
  NATIVE_STARTUP_READY_EVENT,
  NATIVE_STARTUP_TIMEOUT_MS,
  nativeStartupScript,
} from "@/lib/native-startup";

const appMarker = "YummyGoCapacitorAndroid";

function androidUa(engine = 101, android = 11, model = "D2s_PLUS_2nd_STGL") {
  return `Mozilla/5.0 (Linux; Android ${android}; ${model} Build/RQ3A.210705.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/${engine}.0.0.0 Safari/537.36 ${appMarker}`;
}

interface StartupEvent {
  target?: object;
}

type Listener = (event?: StartupEvent) => void;

function eventTarget() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    addEventListener(name: string, listener: Listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)?.add(listener);
    },
    removeEventListener(name: string, listener: Listener) {
      listeners.get(name)?.delete(listener);
    },
    emit(name: string, event: StartupEvent = {}) {
      for (const listener of [...(listeners.get(name) ?? [])]) listener(event);
    },
  };
}

interface StartupOptions {
  userAgent?: string;
  bridge?: "android" | "ios" | "web" | "throws";
  storage?: string | null;
  storageThrows?: boolean;
  cssSupports?: (property: string, value?: string) => boolean;
  stylesReady?: string;
  legacy83StylesReady?: string;
  documentReady?: boolean;
  missingReplaceAll?: boolean;
}

function bootstrap(options: StartupOptions = {}) {
  const classes = new Set<string>();
  const attributes = new Map<string, string>();
  const root = {
    classList: {
      add(...names: string[]) { names.forEach((name) => classes.add(name)); },
      toggle(name: string, enabled: boolean) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
    setAttribute(name: string, value: string) { attributes.set(name, value); },
  };
  const timers = new Map<number, { at: number; callback: Listener }>();
  let nextTimer = 0;
  let now = 0;
  let reloads = 0;
  let headingFocuses = 0;
  let stylesReady = options.stylesReady ?? "1";
  let legacy83StylesReady = options.legacy83StylesReady ?? "1";
  const retry = { id: "native-startup-retry" };
  const version = { textContent: "" };
  const nodes = new Map<string, object>([
    ["native-startup-heading", { focus() { headingFocuses += 1; } }],
    ["native-startup-version", version],
    ["native-startup-retry", retry],
  ]);
  const document = {
    ...eventTarget(),
    documentElement: root,
    readyState: options.documentReady ? "complete" : "loading",
    getElementById(id: string) { return nodes.get(id) ?? null; },
  };
  const window = {
    ...eventTarget(),
    Capacitor: options.bridge ? {
      isNativePlatform() {
        if (options.bridge === "throws") throw new Error("Bridge unavailable");
        return options.bridge !== "web";
      },
      getPlatform() { return options.bridge; },
    } : undefined,
    CSS: { supports: options.cssSupports ?? (() => true) },
    location: { origin: "https://yummy-go.com", reload() { reloads += 1; } },
    getComputedStyle() {
      return { getPropertyValue(name: string) { return name === "--yummy-go-legacy83-ready" ? legacy83StylesReady : stylesReady; } };
    },
    setTimeout(callback: Listener, delay: number) {
      const id = ++nextTimer;
      timers.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout(id: number) { timers.delete(id); },
  };

  const context = createContext({
    document,
    window,
    navigator: { userAgent: options.userAgent ?? androidUa() },
    localStorage: {
      getItem() {
        if (options.storageThrows) throw new Error("Storage unavailable");
        return options.storage ?? null;
      },
    },
  });
  runInContext((options.missingReplaceAll ? "delete String.prototype.replaceAll;\n" : "") +
    "var originalReplaceAll = String.prototype.replaceAll;\n" + nativeStartupScript, context);

  return {
    attributes,
    classes,
    version,
    timers,
    evaluate(source: string): unknown { return runInContext(source, context); },
    get status() { return attributes.get("data-native-startup"); },
    get reloads() { return reloads; },
    get headingFocuses() { return headingFocuses; },
    domReady() {
      document.readyState = "complete";
      document.emit("DOMContentLoaded");
    },
    appReady() { window.emit(NATIVE_STARTUP_READY_EVENT); },
    resourceFailed(url = "/_next/static/chunks/startup.js") {
      document.emit("error", { target: { tagName: "SCRIPT", src: url } });
    },
    stylesheetLoaded(url = "https://yummy-go.com/_next/static/css/app.css") {
      document.emit("load", { target: { tagName: "LINK", href: url } });
    },
    retry() { document.emit("click", { target: retry }); },
    setStylesReady(value: string) { stylesReady = value; },
    setLegacy83StylesReady(value: string) { legacy83StylesReady = value; },
    advance(milliseconds: number) {
      now += milliseconds;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
  };
}

describe("native Android startup before the app runtime", () => {
  it("parses as ES5 without depending on Next to transpile it", () => {
    const parser: unknown = createRequire(import.meta.url)("next/dist/compiled/acorn/acorn.js");
    if (!parser || typeof parser !== "object" || !("parse" in parser) || typeof parser.parse !== "function") {
      throw new Error("The installed Next package does not expose the Acorn parser");
    }
    const parse = parser.parse as (source: string, options: { ecmaVersion: 5 }) => unknown;
    expect(() => parse(nativeStartupScript, { ecmaVersion: 5 })).not.toThrow();
  });

  it.each([88, 95, 101])("applies SUNMI Android 11 compatibility before hydration on WebView %i", (engine) => {
    const startup = bootstrap({ userAgent: androidUa(engine) });
    expect(startup.classes).toEqual(new Set([
      "capacitor-native", "capacitor-android", "android-webview-compat",
    ]));
    expect(startup.status).toBe("loading");
    expect(startup.attributes.get("data-android-webview-compat")).toBe("on");
    expect(startup.timers.size).toBe(1);
    startup.domReady();
    expect(startup.version.textContent).toBe(`WebView ${engine}`);
    startup.appReady();
    expect(startup.status).toBe("ready");
  });

  it.each([83, 85, 87])("accepts WebView %i with its dedicated selector fallback before hydration", (engine) => {
    const startup = bootstrap({ userAgent: androidUa(engine), cssSupports: property => property !== "selector(:where(*))" });
    expect(startup.classes.has("android-webview-83")).toBe(true);
    expect(startup.status).toBe("loading");
    startup.appReady();
    expect(startup.status).toBe("ready");
  });

  it("recognizes a native Android bridge without the UA marker and tolerates a late bridge", () => {
    expect(bootstrap({ userAgent: androidUa().replace(appMarker, ""), bridge: "android" }).classes.has("capacitor-android")).toBe(true);
    expect(bootstrap({ bridge: "throws" }).classes.has("capacitor-android")).toBe(true);
  });

  it("agrees with the runtime compatibility decision across engines, capabilities and overrides", () => {
    const missingBackdrop = (property: string) => property !== "backdrop-filter" && property !== "-webkit-backdrop-filter";
    const cases: StartupOptions[] = [
      { userAgent: androidUa(88) },
      { userAgent: androidUa(95, 13) },
      { userAgent: androidUa(126, 14) },
      { userAgent: androidUa(126, 14), cssSupports: missingBackdrop },
      { userAgent: androidUa(126, 14), storage: " ON " },
      { userAgent: androidUa(88), storage: " off " },
      { userAgent: androidUa(88), storage: "invalid" },
      { userAgent: androidUa(88), storageThrows: true },
    ];
    for (const options of cases) {
      const expected = getAndroidWebViewCompatInfo({
        isNativePlatform: true,
        platform: "android",
        userAgent: options.userAgent ?? androidUa(),
        cssSupports: options.cssSupports ?? (() => true),
        storageValue: options.storageThrows ? null : options.storage,
      });
      const startup = bootstrap(options);
      expect(startup.classes.has("android-webview-compat"), JSON.stringify(options)).toBe(expected.needsCompat);
      expect(startup.attributes.get("data-android-webview-compat")).toBe(expected.needsCompat ? "on" : "off");
    }
  });

  it("preserves Swan 1 WebView 101 instead of treating its engine as unsupported", () => {
    const startup = bootstrap({ userAgent: androidUa(101, 11, "Swan 1"), documentReady: true });
    expect(startup.classes.has("swan1-legacy-colors")).toBe(true);
    startup.appReady();
    expect(startup.status).toBe("ready");
  });

  it("leaves ordinary browsers and the iOS native app untouched", () => {
    for (const options of [
      { userAgent: androidUa(88).replace(appMarker, "") },
      { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36", bridge: "web" as const },
      { userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 YummyGoCapacitoriOS", bridge: "ios" as const },
    ]) {
      const startup = bootstrap(options);
      startup.domReady();
      startup.advance(NATIVE_STARTUP_TIMEOUT_MS);
      expect(startup.classes.size).toBe(0);
      expect(startup.attributes.size).toBe(0);
      expect(startup.timers.size).toBe(0);
      expect(startup.reloads).toBe(0);
    }
  });
});

describe("legacy native String replacement before Next starts", () => {
  function legacy() {
    return bootstrap({ userAgent: androidUa(83), missingReplaceAll: true });
  }

  it("replaces every literal separator used by payment and dashboard parsing", () => {
    const startup = legacy();
    expect(startup.evaluate('"1,234,567".replaceAll(",", "")')).toBe("1234567");
    expect(startup.evaluate('"||branch|".replaceAll("|", "")')).toBe("branch");
    expect(startup.evaluate('"mdi-food-outline".replaceAll("-", " ")')).toBe("mdi food outline");
    expect(startup.evaluate('"[a].*[a].*".replaceAll("[a].*", "$&!")')).toBe("[a].*![a].*!");
  });

  it("preserves empty-search, function replacements and substitution syntax", () => {
    const startup = legacy();
    expect(startup.evaluate('"ab".replaceAll("", "-")')).toBe("-a-b-");
    expect(startup.evaluate('"aba".replaceAll("a", function (match, offset) { return String(offset); })')).toBe("0b2");
    expect(startup.evaluate('"aba".replaceAll("a", "$$")')).toBe("$b$");
    expect(startup.evaluate('"aba".replaceAll(/a/g, "x")')).toBe("xbx");
    expect(() => startup.evaluate('"aba".replaceAll(/a/, "x")')).toThrow(/global regular expression/);
  });

  it("honors custom Symbol.replace and rejects invalid receivers", () => {
    const startup = legacy();
    expect(startup.evaluate('var search = {}; search[Symbol.replace] = function (value, replacement) { return value + replacement; }; "a".replaceAll(search, "b")')).toBe("ab");
    expect(() => startup.evaluate('String.prototype.replaceAll.call(null, "a", "b")')).toThrow(/null or undefined/);
    expect(() => startup.evaluate('"a".replaceAll(Symbol("a"), "b")')).toThrow(/Symbol/);
    expect(startup.evaluate('Object.getOwnPropertyDescriptor(String.prototype, "replaceAll").enumerable')).toBe(false);
  });

  it("preserves native implementations and does not patch ordinary browsers", () => {
    expect(bootstrap().evaluate("String.prototype.replaceAll === originalReplaceAll")).toBe(true);
    const browser = bootstrap({ userAgent: androidUa(83).replace(appMarker, ""), missingReplaceAll: true });
    expect(browser.evaluate('typeof String.prototype.replaceAll')).toBe("undefined");
  });
});

describe("native Android startup recovery", () => {
  it("requests an update for engines below 83 or without basic selector feature detection", () => {
    for (const options of [
      { userAgent: androidUa(82) },
      { userAgent: androidUa(101), cssSupports: (property: string) => property !== "selector(*)" },
    ]) {
      const startup = bootstrap(options);
      startup.domReady();
      expect(startup.status).toBe("unsupported");
      startup.appReady();
      expect(startup.status).toBe("unsupported");
      expect(startup.timers.size).toBe(0);
      expect(startup.reloads).toBe(0);
    }
  });

  it("keeps recovery available when WebView 83 receives an old stylesheet and recovers after its selector fallback arrives", () => {
    const startup = bootstrap({ userAgent: androidUa(83), legacy83StylesReady: "" });
    startup.appReady();
    expect(startup.status).toBe("loading");
    startup.advance(NATIVE_STARTUP_TIMEOUT_MS);
    expect(startup.status).toBe("failed");
    startup.setLegacy83StylesReady(" 1 \n");
    startup.stylesheetLoaded();
    expect(startup.status).toBe("ready");
    expect(startup.reloads).toBe(0);
    expect(bootstrap({ userAgent: androidUa(88), legacy83StylesReady: "" }).classes.has("android-webview-83")).toBe(false);
    const newer = bootstrap({ userAgent: androidUa(88), legacy83StylesReady: "" });
    newer.appReady();
    expect(newer.status).toBe("ready");
  });

  it("bounds startup even when a hung deferred script prevents DOMContentLoaded, then recovers on a late commit", () => {
    const startup = bootstrap();
    startup.advance(NATIVE_STARTUP_TIMEOUT_MS - 1);
    expect(startup.status).toBe("loading");
    startup.advance(1);
    expect(startup.status).toBe("failed");
    expect(startup.headingFocuses).toBe(1);
    expect(startup.reloads).toBe(0);
    startup.appReady();
    expect(startup.status).toBe("ready");
  });

  it("cancels the deadline on app readiness and ignores later failures in an active session", () => {
    const startup = bootstrap({ documentReady: true });
    expect(startup.timers.size).toBe(1);
    startup.appReady();
    expect(startup.timers.size).toBe(0);
    startup.setStylesReady("");
    startup.resourceFailed();
    startup.appReady();
    startup.advance(NATIVE_STARTUP_TIMEOUT_MS * 2);
    expect(startup.status).toBe("ready");
    expect(startup.headingFocuses).toBe(0);
    expect(startup.reloads).toBe(0);
  });

  it("does not restart the deadline when DOMContentLoaded follows an earlier React commit", () => {
    const startup = bootstrap();
    startup.appReady();
    startup.domReady();
    expect(startup.status).toBe("ready");
    expect(startup.timers.size).toBe(0);
  });

  it("waits for CSS after React commits and recovers from a timeout on the later stylesheet load", () => {
    const startup = bootstrap({ stylesReady: "", documentReady: true });
    startup.appReady();
    expect(startup.status).toBe("loading");
    startup.advance(NATIVE_STARTUP_TIMEOUT_MS);
    expect(startup.status).toBe("failed");
    expect(startup.reloads).toBe(0);
    startup.setStylesReady(" 1 \n");
    startup.stylesheetLoaded();
    expect(startup.status).toBe("ready");
    expect(startup.timers.size).toBe(0);
  });

  it("ignores unrelated resources and offers manual retry for startup failures before DOMContentLoaded", () => {
    const startup = bootstrap();
    startup.resourceFailed("https://example.com/_next/static/third-party.js");
    startup.resourceFailed("https://yummy-go.com/icons/unrelated.svg");
    expect(startup.status).toBe("loading");
    startup.resourceFailed("https://yummy-go.com/_next/static/chunks/startup.js");
    expect(startup.status).toBe("failed");
    expect(startup.reloads).toBe(0);
    startup.retry();
    expect(startup.reloads).toBe(1);
  });
});
