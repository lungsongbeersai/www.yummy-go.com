package com.yummygo.app;

import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.RemoteException;
import android.provider.Settings;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.sunmi.peripheral.printer.InnerPrinterCallback;
import com.sunmi.peripheral.printer.InnerPrinterException;
import com.sunmi.peripheral.printer.InnerPrinterManager;
import com.sunmi.peripheral.printer.InnerResultCallback;
import com.sunmi.peripheral.printer.SunmiPrinterService;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/** SUNMI's inbuilt service is a local transport, never an unprotected LAN server. */
@CapacitorPlugin(name = "SunmiPrinter")
public class SunmiPrinterPlugin extends Plugin {
  private static final String SERVICE_PACKAGE = "woyou.aidlservice.jiuiv5";
  private static final String INTERFACE = "sunmi://builtin";
  private static final long BIND_TIMEOUT_MS = 5_000;
  private static final long INFO_TIMEOUT_MS = 8_000;
  private static final long JOB_TIMEOUT_MS = 120_000;
  private static final int RAW_BLOCK_BYTES = 128 * 1024;
  private static final int MAX_JOINED_CALLS = 4;

  private final Handler main = new Handler(Looper.getMainLooper());
  private final Object bindingLock = new Object();
  private final Object jobLock = new Object();
  private final ThreadPoolExecutor worker = new ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS,
    new ArrayBlockingQueue<>(16), runnable -> new Thread(runnable, "yummy-sunmi-printer"), new ThreadPoolExecutor.AbortPolicy());
  private volatile SunmiPrinterService service;
  private volatile boolean destroyed;
  private boolean binding;
  private CountDownLatch connection = new CountDownLatch(1);
  private Job active;
  // Access only on the worker, including transaction-result callbacks.
  private SunmiPrintJournal journal;

  private static final class Job {
    final String id;
    final String base64;
    final String deviceCode;
    final List<PluginCall> calls = new ArrayList<>();
    final AtomicBoolean transactionFinished = new AtomicBoolean();
    byte[] bytes;
    List<byte[]> blocks;
    String key;
    String payloadHash;
    SunmiPrinterService printer;
    Runnable timeout;
    volatile boolean wrote;
    volatile boolean cancelled;
    volatile boolean commandFailed;
    boolean responsesSettled;
    boolean reserved;
    boolean storageUncertain;
    Job(String id, String base64, String deviceCode, PluginCall call) {
      this.id = id; this.base64 = base64; this.deviceCode = deviceCode; calls.add(call);
    }
  }

  private final InnerPrinterCallback printerConnection = new InnerPrinterCallback() {
    @Override protected void onConnected(SunmiPrinterService printer) {
      synchronized (bindingLock) { service = printer; binding = false; connection.countDown(); }
    }
    @Override protected void onDisconnected() {
      synchronized (bindingLock) { service = null; binding = false; connection.countDown(); }
      Job job;
      synchronized (jobLock) { job = active; }
      if (job != null) rejectJob(job, job.wrote ? "SUNMI_UNKNOWN" : "SUNMI_NOT_SENT",
        "The inbuilt printer disconnected", job.wrote, !job.wrote);
    }
  };

  @PluginMethod public void getInfo(PluginCall call) {
    AtomicBoolean settled = new AtomicBoolean();
    Runnable timeout = () -> { if (settled.compareAndSet(false, true)) call.resolve(unavailableInfo("SUNMI_INFO_TIMEOUT")); };
    main.postDelayed(timeout, INFO_TIMEOUT_MS);
    try {
      worker.execute(() -> {
        JSObject result;
        try { result = printerInfo(); }
        catch (Exception unavailable) { result = unavailableInfo("SUNMI_UNAVAILABLE"); }
        if (settled.compareAndSet(false, true)) { main.removeCallbacks(timeout); call.resolve(result); }
      });
    } catch (RejectedExecutionException busy) {
      main.removeCallbacks(timeout);
      if (settled.compareAndSet(false, true)) call.resolve(unavailableInfo("SUNMI_BUSY"));
    }
  }

  @PluginMethod public void printEscpos(PluginCall call) {
    String jobId = call.getString("jobId");
    String payload = call.getString("escposBase64");
    String expected = call.getString("expectedDeviceCode");
    String owner = deviceCode();
    if (!SunmiPrintJobGuard.validJobId(jobId) || !SunmiPrintJobGuard.validBase64(payload)) {
      reject(call, "SUNMI_NOT_SENT", "Invalid or oversized inbuilt print job", "not_sent", jobId); return;
    }
    if (owner.isEmpty() || !owner.equals(expected)) {
      reject(call, "SUNMI_NOT_SENT", "This print job belongs to another device", "not_sent", jobId); return;
    }
    Job job;
    synchronized (jobLock) {
      if (destroyed) { reject(call, "SUNMI_NOT_SENT", "The printer connection is closed", "not_sent", jobId); return; }
      if (active != null) {
        if (active.id.equals(jobId) && !active.base64.equals(payload)) {
          reject(call, "SUNMI_JOB_CONFLICT", "A print job ID cannot be reused with different content", "unknown", jobId); return;
        }
        if (active.id.equals(jobId) && active.base64.equals(payload)) {
          if (active.responsesSettled) { reject(call, "SUNMI_UNKNOWN", "The previous print result is unconfirmed; do not resend automatically", "unknown", jobId); return; }
          if (active.calls.size() >= MAX_JOINED_CALLS) { reject(call, "SUNMI_BUSY", "This print job is already running", active.wrote ? "unknown" : "not_sent", jobId); return; }
          active.calls.add(call); return;
        }
        reject(call, "SUNMI_BUSY", "The inbuilt printer is processing another job", "not_sent", jobId); return;
      }
      job = new Job(jobId, payload, owner, call); active = job;
    }
    job.timeout = () -> rejectJob(job, job.wrote ? "SUNMI_UNKNOWN" : "SUNMI_NOT_SENT",
      "The inbuilt printer did not confirm completion; do not resend automatically", job.wrote, !job.wrote);
    main.postDelayed(job.timeout, JOB_TIMEOUT_MS);
    try { worker.execute(() -> beginJob(job)); }
    catch (RejectedExecutionException busy) { rejectJob(job, "SUNMI_NOT_SENT", "The printer is busy", false, true); }
  }

  private void beginJob(Job job) {
    try {
      if (!canContinue(job)) return;
      job.bytes = Base64.decode(job.base64, Base64.NO_WRAP);
      if (job.bytes.length == 0 || job.bytes.length > SunmiPrintJobGuard.MAX_RAW_BYTES
        || !Base64.encodeToString(job.bytes, Base64.NO_WRAP).equals(job.base64)) {
        throw new IllegalArgumentException("Invalid or oversized inbuilt print job");
      }
      job.key = SunmiPrintJobGuard.jobKey(job.deviceCode, job.id);
      job.payloadHash = SunmiPrintJobGuard.hash(job.bytes);
      // Replay a durable success even when the printer is now out of paper or
      // disconnected. An unreadable history must never become a fresh send.
      job.storageUncertain = true;
      SunmiPrintJobGuard.Decision previous = journal().lookup(job.key, job.payloadHash);
      job.storageUncertain = false;
      if (previous == SunmiPrintJobGuard.Decision.PRINTED) { resolvePrinted(job, true); return; }
      if (previous == SunmiPrintJobGuard.Decision.UNKNOWN || previous == SunmiPrintJobGuard.Decision.CONFLICT) {
        rejectJob(job, previous == SunmiPrintJobGuard.Decision.CONFLICT ? "SUNMI_JOB_CONFLICT" : "SUNMI_UNKNOWN",
          "This print job has already been attempted; use the explicit manual reprint flow", true, true); return;
      }
      job.blocks = SunmiEscposChunks.split(job.bytes, RAW_BLOCK_BYTES);
      job.printer = ensureService();
      if (job.printer == null || !InnerPrinterManager.getInstance().hasPrinter(job.printer)) {
        rejectJob(job, "SUNMI_NOT_SENT", "No SUNMI inbuilt printer is available", false, true); return;
      }
      int state = job.printer.updatePrinterState();
      if (state != 1) { rejectJob(job, "SUNMI_NOT_SENT", statusMessage(state), false, true); return; }
      // Recheck both lifecycle and owner after asynchronous binding/status calls.
      if (!canContinue(job)) return;
      if (!job.deviceCode.equals(deviceCode())) throw new IllegalStateException("The printer device identity changed");
      job.storageUncertain = true;
      SunmiPrintJobGuard.Decision decision = journal().reserve(job.key, job.payloadHash);
      job.storageUncertain = false;
      if (decision == SunmiPrintJobGuard.Decision.PRINTED) { resolvePrinted(job, true); return; }
      if (decision == SunmiPrintJobGuard.Decision.UNKNOWN || decision == SunmiPrintJobGuard.Decision.CONFLICT) {
        rejectJob(job, decision == SunmiPrintJobGuard.Decision.CONFLICT ? "SUNMI_JOB_CONFLICT" : "SUNMI_UNKNOWN",
          "This print job has already been attempted; use the explicit manual reprint flow", true, true); return;
      }
      job.reserved = true;
      if (!canContinue(job)) { journal().notSent(job.key, job.payloadHash); return; }
      job.printer.enterPrinterBuffer(true);
      enqueueBufferedJob(job);
    } catch (Exception error) {
      boolean unknown = job.wrote || job.storageUncertain;
      if (!unknown && job.reserved) {
        try { journal().notSent(job.key, job.payloadHash); }
        catch (RuntimeException storageFailure) { unknown = true; }
      }
      rejectJob(job, unknown ? "SUNMI_UNKNOWN" : "SUNMI_NOT_SENT",
        unknown ? "The print result is unconfirmed; do not resend automatically" : "The inbuilt printer could not start the job",
        unknown, !job.wrote);
    }
  }

  private void enqueueBufferedJob(Job job) {
    if (!canContinue(job)) return;
    InnerResultCallback commandCallback = new InnerResultCallback() {
      @Override public void onRunResult(boolean success) { if (!success) commandFailed(job); }
      @Override public void onReturnString(String value) {}
      @Override public void onRaiseException(int code, String message) { commandFailed(job); }
      @Override public void onPrintResult(int code, String message) { if (code != 0) commandFailed(job); }
    };
    try {
      SunmiBufferedTransaction.enqueue(job.blocks, new SunmiBufferedTransaction.Printer() {
        @Override public boolean active() { return canContinue(job); }
        @Override public void send(byte[] block) throws RemoteException {
          synchronized (jobLock) {
            if (destroyed || active != job || job.cancelled) return;
            // Fence before IPC. A timeout cannot release the physical printer
            // to a second job between the lifecycle check and Binder send.
            job.wrote = true;
          }
          job.printer.sendRAWData(block, commandCallback);
        }
        @Override public void commit() throws RemoteException {
          if (!canContinue(job)) return;
          // Commands may report onRunResult only when this buffer executes.
          // Their callbacks cannot gate the submission that makes them run.
          // Only onPrintResult(0) below confirms a completed physical receipt.
          job.printer.exitPrinterBufferWithCallback(true, transactionCallback(job));
        }
      });
    } catch (Exception error) {
      rejectJob(job, "SUNMI_UNKNOWN", "The print result is unconfirmed; do not resend automatically", true, false);
    }
  }

  private InnerResultCallback transactionCallback(Job job) {
    return new InnerResultCallback() {
      @Override public void onRunResult(boolean success) { if (!success) commandFailed(job); }
      @Override public void onReturnString(String value) {}
      @Override public void onRaiseException(int code, String message) { commandFailed(job); }
      @Override public void onPrintResult(int code, String message) {
        if (!job.transactionFinished.compareAndSet(false, true)) return;
        continueOnWorker(job, () -> {
          if (code != 0 || job.commandFailed) {
            rejectJob(job, "SUNMI_UNKNOWN", "The printer did not confirm the complete receipt", true, true); return;
          }
          try { journal().printed(job.key, job.payloadHash); resolvePrinted(job, false); }
          catch (RuntimeException storageFailure) {
            rejectJob(job, "SUNMI_UNKNOWN", "The printer completed but its delivery record could not be saved", true, true);
          }
        });
      }
    };
  }

  private void commandFailed(Job job) {
    job.commandFailed = true;
    rejectJob(job, "SUNMI_UNKNOWN", "The printer rejected part of the receipt; do not resend automatically", true, false);
  }

  private void continueOnWorker(Job job, Runnable action) {
    try { worker.execute(action); }
    catch (RejectedExecutionException busy) {
      rejectJob(job, "SUNMI_UNKNOWN", "The print result is unconfirmed; do not resend automatically", true, false);
    }
  }

  private boolean canContinue(Job job) {
    synchronized (jobLock) { return !destroyed && active == job && !job.cancelled; }
  }

  private SunmiPrintJournal journal() {
    if (journal == null) journal = new SunmiPrintJournal(new File(getContext().getNoBackupFilesDir(), "sunmi-printer"));
    return journal;
  }

  private void resolvePrinted(Job job, boolean replayed) {
    List<PluginCall> calls;
    synchronized (jobLock) {
      calls = job.responsesSettled ? new ArrayList<>() : new ArrayList<>(job.calls);
      job.responsesSettled = true; job.calls.clear();
      if (active == job) active = null;
    }
    if (job.timeout != null) main.removeCallbacks(job.timeout);
    for (PluginCall call : calls) {
      JSObject result = new JSObject(); result.put("deliveryState", "printed");
      result.put("jobId", job.id); result.put("replayed", replayed); call.resolve(result);
    }
  }

  private void rejectJob(Job job, String code, String message, boolean unknown, boolean releaseQueue) {
    List<PluginCall> calls;
    synchronized (jobLock) {
      job.cancelled = true;
      calls = job.responsesSettled ? new ArrayList<>() : new ArrayList<>(job.calls);
      job.responsesSettled = true; job.calls.clear();
      // A timeout/IPC error after bytes were sent keeps the physical queue
      // paused until a definitive transaction result or the next app session.
      if (releaseQueue && active == job) active = null;
    }
    if (job.timeout != null) main.removeCallbacks(job.timeout);
    for (PluginCall call : calls) reject(call, code, message, unknown ? "unknown" : "not_sent", job.id);
  }

  private void reject(PluginCall call, String code, String message, String state, String jobId) {
    JSObject data = new JSObject(); data.put("delivery_state", state); data.put("jobId", jobId);
    call.reject(message, code, data);
  }

  private JSObject printerInfo() throws Exception {
    SunmiPrinterService printer = ensureService();
    if (printer == null || !InnerPrinterManager.getInstance().hasPrinter(printer)) return unavailableInfo("SUNMI_UNAVAILABLE");
    JSObject result = baseInfo();
    int state = printer.updatePrinterState();
    boolean busy;
    boolean paused;
    synchronized (jobLock) {
      busy = active != null;
      paused = busy && active.responsesSettled;
    }
    result.put("supported", true); result.put("connected", true); result.put("busy", busy);
    // Readiness advertises whether the host can receive queued jobs. The
    // frontend serializes SDK submissions; a healthy in-flight receipt must
    // not make later remote jobs wait for the next discovery poll.
    result.put("ready", SunmiPrintJobGuard.acceptsQueuedWork(state, busy, paused)); result.put("stateCode", state);
    result.put("statusMessage", paused ? "The inbuilt print result is unconfirmed; the queue is paused"
      : state == 1 && busy ? "The inbuilt printer is processing a job and accepting queued work" : statusMessage(state));
    try { int paper = printer.getPrinterPaper(); result.put("paperWidthMm", paper == 1 ? 58 : paper == 2 ? 80 : JSObject.NULL); }
    catch (RemoteException unsupported) { result.put("paperWidthMm", JSObject.NULL); }
    try { result.put("serialNumber", printer.getPrinterSerialNo()); } catch (RemoteException unsupported) { /* Optional metadata. */ }
    try { result.put("printerModel", printer.getPrinterModal()); } catch (RemoteException unsupported) { /* Optional metadata. */ }
    try { result.put("serviceVersion", getContext().getPackageManager().getPackageInfo(SERVICE_PACKAGE, 0).versionName); }
    catch (PackageManager.NameNotFoundException unavailable) { /* Optional metadata. */ }
    return result;
  }

  private JSObject baseInfo() {
    JSObject result = new JSObject(); result.put("interfaceValue", INTERFACE);
    result.put("deviceCode", deviceCode()); result.put("model", Build.MODEL);
    return result;
  }

  private JSObject unavailableInfo(String reason) {
    JSObject result = baseInfo(); result.put("supported", false); result.put("connected", false);
    result.put("ready", false); result.put("busy", false); result.put("stateCode", JSObject.NULL);
    result.put("paperWidthMm", JSObject.NULL); result.put("reason", reason); return result;
  }

  private String deviceCode() {
    String identifier = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
    if (identifier == null || identifier.trim().isEmpty()) return "";
    String slug = identifier.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
    return slug.isEmpty() ? "" : "android-native-" + slug;
  }

  private SunmiPrinterService ensureService() throws InterruptedException {
    if (destroyed) return null;
    if (service != null) return service;
    try { getContext().getPackageManager().getPackageInfo(SERVICE_PACKAGE, 0); }
    catch (PackageManager.NameNotFoundException unsupported) { return null; }
    CountDownLatch waiting;
    synchronized (bindingLock) {
      if (service != null) return service;
      if (!binding) {
        binding = true; connection = new CountDownLatch(1);
        main.post(() -> {
          try {
            if (destroyed || !InnerPrinterManager.getInstance().bindService(getContext().getApplicationContext(), printerConnection)) {
              synchronized (bindingLock) { binding = false; connection.countDown(); }
            }
          } catch (InnerPrinterException | RuntimeException unavailable) {
            synchronized (bindingLock) { binding = false; connection.countDown(); }
          }
        });
      }
      waiting = connection;
    }
    waiting.await(BIND_TIMEOUT_MS, TimeUnit.MILLISECONDS);
    return destroyed ? null : service;
  }

  private static String statusMessage(int state) {
    switch (state) {
      case 1: return "The inbuilt printer is ready";
      case 2: return "The inbuilt printer is initializing";
      case 4: return "The inbuilt printer is out of paper";
      case 5: return "The inbuilt printer is overheating";
      case 6: return "The inbuilt printer cover is open";
      case 7: return "The inbuilt printer cutter needs attention";
      case 8: return "The inbuilt printer cutter is recovering";
      case 9: return "The inbuilt printer could not detect the black mark";
      default: return "The inbuilt printer is unavailable (status " + state + ")";
    }
  }

  @Override protected void handleOnDestroy() {
    destroyed = true;
    Job job;
    synchronized (jobLock) { job = active; }
    if (job != null) rejectJob(job, job.wrote ? "SUNMI_UNKNOWN" : "SUNMI_NOT_SENT", "The printer connection closed", job.wrote, true);
    synchronized (bindingLock) { connection.countDown(); }
    try { InnerPrinterManager.getInstance().unBindService(getContext().getApplicationContext(), printerConnection); }
    catch (InnerPrinterException | RuntimeException unavailable) { /* An unbound service needs no cleanup. */ }
    try { worker.execute(() -> { if (journal != null) { journal.close(); journal = null; } }); }
    catch (RejectedExecutionException busy) { /* Pending reservations remain unknown on disk. */ }
    worker.shutdown();
    super.handleOnDestroy();
  }
}
