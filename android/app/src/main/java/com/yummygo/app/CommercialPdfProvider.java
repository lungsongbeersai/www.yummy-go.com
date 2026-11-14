package com.yummygo.app;

import android.net.Uri;
import android.os.ParcelFileDescriptor;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/** Separate from Capacitor camera's legacy, wider provider paths. */
public class CommercialPdfProvider extends FileProvider {
  @Override
  public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
    // Expiry is enforced even if Android stopped the Activity's cleanup timer.
    if (!"r".equals(mode) || !hasCurrentLease(uri)) {
      throw new FileNotFoundException("The shared PDF is no longer available");
    }
    return super.openFile(uri,mode);
  }

  private boolean hasCurrentLease(Uri uri) {
    List<String> parts=uri.getPathSegments();
    if (getContext()==null || parts.size()!=3 || !"commercial_pdf".equals(parts.get(0))
      || !parts.get(1).matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
      || !parts.get(2).equals(CommercialPdfStore.safeFileName(parts.get(2)))) return false;
    File marker=new File(new File(new File(getContext().getCacheDir(),"commercial-pdf"),parts.get(1)),".shared");
    if (!marker.isFile() || marker.length()>20) return false;
    try (FileInputStream input=new FileInputStream(marker)) {
      byte[] bytes=new byte[(int)marker.length()];
      if (input.read(bytes)!=bytes.length) return false;
      long expiresAt=Long.parseLong(new String(bytes,StandardCharsets.US_ASCII));
      long now=System.currentTimeMillis();
      return expiresAt>now && expiresAt<=now+CommercialPdfStore.SHARED_TTL_MS;
    } catch (IOException | NumberFormatException ignored) { return false; }
  }
}
