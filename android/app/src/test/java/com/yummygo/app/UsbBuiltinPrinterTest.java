package com.yummygo.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class UsbBuiltinPrinterTest {
  @Test public void acceptsPrinterClassWithBulkOut() {
    assertTrue(UsbBuiltinPrinter.isPrinterInterface(7, 3, true));
  }

  @Test public void acceptsSingleInterfaceVendorDevice() {
    assertTrue(UsbBuiltinPrinter.isPrinterInterface(255, 1, true));
  }

  @Test public void rejectsMultiInterfaceVendorDevicesSuchAsModems() {
    assertFalse(UsbBuiltinPrinter.isPrinterInterface(255, 5, true));
  }

  @Test public void rejectsInterfacesWithoutBulkOut() {
    assertFalse(UsbBuiltinPrinter.isPrinterInterface(7, 1, false));
  }

  @Test public void rejectsStorageAndHid() {
    assertFalse(UsbBuiltinPrinter.isPrinterInterface(8, 1, true));
    assertFalse(UsbBuiltinPrinter.isPrinterInterface(3, 1, true));
  }
}
