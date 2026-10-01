package com.yummygo.app;

import android.app.Activity;
import android.app.Presentation;
import android.content.Context;
import android.graphics.Point;
import android.hardware.display.DisplayManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

@CapacitorPlugin(name = "SwanCustomerDisplay")
public class SwanCustomerDisplayPlugin extends Plugin {
  private static final String CUSTOMER_DISPLAY_PATH = "/customer-display";
  private static final String CUSTOMER_DISPLAY_USER_AGENT = "YummyGoSwanCustomerDisplay";
  private CustomerPresentation presentation;
  private String latestPayload;

  private boolean isSwanOne() {
    return "Swan 1".equals(Build.MODEL) && "rk3566_rgo".equals(Build.DEVICE);
  }

  private DisplayManager displayManager() {
    return (DisplayManager) getActivity().getSystemService(Context.DISPLAY_SERVICE);
  }

  private Display findCustomerDisplay(Integer requestedId) {
    DisplayManager manager = displayManager();
    if (manager == null) return null;

    for (Display display : manager.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION)) {
      if (display.getDisplayId() != Display.DEFAULT_DISPLAY &&
          (requestedId == null || display.getDisplayId() == requestedId)) {
        return display;
      }
    }
    return null;
  }

  private JSObject status() {
    JSObject result = new JSObject();
    boolean supported = isSwanOne();
    result.put("supported", supported);
    if (!supported) return result;

    Display display = findCustomerDisplay(null);
    DisplayManager manager = displayManager();
    Display primary = manager == null ? null : manager.getDisplay(Display.DEFAULT_DISPLAY);
    Point primarySize = new Point();
    if (primary != null) primary.getRealSize(primarySize);
    result.put("primaryWidth", primarySize.x);
    result.put("primaryHeight", primarySize.y);
    result.put("connected", display != null);
    result.put("active", display != null && presentation != null && presentation.isShowing() &&
      presentation.getDisplay().getDisplayId() == display.getDisplayId());

    if (display != null) {
      Point size = new Point();
      display.getRealSize(size);
      result.put("displayId", display.getDisplayId());
      result.put("width", size.x);
      result.put("height", size.y);
      result.put("label", display.getName());
    }
    return result;
  }

  @PluginMethod
  public void getStatus(PluginCall call) {
    getActivity().runOnUiThread(() -> call.resolve(status()));
  }

  @PluginMethod
  public void open(PluginCall call) {
    getActivity().runOnUiThread(() -> {
      if (!isSwanOne()) {
        call.reject("This customer display is available only on Swan 1.");
        return;
      }

      JSObject payload = call.getObject("payload");
      if (payload == null) {
        call.reject("The customer display payload is missing.");
        return;
      }

      Integer requestedId = call.getInt("displayId");
      Display display = findCustomerDisplay(requestedId);
      if (display == null) {
        call.reject("No customer display is connected.");
        return;
      }

      WebView mainWebView = getBridge().getWebView();
      String currentUrl = mainWebView == null ? null : mainWebView.getUrl();
      Uri currentUri = currentUrl == null ? null : Uri.parse(currentUrl);
      if (currentUri == null || currentUri.getHost() == null ||
          !("https".equals(currentUri.getScheme()) || "http".equals(currentUri.getScheme()))) {
        call.reject("The app URL is not ready.");
        return;
      }

      String displayUrl = currentUri.buildUpon().path(CUSTOMER_DISPLAY_PATH)
        .clearQuery().fragment(null).build().toString();
      if (presentation != null && presentation.isShowing() &&
          presentation.getDisplay().getDisplayId() == display.getDisplayId()) {
        latestPayload = payload.toString();
        presentation.showPayload(latestPayload);
        call.resolve(status());
        return;
      }

      dismissPresentation();
      latestPayload = payload.toString();
      try {
        CustomerPresentation next = new CustomerPresentation(getActivity(), display, displayUrl);
        next.setOnDismissListener(ignored -> {
          next.release();
          if (presentation == next) {
            presentation = null;
            latestPayload = null;
          }
        });
        next.show();
        presentation = next;
        call.resolve(status());
      } catch (RuntimeException error) {
        presentation = null;
        latestPayload = null;
        call.reject("Could not open the customer display: " + error.getMessage(), error);
      }
    });
  }

  @PluginMethod
  public void update(PluginCall call) {
    getActivity().runOnUiThread(() -> {
      if (!isSwanOne() || presentation == null || !presentation.isShowing()) {
        call.resolve();
        return;
      }
      JSObject payload = call.getObject("payload");
      if (payload == null) {
        call.reject("The customer display payload is missing.");
        return;
      }
      latestPayload = payload.toString();
      presentation.showPayload(latestPayload);
      call.resolve();
    });
  }

  @PluginMethod
  public void close(PluginCall call) {
    getActivity().runOnUiThread(() -> {
      dismissPresentation();
      call.resolve(status());
    });
  }

  private void dismissPresentation() {
    latestPayload = null;
    if (presentation == null) return;
    CustomerPresentation previous = presentation;
    presentation = null;
    previous.dismiss();
    previous.release();
  }

  @Override
  protected void handleOnDestroy() {
    dismissPresentation();
  }

  private final class CustomerPresentation extends Presentation {
    private final String url;
    private WebView webView;
    private boolean pageLoaded;

    CustomerPresentation(Activity activity, Display display, String url) {
      super(activity, display);
      this.url = url;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
      super.onCreate(savedInstanceState);
      webView = new WebView(getContext());
      WebSettings settings = webView.getSettings();
      settings.setJavaScriptEnabled(true);
      settings.setDomStorageEnabled(true);
      settings.setUseWideViewPort(true);
      settings.setUserAgentString(settings.getUserAgentString() + " " + CUSTOMER_DISPLAY_USER_AGENT);
      webView.setWebViewClient(new WebViewClient() {
        @Override
        public void onPageFinished(WebView view, String loadedUrl) {
          pageLoaded = true;
          showPayload(latestPayload);
        }
      });
      setContentView(webView);
      webView.loadUrl(url);
    }

    void showPayload(String payloadJson) {
      if (!pageLoaded || webView == null || payloadJson == null) return;
      String script = "window.__yummyGoNativeCustomerDisplayPayload=JSON.parse(" +
        JSONObject.quote(payloadJson) + ");" +
        "window.dispatchEvent(new CustomEvent('yummy-go:native-customer-display-payload'," +
        "{detail:window.__yummyGoNativeCustomerDisplayPayload}));";
      webView.evaluateJavascript(script, null);
    }

    void release() {
      if (webView == null) return;
      WebView released = webView;
      webView = null;
      ViewParent parent = released.getParent();
      if (parent instanceof ViewGroup) ((ViewGroup) parent).removeView(released);
      released.destroy();
    }
  }
}
