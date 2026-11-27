package com.yummygo.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Built-in receipt printers on non-SUNMI Android POS terminals (for example
 * Rockchip RK3566 all-in-ones) are wired to an internal USB port. This is the
 * fallback transport when SUNMI's printer service is absent. It only writes
 * ESC/POS bytes to a local USB endpoint and never opens a network listener.
 */
final class UsbBuiltinPrinter {
  static final String ACTION_PERMISSION = "com.yummygo.app.USB_PRINTER_PERMISSION";
  private static final int TRANSFER_BYTES = 16 * 1024;
  private static final int TRANSFER_TIMEOUT_MS = 15_000;

  interface Active { boolean active(); }
  interface BeforeWrite { boolean fence(); }

  static final class Target {
    final UsbDevice device;
    final int interfaceIndex;
    Target(UsbDevice device, int interfaceIndex) { this.device = device; this.interfaceIndex = interfaceIndex; }
    String label() {
      return String.format(Locale.ROOT, "USB %04x:%04x", device.getVendorId(), device.getProductId());
    }
  }

  private final Context context;

  UsbBuiltinPrinter(Context context) { this.context = context.getApplicationContext(); }

  private UsbManager manager() { return (UsbManager) context.getSystemService(Context.USB_SERVICE); }

  /** Pure selection policy shared with unit tests. */
  static boolean isPrinterInterface(int interfaceClass, int deviceInterfaceCount, boolean hasBulkOut) {
    if (!hasBulkOut) return false;
    if (interfaceClass == UsbConstants.USB_CLASS_PRINTER) return true;
    // Many POS printer modules expose a single vendor-specific bulk interface.
    // Multi-interface vendor devices (4G modems, card readers) are excluded.
    return interfaceClass == UsbConstants.USB_CLASS_VENDOR_SPEC && deviceInterfaceCount == 1;
  }

  Target find() {
    UsbManager usb = manager();
    if (usb == null) return null;
    Target vendorFallback = null;
    for (UsbDevice device : usb.getDeviceList().values()) {
      for (int i = 0; i < device.getInterfaceCount(); i++) {
        UsbInterface candidate = device.getInterface(i);
        if (!isPrinterInterface(candidate.getInterfaceClass(), device.getInterfaceCount(), bulkOut(candidate) != null)) continue;
        if (candidate.getInterfaceClass() == UsbConstants.USB_CLASS_PRINTER) return new Target(device, i);
        if (vendorFallback == null) vendorFallback = new Target(device, i);
      }
    }
    return vendorFallback;
  }

  boolean hasPermission(Target target) {
    UsbManager usb = manager();
    return usb != null && usb.hasPermission(target.device);
  }

  /** Shows Android's USB permission dialog and waits briefly for the cashier's answer. */
  boolean requestPermission(Target target, long waitMs) throws InterruptedException {
    UsbManager usb = manager();
    if (usb == null) return false;
    if (usb.hasPermission(target.device)) return true;
    int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
    Intent intent = new Intent(ACTION_PERMISSION).setPackage(context.getPackageName());
    usb.requestPermission(target.device, PendingIntent.getBroadcast(context, 0, intent, flags));
    long deadline = System.currentTimeMillis() + waitMs;
    while (System.currentTimeMillis() < deadline) {
      if (usb.hasPermission(target.device)) return true;
      Thread.sleep(250);
    }
    return usb.hasPermission(target.device);
  }

  /**
   * Writes every block in order. {@code fence} runs before the first byte
   * leaves the app so the caller can record that delivery became uncertain.
   */
  void write(Target target, List<byte[]> blocks, Active active, BeforeWrite fence) throws IOException {
    UsbManager usb = manager();
    if (usb == null || !usb.hasPermission(target.device)) throw new IOException("USB printer permission is missing");
    UsbInterface printerInterface = target.device.getInterface(target.interfaceIndex);
    UsbEndpoint out = bulkOut(printerInterface);
    if (out == null) throw new IOException("USB printer has no output endpoint");
    UsbDeviceConnection connection = usb.openDevice(target.device);
    if (connection == null) throw new IOException("USB printer could not be opened");
    try {
      if (!connection.claimInterface(printerInterface, true)) throw new IOException("USB printer is in use");
      boolean fenced = false;
      byte[] buffer = new byte[TRANSFER_BYTES];
      for (byte[] block : blocks) {
        int offset = 0;
        while (offset < block.length) {
          if (!active.active()) throw new IOException("The print job was cancelled");
          if (!fenced) { if (!fence.fence()) throw new IOException("The print job was cancelled"); fenced = true; }
          int length = Math.min(TRANSFER_BYTES, block.length - offset);
          System.arraycopy(block, offset, buffer, 0, length);
          int sent = connection.bulkTransfer(out, buffer, length, TRANSFER_TIMEOUT_MS);
          if (sent <= 0) throw new IOException("USB printer stopped accepting data");
          offset += sent;
        }
      }
    } finally {
      try { connection.releaseInterface(printerInterface); } catch (RuntimeException ignored) { /* Closing below. */ }
      connection.close();
    }
  }

  /** Short hardware summary shown in the diagnostic when no printer matches. */
  String describe() {
    List<String> parts = new ArrayList<>();
    UsbManager usb = manager();
    if (usb != null) {
      for (UsbDevice device : usb.getDeviceList().values()) {
        StringBuilder classes = new StringBuilder();
        for (int i = 0; i < device.getInterfaceCount(); i++) {
          if (i > 0) classes.append('/');
          classes.append(device.getInterface(i).getInterfaceClass());
        }
        parts.add(String.format(Locale.ROOT, "%04x:%04x[%s]", device.getVendorId(), device.getProductId(), classes));
      }
    }
    List<String> serial = new ArrayList<>();
    File[] nodes = new File("/dev").listFiles((dir, name) -> name.startsWith("ttyS") || name.startsWith("ttyUSB") || name.startsWith("usb/lp") || name.startsWith("printer"));
    if (nodes != null) for (File node : nodes) if (node.canWrite()) serial.add(node.getName());
    return "USB " + (parts.isEmpty() ? "none" : String.join(",", parts)) + "; writable tty " + (serial.isEmpty() ? "none" : String.join(",", serial));
  }

  private static UsbEndpoint bulkOut(UsbInterface printerInterface) {
    for (int i = 0; i < printerInterface.getEndpointCount(); i++) {
      UsbEndpoint endpoint = printerInterface.getEndpoint(i);
      if (endpoint.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK && endpoint.getDirection() == UsbConstants.USB_DIR_OUT) return endpoint;
    }
    return null;
  }
}
