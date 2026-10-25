import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const liff = vi.hoisted(() => ({
  init: vi.fn().mockResolvedValue(undefined),
  isLoggedIn: vi.fn().mockReturnValue(true),
  login: vi.fn(),
  getIDToken: vi.fn().mockReturnValue("fixture-id-token"),
  getProfile: vi.fn().mockResolvedValue({ displayName: "ผู้ใช้ทดสอบ" }),
  getFriendship: vi.fn().mockResolvedValue({ friendFlag: true }),
}));
vi.mock("@line/liff", () => ({ default: liff }));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("VITE_DEMO_MODE", "false");
  vi.stubEnv("VITE_LINE_LIFF_ID", "fixture-liff-id");
  vi.stubGlobal("window", {
    location: {
      href: "https://equipment.example.invalid/booking.html?id=fixture",
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("LIFF integration without any live identity requests", () => {
  it("times out an unavailable LINE service and permits a later retry", async () => {
    vi.useFakeTimers();
    liff.init.mockImplementationOnce(() => new Promise(() => {}));
    const line = await import("./line");
    const initialized = line.initializeLine();
    const rejected = expect(initialized).rejects.toThrow(
      "LINE_CONNECTION_TIMEOUT",
    );
    await vi.waitFor(() => expect(liff.init).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(10000);
    await rejected;
    await line.initializeLine();
    expect(liff.init).toHaveBeenCalledTimes(2);
  });
  it("never initializes or logs into LINE in demo mode", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    const line = await import("./line");
    expect(line.lineEnabled).toBe(false);
    await expect(line.lineSession(true)).rejects.toThrow();
    expect(liff.init).not.toHaveBeenCalled();
    expect(liff.login).not.toHaveBeenCalled();
  });
  it("initializes once for redirects and preserves legacy booking parameters on explicit login", async () => {
    const line = await import("./line");
    await line.initializeLine();
    liff.isLoggedIn.mockReturnValueOnce(false);
    expect(await line.lineSession(true)).toBeNull();
    expect(liff.login).toHaveBeenCalledWith({
      redirectUri: window.location.href,
    });
    expect(await line.lineSession()).toEqual({
      idToken: "fixture-id-token",
      displayName: "ผู้ใช้ทดสอบ",
      friend: true,
    });
    expect(liff.init).toHaveBeenCalledTimes(1);
  });
  it("requires friendship and submits the fresh token only to the same-origin booking endpoint", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(Response.json({ bookingId: "fixture" }));
    vi.stubGlobal("fetch", request);
    const line = await import("./line");
    liff.getFriendship.mockResolvedValueOnce({ friendFlag: false });
    await expect(
      line.createLineBooking({ requestId: "fixture" }),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    expect(await line.createLineBooking({ requestId: "fixture" })).toBe(
      "fixture",
    );
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("/api/line/bookings");
    expect(JSON.parse(options.body)).toEqual({
      requestId: "fixture",
      idToken: "fixture-id-token",
      lineConsent: true,
    });
  });
  it("does not fall back to an unlinked booking when LINE authentication expires", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );
    const line = await import("./line");
    await expect(line.createLineBooking({})).rejects.toThrow(/หมดอายุ/);
  });
  it("rejects non-LINE friend URLs", async () => {
    const line = await import("./line");
    for (const url of [
      "javascript:alert(1)",
      "https://line.me.attacker.invalid/",
      "http://line.me/",
    ]) {
      vi.stubEnv("VITE_LINE_OA_URL", url);
      expect(line.lineFriendUrl()).toBeNull();
    }
    vi.stubEnv("VITE_LINE_OA_URL", "https://lin.ee/fixture");
    expect(line.lineFriendUrl()).toBe("https://lin.ee/fixture");
  });
});
