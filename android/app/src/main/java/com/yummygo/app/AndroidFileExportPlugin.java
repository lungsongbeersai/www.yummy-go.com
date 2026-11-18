package com.yummygo.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name="AndroidFileExport")
public class AndroidFileExportPlugin extends Plugin {
  private NativeExportStore store;
  private final Handler main=new Handler(Looper.getMainLooper());
  private final ExecutorService writes=Executors.newSingleThreadExecutor();
  private volatile boolean destroyed;
  private PendingSave pendingSave;
  private static final class PendingSave {
    final String handle;
    final PluginCall call;
    volatile boolean cancelled;
    boolean resolved;
    PendingSave(String handle,PluginCall call) { this.handle=handle; this.call=call; }
  }
  private final Runnable cleanup=new Runnable() {
    @Override public void run() {
      if (destroyed) return;
      if (store!=null) store.prune();
      synchronized (AndroidFileExportPlugin.this) {
        if (pendingSave!=null && store!=null && !store.isReady(pendingSave.handle)) {
          pendingSave.cancelled=true;
          completeSave(pendingSave,"cancelled",null);
        }
      }
      main.postDelayed(this,30_000);
    }
  };

  @Override public void load() {
    try { store=new NativeExportStore(new File(getContext().getCacheDir(),"file-export"),System::currentTimeMillis); }
    catch (IOException ignored) { store=null; }
    main.post(cleanup);
  }

  @PluginMethod public void beginFile(PluginCall call) {
    try {
      String name=call.getString("fileName");
      String mimeType=call.getString("mimeType");
      Double size=call.getDouble("sizeBytes");
      if (name==null || mimeType==null || name.length()>512 || size==null || !Double.isFinite(size) || size!=Math.floor(size)
        || size<8 || size>NativeExportStore.MAX_BYTES) throw invalid();
      NativeExportStore.Entry entry=available().begin(name,mimeType,size.longValue());
      JSObject result=new JSObject();result.put("handle",entry.handle);call.resolve(result);
    } catch (Exception error) { reject(call,error); }
  }

  @PluginMethod public void appendFile(PluginCall call) {
    try {
      Double index=call.getDouble("index");
      String encoded=call.getString("base64");
      if (index==null || !Double.isFinite(index) || index<0 || index>Integer.MAX_VALUE || index!=Math.floor(index)
        || encoded==null || encoded.isEmpty() || encoded.length()>((NativeExportStore.MAX_CHUNK_BYTES+2)/3)*4
        || encoded.length()%4!=0 || !encoded.matches("[A-Za-z0-9+/]*={0,2}")) throw invalid();
      // android.util.Base64 is available on the app's minimum Android API 24.
      byte[] bytes;
      try { bytes=Base64.decode(encoded,Base64.NO_WRAP); }
      catch (IllegalArgumentException ignored) { throw invalid(); }
      if (!Base64.encodeToString(bytes,Base64.NO_WRAP).equals(encoded)) throw invalid();
      NativeExportStore.Entry entry=available().append(call.getString("handle"),index.intValue(),bytes);
      JSObject result=new JSObject();result.put("nextIndex",entry.nextIndex);result.put("receivedBytes",entry.receivedBytes);call.resolve(result);
    } catch (Exception error) { reject(call,error); }
  }

  @PluginMethod public void finishFile(PluginCall call) {
    try {
      NativeExportStore.Entry entry=available().finish(call.getString("handle"));
      JSObject result=new JSObject();result.put("handle",entry.handle);result.put("sizeBytes",entry.sizeBytes);call.resolve(result);
    } catch (Exception error) { reject(call,error); }
  }

  @PluginMethod public void saveFile(PluginCall call) {
    main.post(() -> {
      try {
        NativeExportStore.Entry entry=available().ready(call.getString("handle"));
        synchronized (this) {
          if (pendingSave!=null) { call.reject("A file destination picker is already open","FILE_BUSY");return; }
          pendingSave=new PendingSave(entry.handle,call);
        }
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
          .setType(entry.mimeType).putExtra(Intent.EXTRA_TITLE,entry.file.getName());
        try { startActivityForResult(call,intent,"onSaveFileResult"); }
        catch (RuntimeException error) { synchronized (this) { pendingSave=null; } throw error; }
      } catch (Exception error) { reject(call,error); }
    });
  }

