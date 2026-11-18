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
    <div id="native-startup-fallback" data-native-startup-content role="alertdialog" aria-modal="true" aria-labelledby="native-startup-heading">
      <section data-native-startup-content>
        <h1 id="native-startup-heading" data-native-startup-content tabIndex={-1}>
          <span data-native-startup-content data-startup-copy="failed">{copy.failedTitle}</span>
          <span data-native-startup-content data-startup-copy="unsupported">{copy.unsupportedTitle}</span>
        </h1>
        <p data-native-startup-content data-startup-copy="failed">{copy.failedBody}</p>
        <p data-native-startup-content data-startup-copy="unsupported">{copy.unsupportedBody}</p>
        {/* Keep the text node present so early diagnostics only change its value. */}
        <p id="native-startup-version" data-native-startup-content suppressHydrationWarning>WebView</p>
        <button id="native-startup-retry" data-native-startup-content type="button">{copy.retry}</button>
      </section>
    </div>
  );
}
