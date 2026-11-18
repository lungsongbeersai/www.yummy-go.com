package com.yummygo.app;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Keep SDK calls below Binder limits without cutting an ESC/POS command in half. */
final class SunmiEscposChunks {
  private SunmiEscposChunks() {}

  static List<byte[]> split(byte[] bytes, int maximum) {
    if (bytes == null || bytes.length == 0 || maximum < 16) throw invalid();
    List<byte[]> result = new ArrayList<>();
    ByteArrayOutputStream pending = new ByteArrayOutputStream(maximum);
    for (int offset = 0; offset < bytes.length;) {
      int length = commandLength(bytes, offset);
      if (length == 0) {
        // An unfamiliar short command remains intact. Do not guess where a
        // large vendor-specific command or its binary arguments may end.
        if (bytes.length <= maximum) return java.util.Collections.singletonList(bytes);
        throw new IllegalArgumentException("The large ESC/POS command stream cannot be split safely");
      }
      if (length <= maximum) append(result, pending, Arrays.copyOfRange(bytes, offset, offset + length), maximum);
      else if (raster(bytes, offset)) {
        int width = unsigned16(bytes, offset + 4);
        int height = unsigned16(bytes, offset + 6);
        int rowsPerBlock = (maximum - 8) / width;
        if (rowsPerBlock < 1) throw invalid();
        for (int row = 0; row < height; row += rowsPerBlock) {
          int rows = Math.min(rowsPerBlock, height - row);
          byte[] band = new byte[8 + width * rows];
          System.arraycopy(bytes, offset, band, 0, 8);
          band[6] = (byte) (rows & 0xff); band[7] = (byte) ((rows >> 8) & 0xff);
          System.arraycopy(bytes, offset + 8 + width * row, band, 8, width * rows);
          append(result, pending, band, maximum);
        }
      } else throw new IllegalArgumentException("The ESC/POS command exceeds the inbuilt printer transport limit");
      offset += length;
    }
    if (pending.size() > 0) result.add(pending.toByteArray());
    return result;
  }

  private static void append(List<byte[]> result, ByteArrayOutputStream pending, byte[] command, int maximum) {
    if (pending.size() + command.length > maximum && pending.size() > 0) {
      result.add(pending.toByteArray()); pending.reset();
    }
    pending.write(command, 0, command.length);
  }

  private static int commandLength(byte[] bytes, int offset) {
    int first = bytes[offset] & 0xff;
    if (first != 0x1b && first != 0x1d) {
      int end = offset + 1;
      while (end < bytes.length && bytes[end] != 0x1b && bytes[end] != 0x1d) end++;
      return end - offset;
    }
    require(bytes, offset, 2);
    int second = bytes[offset + 1] & 0xff;
    if (first == 0x1b) {
      if (second == 0x40) return 2; // initialize
      if (second == 0x70) return fixed(bytes, offset, 5); // drawer pulse
      if (second == 0x42) return fixed(bytes, offset, 4); // buzzer
      if (second == 0x61 || second == 0x33 || second == 0x4a || second == 0x64
        || second == 0x45 || second == 0x2d || second == 0x4d || second == 0x74 || second == 0x21) {
        return fixed(bytes, offset, 3);
      }
      return 0;
    }
    if (second == 0x4c || second == 0x50) return fixed(bytes, offset, 4); // margin / motion units
    if (second == 0x72 || second == 0x21 || second == 0x42) return fixed(bytes, offset, 3);
    if (second == 0x56) {
      require(bytes, offset, 3);
      int mode = bytes[offset + 2] & 0xff;
      return fixed(bytes, offset, mode == 0x41 || mode == 0x42 ? 4 : 3);
    }
    if (second == 0x28) { // length-delimited GS ( k QR / GS ( L graphics
      require(bytes, offset, 5);
      int kind = bytes[offset + 2] & 0xff;
      if (kind != 0x6b && kind != 0x4c) return 0;
      return fixed(bytes, offset, 5 + unsigned16(bytes, offset + 3));
    }
    if (second == 0x76) {
      require(bytes, offset, 3);
      if ((bytes[offset + 2] & 0xff) != 0x30) return 0;
      require(bytes, offset, 8);
      int width = unsigned16(bytes, offset + 4), rows = unsigned16(bytes, offset + 6);
      long length = 8L + (long) width * rows;
      if (width < 1 || rows < 1 || length > Integer.MAX_VALUE) throw invalid();
      return fixed(bytes, offset, (int) length);
    }
    return 0;
  }

  private static boolean raster(byte[] bytes, int offset) {
    return bytes[offset] == 0x1d && bytes[offset + 1] == 0x76 && bytes[offset + 2] == 0x30;
  }
  private static int unsigned16(byte[] bytes, int offset) { return (bytes[offset] & 0xff) | ((bytes[offset + 1] & 0xff) << 8); }
  private static int fixed(byte[] bytes, int offset, int length) { require(bytes, offset, length); return length; }
  private static void require(byte[] bytes, int offset, int length) {
    if (length < 1 || (long) offset + length > bytes.length) throw invalid();
  }
  private static IllegalArgumentException invalid() { return new IllegalArgumentException("The ESC/POS command stream is incomplete or invalid"); }
}