  @ActivityCallback private void onSaveFileResult(PluginCall ignored,ActivityResult result) {
    PendingSave operation;
    synchronized (this) { operation=pendingSave; }
    if (operation==null) return;
    Uri destination=result.getData()==null ? null : result.getData().getData();
    if (destroyed || operation.cancelled || result.getResultCode()!=Activity.RESULT_OK || destination==null) {
      completeSave(operation,"cancelled",null);clearSave(operation);return;
    }
    if (!"content".equals(destination.getScheme())) { completeSave(operation,null,invalid());clearSave(operation);return; }
    try { writes.execute(() -> {
      boolean wrote=false;
      try {
        if (destroyed || operation.cancelled || !available().isReady(operation.handle)) {
          completeSave(operation,"cancelled",null);return;
        }
        try (OutputStream output=getContext().getContentResolver().openOutputStream(destination,"wt")) {
          if (output==null) throw new IOException("File destination is unavailable");
          wrote=true;
          available().copyTo(operation.handle,output);
          output.flush();
        }
        if (destroyed || operation.cancelled || !available().isReady(operation.handle)) throw new NativeExportStore.ExportException("FILE_CANCELLED","File save cancelled");
        completeSave(operation,"saved",null);
      } catch (Exception error) {
        if (wrote) {
          try { getContext().getContentResolver().delete(destination,null,null); } catch (RuntimeException ignoredDelete) { /* Best effort for a newly created, incomplete output. */ }
        }
        if (operation.cancelled || error instanceof NativeExportStore.ExportException && "FILE_CANCELLED".equals(((NativeExportStore.ExportException)error).code)) completeSave(operation,"cancelled",null);
        else completeSave(operation,null,error);
      } finally { clearSave(operation); }
    }); } catch (RuntimeException error) {
      completeSave(operation,"cancelled",null);
      clearSave(operation);
    }
  }

  @PluginMethod public void discardFile(PluginCall call) {
    String handle=call.getString("handle");
    if (store!=null) store.discard(handle);
    synchronized (this) {
      if (pendingSave!=null && pendingSave.handle.equals(handle)) {
        pendingSave.cancelled=true;
        completeSave(pendingSave,"cancelled",null);
      }
    }
    call.resolve();
  }

  private synchronized void completeSave(PendingSave operation,String status,Exception error) {
    if (operation.resolved) return;
    operation.resolved=true;
    if (error!=null) reject(operation.call,error);
    else { JSObject value=new JSObject();value.put("status",status);operation.call.resolve(value); }
  }
  private synchronized void clearSave(PendingSave operation) {
    if (pendingSave==operation) pendingSave=null;
    if (store!=null) store.discard(operation.handle);
  }

  private NativeExportStore available() throws IOException {
    if (destroyed || store==null) throw new NativeExportStore.ExportException("FILE_UNAVAILABLE","Private file storage is unavailable");
    return store;
  }
  private static NativeExportStore.ExportException invalid() { return new NativeExportStore.ExportException("FILE_INVALID","Invalid file transfer"); }
  private static void reject(PluginCall call,Exception error) {
    if (error instanceof NativeExportStore.ExportException) call.reject(error.getMessage(),((NativeExportStore.ExportException)error).code);
    else call.reject("Unable to save this export","FILE_FAILED");
  }

  @Override protected void handleOnDestroy() {
    destroyed=true;
    main.removeCallbacks(cleanup);
    synchronized (this) {
      if (pendingSave!=null) { pendingSave.cancelled=true;completeSave(pendingSave,"cancelled",null); }
    }
    if (store!=null) store.close();
    writes.shutdownNow();
  }
}
