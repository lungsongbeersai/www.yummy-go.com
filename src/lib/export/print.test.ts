import { afterEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ android: true, print: vi.fn() }));
vi.mock("@/lib/capacitor-platform", () => ({ isCapacitorAndroidApp: () => native.android }));
vi.mock("@/lib/android-system-print", () => ({ printHtmlWithAndroidSystemPrint: native.print }));
vi.mock("@/lib/export/file-output", () => ({ createFileExportGuard: (current?: () => boolean) => current ?? (() => true) }));

import { printExportHtml, renderExportPrintDocument } from "./print";

afterEach(() => { native.print.mockReset(); native.android = true; });

describe("prepared report printing", () => {
  it("keeps styles and language while escaping document metadata and excluding runtime attributes", () => {
    const html = renderExportPrintDocument({
      content: '<main class="report-print-surface">ລາຍງານ</main>',
      title: 'Report <private> "owned"', baseUrl: "https://example.test/", styles: '<link rel="stylesheet" href="/fonts.css">',
      htmlAttributes: { lang: "lo", class: "font-lao capacitor-android", "data-theme": "light", onclick: "untrusted()" },
    });
    expect(html).toContain('lang="lo"');
    expect(html).toContain('class="font-lao capacitor-android"');
    expect(html).toContain("Report &lt;private&gt; &quot;owned&quot;");
    expect(html).toContain('<link rel="stylesheet" href="/fonts.css">');
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("window.print");
  });

  it("hands Android the already prepared HTML once and propagates native failures", async () => {
    native.print.mockResolvedValue(true);
    await expect(printExportHtml("<p>Own report</p>", { title: "Own report", orientation: "portrait" })).resolves.toBe(true);
    expect(native.print).toHaveBeenCalledExactlyOnceWith({ html: "<p>Own report</p>", jobName: "Own report", orientation: "portrait", colorMode: "color", isCurrent: expect.any(Function) });
    native.print.mockRejectedValue(new Error("Print service unavailable"));
    await expect(printExportHtml("<p>Own report</p>", { title: "Own report" })).rejects.toThrow("Print service unavailable");
  });

  it("does not print stale content or hide missing native capabilities as success", async () => {
    await expect(printExportHtml("private", { title: "Report", isCurrent: () => false })).rejects.toMatchObject({ name: "AbortError" });
    expect(native.print).not.toHaveBeenCalled();
    native.print.mockResolvedValue(false);
    await expect(printExportHtml("private", { title: "Report" })).rejects.toThrow("Update");
    native.android = false;
    await expect(printExportHtml("private", { title: "Report" })).resolves.toBe(false);
  });
});
