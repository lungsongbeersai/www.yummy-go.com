import type { Language } from "@/lib/language";
import { NATIVE_STARTUP_COPY, nativeStartupScript, nativeStartupStyles } from "@/lib/native-startup";
import { themeBootstrapScript } from "@/lib/theme-bootstrap-script";

export function NativeStartupHead() {
  // next/script itself needs Next's bootstrap. This guard and theme must run
  // even when a downloaded framework chunk cannot be parsed by the WebView.
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: nativeStartupStyles }} />
      <script
        id="app-bootstrap"
        dangerouslySetInnerHTML={{ __html: `${nativeStartupScript}\n${themeBootstrapScript}` }}
      />
    </>
  );
}

export function NativeStartupFallback({ language }: { language: Language }) {
  const copy = NATIVE_STARTUP_COPY[language];

  return (
    <div id="native-startup-fallback" role="alertdialog" aria-modal="true" aria-labelledby="native-startup-heading">
      <section>
        <h1 id="native-startup-heading" tabIndex={-1}>
          <span data-startup-copy="failed">{copy.failedTitle}</span>
          <span data-startup-copy="unsupported">{copy.unsupportedTitle}</span>
        </h1>
        <p data-startup-copy="failed">{copy.failedBody}</p>
        <p data-startup-copy="unsupported">{copy.unsupportedBody}</p>
        {/* Keep the text node present so early diagnostics only change its value. */}
        <p id="native-startup-version" suppressHydrationWarning>WebView</p>
        <button id="native-startup-retry" type="button">{copy.retry}</button>
      </section>
    </div>
  );
}
