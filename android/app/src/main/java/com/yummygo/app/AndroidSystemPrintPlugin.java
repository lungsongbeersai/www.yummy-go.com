package com.yummygo.app;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(name = "AndroidSystemPrint")
public class AndroidSystemPrintPlugin extends Plugin {
  private final Handler main = new Handler(Looper.getMainLooper());
  private final Set<WebView> printWebViews = Collections.newSetFromMap(new IdentityHashMap<>());
  private final Map<String, PendingPrint> pending = new LinkedHashMap<>();
  private final Map<String, Long> cancelled = new LinkedHashMap<>();
  private final Map<String, Long> handedOff = new LinkedHashMap<>();
  private boolean destroyed;
  private static final long LOAD_TIMEOUT_MS = 30_000;
  private static final long RECENT_TTL_MS = 5 * 60_000;

  private static final class PendingPrint {
    final String id;
    final PluginCall call;
    WebView view;
    Runnable timeout;
    PendingPrint(String id, PluginCall call) { this.id = id; this.call = call; }
  }

  @PluginMethod public void getCapabilities(PluginCall call) {
    JSObject result = new JSObject(); result.put("requestCancellation", true); call.resolve(result);
  }

  @PluginMethod public void cancelPrint(PluginCall call) {
    String requestId = call.getString("requestId");
    if (!validId(requestId)) { call.reject("Invalid print request", "PRINT_INVALID"); return; }
    main.post(() -> {
      pruneRecent();
      if (handedOff.containsKey(requestId)) { resolve(call, "handed-off"); return; }
      PendingPrint operation = pending.get(requestId);
      if (operation != null) { cancelPending(operation); resolve(call, "cancelled"); return; }
      // Remember a cancellation that crossed the bridge before printHtml.
      // "missing" does not claim that an already handed-off job stopped.
      remember(cancelled, requestId);
      resolve(call, "missing");
    });
  }

