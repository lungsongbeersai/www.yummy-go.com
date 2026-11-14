package com.yummygo.app;

import static org.junit.Assert.*;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class CommercialPdfStoreTest {
  @Rule public TemporaryFolder temporary=new TemporaryFolder();
  private final AtomicLong now=new AtomicLong(1_000_000);
  private final List<File> revoked=new ArrayList<>();
  private File root;
  private CommercialPdfStore store;
  private final byte[] pdf="%PDF-1.4\nSYNTHETIC-ONLY\n%%EOF".getBytes(StandardCharsets.US_ASCII);
  @Before public void setup() throws IOException {
    root=temporary.newFolder("commercial-pdf");
    store=new CommercialPdfStore(root,now::get,revoked::add);
  }
  private CommercialPdfStore.Entry ready(String name) throws IOException {
    CommercialPdfStore.Entry entry=store.begin(name,pdf.length);
    store.append(entry.handle,0,pdf);return store.finish(entry.handle);
  }

  @Test public void transfersSequentialChunksIncludingSplitSignatureAndExactSize() throws Exception {
    CommercialPdfStore.Entry entry=store.begin("Quotation.pdf",pdf.length);
    assertEquals(0,entry.receivedBytes);
    assertEquals(1,store.append(entry.handle,0,Arrays.copyOfRange(pdf,0,2)).nextIndex);
    assertEquals(5,store.append(entry.handle,1,Arrays.copyOfRange(pdf,2,5)).receivedBytes);
    store.append(entry.handle,2,Arrays.copyOfRange(pdf,5,pdf.length));
    assertEquals(pdf.length,store.finish(entry.handle).sizeBytes);
    ByteArrayOutputStream output=new ByteArrayOutputStream();store.copyTo(entry.handle,output);
    assertArrayEquals(pdf,output.toByteArray());
    assertEquals(root.getCanonicalFile(),entry.directory.getParentFile().getCanonicalFile());
  }

  @Test public void enforcesChunkOrderAndRejectsDuplicateOrExtraBytes() throws Exception {
    CommercialPdfStore.Entry entry=store.begin("Quotation",pdf.length);
    assertThrows(CommercialPdfStore.PdfException.class,() -> store.append(entry.handle,1,pdf));
    assertEquals(0,entry.file.length());
    store.append(entry.handle,0,Arrays.copyOfRange(pdf,0,5));
    assertThrows(CommercialPdfStore.PdfException.class,() -> store.append(entry.handle,0,pdf));
    assertThrows(CommercialPdfStore.PdfException.class,() -> store.append(entry.handle,1,pdf));
    store.append(entry.handle,1,Arrays.copyOfRange(pdf,5,pdf.length));store.finish(entry.handle);
    assertThrows(CommercialPdfStore.PdfException.class,() -> store.append(entry.handle,2,new byte[]{1}));
  }

  @Test public void validatesSignatureIncompleteTransfersAndEmptyChunks() throws Exception {
    CommercialPdfStore.Entry entry=store.begin("Quotation",pdf.length);
    assertThrows(CommercialPdfStore.PdfException.class,() -> store.append(entry.handle,0,"<html>".getBytes(StandardCharsets.US_ASCII)));
    assertThrows(CommercialPdfStore.PdfException.class,() -> store.append(entry.handle,0,new byte[0]));
    store.append(entry.handle,0,Arrays.copyOfRange(pdf,0,2));
    assertThrows(CommercialPdfStore.PdfException.class,() -> store.append(entry.handle,1,new byte[]{'X'}));
    assertEquals(2,entry.file.length());
    assertThrows(CommercialPdfStore.PdfException.class,() -> store.finish(entry.handle));
    assertFalse(store.isReady(entry.handle));
  }

  @Test public void boundsDeclaredSizeChunksAndSimultaneousStaging() throws Exception {
    assertThrows(CommercialPdfStore.PdfException.class,() -> store.begin("Quotation",4));
    assertThrows(CommercialPdfStore.PdfException.class,() -> store.begin("Quotation",CommercialPdfStore.MAX_BYTES+1L));
    CommercialPdfStore.Entry entry=store.begin("Quotation",CommercialPdfStore.MAX_BYTES);
    assertThrows(CommercialPdfStore.PdfException.class,() -> store.append(entry.handle,0,new byte[CommercialPdfStore.MAX_CHUNK_BYTES+1]));
    byte[] chunk=new byte[CommercialPdfStore.MAX_CHUNK_BYTES];System.arraycopy(pdf,0,chunk,0,5);
    store.append(entry.handle,0,chunk);
    assertEquals(CommercialPdfStore.MAX_CHUNK_BYTES,entry.receivedBytes);
    store.begin("Second",pdf.length);
    assertThrows(CommercialPdfStore.PdfException.class,() -> store.begin("Third",pdf.length));
  }

  @Test public void supportsMaximumSizeWithoutRetainingWholePdfInMemory() throws Exception {
    CommercialPdfStore.Entry entry=store.begin("Quotation",CommercialPdfStore.MAX_BYTES);
    byte[] chunk=new byte[CommercialPdfStore.MAX_CHUNK_BYTES];System.arraycopy(pdf,0,chunk,0,5);
    for (int index=0;index<CommercialPdfStore.MAX_BYTES/CommercialPdfStore.MAX_CHUNK_BYTES;index++) store.append(entry.handle,index,chunk);
    assertEquals(CommercialPdfStore.MAX_BYTES,store.finish(entry.handle).file.length());
  }

  @Test public void usesSanitizedDisplayNamesInsideOpaqueDirectories() throws Exception {
    CommercialPdfStore.Entry entry=ready("../../Quotation/<synthetic>:?.PDF");
    assertTrue(entry.handle.matches("[0-9a-f-]{36}"));
    assertTrue(entry.file.getName().endsWith(".pdf"));
    assertFalse(entry.file.getName().contains("/"));
    assertFalse(entry.file.getName().contains(":"));
    assertFalse(entry.file.getName().startsWith("."));
    assertEquals("commercial-document.pdf",CommercialPdfStore.safeFileName("..."));
    String name=CommercialPdfStore.safeFileName("ກ".repeat(300));
    assertTrue(name.getBytes(StandardCharsets.UTF_8).length<=164);
    assertFalse(name.contains("\ufffd"));
    assertThrows(CommercialPdfStore.PdfException.class,() -> store.ready("../../outside"));
  }

  @Test public void normalReleasePreservesSharedLeaseButForcedDiscardRevokesAndDeletes() throws Exception {
    CommercialPdfStore.Entry unshared=ready("First");store.release(unshared.handle);
    assertFalse(unshared.file.exists());assertTrue(revoked.isEmpty());
    CommercialPdfStore.Entry shared=ready("Second");store.markShared(shared.handle);store.release(shared.handle);
    assertTrue(shared.file.exists());assertTrue(store.isReady(shared.handle));assertTrue(revoked.isEmpty());
    store.discard(shared.handle);
    assertFalse(shared.file.exists());assertFalse(store.isReady(shared.handle));assertEquals(List.of(shared.file),revoked);
    store.discard(shared.handle);store.release(shared.handle);
    assertEquals(1,revoked.size());
  }

  @Test public void expiresAndRevokesSharedFilesWithoutExtendingLeaseOnRelease() throws Exception {
    CommercialPdfStore.Entry shared=ready("Quotation");store.markShared(shared.handle);
    now.addAndGet(CommercialPdfStore.SHARED_TTL_MS-1);store.release(shared.handle);assertTrue(store.isReady(shared.handle));
    now.incrementAndGet();store.prune();
    assertFalse(shared.file.exists());assertFalse(store.isReady(shared.handle));assertEquals(List.of(shared.file),revoked);
  }

  @Test public void retainsOnlyTwoHandedFilesAndEvictsTheOldestWithRevocation() throws Exception {
    CommercialPdfStore.Entry first=ready("First");store.markShared(first.handle);now.incrementAndGet();
    CommercialPdfStore.Entry second=ready("Second");store.markShared(second.handle);now.incrementAndGet();
    CommercialPdfStore.Entry third=ready("Third");store.markShared(third.handle);
    assertFalse(store.isReady(first.handle));assertTrue(store.isReady(second.handle));assertTrue(store.isReady(third.handle));
    assertEquals(List.of(first.file),revoked);
  }

  @Test public void newBridgeInvalidatesPriorSharedLeaseAndRemovesOrphanedPartialTransfers() throws Exception {
    CommercialPdfStore.Entry shared=ready("Shared");store.markShared(shared.handle);
    CommercialPdfStore.Entry partial=store.begin("Partial",pdf.length);store.append(partial.handle,0,Arrays.copyOf(pdf,5));
    // Simulate process death without an orderly close.
    CommercialPdfStore fresh=new CommercialPdfStore(root,now::get,revoked::add);
    assertFalse(partial.file.exists());assertFalse(shared.file.exists());assertFalse(fresh.isReady(shared.handle));
    assertEquals(2,revoked.size());assertTrue(revoked.contains(shared.file));assertTrue(revoked.contains(partial.file));
  }

  @Test public void cancellationDuringCopyStopsBeforeAnyFurtherBytesAreWritten() throws Exception {
    byte[] data=new byte[40_000];System.arraycopy(pdf,0,data,0,pdf.length);
    CommercialPdfStore.Entry entry=store.begin("Quotation",data.length);store.append(entry.handle,0,data);store.finish(entry.handle);
    ByteArrayOutputStream written=new ByteArrayOutputStream();
    OutputStream output=new OutputStream() {
      @Override public void write(int value) { throw new AssertionError("Use bounded chunks"); }
      @Override public void write(byte[] values,int offset,int count) {
        written.write(values,offset,count);store.discard(entry.handle);
      }
    };
    CommercialPdfStore.PdfException failure=assertThrows(CommercialPdfStore.PdfException.class,() -> store.copyTo(entry.handle,output));
    assertEquals("PDF_CANCELLED",failure.code);assertEquals(16*1024,written.size());assertFalse(entry.file.exists());
  }

  @Test public void destinationIoFailureIsPropagatedAndCannotBecomeSuccessfulSave() throws Exception {
    CommercialPdfStore.Entry entry=ready("Quotation");
    OutputStream failed=new OutputStream() { @Override public void write(int value) throws IOException { throw new IOException("Synthetic destination failure"); } };
    assertThrows(IOException.class,() -> store.copyTo(entry.handle,failed));
    assertTrue(store.isReady(entry.handle));
  }
}
