package com.yummygo.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
    super.onCreate(savedInstanceState);

    hardenWebViewRendering();

    Window window = getWindow();

    // ให้แอปวาดเต็มจอ แล้วเราจัด safe area เองจาก native
    WindowCompat.setDecorFitsSystemWindows(window, false);

    // สี Status Bar และ Navigation Bar
    window.setStatusBarColor(Color.WHITE);
    window.setNavigationBarColor(Color.WHITE);

    // ให้ icon ด้านบน/ล่างเป็นสีเข้ม เพราะพื้นหลังสีขาว
    WindowInsetsControllerCompat controller =
      new WindowInsetsControllerCompat(window, window.getDecorView());

    controller.setAppearanceLightStatusBars(true);
    controller.setAppearanceLightNavigationBars(true);

    // เพิ่ม padding ให้ root view ตาม Status Bar / Navigation Bar
    // เพื่อไม่ให้ WebView ชนด้านบนและด้านล่าง
    View content = findViewById(android.R.id.content);

    ViewCompat.setOnApplyWindowInsetsListener(content, (view, insets) -> {
      Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());

      view.setPadding(
        systemBars.left,
        systemBars.top,
        systemBars.right,
        systemBars.bottom
      );

      return insets;
    });
  }

  private void hardenWebViewRendering() {
    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) {
      return;
    }

    webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

    WebSettings settings = webView.getSettings();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      webView.setForceDarkAllowed(false);
      settings.setForceDark(WebSettings.FORCE_DARK_OFF);
    }

    if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
      WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, false);
    }
  }
}
