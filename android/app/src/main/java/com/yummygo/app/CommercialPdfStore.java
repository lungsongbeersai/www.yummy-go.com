package com.yummygo.app;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.LongSupplier;

/** Private, bounded staging; it never accepts a caller-provided filesystem path. */
final class CommercialPdfStore {
  static final int MAX_BYTES = 20 * 1024 * 1024;
  static final int MAX_CHUNK_BYTES = 256 * 1024;
  static final long SHARED_TTL_MS = 5 * 60 * 1000L;
  static final int MAX_SHARED = 2;
  private static final int MAX_STAGING = 2;
  private static final byte[] SIGNATURE = "%PDF-".getBytes(StandardCharsets.US_ASCII);

  interface Revoker { void revoke(File file); }

  static final class PdfException extends IOException {
    final String code;
    PdfException(String code, String message) { super(message); this.code = code; }
  }

  static final class Entry {
    final String handle;
    final File directory;
    final File file;
    final long sizeBytes;
    long receivedBytes;
    int nextIndex;
    boolean complete;
    long expiresAt;
    boolean shared;
    Entry(String handle, File directory, File file, long sizeBytes, long expiresAt) {
      this.handle=handle; this.directory=directory; this.file=file; this.sizeBytes=sizeBytes; this.expiresAt=expiresAt;
    }
  }

  private final File root;
  private final LongSupplier clock;
  private final Revoker revoker;
  private final Map<String,Entry> entries = new LinkedHashMap<>();

  CommercialPdfStore(File root, LongSupplier clock, Revoker revoker) throws IOException {
    this.root=root; this.clock=clock; this.revoker=revoker;
    if (!root.isDirectory() && !root.mkdirs()) throw new IOException("Private PDF cache is unavailable");
    clearPreviousSession();
    prune();
  }

  synchronized Entry begin(String fileName, long sizeBytes) throws IOException {
    prune();
    if (sizeBytes<SIGNATURE.length || sizeBytes>MAX_BYTES) throw invalid("PDF size must be between 5 bytes and 20 MiB");
    if (entries.values().stream().filter(entry -> !entry.shared).count()>=MAX_STAGING) {
      throw new PdfException("PDF_LIMIT","Too many PDFs are being prepared");
    }
    String handle=UUID.randomUUID().toString();
    File directory=new File(root,handle);
    if (!directory.mkdir()) throw new IOException("Private PDF cache is unavailable");
    File file=new File(directory,safeFileName(fileName));
    if (!file.createNewFile()) { deleteTree(directory); throw new IOException("Private PDF cache is unavailable"); }
    Entry entry=new Entry(handle,directory,file,sizeBytes,clock.getAsLong()+SHARED_TTL_MS);
    entries.put(handle,entry);
    return entry;
  }

  synchronized Entry append(String handle, int index, byte[] bytes) throws IOException {
    Entry entry=get(handle,false);
    if (entry.complete || index!=entry.nextIndex) throw invalid("PDF chunks must arrive once in sequential order");
    if (bytes==null || bytes.length==0 || bytes.length>MAX_CHUNK_BYTES
      || entry.receivedBytes+bytes.length>entry.sizeBytes) throw invalid("Invalid PDF chunk size");
    if (entry.receivedBytes<SIGNATURE.length) {
      for (int offset=0;offset<bytes.length && entry.receivedBytes+offset<SIGNATURE.length;offset++) {
        if (bytes[offset]!=SIGNATURE[(int)entry.receivedBytes+offset]) throw invalid("The document is not a PDF");
      }
    }
    try (FileOutputStream output=new FileOutputStream(entry.file,true)) { output.write(bytes); }
    entry.receivedBytes+=bytes.length;
    entry.nextIndex++;
    entry.expiresAt=clock.getAsLong()+SHARED_TTL_MS;
    return entry;
  }

  synchronized Entry finish(String handle) throws IOException {
    Entry entry=get(handle,false);
    if (entry.receivedBytes!=entry.sizeBytes || entry.file.length()!=entry.sizeBytes) throw invalid("The PDF transfer is incomplete");
    entry.complete=true;
    return entry;
  }

