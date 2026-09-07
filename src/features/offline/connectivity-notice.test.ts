import { describe, expect, it } from "vitest";
import { BACKEND_NETWORK_STATE, type BackendNetworkState } from "@/lib/network-state";
import { connectivityNoticeForState } from "./connectivity-notice";

describe("connectivity notices", () => {
  it.each([BACKEND_NETWORK_STATE.CHECKING, BACKEND_NETWORK_STATE.ONLINE])(
    "does not announce an outage or recovery on initial %s",
    (state) => expect(connectivityNoticeForState(state, false)).toBeNull(),
  );

  it("warns only for the confirmed OFFLINE verdict", () => {
    expect(connectivityNoticeForState(BACKEND_NETWORK_STATE.OFFLINE, false)).toBe("offline");
  });

  it("does not repeat the warning during the same outage, including locale rerenders", () => {
    expect(connectivityNoticeForState(BACKEND_NETWORK_STATE.OFFLINE, true)).toBeNull();
  });

  it("does not announce recovery while checking after an outage", () => {
    expect(connectivityNoticeForState(BACKEND_NETWORK_STATE.CHECKING, true)).toBeNull();
    expect(connectivityNoticeForState(BACKEND_NETWORK_STATE.ONLINE, true)).toBe("online");
  });

  it("announces each new outage once and only recovers on a confirmed response", () => {
    const sequence: BackendNetworkState[] = [
      "CHECKING", "ONLINE", "CHECKING", "OFFLINE", "OFFLINE", "CHECKING",
      "OFFLINE", "ONLINE", "ONLINE", "CHECKING", "OFFLINE", "ONLINE",
    ];
    let offlineNoticeShown = false;
    const notices: string[] = [];
    for (const state of sequence) {
      const notice = connectivityNoticeForState(state, offlineNoticeShown);
      if (!notice) continue;
      notices.push(notice);
      offlineNoticeShown = notice === "offline";
    }
    expect(notices).toEqual(["offline", "online", "offline", "online"]);
  });
});
