package com.yummygo.app;

import android.app.Activity;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// เชื่อม theme ของเว็บแอป (Zustand app-store, ผู้ใช้เลือกเอง) เข้ากับสี status/navigation bar
// ฝั่ง native — ตั้งใจไม่ผูกกับ OS dark mode เพราะแอปมีสวิตช์ธีมของตัวเอง ต้อง sync กับตัวนั้นเท่านั้น
@CapacitorPlugin(name = "NativeTheme")
public class NativeThemePlugin extends Plugin {
  @PluginMethod
  public void setDarkMode(PluginCall call) {
    boolean isDark = call.getBoolean("dark", false);
    Activity activity = getActivity();

    if (activity instanceof MainActivity) {
      activity.runOnUiThread(() -> ((MainActivity) activity).applyBarColors(isDark));
    }

    call.resolve();
  }
}