  synchronized Entry ready(String handle) throws IOException { return get(handle,true); }

  synchronized Entry markShared(String handle) throws IOException {
    Entry entry=get(handle,true);
    entry.expiresAt=clock.getAsLong()+SHARED_TTL_MS;
    entry.shared=true;
    try (FileOutputStream marker=new FileOutputStream(new File(entry.directory,".shared"))) {
      marker.write(Long.toString(entry.expiresAt).getBytes(StandardCharsets.US_ASCII));
    }
    trimShared(entry);
    return entry;
  }

  /** Normal modal closure keeps a receiver's already granted file readable. */
  synchronized void release(String handle) { Entry entry=entries.get(handle); if (entry!=null && !entry.shared) remove(entry); }

  /** Auth/content invalidation deliberately revokes even a previously shared file. */
  synchronized void discard(String handle) { Entry entry=entries.get(handle); if (entry!=null) remove(entry); }

  synchronized boolean isReady(String handle) {
    try { get(handle,true); return true; } catch (IOException error) { return false; }
  }

  void copyTo(String handle, OutputStream output) throws IOException {
    Entry entry;
    synchronized (this) { entry=get(handle,true); }
    byte[] buffer=new byte[16*1024];
    try (FileInputStream input=new FileInputStream(entry.file)) {
      int read;
      while ((read=input.read(buffer))!=-1) {
        synchronized (this) {
          if (get(handle,true)!=entry) throw cancelled();
          output.write(buffer,0,read);
        }
      }
    }
    synchronized (this) { if (get(handle,true)!=entry) throw cancelled(); }
  }

  synchronized void prune() {
    long now=clock.getAsLong();
    for (Entry entry:new ArrayList<>(entries.values())) if (entry.expiresAt<=now) remove(entry);
  }

  synchronized void close() {
    // Do not interrupt a receiver merely because this Activity was stopped.
    // A new bridge invalidates this session's remaining grants on startup.
    for (Entry entry:new ArrayList<>(entries.values())) if (!entry.shared) remove(entry);
  }

  private Entry get(String handle, boolean complete) throws IOException {
    prune();
    Entry entry=entries.get(handle);
    if (entry==null || !entry.file.isFile()) throw cancelled();
    if (complete && !entry.complete) throw invalid("The PDF transfer is incomplete");
    return entry;
  }

  private void trimShared(Entry newest) {
    List<Entry> shared=new ArrayList<>();
    for (Entry entry:entries.values()) if (entry.shared && entry!=newest) shared.add(entry);
    shared.sort(Comparator.comparingLong(entry -> entry.expiresAt));
    while (shared.size()>=MAX_SHARED) remove(shared.remove(0));
  }

  private void remove(Entry entry) {
    entries.remove(entry.handle);
    if (entry.shared) revoker.revoke(entry.file);
    deleteTree(entry.directory);
  }

  private void clearPreviousSession() {
    File[] directories=root.listFiles();
    if (directories==null) return;
    for (File directory:directories) {
      File[] contents=directory.listFiles();
      if (contents!=null) for (File candidate:contents) {
        if (candidate.getName().endsWith(".pdf") && candidate.isFile()) revoker.revoke(candidate);
      }
      deleteTree(directory);
    }
  }

  static String safeFileName(String value) {
    String name=value==null ? "" : value.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]","-").trim();
    name=name.replaceAll("^[.]+|[. ]+$","");
    if (name.toLowerCase(Locale.ROOT).endsWith(".pdf")) name=name.substring(0,name.length()-4);
    if (name.isEmpty()) name="commercial-document";
    while (name.getBytes(StandardCharsets.UTF_8).length>160) name=name.substring(0,name.offsetByCodePoints(0,name.codePointCount(0,name.length())-1));
    return name+".pdf";
  }

  private static void deleteTree(File file) {
    File[] children=file.listFiles();
    if (children!=null) for (File child:children) deleteTree(child);
    file.delete();
  }

  private static PdfException invalid(String message) { return new PdfException("PDF_INVALID",message); }
  private static PdfException cancelled() { return new PdfException("PDF_CANCELLED","The prepared PDF is no longer available"); }
}
