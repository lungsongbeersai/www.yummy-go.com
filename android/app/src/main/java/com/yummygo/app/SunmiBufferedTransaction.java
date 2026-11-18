package com.yummygo.app;

import java.util.List;

/** Buffer submission cannot depend on callbacks that may run only after commit. */
final class SunmiBufferedTransaction {
  interface Printer {
    boolean active();
    void send(byte[] commandBlock) throws Exception;
    void commit() throws Exception;
  }

  private SunmiBufferedTransaction() {}

  static void enqueue(List<byte[]> blocks, Printer printer) throws Exception {
    for (byte[] block : blocks) {
      if (!printer.active()) return;
      printer.send(block);
    }
    if (printer.active()) printer.commit();
  }
}
