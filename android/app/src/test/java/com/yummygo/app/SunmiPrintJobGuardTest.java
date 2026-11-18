package com.yummygo.app;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import org.junit.Test;

public class SunmiPrintJobGuardTest {
  @Test public void healthyInFlightJobKeepsHostAvailableForQueuedWork() {
    assertTrue(SunmiPrintJobGuard.acceptsQueuedWork(1, false, false));
    assertTrue(SunmiPrintJobGuard.acceptsQueuedWork(1, true, false));
    assertTrue(SunmiPrintJobGuard.acceptsQueuedWork(1, false, true));
  }

  @Test public void unconfirmedPhysicalJobAndHardwareFaultsPauseQueueAdmission() {
    assertFalse(SunmiPrintJobGuard.acceptsQueuedWork(1, true, true));
    for (int state : new int[] {2, 3, 4, 5, 6, 7, 8, 9, 505}) {
      assertFalse(SunmiPrintJobGuard.acceptsQueuedWork(state, false, false));
      assertFalse(SunmiPrintJobGuard.acceptsQueuedWork(state, true, false));
      assertFalse(SunmiPrintJobGuard.acceptsQueuedWork(state, true, true));
    }
  }

  @Test public void knownPrintedPayloadReplaysButUnknownPayloadNeverRetries() {
    String hash = SunmiPrintJobGuard.hash(new byte[] {1, 2, 3});
    assertEquals(SunmiPrintJobGuard.Decision.NEW, SunmiPrintJobGuard.decide(null, false, hash));
    assertEquals(SunmiPrintJobGuard.Decision.PRINTED, SunmiPrintJobGuard.decide(hash, true, hash));
    assertEquals(SunmiPrintJobGuard.Decision.UNKNOWN, SunmiPrintJobGuard.decide(hash, false, hash));
    assertEquals(SunmiPrintJobGuard.Decision.CONFLICT, SunmiPrintJobGuard.decide(hash, true, "changed"));
    assertEquals(SunmiPrintJobGuard.Decision.CONFLICT, SunmiPrintJobGuard.decide(hash, false, "changed"));
  }

  @Test public void fingerprintIncludesExactBytesAndJobKeysIncludePhysicalOwner() {
    assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", SunmiPrintJobGuard.hash("abc".getBytes(StandardCharsets.UTF_8)));
    assertNotEquals(SunmiPrintJobGuard.hash(new byte[] {1, 2}), SunmiPrintJobGuard.hash(new byte[] {2, 1}));
    assertNotEquals(SunmiPrintJobGuard.jobKey("android-native-one", "job-1"), SunmiPrintJobGuard.jobKey("android-native-two", "job-1"));
    assertNotEquals(SunmiPrintJobGuard.jobKey("android-native-one", "job-1"), SunmiPrintJobGuard.jobKey("android-native-one", "job-2"));
  }

  @Test public void rejectsInvalidOrUnboundedIdsAndNonCanonicalBase64Shapes() {
    assertTrue(SunmiPrintJobGuard.validJobId("invoice:550e8400-e29b-41d4-a716-446655440000:item-1"));
    assertFalse(SunmiPrintJobGuard.validJobId(null));
    assertFalse(SunmiPrintJobGuard.validJobId(""));
    assertFalse(SunmiPrintJobGuard.validJobId("../receipt"));
    assertFalse(SunmiPrintJobGuard.validJobId(new String(new char[257]).replace('\0', 'a')));
    assertTrue(SunmiPrintJobGuard.validBase64("G0A="));
    assertFalse(SunmiPrintJobGuard.validBase64("G0A"));
    assertFalse(SunmiPrintJobGuard.validBase64("G0A=\n"));
    assertFalse(SunmiPrintJobGuard.validBase64("G0A?"));
    assertFalse(SunmiPrintJobGuard.validBase64(new String(new char[SunmiPrintJobGuard.MAX_BASE64_CHARS + 4]).replace('\0', 'a')));
  }
}
