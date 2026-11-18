package com.yummygo.app;

import static org.junit.Assert.*;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class NativeExportStoreTest {
  @Rule public TemporaryFolder temporary = new TemporaryFolder();
  private final AtomicLong now = new AtomicLong(1000);
  private File root;
  private NativeExportStore store;
  private final byte[] pdf = "%PDF-1.7\nSYNTHETIC-ONLY\n%%EOF".getBytes(StandardCharsets.US_ASCII);

  @Before public void setup() throws IOException {
    root = temporary.newFolder("file-export");
    store = new NativeExportStore(root, now::get);
  }

  private NativeExportStore.Entry prepare(String name, String mime, byte[] bytes) throws IOException {
    NativeExportStore.Entry entry = store.begin(name, mime, bytes.length);
    store.append(entry.handle, 0, bytes);
    return store.finish(entry.handle);
  }

  private byte[] archive(boolean workbook) throws IOException {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
      for (String name : workbook ? new String[] {"[Content_Types].xml", "xl/workbook.xml"} : new String[] {"products.json"}) {
        zip.putNextEntry(new ZipEntry(name)); zip.write("synthetic".getBytes(StandardCharsets.UTF_8)); zip.closeEntry();
      }
    }
    return bytes.toByteArray();
  }

  @Test public void transfersExactBytesWithSplitHeadersAndPrivateGeneratedHandles() throws Exception {
    NativeExportStore.Entry entry = store.begin("own-report.pdf", "application/pdf", pdf.length);
    store.append(entry.handle, 0, Arrays.copyOfRange(pdf, 0, 2));
    store.append(entry.handle, 1, Arrays.copyOfRange(pdf, 2, pdf.length));
    store.finish(entry.handle);
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    store.copyTo(entry.handle, output);
    assertArrayEquals(pdf, output.toByteArray());
    assertEquals(root.getCanonicalFile(), entry.directory.getParentFile().getCanonicalFile());
    assertTrue(entry.handle.matches("[0-9a-f-]{36}"));
  }

  @Test public void allowsOnlyMatchingSupportedFormatsAndSanitizesNames() throws Exception {
    assertThrows(IOException.class, () -> store.begin("run.exe", "application/octet-stream", 20));
    assertThrows(IOException.class, () -> store.begin("wrong.png", "application/pdf", 20));
    String name = NativeExportStore.safeFileName("../ບົດລາຍງານ/?.pdf", "application/pdf");
    assertFalse(name.contains("/")); assertFalse(name.contains("\\")); assertFalse(name.startsWith("."));
    assertTrue(name.endsWith(".pdf"));
    assertThrows(IOException.class, () -> store.begin("big.zip", "application/zip", (long) NativeExportStore.MAX_BYTES + 1));
  }

  @Test public void validatesPngAndArchiveSignaturesInsteadOfTrustingMime() throws Exception {
    byte[] png = new byte[] {(byte) 137, 80, 78, 71, 13, 10, 26, 10};
    assertTrue(prepare("qr.png", "image/png", png).complete);
    store.close();
    NativeExportStore.Entry bad = store.begin("not-png.png", "image/png", pdf.length);
    assertThrows(IOException.class, () -> store.append(bad.handle, 0, pdf));
    assertEquals(0, bad.file.length());
    store.close();
    assertTrue(prepare("products.zip", "application/zip", archive(false)).complete);
  }

  @Test public void rejectsAnOrdinaryZipDisguisedAsXlsxAndAcceptsAWorkbookContainer() throws Exception {
    byte[] ordinary = archive(false);
    NativeExportStore.Entry bad = store.begin("wrong.xlsx", NativeExportStore.XLSX, ordinary.length);
    store.append(bad.handle, 0, ordinary);
    assertThrows(IOException.class, () -> store.finish(bad.handle));
    store.discard(bad.handle);
    assertTrue(prepare("report.xlsx", NativeExportStore.XLSX, archive(true)).complete);
  }

  @Test public void rejectsSkippedDuplicateOversizedAndIncompleteChunks() throws Exception {
    NativeExportStore.Entry entry = store.begin("report.pdf", "application/pdf", pdf.length);
    assertThrows(IOException.class, () -> store.append(entry.handle, 1, pdf));
    assertThrows(IOException.class, () -> store.append(entry.handle, 0, new byte[NativeExportStore.MAX_CHUNK_BYTES + 1]));
    store.append(entry.handle, 0, Arrays.copyOfRange(pdf, 0, 8));
    assertThrows(IOException.class, () -> store.append(entry.handle, 0, pdf));
    assertThrows(IOException.class, () -> store.finish(entry.handle));
    assertFalse(store.isReady(entry.handle));
  }

  @Test public void expiresStagingAndBoundsConcurrentFiles() throws Exception {
    NativeExportStore.Entry first = store.begin("one.pdf", "application/pdf", pdf.length);
    store.begin("two.pdf", "application/pdf", pdf.length);
    assertThrows(IOException.class, () -> store.begin("three.pdf", "application/pdf", pdf.length));
    now.addAndGet(NativeExportStore.TTL_MS);
    store.prune();
    assertFalse(first.file.exists());
    assertNotNull(store.begin("three.pdf", "application/pdf", pdf.length));
  }

  @Test public void abortsCopyAfterRevocationAndClearsFilesOnActivityRecreation() throws Exception {
    byte[] bytes = new byte[40_000]; Arrays.fill(bytes, (byte) 97); System.arraycopy(pdf, 0, bytes, 0, pdf.length);
    NativeExportStore.Entry entry = prepare("private.pdf", "application/pdf", bytes);
    OutputStream revokeDuringWrite = new OutputStream() {
      @Override public void write(int value) {}
      @Override public void write(byte[] value, int offset, int length) { store.discard(entry.handle); }
    };
    assertThrows(IOException.class, () -> store.copyTo(entry.handle, revokeDuringWrite));
    NativeExportStore.Entry abandoned = prepare("abandoned.pdf", "application/pdf", pdf);
    new NativeExportStore(root, now::get);
    assertFalse(abandoned.file.exists());
  }

  @Test public void slowExternalDestinationsDoNotBlockMainThreadRevocation() throws Exception {
    NativeExportStore.Entry entry = prepare("private.pdf", "application/pdf", pdf);
    CountDownLatch writing = new CountDownLatch(1);
    CountDownLatch release = new CountDownLatch(1);
    CountDownLatch revoked = new CountDownLatch(1);
    OutputStream slowDestination = new OutputStream() {
      @Override public void write(int value) {}
      @Override public void write(byte[] value, int offset, int length) throws IOException {
        writing.countDown();
        try { release.await(3, TimeUnit.SECONDS); } catch (InterruptedException error) { throw new IOException(error); }
      }
    };
    Thread writer = new Thread(() -> { try { store.copyTo(entry.handle, slowDestination); } catch (IOException expectedCancellation) {} });
    Thread revoker = new Thread(() -> { store.discard(entry.handle); revoked.countDown(); });
    writer.start();
    try {
      assertTrue(writing.await(1, TimeUnit.SECONDS));
      revoker.start();
      assertTrue("External provider I/O must not hold the staging lock", revoked.await(1, TimeUnit.SECONDS));
    } finally { release.countDown(); writer.join(1500); if (revoker.isAlive()) revoker.join(1500); }
    assertFalse(writer.isAlive());
  }
}
