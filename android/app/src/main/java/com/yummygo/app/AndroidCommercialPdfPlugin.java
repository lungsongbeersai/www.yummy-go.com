package com.yummygo.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
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

@CapacitorPlugin(name="AndroidCommercialPdf")
public class AndroidCommercialPdfPlugin extends Plugin {
  private CommercialPdfStore store;
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
      main.postDelayed(this,30_000);
    }
  };

  @Override public void load() {
    try { store=new CommercialPdfStore(new File(getContext().getCacheDir(),"commercial-pdf"),System::currentTimeMillis,this::revoke); }
    catch (IOException ignored) { store=null; }
    main.post(cleanup);
  }

  @PluginMethod public void beginPdf(PluginCall call) {
    try {
      String name=call.getString("fileName");
      Double size=call.getDouble("sizeBytes");
      if (name==null || name.length()>512 || size==null || !Double.isFinite(size) || size!=Math.floor(size)
        || size<5 || size>CommercialPdfStore.MAX_BYTES) throw invalid();
      CommercialPdfStore.Entry entry=available().begin(name,size.longValue());
      JSObject result=new JSObject();result.put("handle",entry.handle);call.resolve(result);
    } catch (Exception error) { reject(call,error); }
  }

  @PluginMethod public void appendPdf(PluginCall call) {
    try {
      Double index=call.getDouble("index");
      String encoded=call.getString("base64");
      if (index==null || !Double.isFinite(index) || index<0 || index>Integer.MAX_VALUE || index!=Math.floor(index)
        || encoded==null || encoded.isEmpty() || encoded.length()>((CommercialPdfStore.MAX_CHUNK_BYTES+2)/3)*4
        || encoded.length()%4!=0 || !encoded.matches("[A-Za-z0-9+/]*={0,2}")) throw invalid();
      // android.util.Base64 is available on the app's minimum Android API 24.
      byte[] bytes;
      try { bytes=Base64.decode(encoded,Base64.NO_WRAP); }
      catch (IllegalArgumentException ignored) { throw invalid(); }
      if (!Base64.encodeToString(bytes,Base64.NO_WRAP).equals(encoded)) throw invalid();
      CommercialPdfStore.Entry entry=available().append(call.getString("handle"),index.intValue(),bytes);
      JSObject result=new JSObject();result.put("nextIndex",entry.nextIndex);result.put("receivedBytes",entry.receivedBytes);call.resolve(result);
    } catch (Exception error) { reject(call,error); }
  }

  @PluginMethod public void finishPdf(PluginCall call) {
    try {
      CommercialPdfStore.Entry entry=available().finish(call.getString("handle"));
      JSObject result=new JSObject();result.put("handle",entry.handle);result.put("sizeBytes",entry.sizeBytes);call.resolve(result);
    } catch (Exception error) { reject(call,error); }
  }

  @PluginMethod public void sharePdf(PluginCall call) {
    main.post(() -> {
      try {
        synchronized (this) {
          if (pendingSave!=null) { call.reject("A PDF destination picker is already open","PDF_BUSY");return; }
        }
        CommercialPdfStore.Entry entry=available().ready(call.getString("handle"));
        Uri uri=uri(entry.file);
        Intent send=new Intent(Intent.ACTION_SEND).setType("application/pdf")
          .putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        send.setClipData(ClipData.newRawUri("PDF",uri));
        Intent chooser=Intent.createChooser(send,"Share PDF").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        chooser.setClipData(ClipData.newRawUri("PDF",uri));
        available().markShared(entry.handle);
        try { getActivity().startActivity(chooser); }
        catch (RuntimeException error) { store.discard(entry.handle); throw error; }
        // Opening Android's chooser does not prove that an account received it.
        JSObject result=new JSObject();result.put("status","opened");call.resolve(result);
      } catch (Exception error) { reject(call,error); }
    });
  }

  @PluginMethod public void savePdf(PluginCall call) {
    main.post(() -> {
      try {
        CommercialPdfStore.Entry entry=available().ready(call.getString("handle"));
        synchronized (this) {
          if (pendingSave!=null) { call.reject("A PDF destination picker is already open","PDF_BUSY");return; }
          pendingSave=new PendingSave(entry.handle,call);
        }
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
          .setType("application/pdf").putExtra(Intent.EXTRA_TITLE,entry.file.getName());
        try { startActivityForResult(call,intent,"onSavePdfResult"); }
        catch (RuntimeException error) { synchronized (this) { pendingSave=null; } throw error; }
      } catch (Exception error) { reject(call,error); }
    });
  }

  @ActivityCallback private void onSavePdfResult(PluginCall ignored,ActivityResult result) {
    PendingSave operation;
    synchronized (this) { operation=pendingSave; }
    if (operation==null) return;
    Uri destination=result.getData()==null ? null : result.getData().getData();
    if (destroyed || operation.cancelled || result.getResultCode()!=Activity.RESULT_OK || destination==null) {
      completeSave(operation,"cancelled",null);clearSave(operation);return;
    }
    if (!"content".equals(destination.getScheme())) { completeSave(operation,null,invalid());clearSave(operation);return; }
    writes.execute(() -> {
      boolean wrote=false;
      try {
        if (destroyed || operation.cancelled || !available().isReady(operation.handle)) {
          completeSave(operation,"cancelled",null);return;
        }
        try (OutputStream output=getContext().getContentResolver().openOutputStream(destination,"wt")) {
          if (output==null) throw new IOException("PDF destination is unavailable");
          wrote=true;
          available().copyTo(operation.handle,output);
          output.flush();
        }
        if (destroyed || operation.cancelled || !available().isReady(operation.handle)) throw new CommercialPdfStore.PdfException("PDF_CANCELLED","PDF save cancelled");
        completeSave(operation,"saved",null);
      } catch (Exception error) {
        if (wrote) {
          try { getContext().getContentResolver().delete(destination,null,null); } catch (RuntimeException ignoredDelete) { /* Best effort for a newly created, incomplete output. */ }
        }
        if (operation.cancelled || error instanceof CommercialPdfStore.PdfException && "PDF_CANCELLED".equals(((CommercialPdfStore.PdfException)error).code)) completeSave(operation,"cancelled",null);
        else completeSave(operation,null,error);
      } finally { clearSave(operation); }
    });
  }

  @PluginMethod public void releasePdf(PluginCall call) {
    if (store!=null) store.release(call.getString("handle"));
    call.resolve();
  }

  @PluginMethod public void discardPdf(PluginCall call) {
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
  private synchronized void clearSave(PendingSave operation) { if (pendingSave==operation) pendingSave=null; }

  private CommercialPdfStore available() throws IOException {
    if (destroyed || store==null) throw new CommercialPdfStore.PdfException("PDF_UNAVAILABLE","Private PDF storage is unavailable");
    return store;
  }
  private Uri uri(File file) { return FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".commercialpdf",file); }
  private void revoke(File file) {
    try { getContext().revokeUriPermission(uri(file),Intent.FLAG_GRANT_READ_URI_PERMISSION); }
    catch (RuntimeException ignored) { /* Expired or already revoked; never log a private path. */ }
  }
  private static CommercialPdfStore.PdfException invalid() { return new CommercialPdfStore.PdfException("PDF_INVALID","Invalid PDF transfer"); }
  private static void reject(PluginCall call,Exception error) {
    if (error instanceof CommercialPdfStore.PdfException) call.reject(error.getMessage(),((CommercialPdfStore.PdfException)error).code);
    else call.reject("Unable to save or share this PDF","PDF_FAILED");
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
