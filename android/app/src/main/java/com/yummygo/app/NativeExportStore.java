package com.yummygo.app;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.LongSupplier;
import java.util.zip.ZipFile;

/** Bounded private staging for user-requested exports, never caller filesystem paths. */
final class NativeExportStore {
  static final int MAX_BYTES = 64 * 1024 * 1024;
  static final int MAX_CHUNK_BYTES = 256 * 1024;
  static final long TTL_MS = 5 * 60 * 1000L;
  private static final int MAX_STAGING = 2;
  static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  static final class ExportException extends IOException {
    final String code;
    ExportException(String code, String message) { super(message); this.code = code; }
  }

  static final class Entry {
    final String handle;
    final File directory;
    final File file;
    final String mimeType;
    final long sizeBytes;
    final byte[] header = new byte[8];
    long receivedBytes;
    long expiresAt;
    int nextIndex;
    boolean complete;
    Entry(String handle, File directory, File file, String mimeType, long sizeBytes, long expiresAt) {
      this.handle = handle; this.directory = directory; this.file = file;
      this.mimeType = mimeType; this.sizeBytes = sizeBytes; this.expiresAt = expiresAt;
    }
  }

  private final File root;
  private final LongSupplier clock;
  private final Map<String, Entry> entries = new LinkedHashMap<>();

  NativeExportStore(File root, LongSupplier clock) throws IOException {
    this.root = root; this.clock = clock;
    if (!root.isDirectory() && !root.mkdirs()) throw new IOException("Private export storage is unavailable");
    File[] previous = root.listFiles();
    if (previous != null) for (File file : previous) deleteTree(file);
  }

  synchronized Entry begin(String fileName, String mimeType, long sizeBytes) throws IOException {
    prune();
    String name = safeFileName(fileName, mimeType);
    if (sizeBytes < 8 || sizeBytes > MAX_BYTES) throw invalid("Export size must be between 8 bytes and 64 MiB");
    if (entries.size() >= MAX_STAGING) throw new ExportException("FILE_LIMIT", "Too many files are being prepared");
    String handle = UUID.randomUUID().toString();
    File directory = new File(root, handle);
    if (!directory.mkdir()) throw new IOException("Private export storage is unavailable");
    File file = new File(directory, name);
    if (!file.createNewFile()) { deleteTree(directory); throw new IOException("Private export storage is unavailable"); }
    Entry entry = new Entry(handle, directory, file, mimeType, sizeBytes, clock.getAsLong() + TTL_MS);
    entries.put(handle, entry);
    return entry;
  }

  synchronized Entry append(String handle, int index, byte[] bytes) throws IOException {
    Entry entry = get(handle, false);
    if (entry.complete || index != entry.nextIndex) throw invalid("File chunks must arrive once in sequential order");
    if (bytes == null || bytes.length == 0 || bytes.length > MAX_CHUNK_BYTES || entry.receivedBytes + bytes.length > entry.sizeBytes) throw invalid("Invalid file chunk size");
    if (entry.receivedBytes < entry.header.length) {
      System.arraycopy(bytes, 0, entry.header, (int) entry.receivedBytes, Math.min(bytes.length, entry.header.length - (int) entry.receivedBytes));
      validateHeader(entry, (int) Math.min(entry.header.length, entry.receivedBytes + bytes.length));
    }
    try (FileOutputStream output = new FileOutputStream(entry.file, true)) { output.write(bytes); }
    entry.receivedBytes += bytes.length; entry.nextIndex++; entry.expiresAt = clock.getAsLong() + TTL_MS;
    return entry;
  }

  synchronized Entry finish(String handle) throws IOException {
    Entry entry = get(handle, false);
    if (entry.receivedBytes != entry.sizeBytes || entry.file.length() != entry.sizeBytes) throw invalid("The file transfer is incomplete");
    validateHeader(entry, (int) Math.min(entry.header.length, entry.receivedBytes));
    if ("application/zip".equals(entry.mimeType) || XLSX.equals(entry.mimeType)) {
      try (ZipFile zip = new ZipFile(entry.file)) {
        if (XLSX.equals(entry.mimeType) && (zip.getEntry("[Content_Types].xml") == null || zip.getEntry("xl/workbook.xml") == null)) throw invalid("The file is not an Excel workbook");
      } catch (IOException error) { throw invalid("The exported archive is invalid"); }
    }
    entry.complete = true;
    return entry;
  }

