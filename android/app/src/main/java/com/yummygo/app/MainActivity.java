package com.yummygo.app;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  // สี status bar ตรงกับ --background ของเว็บแอป (globals.css) ทั้งสองธีม;
  // navigation bar ของ Swan 1 ใช้สีเทาแยกต่างหากเพื่อให้เห็นขอบชัดเจน
  private static final int STATUS_BAR_COLOR_LIGHT = Color.WHITE;
  private static final int STATUS_BAR_COLOR_DARK = Color.parseColor("#0F131A");
  private static final int SWAN_NAVIGATION_BAR_COLOR_LIGHT = Color.parseColor("#D1D5DB");
  private static final int SWAN_NAVIGATION_BAR_COLOR_DARK = Color.parseColor("#343A40");

  @Override
  public void onCreate(Bundle savedInstanceState) {
    // ธีมคุมโดยแอปเอง (สวิตช์ในแอป) ไม่ใช่ OS — ปิด native dark mode ไว้เฉย ๆ กันสับสน,
    // ต้อง register ก่อน super.onCreate ตามข้อกำหนดของ Capacitor
    AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
    registerPlugin(NativeThemePlugin.class);
    registerPlugin(SwanCustomerDisplayPlugin.class);
    registerPlugin(AndroidSystemPrintPlugin.class);
    super.onCreate(savedInstanceState);

    hardenWebViewRendering();

    Window window = getWindow();

    // This is a cashier terminal: while Yummy Go is in the foreground the display must
    // stay ready for the next tap. FLAG_KEEP_SCREEN_ON is scoped to this Activity, so
    // Android can sleep normally as soon as the cashier leaves the app.
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

    // ให้ WebView วาดเต็มจอจริง (ยื่นไปใต้แถบระบบ) — เว็บแอปจัด safe area เองผ่าน CSS
    WindowCompat.setDecorFitsSystemWindows(window, false);

    // ค่าเริ่มต้นก่อนเว็บแอป hydrate เสร็จ (ธีม default ของแอปคือสว่าง) — เว็บแอปจะเรียก
    // NativeTheme.setDarkMode ทับด้วยค่าจริงจาก app-store ทันทีที่ hydrate เสร็จ
    applyBarColors(false);

    // Android 15+ บังคับ edge-to-edge: status bar ไม่ใช้ setStatusBarColor แล้ว ส่วน navigation bar
    // ยังใช้ setNavigationBarColor ได้เฉพาะโหมดสามปุ่ม (gesture mode โปร่งใส) — เดิม pad root view
    // กันไม่ให้ WebView ยื่นไปใต้แถบระบบ ทำให้ช่องว่างตรงนั้น
    // โชว์ native background (เขียว) ไม่มีทางเซตสีให้ตรงธีมแอปได้เลย ตอนนี้ปล่อยให้ WebView ยื่นเต็มจอ
    // จริง แล้วให้ฝั่งเว็บกันเนื้อหาเองด้วย env(safe-area-inset-*) (มีอยู่แล้วใน globals.css /
    // native-top-bar, bottom-nav — ต้องมี viewport-fit=cover ด้วย ซึ่งเว็บแอปตั้งไว้แล้ว) วิธีนี้พื้นหลัง
    // จริงของหน้าเว็บ (ตามธีม) จะโผล่ผ่านแถบโปร่งใสแทน ไม่ต้องพึ่ง API ที่ถูกบล็อกอีก
  }

  // เรียกจาก onCreate (ค่าเริ่มต้น) และจาก NativeThemePlugin (เว็บแอป sync ธีมจริงมาให้)
  public void applyBarColors(boolean isDark) {
    Window window = getWindow();
    int barColor = isDark ? STATUS_BAR_COLOR_DARK : STATUS_BAR_COLOR_LIGHT;
    int navigationBarColor = barColor;
    if ("Swan 1".equals(Build.MODEL) && "rk3566_rgo".equals(Build.DEVICE)) {
      // The Swan's three-button bar is visible on every route. Keep it distinct
      // from the WebView surface without changing the system bars on other devices.
      navigationBarColor = isDark ? SWAN_NAVIGATION_BAR_COLOR_DARK : SWAN_NAVIGATION_BAR_COLOR_LIGHT;
    }

    // Android 15+ (API 35+) บังคับ edge-to-edge และเพิกเฉยต่อ setStatusBarColor
    // (ดู @capacitor/status-bar's StatusBar.java: shouldSetStatusBarColor() คืน false ตั้งแต่ API 36)
    // — พื้นที่แถบระบบที่โปร่งใสจะโชว์ "window background" แทน ซึ่งเดิม
    // ค้างเป็นสีเขียวของ splash theme (AndroidManifest ผูก MainActivity ไว้กับ
    // AppTheme.NoActionBarLaunch ตลอดอายุแอป ไม่เคยสลับ) ตั้ง background ตรงนี้แทนจึงเห็นผลจริงทุกเวอร์ชัน
    window.setBackgroundDrawable(new ColorDrawable(barColor));

    window.setStatusBarColor(barColor);
    window.setNavigationBarColor(navigationBarColor);

    WindowInsetsControllerCompat controller =
      new WindowInsetsControllerCompat(window, window.getDecorView());

    controller.setAppearanceLightStatusBars(!isDark);
    controller.setAppearanceLightNavigationBars(!isDark);
  }

  private void hardenWebViewRendering() {
    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) {
      return;
    }

    webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      // POS screens are large and image-heavy. Keep the renderer at foreground priority
      // while visible instead of letting low-memory pressure repeatedly evict/recreate it.
      webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
    }

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