  @PluginMethod public void printHtml(PluginCall call) {
    String html = call.getString("html");
    String jobName = call.getString("jobName", "Yummy Go QR");
    String baseUrl = call.getString("baseUrl", "https://yummy-go.com/");
    String orientation = call.getString("orientation");
    String colorMode = call.getString("colorMode", "monochrome");
    String suppliedId = call.getString("requestId");
    if (html == null || html.trim().isEmpty() || suppliedId != null && !validId(suppliedId)) {
      call.reject("Invalid print document", "PRINT_INVALID"); return;
    }
    String requestId = suppliedId == null ? UUID.randomUUID().toString() : suppliedId;
    main.post(() -> {
      pruneRecent();
      if (destroyed || cancelled.containsKey(requestId)) { resolve(call, "cancelled"); return; }
      if (pending.containsKey(requestId) || handedOff.containsKey(requestId)) { call.reject("Duplicate print request", "PRINT_DUPLICATE"); return; }
      if (pending.size() >= 2) { call.reject("A report is already being prepared", "PRINT_BUSY"); return; }
      PendingPrint operation = new PendingPrint(requestId, call);
      pending.put(requestId, operation);
      try {
        PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
        if (printManager == null) throw new IllegalStateException("Android print service is unavailable");
        WebView printWebView = new WebView(getActivity());
        operation.view = printWebView; printWebViews.add(printWebView);
        printWebView.getSettings().setLoadsImagesAutomatically(true);
        printWebView.setWebViewClient(new WebViewClient() {
          @Override public void onPageFinished(WebView view, String url) {
            if (pending.get(requestId) != operation) return;
            if (destroyed || getActivity().isFinishing() || getActivity().isDestroyed()) { cancelPending(operation); return; }
            try {
              PrintDocumentAdapter adapter = cleanupAdapter(view.createPrintDocumentAdapter(jobName), view);
              PrintAttributes.Builder attributes = new PrintAttributes.Builder()
                .setColorMode("color".equals(colorMode) ? PrintAttributes.COLOR_MODE_COLOR : PrintAttributes.COLOR_MODE_MONOCHROME);
              if ("landscape".equals(orientation)) attributes.setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape());
              else if ("portrait".equals(orientation)) attributes.setMediaSize(PrintAttributes.MediaSize.ISO_A4.asPortrait());
              if (printManager.print(jobName, adapter, attributes.build()) == null) throw new IllegalStateException("Android print handoff was not confirmed");
              // This main-thread handoff is the boundary. Cancellation never
              // reprints or claims to revoke an OS-owned print job afterwards.
              pending.remove(requestId);
              if (operation.timeout != null) main.removeCallbacks(operation.timeout);
              remember(handedOff, requestId);
              resolve(call, "handed-off");
            } catch (RuntimeException error) { failPending(operation, "Could not open Android printing", "PRINT_FAILED"); }
          }
        });
        operation.timeout = () -> failPending(operation, "The print document did not finish loading", "PRINT_TIMEOUT");
        main.postDelayed(operation.timeout, LOAD_TIMEOUT_MS);
        printWebView.loadDataWithBaseURL(baseUrl, html, "text/html", "UTF-8", null);
      } catch (RuntimeException error) { failPending(operation, "Could not prepare Android printing", "PRINT_FAILED"); }
    });
  }

  private void cancelPending(PendingPrint operation) {
    if (pending.get(operation.id) != operation) return;
    pending.remove(operation.id);
    if (operation.timeout != null) main.removeCallbacks(operation.timeout);
    if (operation.view != null) releaseWebView(operation.view);
    remember(cancelled, operation.id);
    resolve(operation.call, "cancelled");
  }

  private void failPending(PendingPrint operation, String message, String code) {
    if (pending.get(operation.id) != operation) return;
    pending.remove(operation.id);
    if (operation.timeout != null) main.removeCallbacks(operation.timeout);
    if (operation.view != null) releaseWebView(operation.view);
    remember(cancelled, operation.id);
    operation.call.reject(message, code);
  }

  private static boolean validId(String value) {
    return value != null && value.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
  }
  private static void resolve(PluginCall call, String status) { JSObject result = new JSObject(); result.put("status", status); call.resolve(result); }
  private void remember(Map<String, Long> records, String id) {
    records.put(id, System.currentTimeMillis() + RECENT_TTL_MS);
    while (records.size() > 64) records.remove(records.keySet().iterator().next());
  }
  private void pruneRecent() {
    long now = System.currentTimeMillis();
    cancelled.entrySet().removeIf(entry -> entry.getValue() <= now);
    handedOff.entrySet().removeIf(entry -> entry.getValue() <= now);
  }

  private PrintDocumentAdapter cleanupAdapter(PrintDocumentAdapter delegate, WebView printWebView) {
    return new PrintDocumentAdapter() {
      @Override public void onStart() { delegate.onStart(); }
      @Override public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes, CancellationSignal signal, LayoutResultCallback callback, Bundle extras) {
        delegate.onLayout(oldAttributes, newAttributes, signal, callback, extras);
      }
      @Override public void onWrite(PageRange[] pages, ParcelFileDescriptor destination, CancellationSignal signal, WriteResultCallback callback) {
        delegate.onWrite(pages, destination, signal, callback);
      }
      @Override public void onFinish() { try { delegate.onFinish(); } finally { releaseWebView(printWebView); } }
    };
  }
  private void releaseWebView(WebView view) {
    getActivity().runOnUiThread(() -> { if (printWebViews.remove(view)) { view.stopLoading(); view.destroy(); } });
  }
  @Override protected void handleOnDestroy() {
    destroyed = true;
    for (PendingPrint operation : new ArrayList<>(pending.values())) cancelPending(operation);
    for (WebView view : printWebViews.toArray(new WebView[0])) releaseWebView(view);
    cancelled.clear(); handedOff.clear();
  }
}
