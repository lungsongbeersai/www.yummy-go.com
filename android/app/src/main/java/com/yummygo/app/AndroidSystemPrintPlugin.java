package com.yummygo.app;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;

@CapacitorPlugin(name = "AndroidSystemPrint")
public class AndroidSystemPrintPlugin extends Plugin {
  private final Set<WebView> printWebViews =
    Collections.newSetFromMap(new IdentityHashMap<>());

  @PluginMethod
  public void printHtml(PluginCall call) {
    String html = call.getString("html");
    String jobName = call.getString("jobName", "Yummy Go QR");
    String baseUrl = call.getString("baseUrl", "https://yummy-go.com/");

    if (html == null || html.trim().isEmpty()) {
      call.reject("Print document is empty.");
      return;
    }

    getActivity().runOnUiThread(() -> {
      try {
        PrintManager printManager =
          (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
        if (printManager == null) {
          call.reject("Android print service is unavailable.");
          return;
        }

        WebView printWebView = new WebView(getActivity());
        printWebViews.add(printWebView);
        printWebView.getSettings().setLoadsImagesAutomatically(true);
        printWebView.setWebViewClient(new WebViewClient() {
          private boolean printStarted;

          @Override
          public void onPageFinished(WebView view, String url) {
            if (printStarted) return;
            printStarted = true;

            try {
              PrintDocumentAdapter delegate =
                view.createPrintDocumentAdapter(jobName);
              PrintDocumentAdapter adapter = cleanupAdapter(delegate, view);
              PrintAttributes attributes = new PrintAttributes.Builder()
                .setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME)
                .build();

              printManager.print(jobName, adapter, attributes);
              call.resolve();
            } catch (RuntimeException error) {
              releaseWebView(view);
              call.reject("Could not open Android print: " + error.getMessage(), error);
            }
          }
        });
        printWebView.loadDataWithBaseURL(baseUrl, html, "text/html", "UTF-8", null);
      } catch (RuntimeException error) {
        call.reject("Could not prepare Android print: " + error.getMessage(), error);
      }
    });
  }

  private PrintDocumentAdapter cleanupAdapter(
    PrintDocumentAdapter delegate,
    WebView printWebView
  ) {
    return new PrintDocumentAdapter() {
      @Override
      public void onStart() {
        delegate.onStart();
      }

      @Override
      public void onLayout(
        PrintAttributes oldAttributes,
        PrintAttributes newAttributes,
        CancellationSignal cancellationSignal,
        LayoutResultCallback callback,
        Bundle extras
      ) {
        delegate.onLayout(
          oldAttributes,
          newAttributes,
          cancellationSignal,
          callback,
          extras
        );
      }

      @Override
      public void onWrite(
        PageRange[] pages,
        ParcelFileDescriptor destination,
        CancellationSignal cancellationSignal,
        WriteResultCallback callback
      ) {
        delegate.onWrite(pages, destination, cancellationSignal, callback);
      }

      @Override
      public void onFinish() {
        try {
          delegate.onFinish();
        } finally {
          releaseWebView(printWebView);
        }
      }
    };
  }

  private void releaseWebView(WebView webView) {
    getActivity().runOnUiThread(() -> {
      if (!printWebViews.remove(webView)) return;
      webView.stopLoading();
      webView.destroy();
    });
  }

  @Override
  protected void handleOnDestroy() {
    for (WebView webView : printWebViews.toArray(new WebView[0])) {
      releaseWebView(webView);
    }
  }
}
