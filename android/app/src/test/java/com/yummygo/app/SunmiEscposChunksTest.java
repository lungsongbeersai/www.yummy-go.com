package com.yummygo.app;

import static org.junit.Assert.*;
import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.List;
import org.junit.Test;

public class SunmiEscposChunksTest {
  private byte[] raster(int width, int rows) {
    byte[] value = new byte[8 + width * rows];
    value[0] = 0x1d; value[1] = 0x76; value[2] = 0x30;
    value[4] = (byte) width; value[5] = (byte) (width >> 8);
    value[6] = (byte) rows; value[7] = (byte) (rows >> 8);
    for (int index = 8; index < value.length; index++) value[index] = (byte) (index % 251);
    return value;
  }

  @Test public void keepsRendererCommandsAndFinalCutInOrderAcrossBlocks() {
    byte[] header = {0x1b, 0x40, 0x1b, 0x61, 0, 0x1d, 0x4c, 0, 0, 0x1b, 0x33, 24};
    byte[] drawer = {0x1b, 0x70, 0, 25, (byte) 250};
    byte[] buzzerAndCut = {0x1b, 0x42, 2, 3, 0x1d, 0x56, 1};
    ByteArrayOutputStream source = new ByteArrayOutputStream();
    source.write(header, 0, header.length); source.write(drawer, 0, drawer.length);
    byte[] image = raster(72, 16); source.write(image, 0, image.length);
    source.write(image, 0, image.length); source.write(buzzerAndCut, 0, buzzerAndCut.length);
    List<byte[]> blocks = SunmiEscposChunks.split(source.toByteArray(), 1200);
    ByteArrayOutputStream joined = new ByteArrayOutputStream();
    for (byte[] block : blocks) { assertTrue(block.length <= 1200); joined.write(block, 0, block.length); }
    assertArrayEquals(source.toByteArray(), joined.toByteArray());
    assertArrayEquals(buzzerAndCut, Arrays.copyOfRange(blocks.get(blocks.size() - 1), blocks.get(blocks.size() - 1).length - 7, blocks.get(blocks.size() - 1).length));
  }

  @Test public void splitsOversizedRasterOnlyAtWholeRowsWithoutChangingPixels() {
    byte[] image = raster(72, 2000);
    List<byte[]> blocks = SunmiEscposChunks.split(image, 128 * 1024);
    assertEquals(2, blocks.size());
    ByteArrayOutputStream pixels = new ByteArrayOutputStream();
    int rows = 0;
    for (byte[] block : blocks) {
      assertTrue(block.length <= 128 * 1024);
      assertEquals(0x1d, block[0]); assertEquals(0x76, block[1]);
      int bandRows = (block[6] & 0xff) | ((block[7] & 0xff) << 8);
      rows += bandRows; assertEquals(8 + 72 * bandRows, block.length);
      pixels.write(block, 8, block.length - 8);
    }
    assertEquals(2000, rows);
    assertArrayEquals(Arrays.copyOfRange(image, 8, image.length), pixels.toByteArray());
  }

  @Test public void preservesLengthDelimitedQrAndGraphicsAndShortUnknownCommands() {
    byte[] qr = {0x1d, 0x28, 0x6b, 3, 0, 49, 65, 50};
    assertArrayEquals(qr, SunmiEscposChunks.split(qr, 16).get(0));
    byte[] vendor = {0x1b, 0x7f, 0x30, 0x31};
    assertArrayEquals(vendor, SunmiEscposChunks.split(vendor, 16).get(0));
  }

  @Test public void rejectsTruncatedRasterAndUnsafeGiantVendorCommandsBeforeAnyWrite() {
    byte[] image = raster(72, 16);
    assertThrows(IllegalArgumentException.class, () -> SunmiEscposChunks.split(Arrays.copyOf(image, image.length - 1), 128 * 1024));
    byte[] unknown = new byte[2000]; unknown[0] = 0x1b; unknown[1] = 0x7f;
    assertThrows(IllegalArgumentException.class, () -> SunmiEscposChunks.split(unknown, 1200));
    assertThrows(IllegalArgumentException.class, () -> SunmiEscposChunks.split(new byte[] {0x1d, 0x28, 0x6b, 4, 0, 1}, 16));
  }
}
