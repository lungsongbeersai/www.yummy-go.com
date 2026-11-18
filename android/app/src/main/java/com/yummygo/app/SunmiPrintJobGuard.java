package com.yummygo.app;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** Pure validation and replay policy shared by the native printer and its tests. */
final class SunmiPrintJobGuard {
  static final int MAX_RAW_BYTES = 4 * 1024 * 1024;
  static final int MAX_BASE64_CHARS = ((MAX_RAW_BYTES + 2) / 3) * 4;
  static final int MAX_JOB_ID_LENGTH = 256;

  enum Decision { NEW, PRINTED, UNKNOWN, CONFLICT }

  private SunmiPrintJobGuard() {}

  /** Host readiness permits queued work while the one physical job is healthy. */
  static boolean acceptsQueuedWork(int printerState, boolean activeJob, boolean activeJobSettled) {
    return printerState == 1 && !(activeJob && activeJobSettled);
  }

  static boolean validJobId(String value) {
    return value != null && value.length() <= MAX_JOB_ID_LENGTH
      && value.matches("[A-Za-z0-9._:-]{1,256}");
  }

  static boolean validBase64(String value) {
    return value != null && !value.isEmpty() && value.length() <= MAX_BASE64_CHARS
      && value.length() % 4 == 0 && value.matches("[A-Za-z0-9+/]*={0,2}");
  }

  static String hash(byte[] value) {
    try {
      byte[] digest = MessageDigest.getInstance("SHA-256").digest(value);
      StringBuilder result = new StringBuilder(digest.length * 2);
      for (byte part : digest) result.append(String.format(java.util.Locale.ROOT, "%02x", part & 0xff));
      return result.toString();
    } catch (NoSuchAlgorithmException impossible) {
      throw new IllegalStateException("SHA-256 is unavailable", impossible);
    }
  }

  static String jobKey(String deviceCode, String jobId) {
    return hash((deviceCode + "\u0000" + jobId).getBytes(StandardCharsets.UTF_8));
  }

  static Decision decide(String previousHash, boolean printed, String payloadHash) {
    if (previousHash == null) return Decision.NEW;
    if (!previousHash.equals(payloadHash)) return Decision.CONFLICT;
    return printed ? Decision.PRINTED : Decision.UNKNOWN;
  }
}