  synchronized Entry ready(String handle) throws IOException { return get(handle, true); }
  synchronized void discard(String handle) { Entry entry = entries.remove(handle); if (entry != null) deleteTree(entry.directory); }
  synchronized boolean isReady(String handle) { try { get(handle, true); return true; } catch (IOException error) { return false; } }

  void copyTo(String handle, OutputStream output) throws IOException {
    Entry entry;
    synchronized (this) { entry = get(handle, true); }
    try (FileInputStream input = new FileInputStream(entry.file)) {
      byte[] buffer = new byte[16 * 1024];
      int read;
      while ((read = input.read(buffer)) != -1) {
        synchronized (this) {
          if (get(handle, true) != entry) throw cancelled();
        }
        // SAF destinations may be cloud-backed. Never hold the staging lock
        // across their I/O: lifecycle cleanup runs on Android's main thread.
        output.write(buffer, 0, read);
        synchronized (this) { if (get(handle, true) != entry) throw cancelled(); }
      }
    }
    synchronized (this) { if (get(handle, true) != entry) throw cancelled(); }
  }

  synchronized void prune() {
    for (Entry entry : new ArrayList<>(entries.values())) if (entry.expiresAt <= clock.getAsLong()) discard(entry.handle);
  }
  synchronized void close() { for (String handle : new ArrayList<>(entries.keySet())) discard(handle); }

  private Entry get(String handle, boolean complete) throws IOException {
    prune();
    Entry entry = entries.get(handle);
    if (entry == null || !entry.file.isFile()) throw cancelled();
    if (complete && !entry.complete) throw invalid("The file transfer is incomplete");
    return entry;
  }

  static String safeFileName(String value, String mimeType) throws ExportException {
    String extension;
    if ("application/pdf".equals(mimeType)) extension = ".pdf";
    else if (XLSX.equals(mimeType)) extension = ".xlsx";
    else if ("image/png".equals(mimeType)) extension = ".png";
    else if ("application/zip".equals(mimeType)) extension = ".zip";
    else throw invalid("Unsupported export format");
    if (value == null || value.length() > 512) throw invalid("Invalid export file name");
    String name = value.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "-").trim().replaceAll("^[.]+|[. ]+$", "");
    if (!name.toLowerCase(Locale.ROOT).endsWith(extension)) throw invalid("File extension does not match its format");
    name = name.substring(0, name.length() - extension.length());
    if (name.isEmpty()) name = "yummy-go-export";
    while ((name + extension).getBytes(StandardCharsets.UTF_8).length > 180) name = name.substring(0, name.offsetByCodePoints(0, name.codePointCount(0, name.length()) - 1));
    return name + extension;
  }

  private static void validateHeader(Entry entry, int available) throws ExportException {
    byte[] expected;
    if ("application/pdf".equals(entry.mimeType)) expected = "%PDF-".getBytes(StandardCharsets.US_ASCII);
    else if ("image/png".equals(entry.mimeType)) expected = new byte[] {(byte) 137, 80, 78, 71, 13, 10, 26, 10};
    else {
      byte kind = entry.header[2];
      if (available >= 3 && kind != 3 && !("application/zip".equals(entry.mimeType) && kind == 5)) throw invalid("Invalid archive signature");
      expected = new byte[] {80, 75, kind, kind == 5 ? (byte) 6 : (byte) 4};
    }
    for (int index = 0; index < Math.min(available, expected.length); index++) if (entry.header[index] != expected[index]) throw invalid("File signature does not match its format");
  }

  private static void deleteTree(File file) {
    File[] children = file.listFiles();
    if (children != null) for (File child : children) deleteTree(child);
    file.delete();
  }
  private static ExportException invalid(String message) { return new ExportException("FILE_INVALID", message); }
  private static ExportException cancelled() { return new ExportException("FILE_CANCELLED", "The prepared export is no longer available"); }
}
