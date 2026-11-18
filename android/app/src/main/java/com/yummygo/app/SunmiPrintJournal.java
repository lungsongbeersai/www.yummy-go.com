package com.yummygo.app;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import java.io.File;

/** Only delivery hashes are stored; no receipt bytes, sales data or offline intent. */
final class SunmiPrintJournal implements AutoCloseable {
  private static final long MAX_DATABASE_BYTES = 128L * 1024 * 1024;
  private final SQLiteDatabase database;

  SunmiPrintJournal(File directory) {
    if (!directory.isDirectory() && !directory.mkdirs()) throw new IllegalStateException("Printer delivery storage is unavailable");
    database = SQLiteDatabase.openOrCreateDatabase(new File(directory, "delivery.sqlite"), null);
    try {
      // FULL commits the unknown reservation before a printer command is sent.
      // Never age out an uncertain/printed ID and silently make it printable again.
      try (Cursor mode = database.rawQuery("PRAGMA journal_mode=DELETE", null)) { mode.moveToFirst(); }
      database.execSQL("PRAGMA synchronous=FULL");
      database.setMaximumSize(MAX_DATABASE_BYTES);
      database.execSQL("CREATE TABLE IF NOT EXISTS delivery (job_key TEXT PRIMARY KEY NOT NULL, payload_hash TEXT NOT NULL, state INTEGER NOT NULL CHECK(state IN (1,2)))");
    } catch (RuntimeException error) { database.close(); throw error; }
  }

  SunmiPrintJobGuard.Decision reserve(String key, String payloadHash) {
    database.beginTransaction();
    try {
      SunmiPrintJobGuard.Decision decision = lookup(key, payloadHash);
      if (decision == SunmiPrintJobGuard.Decision.NEW) {
        ContentValues values = new ContentValues();
        values.put("job_key", key); values.put("payload_hash", payloadHash); values.put("state", 1);
        database.insertOrThrow("delivery", null, values);
      }
      database.setTransactionSuccessful();
      return decision;
    } finally { database.endTransaction(); }
  }

  SunmiPrintJobGuard.Decision lookup(String key, String payloadHash) {
    try (Cursor row = database.query("delivery", new String[] {"payload_hash", "state"}, "job_key=?", new String[] {key}, null, null, null)) {
      return row.moveToFirst()
        ? SunmiPrintJobGuard.decide(row.getString(0), row.getInt(1) == 2, payloadHash)
        : SunmiPrintJobGuard.Decision.NEW;
    }
  }

  void printed(String key, String payloadHash) {
    ContentValues values = new ContentValues(); values.put("state", 2);
    if (database.update("delivery", values, "job_key=? AND payload_hash=?", new String[] {key, payloadHash}) != 1) {
      throw new IllegalStateException("Printer delivery reservation is missing");
    }
  }

  void notSent(String key, String payloadHash) {
    database.delete("delivery", "job_key=? AND payload_hash=? AND state=1", new String[] {key, payloadHash});
  }

  @Override public void close() { database.close(); }
}
