package com.yummygo.app;

import android.content.res.Configuration;
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
  // ตรงกับ --background จริงของเว็บแอป (globals.css): oklch(1 0 0) โหมดสว่าง,
  // oklch(0.148 0.004 228.8) โหมดมืด — ให้แถบระบบกลืนกับพื้นหลังแอปทั้งสองธีม
  private static final int STATUS_BAR_COLOR_LIGHT = Color.WHITE;
  private static final int STATUS_BAR_COLOR_DARK = Color.parseColor("#0F131A");

  @Override
  public void onCreate(Bundle savedInstanceState) {
    // เดิมบังคับ MODE_NIGHT_NO (ปิด dark mode ระดับ native ตลอด) เปลี่ยนเป็นตามเครื่องจริง
    AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM);
    super.onCreate(savedInstanceState);

    hardenWebViewRendering();

    Window window = getWindow();

    // ให้แอปวาดเต็มจอ แล้วเราจัด safe area เองจาก native
    WindowCompat.setDecorFitsSystemWindows(window, false);

    boolean isDarkMode =
      (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
        == Configuration.UI_MODE_NIGHT_YES;
    int barColor = isDarkMode ? STATUS_BAR_COLOR_DARK : STATUS_BAR_COLOR_LIGHT;

    // สี Status Bar และ Navigation Bar — ตามโหมดสว่าง/มืดของเครื่อง ไม่ใช่ค่าคงที่
    window.setStatusBarColor(barColor);
    window.setNavigationBarColor(barColor);

    // ไอคอนเข้มบนพื้นหลังสว่าง / ไอคอนอ่อนบนพื้นหลังมืด
    WindowInsetsControllerCompat controller =
      new WindowInsetsControllerCompat(window, window.getDecorView());

    controller.setAppearanceLightStatusBars(!isDarkMode);
    controller.setAppearanceLightNavigationBars(!isDarkMode);

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
