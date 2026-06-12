package com.yummygo.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

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
}