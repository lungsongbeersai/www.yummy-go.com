package com.yummygo.app;

import static org.junit.Assert.*;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.Test;

public class SunmiBufferedTransactionTest {
  @Test public void commitsBufferedCommandsWithoutAnyPreCommitCallback() throws Exception {
    List<String> events = new ArrayList<>();
    SunmiBufferedTransaction.enqueue(Arrays.asList(new byte[] {1}, new byte[] {2}), new SunmiBufferedTransaction.Printer() {
      @Override public boolean active() { return true; }
      @Override public void send(byte[] bytes) { events.add("send:" + bytes[0]); /* SDK deliberately produces no callback yet. */ }
      @Override public void commit() { events.add("commit"); }
    });
    assertEquals(Arrays.asList("send:1", "send:2", "commit"), events);
    // Submission alone provides no printed result. The plugin separately
    // owns the transaction's physical onPrintResult callback and journal.
  }

  @Test public void aCancellationOrCommandFailureStopsLaterBlocksAndCommit() throws Exception {
    List<String> events = new ArrayList<>();
    SunmiBufferedTransaction.enqueue(Arrays.asList(new byte[] {1}, new byte[] {2}), new SunmiBufferedTransaction.Printer() {
      boolean active = true;
      @Override public boolean active() { return active; }
      @Override public void send(byte[] bytes) { events.add("send:" + bytes[0]); active = false; }
      @Override public void commit() { events.add("commit"); }
    });
    assertEquals(Arrays.asList("send:1"), events);
  }

  @Test public void anIpcExceptionDoesNotRetryTheBlockOrCommitAnIncompleteReceipt() {
    List<String> events = new ArrayList<>();
    assertThrows(IOException.class, () -> SunmiBufferedTransaction.enqueue(
      Arrays.asList(new byte[] {1}, new byte[] {2}, new byte[] {3}), new SunmiBufferedTransaction.Printer() {
        @Override public boolean active() { return true; }
        @Override public void send(byte[] bytes) throws IOException {
          events.add("send:" + bytes[0]); if (bytes[0] == 2) throw new IOException("Binder outcome unknown");
        }
        @Override public void commit() { events.add("commit"); }
      }));
    assertEquals(Arrays.asList("send:1", "send:2"), events);
  }
}
